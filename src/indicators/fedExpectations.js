/**
 * ③ Fed 금리 기대.
 * CME FedWatch 는 공개 API 가 없으므로 시장금리(6M·1Y·2Y 국채)의 20일 평균 변화를 '시장 내재 정책 기대' 프록시로 사용.
 * (adapter 를 추가하면 FedWatch 확률로 교체 가능 — 이 함수만 대체)
 */
import { obs, unavailable, origin, component, combineOrigins, f, sg } from './common.js';
import { mean } from '../data/series.js';

const TENORS = [['DGS6MO', '6개월물'], ['DGS1', '1년물'], ['DGS2', '2년물']];

export function computeFedExpectations(ds, day, cfg) {
  const c = cfg.fed;
  const comps = [], origins = [];
  let wSum = 0, dSum = 0;
  let spreadNow = NaN, spreadPrev = NaN;
  const dff = obs(ds, 'DFF', day, cfg);

  for (const [id, label] of TENORS) {
    const o = obs(ds, id, day, cfg);
    if (!o || o.i < 24) continue;
    const cur = mean(o.s.v.slice(o.i - 4, o.i + 1));
    const old = mean(o.s.v.slice(o.i - 24, o.i - 19));
    const delta = cur - old;
    const w = c.tenorWeights[id] || 1;
    wSum += w; dSum += w * delta;
    origins.push(origin(o));
    comps.push(component(`${label} 국채금리`, o, `${f(o.v)}% (20일 평균 변화 ${sg(delta)}%p)`, { delta }));
    if (id === 'DGS1' && dff) {
      spreadNow = o.v - dff.v;
      spreadPrev = o.s.v[o.i - 20] - (dff.i >= 20 ? dff.s.v[dff.i - 20] : NaN);
    }
  }
  if (comps.length < c.minTenors) return unavailable('fed', `정책금리 기대 산출용 국채 만기 ${comps.length}개만 사용 가능`);

  if (dff) {
    origins.push(origin(dff));
    comps.unshift(component('현재 Fed Funds(실효)', dff, `${f(dff.v)}%`));
  }
  const delta = dSum / wSum;
  const org = combineOrigins(origins);
  return {
    key: 'fed', available: true,
    value: Number.isFinite(spreadNow) ? spreadNow : delta, previous: spreadPrev, previousLabel: '20거래일 전', change1m: Number.isFinite(spreadNow) && Number.isFinite(spreadPrev) ? spreadNow - spreadPrev : delta, change1mLabel: '20거래일', unit: '%p',
    valueText: Number.isFinite(spreadNow) ? `1Y−FF 스프레드 ${sg(spreadNow)}%p` : `기대 변화 ${sg(delta)}%p`,
    previousText: Number.isFinite(spreadPrev) ? `${sg(spreadPrev)}%p` : 'n/a',
    change1mText: `금리 기대 ${sg(delta)}%p`,
    details: { delta, fedFunds: dff ? dff.v : NaN, spreadNow },
    components: comps, seriesIds: ['DGS2', 'DGS1', 'DGS6MO', 'DFF'], proxy: true,
    proxyNote: 'CME FedWatch 대신 국채 6M/1Y/2Y 금리 변화를 정책 기대 프록시로 사용',
    ...org,
  };
}
