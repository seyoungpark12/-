/**
 * ⑥ High Yield Credit Spread.
 * 우선: ICE BofA US HY OAS (FRED BAMLH0A0HYM2, 무료 제공은 최근 3년).
 * OAS 이력이 부족한 과거 시점(백테스트)에는 Baa−10Y 스프레드를 프록시로 사용하고 임계값 비율을 proxyScale 만큼 축소.
 */
import { obs, back, unavailable, origin, component, f, sg } from './common.js';
import { maxRange, minRange } from '../data/series.js';

export function computeCreditSpread(ds, day, cfg) {
  const c = cfg.hy;
  let o = obs(ds, 'BAMLH0A0HYM2', day, cfg);
  let proxy = false;
  if (!o || o.i < c.minHistory) {
    const p = obs(ds, 'BAA10Y', day, cfg);
    if (p && p.i >= c.minHistory) { o = p; proxy = true; }
    else if (!o) return unavailable('hy', 'HY 스프레드 데이터를 사용할 수 없음');
    else return unavailable('hy', 'HY 스프레드 이력 부족');
  }
  const v = o.v;
  const ratio = (a, b) => (Number.isFinite(b) && b !== 0 ? a / b - 1 : NaN);
  const d5 = ratio(v, back(o, 5)), d20 = ratio(v, back(o, 20)), d60 = ratio(v, back(o, 60));
  const peakWin = 60;
  const peak = maxRange(o.s.v, o.i - peakWin + 1, o.i);
  const peakIdx = (() => { for (let k = o.i; k > o.i - peakWin; k--) if (o.s.v[k] === peak) return k; return o.i; })();
  const trough = minRange(o.s.v, Math.max(0, peakIdx - 60), peakIdx);
  const risen = ratio(peak, trough);
  const nearPeak = v / peak;
  const scale = proxy ? c.proxyScale : 1;
  const surge = d5 >= c.surge5 * scale || d20 >= c.surge20 * scale;
  const sustainedSurge = d20 >= c.sustainedD20 * scale && nearPeak >= c.sustainedNearPeak;
  const stabilized = risen >= c.risenMin * scale && nearPeak < c.stabBelowPeak && d5 <= c.stabD5Max * scale;

  const label = proxy ? 'Baa−10Y 스프레드(프록시)' : 'HY OAS';
  const comps = [
    component(label, o, `${f(v)}%p (5일 ${sg(d5 * 100, 1)}% · 20일 ${sg(d20 * 100, 1)}% · 60일 ${sg(d60 * 100, 1)}%)`),
    component('최근 60일 고점 대비', o, `고점 ${f(peak)}%p 대비 ${sg((nearPeak - 1) * 100, 1)}%`),
  ];
  return {
    key: 'hy', available: true, proxy,
    proxyNote: proxy ? 'HY OAS 이력이 부족한 과거 구간 → Moody\'s Baa−10Y 스프레드를 프록시로 사용' : undefined,
    value: v, previous: back(o, 1), previousLabel: '전일', change1m: v - back(o, 20), change1mLabel: '20거래일', unit: '%p',
    valueText: `${f(v)}%p${proxy ? ' (프록시)' : ''}`, previousText: `${f(back(o, 1))}%p`, change1mText: `${sg(v - back(o, 20))}%p (${sg(d20 * 100, 1)}%)`,
    details: { d5, d20, d60, peak, nearPeak, trough, risen, surge, sustainedSurge, stabilized, scale },
    components: comps, seriesIds: [proxy ? 'BAA10Y' : 'BAMLH0A0HYM2'], ...origin(o),
  };
}
