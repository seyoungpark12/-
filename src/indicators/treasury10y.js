/** ① 미국 10년물 국채금리 지표 계산 (점수화는 scoring/indicatorScore.js) */
import { obs, back, unavailable, origin, component, f, sg } from './common.js';
import { maxRange } from '../data/series.js';

export function computeY10(ds, day, cfg) {
  const o = obs(ds, 'DGS10', day, cfg);
  if (!o) return unavailable('y10', '10년물 국채금리 데이터를 사용할 수 없음');
  const c = cfg.y10;
  const v = o.v;
  const prev1 = back(o, 1), prev5 = back(o, 5), prev20 = back(o, 20);
  if (!Number.isFinite(prev20)) return unavailable('y10', '10년물 이력 부족(20일 미만)');
  const d1 = (v - prev1) * 100, d5 = (v - prev5) * 100, d20 = (v - prev20) * 100;
  const high = maxRange(o.s.v, o.i - c.lookbackHigh + 1, o.i);
  const fromHigh = (v - high) * 100;
  const ro = obs(ds, 'DFII10', day, cfg);
  const realD20 = ro && Number.isFinite(back(ro, 20)) ? (ro.v - back(ro, 20)) * 100 : NaN;

  const components = [component('10년물 명목금리', o, `${f(v)}% (전일 ${sg(d1, 0)}bp · 5일 ${sg(d5, 0)}bp · 20일 ${sg(d20, 0)}bp)`)];
  components.push(component(`최근 ${c.lookbackHigh}거래일 고점 대비`, o, `${f(high)}% 대비 ${sg(fromHigh, 0)}bp`));
  if (ro) components.push(component('10년 실질금리(TIPS)', ro, `${f(ro.v)}% (20일 ${sg(realD20, 0)}bp)`));

  return {
    key: 'y10', available: true,
    value: v, previous: prev1, previousLabel: '전일', change1m: v - prev20, change1mLabel: '20거래일', unit: '%',
    valueText: `${f(v)}%`, previousText: `${f(prev1)}%`, change1mText: `${sg(d20, 0)}bp`,
    details: { d1, d5, d20, high, fromHigh, realYield: ro ? ro.v : NaN, realD20 },
    components, seriesIds: ['DGS10'], proxy: false,
    ...origin(o),
  };
}
