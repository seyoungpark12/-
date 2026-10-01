import { computeY10 } from './treasury10y.js';
import { computeInflation } from './inflation.js';
import { computeFedExpectations } from './fedExpectations.js';
import { computePmi } from './pmi.js';
import { computeEmployment } from './employment.js';
import { computeCreditSpread } from './creditSpread.js';
import { computeVix } from './vix.js';
import { computeDxy } from './dxy.js';
import { computeEps } from './eps.js';
import { computeValuation } from './valuation.js';

export { INDICATOR_META } from './meta.js';

/** 기준일(day)의 10개 지표 원시 측정값 계산 (점수화 전) */
export function computeAllIndicators(ds, day, cfg) {
  return {
    y10: computeY10(ds, day, cfg),
    inflation: computeInflation(ds, day, cfg),
    fed: computeFedExpectations(ds, day, cfg),
    pmi: computePmi(ds, day, cfg),
    employment: computeEmployment(ds, day, cfg),
    hy: computeCreditSpread(ds, day, cfg),
    vix: computeVix(ds, day, cfg),
    dxy: computeDxy(ds, day, cfg),
    eps: computeEps(ds, day, cfg),
    valuation: computeValuation(ds, day, cfg),
  };
}
