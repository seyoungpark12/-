/** 백테스트 페이지 진입점 */
import { loadDataset } from '../data/loader.js';
import { CONFIG, mergeConfig, phaseByKey } from '../config.js';
import { readOverride, writeOverride, getActiveConfig } from '../configStore.js';
import { replayAsync } from '../engine/replay.js';
import { episodeAnalysis, phaseForwardStats, pickPriceSeries } from './analyze.js';
import { esc, $, fmtPct, toast } from '../dashboard/ui.js';
import { toDay, toStr, idxAtOrBefore } from '../data/series.js';

let ds = null, cfg = getActiveConfig(), result = null;
const charts = [];

async function boot() {
  ds = await loadDataset(new URL('../../', import.meta.url).href);
  $('#loading').hidden = true; $('#app').hidden = false;
  $('#cfg-text').value = JSON.stringify(readOverride() || {}, null, 2);
  $('#cfg-defaults').textContent = JSON.stringify({ weights: CONFIG.weights, phases: CONFIG.phases.map(p => ({ key: p.key, minScore: p.minScore })), priceGate: CONFIG.priceGate, override: CONFIG.override, bottoming: CONFIG.bottoming, hy: CONFIG.hy, vix: CONFIG.vix, y10: CONFIG.y10 }, null, 2);
  $('#btn-run').addEventListener('click', run);
  $('#btn-apply').addEventListener('click', applyOverride);
  $('#btn-reset').addEventListener('click', () => { writeOverride(null); $('#cfg-text').value = '{}'; cfg = getActiveConfig(); toast('기본 파라미터로 초기화'); run(); });
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-ep]'); if (b) document.getElementById('ep-' + b.dataset.ep)?.scrollIntoView({ behavior: 'smooth' }); });
  window.addEventListener('resize', () => charts.forEach(c => c.resize()));
  run();
}

function applyOverride() {
  let o;
  try { o = JSON.parse($('#cfg-text').value || '{}'); } catch (e) { toast('JSON 형식 오류: ' + e.message, 4000); return; }
  writeOverride(Object.keys(o).length ? o : null);
  cfg = getActiveConfig();
  toast('파라미터 적용 — 백테스트를 다시 실행합니다');
  run();
}

async function run() {
  const step = +$('#sel-step').value;
  const prog = $('#bt-progress'); const bar = prog.firstElementChild;
  prog.hidden = false; bar.style.width = '0%';
  $('#bt-status').textContent = '실행 중… (point-in-time 일자별 재계산)';
  $('#bt-out').innerHTML = '';
  charts.splice(0).forEach(c => c.dispose());
  const start = $('#sel-start').value;
  const res = await replayAsync(ds, cfg, { start, step, onProgress: (p) => { bar.style.width = (p * 100).toFixed(0) + '%'; } });
  result = res;
  prog.hidden = true;
  $('#bt-status').innerHTML = `${res.rows[0].date} ~ ${res.rows[res.rows.length - 1].date} · ${step}거래일 간격 · ${res.rows.length.toLocaleString()}개 시점 · ${(res.ms / 1000).toFixed(1)}초 · 알림 ${res.alerts.length}회` + (JSON.stringify(readOverride() || {}) !== '{}' ? ' · <b style="color:#fbbf24">⚙ 파라미터 오버라이드 적용 중</b>' : ' · 기본 파라미터');
  render(res);
  document.body.dataset.btReady = '1';
}

const pc = (x, d = 1) => (Number.isFinite(x) ? `${(x * 100).toFixed(d)}%` : 'n/a');

function render(res) {
  const eps = cfg.backtest.episodes.map(ep => episodeAnalysis(ds, cfg, res.rows, ep));
  const out = $('#bt-out');
  let html = '';
  // 요약 표
  html += `<section class="section"><div class="section-head"><h2>에피소드 요약</h2><span class="muted small">행을 클릭하면 상세로 이동</span></div>
    <div class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>구간</th><th>유형</th><th>낙폭</th><th>첫 1차 신호</th><th>신호 시점 낙폭</th><th>저점 대비</th><th>안전장치(H/C)</th><th>점수 개선(저점 ±30일)</th><th>알림</th><th>판정</th></tr></thead><tbody>
    ${eps.map(e => {
      if (!e.available) return `<tr><td>${esc(e.ep.name)}</td><td colspan="9" class="muted">${esc(e.reason)}</td></tr>`;
      const f = e.firstBuy1;
      const warn = e.findings.filter(x => x.level === 'warn' || x.level === 'bad').length, ok = e.findings.filter(x => x.level === 'ok').length;
      return `<tr style="cursor:pointer" data-ep="${e.ep.id}"><td><b>${esc(e.ep.name)}</b></td><td>${e.ep.type === 'bull' ? '상승장' : '조정/약세'}</td><td class="mono">${pc(e.maxDD)}</td>
        <td class="mono">${f ? esc(f.date) : '—'}</td><td class="mono">${f ? pc(f.ddFromPeak) : '—'}</td>
        <td class="mono">${f ? (f.beforeTrough ? `저점 ${f.daysToTrough}일 전 (추가 ${pc(-f.furtherDrop)})` : `저점 후 +${pc(f.aboveTrough)}`) : '—'}</td>
        <td class="mono">${e.override.hardDays} / ${e.override.comboDays}</td>
        <td class="mono">${e.score.improvement30 === null ? 'n/a' : (e.score.improvement30 > 0 ? '+' : '') + e.score.improvement30}</td>
        <td class="mono">${e.alerts.length}</td>
        <td><span style="color:#4ade80">✔${ok}</span> <span style="color:#fbbf24">⚠${warn}</span></td></tr>`;
    }).join('')}</tbody></table></div></div></section>`;

  // 에피소드 카드
  html += `<section class="section"><div class="section-head"><h2>에피소드별 분석</h2><span class="muted small">가격(좌) · 점수(우, 계단선) · 🔔 알림 · 음영: 안전장치(빨강 HARD / 주황 COMBO) · 초록 점: 바닥 탐색 가능 구간</span></div>`;
  eps.forEach((e) => { html += episodeCard(e); });
  html += `</section>`;

  // 단계별 통계
  const px = pickStatsInstrument();
  const pfs = px ? phaseForwardStats(ds, cfg, res.rows, px) : null;
  html += `<section class="section"><div class="section-head"><h2>단계별 이후 수익률 (참고)</h2><span class="muted small">${pfs ? esc(px === 'NASDAQ100' ? 'Nasdaq 100 기준 (전 구간 이력 보유)' : 'S&P 500 기준') : ''} · 연속 시점이 겹쳐 통계적으로 독립이 아니며, 목적은 단계별 위험·반등 특성 확인(수익 극대화 아님)</span></div>
    <div class="panel">${pfs ? phaseTable(pfs) : '<span class="muted">가격 데이터 없음</span>'}</div></section>`;
  out.innerHTML = html;

  eps.forEach((e) => { if (e.available) drawEpisodeChart(e, res); });
}

function pickStatsInstrument() { return ds.series.NASDAQ100 ? 'NASDAQ100' : (ds.series.SP500 ? 'SP500' : null); }

function phaseTable(pfs) {
  const ns = cfg.backtest.fwdDays;
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>단계</th><th>시점 수</th><th>평균 낙폭</th>${ns.map(n => `<th>+${n}일 평균 / 중앙값 / 승률 / 최악</th>`).join('')}</tr></thead><tbody>
    ${cfg.phases.map(p => { const s = pfs.stats[p.key]; return `<tr><td style="color:${p.color}"><b>${p.emoji} ${esc(p.label)}</b></td><td class="mono">${s.n}</td><td class="mono">${pc(s.avgDD)}</td>${ns.map(n => { const f = s.fwd[n]; return `<td class="mono">${f.n ? `${pc(f.mean)} / ${pc(f.median)} / ${pc(f.hit, 0)} / ${pc(f.worst)}` : 'n/a'}</td>`; }).join('')}</tr>`; }).join('')}
    </tbody></table></div>`;
}

function episodeCard(e) {
  if (!e.available) return `<div class="ep-card"><h3>${esc(e.ep.name)}</h3><div class="muted">${esc(e.reason)}</div></div>`;
  const stat = (l, n, d) => `<div class="stat"><div class="l">${esc(l)}</div><div class="n">${n}</div><div class="d">${d || ''}</div></div>`;
  const bull = e.ep.type === 'bull';
  return `<div class="ep-card" id="ep-${e.ep.id}">
    <div class="ep-head"><h3>${esc(e.ep.name)}</h3><span class="muted small">${esc(e.ep.start)} ~ ${esc(e.ep.end)} · 가격: ${esc(e.price.label)}</span></div>
    <div id="epc-${e.ep.id}" class="chart tall"></div>
    <div class="stat-grid">
      ${stat('구간 최대 낙폭', pc(e.maxDD), `고점 ${esc(e.peak.date)} → 저점 ${esc(e.trough.date)}`)}
      ${stat('최고 / 최저 점수', `${e.score.max ? e.score.max.total : 'n/a'} / ${e.score.min ? e.score.min.total : 'n/a'}`, `사용 가능 지표가 적은 과거 구간은 점수 범위가 좁음`)}
      ${bull ? '' : stat('저점 -30일 → +30일 점수', `${e.score.troughM30 ?? 'n/a'} → ${e.score.troughP30 ?? 'n/a'}`, e.score.improvement30 === null ? '' : `개선폭 ${e.score.improvement30 > 0 ? '+' : ''}${e.score.improvement30}`)}
      ${stat('1차 이상 단계 비중', pc(e.buy1PlusShare, 0), `2차 이상 ${pc(e.buy2PlusShare, 0)} · 저점 전 ${e.buy1Before} / 후 ${e.buy1After}`)}
      ${stat('알림 발생', `${e.alerts.length}회`, e.alerts.slice(0, 3).map(a => `${esc(a.date)} ${esc(a.label)}`).join('<br>'))}
      ${stat('바닥 탐색 가능 구간', `${e.bottoming.count}개 시점`, e.bottoming.first ? `첫 감지 ${esc(e.bottoming.first.date)}` : '미감지')}
      ${bull ? '' : stat('회복', e.recovery.rec10 ? `+10% ${esc(e.recovery.rec10)}` : '미도달', `+20% ${esc(e.recovery.rec20 || '미도달')} · 전고점 ${esc(e.recovery.recPeak || '미회복')}`)}
    </div>
    ${e.findings.map(f => `<div class="finding ${f.level}">${f.level === 'ok' ? '✔' : f.level === 'warn' ? '⚠' : f.level === 'bad' ? '✘' : 'ⓘ'} ${esc(f.text)}</div>`).join('')}
  </div>`;
}

function drawEpisodeChart(e, res) {
  const el = document.getElementById('epc-' + e.ep.id);
  if (!el) return;
  const a = toDay(e.ep.start), b = toDay(e.ep.end);
  const px = pickPriceSeries(ds, a);
  const S = px.series;
  const rows = res.rows.filter(r => r.day >= a && r.day <= b);
  const price = []; for (let i = 0; i < S.t.length; i++) if (S.t[i] >= a && S.t[i] <= b) price.push([toStr(S.t[i]), S.v[i]]);
  // 안전장치 구간 음영
  const areas = []; let cur = null;
  rows.forEach((r, i) => {
    const kind = r.override === 'HARD' ? 'HARD' : r.override === 'COMBO' ? 'COMBO' : null;
    if (kind && (!cur || cur.kind !== kind)) { if (cur) { cur.end = r.date; areas.push(cur); } cur = { kind, start: r.date, end: r.date }; }
    else if (!kind && cur) { cur.end = r.date; areas.push(cur); cur = null; }
    else if (cur) cur.end = r.date;
  });
  if (cur) areas.push(cur);
  const markArea = { silent: true, data: areas.map(x => [{ xAxis: x.start, itemStyle: { color: x.kind === 'HARD' ? 'rgba(239,68,68,.18)' : 'rgba(245,158,11,.14)' } }, { xAxis: x.end }]) };
  const alertPts = e.alerts.map(al => ({ name: al.label, coord: [al.date, al.price], value: al.total, itemStyle: { color: phaseByKey(cfg, al.phaseKey).color } }));
  const botPts = rows.filter(r => r.bottoming).map(r => ({ coord: [r.date, r.total], symbol: 'circle', symbolSize: 7, itemStyle: { color: '#22c55e' } }));
  const trough = { name: '가격 저점', xAxis: e.trough.date };
  const peak = { name: '고점', xAxis: e.peak.date };
  const c = echarts.init(el);
  c.setOption({
    backgroundColor: 'transparent', animation: false, textStyle: { color: '#9fb0d8' },
    grid: { left: 54, right: 46, top: 30, bottom: 50 },
    legend: { top: 0, textStyle: { color: '#9fb0d8' }, data: [px.label.split(' (')[0], '종합점수'] },
    tooltip: { trigger: 'axis', backgroundColor: '#0e1630', borderColor: '#3b5fd0', textStyle: { color: '#e8ecf8', fontSize: 12 } },
    xAxis: { type: 'time', axisLine: { lineStyle: { color: '#26335a' } }, axisLabel: { color: '#9fb0d8' } },
    yAxis: [
      { type: 'log', scale: true, axisLabel: { color: '#9fb0d8' }, splitLine: { lineStyle: { color: '#26335a', opacity: .4 } } },
      { type: 'value', min: -20, max: 20, interval: 10, axisLabel: { color: '#9fb0d8' }, splitLine: { show: false } },
    ],
    dataZoom: [{ type: 'inside', filterMode: 'none' }, { type: 'slider', height: 16, bottom: 6, borderColor: '#26335a', backgroundColor: '#0e1630', textStyle: { color: '#9fb0d8' }, filterMode: 'none' }],
    series: [
      { name: px.label.split(' (')[0], type: 'line', showSymbol: false, data: price, lineStyle: { width: 1.4, color: '#7aa2ff' }, markArea,
        markLine: { symbol: 'none', silent: true, label: { color: '#9fb0d8', fontSize: 10 }, lineStyle: { color: '#94a3b8', type: 'dashed' }, data: [peak, trough] },
        markPoint: { symbol: 'pin', symbolSize: 32, label: { color: '#000', fontSize: 10, formatter: '🔔' }, data: alertPts } },
      { name: '종합점수', type: 'line', yAxisIndex: 1, step: 'end', showSymbol: false, data: rows.map(r => [r.date, r.total]), lineStyle: { width: 1.3, color: '#f59e0b' },
        markLine: { symbol: 'none', silent: true, label: { show: false }, lineStyle: { type: 'dotted', color: '#475569' }, data: cfg.phases.filter(p => p.rank >= 2).map(p => ({ yAxis: p.minScore })) },
        markPoint: { data: botPts, label: { show: false } } },
    ],
  });
  charts.push(c);
}

boot();
