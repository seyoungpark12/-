/**
 * Dataset 구성 (순수): CSV 텍스트 맵 + 수동 입력 → { series, manual }
 * 브라우저 로딩(fetch)은 src/data/loader.js 에서 담당 (외부 I/O 와 계산 분리).
 */
import { DATASETS, MANUAL_SERIES } from './registry.js';
import { makeSeries } from './series.js';
import { parseFredCsv } from './providers/fred.js';

/** manual: { ISM_MFG:[{date,value,source,release_date,period}], ISM_SVC, FWD_EPS, FWD_PE, peBench:{avg5y,avg10y,high52w,low52w,as_of,source} } */
export function buildDataset(csvTexts, manual = {}) {
  const series = {};
  const missing = [];
  for (const key of Object.keys(DATASETS)) {
    const def = DATASETS[key];
    const text = csvTexts[key];
    if (!text) { missing.push(key); continue; }
    const rows = parseFredCsv(text);
    if (rows.length === 0) { missing.push(key); continue; }
    series[key] = makeSeries(key, rows, def);
  }
  for (const key of Object.keys(MANUAL_SERIES)) {
    const arr = (manual[key] || []).filter(r => r && r.date && Number.isFinite(+r.value)).map(r => ({ date: r.date, value: +r.value }));
    if (arr.length === 0) continue;
    arr.sort((a, b) => (a.date < b.date ? -1 : 1));
    const src = (manual[key].find(r => r.source) || {}).source || '사용자 직접 입력';
    series[key] = makeSeries(key, arr, { ...MANUAL_SERIES[key], id: key, source: src, sourceUrl: '', freq: 'manual', manual: true });
  }
  return { series, manual, missing };
}

export function lastDate(ds, ids) {
  let best = -Infinity;
  for (const id of ids) {
    const s = ds.series[id];
    if (s && s.t.length) best = Math.max(best, s.t[s.t.length - 1]);
  }
  return best;
}
