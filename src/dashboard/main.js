/** 대시보드 진입점 */
import { loadDataset } from '../data/loader.js';
import { getActiveConfig, hasOverride } from '../configStore.js';
import { evaluateLatest, replayAsync } from '../engine/replay.js';
import { dailyResult } from '../engine/dailyReport.js';
import { renderHero, renderQA, renderCards, modalHtml, renderAlertPanel, renderDataStatus } from './render.js';
import { renderCharts, setRange, renderSpark } from './charts.js';
import { renderAllocation } from './allocation.js';
import { renderManualInput } from './manualInput.js';
import { inputPanelHtml, bindInputPanel } from './inlineInput.js';
import { toStr } from '../data/series.js';
import { $, esc, toast } from './ui.js';

const cfg = getActiveConfig();
let redrawManual = null;
let ds = null, view = null, fullRows = null, fullAlerts = null, sparkChart = null;

async function boot() {
  const root = new URL('../../', import.meta.url).href;
  try {
    ds = await loadDataset(root);
  } catch (e) {
    $('#loading').innerHTML = `<div class="error-box">데이터 로드 실패: ${esc(e)}</div>`;
    return;
  }
  if (!ds.series.VIXCLS || !ds.series.SP500) {
    $('#loading').innerHTML = `<div class="error-box">핵심 데이터(VIX/S&P 500)를 불러오지 못했습니다. 이 경우 점수를 임의로 만들지 않고 중단합니다.<br><span class="small">${esc(JSON.stringify(ds.loadErrors))}</span></div>`;
    return;
  }
  $('#loading').hidden = true; $('#app').hidden = false;
  if (hasOverride()) $('#cfg-note').hidden = false;
  recompute(true);
  bindStatic();
  computeHistoryCharts();
  // 페이지를 열어 둔 경우 4시간마다 저장소의 최신 스냅샷을 다시 읽어 재계산
  setInterval(refreshData, REFRESH_MS);
}

const REFRESH_MS = 4 * 60 * 60 * 1000;
const ROOT = new URL('../../', import.meta.url).href;
let updating = false, lastCheck = null, lastUpdateMsg = '';

const lastObsMap = (d) => Object.fromEntries(Object.values(d.series).filter(s => !s.meta.manual).map(s => [s.id, toStr(s.t[s.t.length - 1])]));

function renderUpdateBar() {
  const el = $('#update-status'); if (!el || !ds) return;
  const s = ds.source || {};
  const mode = s.remoteBase
    ? `원격 스냅샷 ${s.remote}개 · 배포본 ${s.bundled}개${s.remoteFailed && s.remoteFailed.length ? ` · 원격 읽기 실패 ${s.remoteFailed.length}개(배포본으로 대체)` : ''}`
    : '배포본 스냅샷 (자동 갱신 소스 미설정)';
  const mf = ds.manifest && ds.manifest.fetched_at ? ` · 스냅샷 생성 ${String(ds.manifest.fetched_at).slice(0, 16).replace('T', ' ')}` : '';
  const chk = lastCheck ? ` · 마지막 확인 ${lastCheck.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}` : '';
  el.innerHTML = `데이터 기준일 <b>${esc(view ? view.asOf : '')}</b> · ${esc(mode)}${esc(mf)}${esc(chk)}${lastUpdateMsg ? `<br><span style="color:var(--text)">${esc(lastUpdateMsg)}</span>` : ''}`;
}

/** 데이터 업데이트: 캐시를 우회해 최신 스냅샷(원격 → 배포본 순)을 다시 읽고 재계산. auto=true 면 변화가 있을 때만 알림 */
async function updateData({ auto = false } = {}) {
  if (updating) return;
  updating = true;
  const btn = $('#btn-update');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ 업데이트 중…'; }
  try {
    const before = lastObsMap(ds), oldAsOf = view.asOf;
    const next = await loadDataset(ROOT, { fresh: true });
    if (!next.series.VIXCLS || !next.series.SP500) throw new Error('핵심 데이터(VIX/S&P 500) 로드 실패 — 기존 데이터를 유지합니다');
    const after = lastObsMap(next);
    const changed = Object.keys(after).filter(k => before[k] !== after[k]);
    ds = next;
    lastCheck = new Date();
    recompute();
    if (changed.length) {
      lastUpdateMsg = `✅ ${changed.length}개 시계열이 새 관측일로 갱신되었습니다 (기준일 ${oldAsOf} → ${view.asOf}).`;
    } else {
      lastUpdateMsg = next.source && next.source.remoteBase
        ? 'ℹ 새로 발표된 데이터가 없습니다 (이미 최신 스냅샷입니다).'
        : 'ℹ 자동 갱신 소스가 설정되지 않아 배포본 스냅샷을 다시 읽었습니다. 새 데이터는 없습니다.';
    }
    renderUpdateBar();
    if (!auto || changed.length) toast(lastUpdateMsg.replace(/^\S+\s/, ''));
    await computeHistoryCharts();
  } catch (e) {
    lastUpdateMsg = '⚠ 업데이트 실패: ' + (e && e.message ? e.message : e) + ' — 기존 데이터를 그대로 표시합니다.';
    renderUpdateBar();
    toast('업데이트 실패 (기존 데이터 유지)');
  } finally {
    updating = false;
    if (btn) { btn.disabled = false; btn.textContent = '🔄 데이터 업데이트'; }
  }
}
const refreshData = () => updateData({ auto: true });

function recompute(first = false) {
  view = evaluateLatest(ds, cfg, { historyDays: 90 });
  const answers = renderHero($('#hero'), view, cfg);
  renderQA($('#qa'), answers);
  renderCards($('#cards'), view, cfg);
  renderAlertPanel($('#alert-panel'), view, cfg);
  renderDataStatus($('#data-status'), ds, view);
  renderUpdateBar();
  renderAllocation($('#alloc'), cfg, view.state.phaseKey);
  window.__MARKET_RESULT__ = dailyResult(view.state, view.history, cfg);
  window.__VIEW__ = view;
  if (first) redrawManual = renderManualInput($('#manual'), async () => { ds = await loadDataset(new URL('../../', import.meta.url).href); recompute(); computeHistoryCharts(); });
}

async function computeHistoryCharts() {
  const prog = $('#hist-progress'), bar = prog.firstElementChild;
  prog.hidden = false; $('#hist-note').textContent = '2016년 이후 일자별 점수를 point-in-time 방식으로 재계산 중…';
  const start = ds.series.SP500.t[0];
  const startStr = new Date((start + 260) * 86400000).toISOString().slice(0, 10); // 낙폭 계산용 이력 확보 이후부터
  const res = await replayAsync(ds, cfg, { start: startStr, step: 3, onProgress: (p) => { bar.style.width = (p * 100).toFixed(0) + '%'; } });
  fullRows = res.rows; fullAlerts = res.alerts;
  prog.hidden = true;
  $('#hist-note').textContent = `${fullRows[0].date} ~ ${fullRows[fullRows.length - 1].date} · 3거래일 간격 · ${fullRows.length.toLocaleString()}개 시점 (${Math.round(res.ms)}ms) · 알림 ${fullAlerts.length}회`;
  document.querySelectorAll('#chart-section .chart').forEach(el => { const inst = echarts.getInstanceByDom(el); if (inst) inst.dispose(); });
  renderCharts(ds, cfg, fullRows, fullAlerts);
  setRange(5, fullRows);
  document.body.dataset.chartsReady = '1';
}

function bindStatic() {
  document.addEventListener('click', (e) => {
    const card = e.target.closest('.icard');
    if (card) openModal(card.dataset.key);
    if (e.target.closest('[data-close]')) $('#modal').close();
    const rb = e.target.closest('[data-range]');
    if (rb) { setRange(+rb.dataset.range, fullRows); document.querySelectorAll('[data-range]').forEach(b => b.classList.toggle('primary', b === rb)); }
  });
  $('#modal').addEventListener('click', (e) => { if (e.target === $('#modal')) $('#modal').close(); });
  $('#modal').addEventListener('close', () => { if (sparkChart) { sparkChart.dispose(); sparkChart = null; } });
  $('#btn-update').addEventListener('click', () => updateData());
  $('#btn-copy-json').addEventListener('click', async () => {
    await navigator.clipboard.writeText(JSON.stringify(window.__MARKET_RESULT__, null, 2)).catch(() => {});
    toast('결과 JSON 을 복사했습니다');
  });
  $('#btn-export-tables').addEventListener('click', exportTables);
}

function openModal(key) {
  const m = $('#modal');
  if (sparkChart) { sparkChart.dispose(); sparkChart = null; }
  m.innerHTML = modalHtml(key, view, cfg);
  if (!m.open) m.showModal();
  const slot = $('#input-slot', m);
  if (slot) {
    slot.innerHTML = inputPanelHtml(key, ds);
    bindInputPanel(slot, key, async () => {
      ds = await loadDataset(new URL('../../', import.meta.url).href);
      recompute();
      if (redrawManual) redrawManual();
      openModal(key);
      computeHistoryCharts();
    });
  }
  const ids = view.state.scored[key].m && view.state.scored[key].m.seriesIds;
  const id = (ids && ids[0]) || null;
  if (id) sparkChart = renderSpark('modal-spark', ds, id);
}

/** 데이터베이스 테이블 구조(명세 29)에 맞춘 JSON 내보내기 */
function exportTables() {
  const st = view.state, h = view.history;
  const out = {
    market_scores: [{ date: st.date, total_score: st.total, market_phase: st.phaseKey, sp500_drawdown: st.prices.sp500.available ? st.prices.sp500.drawdown : null, nasdaq_drawdown: st.prices.nasdaq100.available ? st.prices.nasdaq100.drawdown : null, bottoming_setup: st.bottoming.detected, risk_override: st.override.level, confidence: st.confidence.level }],
    indicator_scores: Object.values(st.scored).map(r => ({ date: st.date, indicator: r.key, value: r.available ? r.m.valueText : null, score: r.score, status: r.status, reason: r.reason, confidence: st.confidence.level })),
    macro_indicators: Object.values(st.measures).filter(m => m.available).map(m => ({ indicator: m.key, date: m.obsDate, value: m.value, previous_value: m.previous, source: m.source, release_date: m.releaseDate, period: m.period })),
    alerts: view.alerts,
    result: window.__MARKET_RESULT__,
  };
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `market-signal-${st.date}.json`; a.click(); URL.revokeObjectURL(a.href);
}

boot();
