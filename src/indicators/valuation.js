/**
 * ⑩ S&P 500 Forward PER (수동 입력 FWD_PE + 선택적 벤치마크).
 * 벤치마크(5y/10y 평균, 52주 고/저)는 직접 입력하거나, 입력 이력이 충분하면 시계열에서 계산.
 */
import { obs, unavailable, origin, component, f, sg } from './common.js';
import { mean } from '../data/series.js';

export function computeValuation(ds, day, cfg) {
  const o = obs(ds, 'FWD_PE', day, cfg);
  if (!o) return unavailable('valuation', 'Forward PER 미입력 (수동 입력 필요)');
  const c = cfg.valuation;
  const b = (ds.manual && ds.manual.peBench) || null;
  let avg5 = b && +b.avg5y, avg10 = b && +b.avg10y, hi = b && +b.high52w, lo = b && +b.low52w;
  let benchSource = b ? (b.source || '수동 입력 벤치마크') : '';
  if (!Number.isFinite(avg5) && !Number.isFinite(avg10) && o.i + 1 >= c.minHistoryPoints) {
    const vals = o.s.v.slice(0, o.i + 1);
    avg5 = mean(vals); hi = Math.max(...vals.slice(-52)); lo = Math.min(...vals.slice(-52));
    benchSource = '입력된 Forward PER 이력에서 계산';
  }
  const refs = [avg10, avg5].filter(Number.isFinite);
  if (!refs.length) return unavailable('valuation', '5년/10년 평균 PER 벤치마크 없음 (수동 입력 필요)', { partialValue: o.v });
  const ref = mean(refs);
  const premium = o.v / ref - 1;
  const dropFromHigh = Number.isFinite(hi) ? o.v / hi - 1 : NaN;
  const risenFromLow = Number.isFinite(lo) ? o.v / lo - 1 : NaN;
  return {
    key: 'valuation', available: true, proxy: false,
    value: o.v, previous: NaN, previousLabel: '', change1m: NaN, change1mLabel: '', unit: 'x',
    valueText: `${f(o.v, 1)}x`, previousText: 'n/a', change1mText: `평균 대비 ${sg(premium * 100, 1)}%`,
    details: { premium, dropFromHigh, risenFromLow, ref, avg5, avg10, hi, lo },
    components: [
      component('Forward PER', o, `${f(o.v, 1)}x (평균 ${f(ref, 1)}x 대비 ${sg(premium * 100, 1)}%)`),
      { label: '벤치마크', valueText: `5y ${f(avg5, 1)} · 10y ${f(avg10, 1)} · 52주 고 ${f(hi, 1)} · 저 ${f(lo, 1)}`, obsDate: '', releaseDate: '', period: '', stale: false, source: benchSource, sourceUrl: '' },
    ],
    seriesIds: ['FWD_PE'], ...origin(o),
  };
}
