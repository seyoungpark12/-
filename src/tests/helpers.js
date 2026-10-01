/** 테스트 헬퍼: 합성 지표 점수/가격/측정값으로 판정 로직(assembleState)을 검증 */
import { CONFIG } from '../config.js';
import { assembleState } from '../engine/evaluateMarket.js';
import { totalScore } from '../scoring/totalScore.js';
import { classifyDrawdown } from '../scoring/priceFilter.js';

export const cfg = CONFIG;
export const KEYS = CONFIG.indicatorOrder;

/** 지표 점수 객체 생성 (scores: 길이 10 배열, null 이면 결측) */
export function mkScored(scores, over = {}) {
  const out = {};
  KEYS.forEach((k, i) => {
    const s = scores[i];
    out[k] = s === null || s === undefined
      ? { key: k, available: false, score: null, status: 'DATA_UNAVAILABLE', reason: '데이터 없음', tag: '데이터 없음', stale: false, m: { available: false } }
      : { key: k, available: true, score: s, status: 'OK', reason: `test ${s}`, tag: `${k} ${s > 0 ? '개선' : s < 0 ? '위험' : '중립'}`, stale: false, proxy: false, m: { available: true }, ...(over[k] || {}) };
  });
  return out;
}

/** 합계가 total 이 되는 10개 점수 배열 (각 -2..2) */
export function scoresForTotal(total) {
  const arr = new Array(10).fill(0);
  let rem = total;
  for (let i = 0; i < 10 && rem !== 0; i++) { const s = Math.max(-2, Math.min(2, rem)); arr[i] = s; rem -= s; }
  if (rem !== 0) throw new Error('total out of range: ' + total);
  return arr;
}

export function mkPrice(symbol, dd, { newLows = 0, available = true } = {}) {
  if (!available) return { symbol, available: false, reason: '가격 없음' };
  return {
    symbol, available: true, stale: false, close: 100 * (1 + dd), high: 100, drawdown: dd, band: classifyDrawdown(dd, cfg),
    makingNewLows: newLows >= cfg.price.newLowCount, newLows,
    ma20: 100, ma50: 100, ma200: 100, aboveMa20: false, aboveMa50: false, aboveMa200: false,
  };
}

/** 합성 측정값 (override/bottoming 판정에 쓰이는 세부 값) */
export function mkMeasures(o = {}) {
  const vix = { available: true, value: 20, details: { d5: 0, d10: 0, d20: 0, peak: 20, peakRatio: 1, surge: false, sustainedSurge: false }, ...(o.vix || {}) };
  if (o.vix && o.vix.details) vix.details = { ...{ d5: 0, d10: 0, d20: 0, peak: 20, peakRatio: 1, surge: false, sustainedSurge: false }, ...o.vix.details };
  const hyBase = { d5: 0, d20: 0, d60: 0, peak: 3, nearPeak: 1, trough: 3, risen: 0, surge: false, sustainedSurge: false, stabilized: false, scale: 1 };
  const hy = { available: true, value: 3, proxy: false, details: { ...hyBase, ...((o.hy && o.hy.details) || {}) } };
  const y10 = { available: true, value: 4, details: { d1: 0, d5: 0, d20: 0, high: 4, fromHigh: 0, realD20: NaN, ...((o.y10 && o.y10.details) || {}) } };
  const dxy = { available: true, value: 120, details: { d5: 0, d20: 0, d60: 0, ...((o.dxy && o.dxy.details) || {}) } };
  const eps = o.eps === null ? { available: false } : { available: true, value: 250, details: { rev1: 0, rev3: 0, rev1Prev: 0, growth: 0, ...((o.eps && o.eps.details) || {}) } };
  return { vix, hy, y10, dxy, eps, ...(o.raw || {}) };
}

/**
 * 시장 상태 합성.
 * opts: { total, scores, spDd, nqDd, spNewLows, nqNewLows, measures, scoredOver, priceUnavailable }
 */
export function mkState(opts = {}) {
  const scores = opts.scores || scoresForTotal(opts.total === undefined ? 0 : opts.total);
  const scored = mkScored(scores, opts.scoredOver);
  const ts = totalScore(scored, cfg);
  const spDd = opts.spDd === undefined ? -0.12 : opts.spDd;
  const nqDd = opts.nqDd === undefined ? -0.14 : opts.nqDd;
  const sp = mkPrice('S&P 500', spDd, { newLows: opts.spNewLows || 0, available: !opts.priceUnavailable });
  const nq = mkPrice('Nasdaq 100', nqDd, { newLows: opts.nqNewLows || 0, available: !opts.priceUnavailable });
  return assembleState({ day: undefined, measures: mkMeasures(opts.measures), scored, ts, prices: { sp500: sp, nasdaq100: nq }, priceList: [sp, nq] }, cfg);
}
