/**
 * 리플레이 (과거 일자별 점수 재계산). point-in-time 방식: 각 기준일에 '그 시점에 발표되어 있던' 데이터만 사용.
 * 대시보드 차트와 백테스트가 공통으로 사용한다.
 */
import { evaluateMarket } from './evaluateMarket.js';
import { evaluateAlert } from '../alerts/marketAlert.js';
import { scoreHistoryStats } from '../scoring/totalScore.js';
import { toDay, toStr, idxAtOrBefore } from '../data/series.js';

/** 거래일 캘린더: 기준 시계열(VIX) 관측일 중 [start, end] */
export function tradingDays(ds, startStr, endStr) {
  const s = ds.series.VIXCLS;
  if (!s) return [];
  const a = toDay(startStr), b = endStr ? toDay(endStr) : Infinity;
  const days = [];
  for (let i = 0; i < s.t.length; i++) if (s.t[i] >= a && s.t[i] <= b) days.push(s.t[i]);
  return days;
}

function pickDays(ds, cfg, { start, end, step = 1 }) {
  const days = tradingDays(ds, start || cfg.replay.start, end);
  const picked = [];
  for (let k = 0; k < days.length; k += step) picked.push(days[k]);
  if (days.length && picked[picked.length - 1] !== days[days.length - 1]) picked.push(days[days.length - 1]);
  return picked;
}

function rowOf(st, al, keepFull) {
  const row = {
    date: st.date, day: st.day,
    total: st.total, availableCount: st.totalInfo.availableCount,
    phaseKey: st.phaseKey, rawPhaseKey: st.rawPhaseKey, suppressed: st.suppressed,
    sp: st.prices.sp500.available ? st.prices.sp500.close : null,
    nq: st.prices.nasdaq100.available ? st.prices.nasdaq100.close : null,
    spDd: st.prices.sp500.available ? st.prices.sp500.drawdown : null,
    nqDd: st.prices.nasdaq100.available ? st.prices.nasdaq100.drawdown : null,
    drawdown: Number.isFinite(st.drawdown) ? st.drawdown : null,
    bottoming: st.bottoming.detected, override: st.override.level,
    confidence: st.confidence.level,
    scores: Object.fromEntries(Object.entries(st.scored).map(([k, r]) => [k, r.available ? r.score : null])),
    alert: al.fire ? 1 : 0, alertBlocked: al.blockedBy,
  };
  if (keepFull) row.state = st;
  return row;
}

/**
 * @param step  N 거래일마다 평가 (1 = 매일). 마지막 날은 항상 포함.
 * @param keepFull 각 일자의 전체 상태(지표 상세 포함) 보관 여부 (메모리 절약용)
 */
export function replay(ds, cfg, opts = {}) {
  const picked = pickDays(ds, cfg, opts);
  const rows = [], alerts = [];
  let prev = null, last = null;
  for (const day of picked) {
    const st = evaluateMarket(ds, day, cfg);
    const al = evaluateAlert(prev, st, cfg);
    rows.push(rowOf(st, al, opts.keepFull));
    if (al.fire) alerts.push({ ...al.record, date: st.date });
    prev = { phaseKey: st.phaseKey, total: st.total };
    last = st;
  }
  return { rows, alerts, last };
}

/** UI 가 멈추지 않도록 일정 간격으로 이벤트 루프에 양보하는 비동기 버전 */
export async function replayAsync(ds, cfg, opts = {}) {
  const picked = pickDays(ds, cfg, opts);
  const rows = [], alerts = [];
  let prev = null, last = null;
  const t0 = (typeof performance !== 'undefined' ? performance.now() : 0);
  let sliceStart = t0;
  for (let n = 0; n < picked.length; n++) {
    const st = evaluateMarket(ds, picked[n], cfg);
    const al = evaluateAlert(prev, st, cfg);
    rows.push(rowOf(st, al, opts.keepFull));
    if (al.fire) alerts.push({ ...al.record, date: st.date });
    prev = { phaseKey: st.phaseKey, total: st.total };
    last = st;
    const now = performance.now();
    if (now - sliceStart > 40) {
      if (opts.onProgress) opts.onProgress((n + 1) / picked.length);
      await new Promise(r => setTimeout(r, 0));
      sliceStart = performance.now();
    }
  }
  if (opts.onProgress) opts.onProgress(1);
  return { rows, alerts, last, ms: performance.now() - t0 };
}

/** 점수 이력 통계(rows 기준). */
export function historyFromRows(rows, cfg, idx) {
  const totals = rows.map(r => r.total);
  return scoreHistoryStats(totals, idx === undefined ? rows.length - 1 : idx, cfg);
}

/** 기준일 전체 상태 + 이력 + 직전 거래일 대비 (대시보드 '오늘' 상태용) */
export function evaluateLatest(ds, cfg, { historyDays = 90 } = {}) {
  const s = ds.series.VIXCLS;
  if (!s || !s.t.length) return null;
  const endDay = s.t[s.t.length - 1];
  const startIdx = Math.max(0, s.t.length - historyDays);
  const res = replay(ds, cfg, { start: toStr(s.t[startIdx]), end: toStr(endDay), step: 1 });
  const state = evaluateMarket(ds, endDay, cfg);
  const rows = res.rows;
  const hist = historyFromRows(rows, cfg);
  const prevRow = rows.length >= 2 ? rows[rows.length - 2] : null;
  const prev = prevRow ? { phaseKey: prevRow.phaseKey, total: prevRow.total } : null;
  const alert = evaluateAlert(prev, state, cfg);
  return { state, history: hist, prev, alert, rows, alerts: res.alerts, asOf: toStr(endDay) };
}

export { idxAtOrBefore };
