/**
 * ⑧ 달러지수. ICE DXY 는 무료 공식 API 가 없어 Federal Reserve 광의 달러지수(DTWEXBGS)를 프록시로 사용.
 */
import { obs, back, pctChg, unavailable, origin, component, f, sg } from './common.js';

export function computeDxy(ds, day, cfg) {
  const o = obs(ds, 'DTWEXBGS', day, cfg);
  if (!o || o.i < 25) return unavailable('dxy', '달러지수 데이터를 사용할 수 없음');
  const v = o.v;
  const d5 = pctChg(v, back(o, 5)), d20 = pctChg(v, back(o, 20)), d60 = pctChg(v, back(o, 60));
  return {
    key: 'dxy', available: true, proxy: true,
    proxyNote: 'ICE DXY 대신 Fed 광의 달러지수(DTWEXBGS)를 사용 — 방향성은 유사하나 수치는 다름',
    value: v, previous: back(o, 1), previousLabel: '전일', change1m: v - back(o, 20), change1mLabel: '20거래일', unit: 'idx',
    valueText: f(v), previousText: f(back(o, 1)), change1mText: `${sg(d20)}%`,
    details: { d5, d20, d60 },
    components: [component('광의 달러지수', o, `${f(v)} (5일 ${sg(d5)}% · 20일 ${sg(d20)}% · 60일 ${sg(d60)}%)`)],
    seriesIds: ['DTWEXBGS'], ...origin(o),
  };
}
