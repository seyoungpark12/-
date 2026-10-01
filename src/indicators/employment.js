/** ⑤ 고용: 침체형 급격한 악화 vs 과열 완화(정상 둔화) 판별용 지표 계산 */
import { obs, unavailable, origin, component, combineOrigins, f, sg } from './common.js';
import { mean, monthIdx } from '../data/series.js';

export function computeEmployment(ds, day, cfg) {
  const comps = [], origins = [];
  const d = {};
  const add = (o, label, text, extra) => { origins.push(origin(o)); comps.push(component(label, o, text, extra)); };

  // 실업률 (Sahm 방식)
  const ur = obs(ds, 'UNRATE', day, cfg);
  if (ur && ur.i >= 16) {
    const ma = (k) => mean(ur.s.v.slice(k - 2, k + 1));
    const cur = ma(ur.i);
    let mn = Infinity;
    for (let k = ur.i - 12; k < ur.i; k++) mn = Math.min(mn, ma(k));
    d.sahm = cur - mn;
    const j3 = monthIdx(ur.s, ur.i, 3, 5);
    d.urChange3 = j3 >= 0 ? ur.v - ur.s.v[j3] : NaN;
    d.ur = ur.v; d.urPrev = ur.s.v[ur.i - 1];
    add(ur, '실업률', `${f(ur.v, 1)}% (Sahm 갭 ${sg(d.sahm)}%p · 3개월 ${sg(d.urChange3, 1)}%p)`);
  }
  // 비농업 고용
  const pay = obs(ds, 'PAYEMS', day, cfg);
  if (pay && pay.i >= 6) {
    d.pay1 = pay.v - pay.s.v[pay.i - 1];
    d.pay3 = (pay.v - pay.s.v[pay.i - 3]) / 3;
    d.pay6 = (pay.v - pay.s.v[pay.i - 6]) / 6;
    add(pay, '비농업 고용', `전월비 ${sg(d.pay1, 0)}천명 · 3개월 평균 ${sg(d.pay3, 0)}천명/월`);
  }
  // 신규 청구
  const ic = obs(ds, 'ICSA', day, cfg);
  if (ic && ic.i >= 30) {
    const a4 = (k) => mean(ic.s.v.slice(k - 3, k + 1));
    d.claims4 = a4(ic.i);
    d.claimsGrowth = d.claims4 / a4(ic.i - 13) - 1;
    d.claimsPeakDrop = d.claims4 / Math.max(...Array.from({ length: 26 }, (_, n) => a4(ic.i - n))) - 1;
    add(ic, '신규 실업수당 청구', `4주 평균 ${f(d.claims4 / 1000, 0)}k (13주 전 대비 ${sg(d.claimsGrowth * 100, 1)}%)`);
  }
  // 연속 청구
  const cc = obs(ds, 'CCSA', day, cfg);
  if (cc && cc.i >= 30) {
    const a4 = (k) => mean(cc.s.v.slice(k - 3, k + 1));
    d.cont4 = a4(cc.i);
    d.contGrowth = d.cont4 / a4(cc.i - 13) - 1;
    add(cc, '연속 실업수당 청구', `4주 평균 ${f(d.cont4 / 1000, 0)}k (13주 전 대비 ${sg(d.contGrowth * 100, 1)}%)`);
  }
  // 임금
  const w = obs(ds, 'CES0500000003', day, cfg);
  if (w && w.i >= 18) {
    d.wageYoy = (w.v / w.s.v[w.i - 12] - 1) * 100;
    d.wage3m = (Math.pow(w.v / w.s.v[w.i - 3], 4) - 1) * 100;
    d.wageYoy6 = (w.s.v[w.i - 6] / w.s.v[w.i - 18] - 1) * 100;
    add(w, '임금상승률(시간당)', `YoY ${f(d.wageYoy)}% · 3개월 연율 ${f(d.wage3m)}%`);
  }

  const groups = ['sahm', 'pay3', 'claimsGrowth', 'contGrowth', 'wageYoy'].filter(k => Number.isFinite(d[k])).length;
  if (groups < 3 || !Number.isFinite(d.sahm) && !Number.isFinite(d.claimsGrowth)) {
    return unavailable('employment', `고용 데이터 ${groups}/5 만 사용 가능(최소 3개 + 실업률 또는 청구건수 필요)`);
  }
  const org = combineOrigins(origins);
  const main = ur || pay;
  return {
    key: 'employment', available: true, proxy: false,
    value: Number.isFinite(d.ur) ? d.ur : d.pay3,
    previous: Number.isFinite(d.urPrev) ? d.urPrev : NaN, previousLabel: '전월', change1m: Number.isFinite(d.urPrev) ? d.ur - d.urPrev : NaN, change1mLabel: '1개월', unit: '%',
    valueText: [Number.isFinite(d.ur) ? `실업률 ${f(d.ur, 1)}%` : null, Number.isFinite(d.pay3) ? `NFP 3M평균 ${sg(d.pay3, 0)}천` : null, Number.isFinite(d.claims4) ? `청구 ${f(d.claims4 / 1000, 0)}k` : null].filter(Boolean).join(' · '),
    previousText: Number.isFinite(d.urPrev) ? `실업률 ${f(d.urPrev, 1)}%` : 'n/a',
    change1mText: Number.isFinite(d.urPrev) ? `실업률 ${sg(d.ur - d.urPrev, 1)}%p` : 'n/a',
    details: d, components: comps, seriesIds: ['UNRATE', 'PAYEMS', 'ICSA', 'CCSA', 'CES0500000003'],
    ...org, _main: main ? 1 : 0,
  };
}
