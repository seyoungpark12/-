/**
 * ④ PMI.
 * 1순위: ISM Manufacturing / Services (무료 공식 API 없음 → 수동 입력 ISM_MFG / ISM_SVC)
 * 2순위(프록시): 지역 연은 제조업 서베이(Philadelphia·Empire State) 3개월 이동평균의 3개월 변화
 */
import { obs, unavailable, origin, component, combineOrigins, f, sg } from './common.js';
import { monthIdx, mean } from '../data/series.js';

export function computePmi(ds, day, cfg) {
  const c = cfg.pmi;
  // ---- ISM (수동 입력) ----
  const ism = [];
  for (const [id, label] of [['ISM_MFG', 'ISM Manufacturing'], ['ISM_SVC', 'ISM Services']]) {
    const o = obs(ds, id, day, cfg);
    if (!o) continue;
    const j = monthIdx(o.s, o.i, 3, 45);
    if (j < 0) continue;
    const ch3 = o.v - o.s.v[j];
    const j1 = monthIdx(o.s, o.i, 1, 45);
    ism.push({ id, label, o, ch3, prev: j1 >= 0 ? o.s.v[j1] : NaN, ch1: j1 >= 0 ? o.v - o.s.v[j1] : NaN });
  }
  if (ism.length) {
    const change3 = mean(ism.map(x => x.ch3));
    const level = mean(ism.map(x => x.o.v));
    const comps = ism.map(x => component(x.label, x.o, `${f(x.o.v, 1)} (3개월 ${sg(x.ch3, 1)} · 50 ${x.o.v >= 50 ? '이상(확장)' : '미만(위축)'})`));
    const org = combineOrigins(ism.map(x => origin(x.o)));
    const p = ism[0];
    return {
      key: 'pmi', available: true, proxy: false,
      value: p.o.v, previous: p.prev, previousLabel: '전월', change1m: p.ch1, change1mLabel: '1개월', unit: 'pt',
      valueText: ism.map(x => `${x.label.replace('ISM ', '')} ${f(x.o.v, 1)}`).join(' · '),
      previousText: f(p.prev, 1), change1mText: sg(p.ch1, 1),
      details: { change3, level, source: 'ISM' },
      components: comps, seriesIds: ['ISM_MFG', 'ISM_SVC'], ...org,
    };
  }

  // ---- 지역 연은 프록시 ----
  const reg = [];
  for (const [id, label] of [['PHILLY', '필라델피아 연은 제조업'], ['EMPIRE', '뉴욕 연은 Empire State']]) {
    const o = obs(ds, id, day, cfg);
    if (!o || o.i < 6) continue;
    const ma = (i) => mean(o.s.v.slice(i - 2, i + 1));
    const j = monthIdx(o.s, o.i, 3, 45);
    if (j < 2) continue;
    const ma0 = ma(o.i), ma3 = ma(j);
    reg.push({ label, o, ma0, ch3: ma0 - ma3 });
  }
  if (!reg.length) return unavailable('pmi', 'ISM 미입력 + 지역 연은 서베이도 사용 불가');
  const change3 = mean(reg.map(x => x.ch3));
  const level = mean(reg.map(x => x.ma0));
  const comps = reg.map(x => component(x.label, x.o, `현재 ${f(x.o.v, 1)} · 3개월 이동평균 ${f(x.ma0, 1)} (3개월 변화 ${sg(x.ch3, 1)})`));
  const org = combineOrigins(reg.map(x => origin(x.o)));
  const p = reg[0];
  const prevV = p.o.s.v[p.o.i - 1];
  return {
    key: 'pmi', available: true, proxy: true,
    proxyNote: 'ISM PMI 미입력 → 지역 연은 제조업 서베이(Philly/Empire) 프록시. ISM 값을 수동 입력하면 자동 대체됨',
    value: level, previous: prevV, previousLabel: '전월(개별 서베이)', change1m: change3, change1mLabel: '3개월(이동평균)', unit: 'pt',
    valueText: `지역연은 3M평균 ${f(level, 1)} (프록시)`,
    previousText: f(prevV, 1), change1mText: `3개월 ${sg(change3, 1)}`,
    details: { change3, level, source: 'REGIONAL' },
    components: comps, seriesIds: ['PHILLY', 'EMPIRE'], ...org,
  };
}
