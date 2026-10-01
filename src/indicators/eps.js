/**
 * ⑨ S&P 500 Forward EPS 전망 (수동 입력 FWD_EPS).
 * 무료 공식 API 가 없으므로 값이 없으면 DATA_UNAVAILABLE (0점으로 대체하지 않음).
 */
import { obs, unavailable, origin, component, pctChg, f, sg } from './common.js';
import { monthIdx } from '../data/series.js';

export function computeEps(ds, day, cfg) {
  const o = obs(ds, 'FWD_EPS', day, cfg);
  if (!o) return unavailable('eps', 'Forward EPS 미입력 (수동 입력 필요: FactSet/S&P Global 등)');
  const c = cfg.eps;
  if (o.i + 1 < c.minPoints) return unavailable('eps', `Forward EPS 입력 ${o.i + 1}건 — 리비전 계산에는 최소 ${c.minPoints}건 필요`);
  const TOL = 12;
  const j1 = monthIdx(o.s, o.i, 1, TOL), j2 = monthIdx(o.s, o.i, 2, TOL), j3 = monthIdx(o.s, o.i, 3, TOL), j12 = monthIdx(o.s, o.i, 12, 20);
  const rev1 = j1 >= 0 ? pctChg(o.v, o.s.v[j1]) : NaN;
  const rev3 = j3 >= 0 ? pctChg(o.v, o.s.v[j3]) : NaN;
  const rev1Prev = j1 >= 0 && j2 >= 0 ? pctChg(o.s.v[j1], o.s.v[j2]) : NaN;
  const growth = j12 >= 0 ? pctChg(o.v, o.s.v[j12]) : NaN;
  if (!Number.isFinite(rev1) && !Number.isFinite(rev3)) return unavailable('eps', '1개월/3개월 전 EPS 값이 없어 리비전 계산 불가');
  return {
    key: 'eps', available: true, proxy: false,
    value: o.v, previous: j1 >= 0 ? o.s.v[j1] : NaN, previousLabel: '1개월 전', change1m: rev1, change1mLabel: '1개월', unit: '$',
    valueText: `$${f(o.v)}`, previousText: j1 >= 0 ? `$${f(o.s.v[j1])}` : 'n/a', change1mText: `${sg(rev1)}%`,
    details: { rev1, rev3, rev1Prev, growth },
    components: [component('Forward EPS', o, `$${f(o.v)} (1M ${sg(rev1)}% · 3M ${sg(rev3)}% · YoY ${sg(growth)}%)`)],
    seriesIds: ['FWD_EPS'], ...origin(o),
  };
}
