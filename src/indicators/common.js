/** 지표 계산 공통 유틸 (순수 함수) */
import { idxAsOf, toStr } from '../data/series.js';

/**
 * 기준일(day) 시점에 '발표되어 있던' 가장 최근 관측치.
 * 너무 오래되었으면(staleDays × staleHardMultiple) null → DATA_UNAVAILABLE.
 */
export function obs(ds, id, day, cfg) {
  const s = ds.series[id];
  if (!s || !s.t.length) return null;
  const i = idxAsOf(s, day);
  if (i < 0) return null;
  const lag = s.meta.lagDays || 0;
  const staleDays = s.meta.staleDays || 7;
  const age = day - (s.t[i] + lag);
  const mult = (cfg && cfg.staleHardMultiple) || 4;
  if (age > staleDays * mult) return null;
  return { s, i, id, t: s.t[i], v: s.v[i], age, stale: age > staleDays, release: s.t[i] + lag };
}

/** n 개 관측치 이전 값 */
export function back(o, n) {
  const j = o.i - n;
  return j >= 0 ? o.s.v[j] : NaN;
}

export const pctChg = (a, b) => (Number.isFinite(a) && Number.isFinite(b) && b !== 0 ? (a / b - 1) * 100 : NaN);
export const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : 'n/a');
export const sg = (x, d = 2) => (Number.isFinite(x) ? (x > 0 ? '+' : '') + x.toFixed(d) : 'n/a');

export function periodOf(o) {
  const fr = o.s.meta.freq;
  const d = toStr(o.t);
  if (fr === 'monthly' || fr === 'manual') return d.slice(0, 7);
  if (fr === 'weekly') return `${d} 종료 주`;
  return d;
}

/** 출처/날짜 메타 */
export function origin(o) {
  return {
    obsDate: toStr(o.t),
    releaseDate: toStr(o.release),
    period: periodOf(o),
    stale: o.stale,
    source: o.s.meta.source,
    sourceUrl: o.s.meta.sourceUrl || '',
  };
}

export function component(label, o, valueText, extra = {}) {
  return { label, valueText, ...origin(o), ...extra };
}

export function unavailable(key, reason, extra = {}) {
  return { key, available: false, reason, stale: false, ...extra };
}

/** 여러 관측치 중 가장 오래된 기준일 / 하나라도 stale 이면 stale */
export function combineOrigins(list) {
  const valid = list.filter(Boolean);
  const oldest = valid.reduce((a, b) => (a.obsDate <= b.obsDate ? a : b));
  const newest = valid.reduce((a, b) => (a.obsDate >= b.obsDate ? a : b));
  return {
    obsDate: newest.obsDate,
    oldestObsDate: oldest.obsDate,
    releaseDate: valid.reduce((a, b) => (a.releaseDate >= b.releaseDate ? a : b)).releaseDate,
    period: newest.period,
    stale: valid.some(x => x.stale),
    source: [...new Set(valid.map(x => x.source))].join(' + '),
    sourceUrl: valid[0].sourceUrl,
  };
}
