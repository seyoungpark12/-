/** ② CPI / PCE: Headline·Core 의 YoY 변화 방향(가속도) 계산 */
import { obs, unavailable, origin, component, combineOrigins, f, sg } from './common.js';
import { monthIdx } from '../data/series.js';

const SERIES = [
  { id: 'CPILFESL', label: 'Core CPI', w: 2 },
  { id: 'CPIAUCSL', label: 'Headline CPI', w: 1 },
  { id: 'PCEPILFE', label: 'Core PCE', w: 2 },
  { id: 'PCEPI', label: 'Headline PCE', w: 1 },
];

const TOL = 5; // 월 시계열은 매월 1일 기준 → 결측월이 있으면 NaN 처리(인접 월로 대체하지 않음)
function yoyAt(s, i) {
  if (i < 0) return NaN;
  const j = monthIdx(s, i, 12, TOL);
  return j < 0 ? NaN : (s.v[i] / s.v[j] - 1) * 100;
}

export function computeInflation(ds, day, cfg) {
  const comps = [];
  const origins = [];
  let wSum = 0, accSum = 0, prevW = 0, prevSum = 0;
  let momExcess = NaN;
  let primary = null;

  for (const def of SERIES) {
    const o = obs(ds, def.id, day, cfg);
    if (!o) continue;
    const s = o.s, i = o.i;
    const yoy0 = yoyAt(s, i);
    const i1 = monthIdx(s, i, 1, TOL), i3 = monthIdx(s, i, 3, TOL), i6 = monthIdx(s, i, 6, TOL);
    const yoy1 = yoyAt(s, i1), yoy3 = yoyAt(s, i3), yoy6 = yoyAt(s, i6);
    if (!Number.isFinite(yoy0) || !Number.isFinite(yoy3)) continue;
    const accel = yoy0 - yoy3;
    const prevAccel = Number.isFinite(yoy6) ? yoy3 - yoy6 : NaN;
    const mom = i1 >= 0 ? (s.v[i] / s.v[i1] - 1) * 100 : NaN;
    wSum += def.w; accSum += def.w * accel;
    if (Number.isFinite(prevAccel)) { prevW += def.w; prevSum += def.w * prevAccel; }
    if (def.id === 'CPILFESL' && i3 >= 0) {
      const ann3 = (Math.pow(s.v[i] / s.v[i3], 4) - 1) * 100;
      momExcess = ann3 - yoy0;
    }
    const org = origin(o);
    origins.push(org);
    comps.push(component(def.label, o, `YoY ${f(yoy0)}% (전월비 ${sg(mom)}% · 3개월 YoY 변화 ${sg(accel)}%p)`, { yoy: yoy0, yoy1, accel }));
    if (!primary) primary = { yoy0, yoy1, label: def.label, o };
  }
  if (comps.length < cfg.inflation.minSeries) return unavailable('inflation', `물가 시계열 ${comps.length}개만 사용 가능(최소 ${cfg.inflation.minSeries}개 필요)`);

  const avgAccel = accSum / wSum;
  const avgPrev = prevW ? prevSum / prevW : NaN;
  const org = combineOrigins(origins);
  return {
    key: 'inflation', available: true,
    value: primary.yoy0, previous: primary.yoy1, previousLabel: '전월', change1m: primary.yoy0 - primary.yoy1, change1mLabel: '1개월', unit: '% YoY',
    valueText: comps.map(c => `${c.label} ${f(c.yoy)}%`).join(' · '),
    previousText: `${primary.label} ${f(primary.yoy1)}%`,
    change1mText: `${sg(primary.yoy0 - primary.yoy1)}%p`,
    details: { avgAccel, avgPrev, momExcess },
    components: comps, seriesIds: ['CPILFESL', 'CPIAUCSL', 'PCEPILFE', 'PCEPI'], proxy: false,
    ...org,
  };
}
