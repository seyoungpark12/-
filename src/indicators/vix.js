/** ⑦ VIX: 공포의 극단 이후 안정 여부 */
import { obs, back, unavailable, origin, component, f, sg } from './common.js';
import { maxRange } from '../data/series.js';

export function computeVix(ds, day, cfg) {
  const o = obs(ds, 'VIXCLS', day, cfg);
  if (!o || o.i < 30) return unavailable('vix', 'VIX 데이터를 사용할 수 없음');
  const c = cfg.vix;
  const v = o.v;
  const ratio = (a, b) => (b ? a / b - 1 : NaN);
  const d5 = ratio(v, back(o, 5)), d10 = ratio(v, back(o, 10)), d20 = ratio(v, back(o, 20));
  const peak = maxRange(o.s.v, o.i - c.peakWindow + 1, o.i);
  const peakRatio = v / peak;
  const surge = d5 >= c.surge5 || d20 >= c.surge20;
  const sustainedSurge = v >= c.elevated && (d5 >= c.surge5 || d10 >= c.surge5) && peakRatio >= c.peakNear;
  const comps = [
    component('VIX 종가', o, `${f(v)} (5일 ${sg(d5 * 100, 1)}% · 20일 ${sg(d20 * 100, 1)}%)`),
    component(`최근 ${c.peakWindow}거래일 고점 대비`, o, `고점 ${f(peak)} 대비 ${sg((peakRatio - 1) * 100, 1)}%`),
  ];
  return {
    key: 'vix', available: true, proxy: false,
    value: v, previous: back(o, 1), previousLabel: '전일', change1m: v - back(o, 20), change1mLabel: '20거래일', unit: '',
    valueText: f(v), previousText: f(back(o, 1)), change1mText: sg(v - back(o, 20)),
    details: { d5, d10, d20, peak, peakRatio, surge, sustainedSurge },
    components: comps, seriesIds: ['VIXCLS'], ...origin(o),
  };
}
