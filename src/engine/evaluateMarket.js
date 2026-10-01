/**
 * 시장 평가 파이프라인 (순수 함수)
 *   10개 지표 측정 → -2~+2 점수 → 총점 → 가격/위험 필터 → 4단계 국면 → 바닥 탐색 → 신뢰도
 * 외부 I/O 없음. 입력은 Dataset + 기준일(day) + config.
 */
import { computeAllIndicators } from '../indicators/index.js';
import { scoreAll } from '../scoring/indicatorScore.js';
import { totalScore } from '../scoring/totalScore.js';
import { phaseForScore, capPhase, minPhase, priceGateCap } from '../scoring/marketPhase.js';
import { computePriceInfo, deepestDrawdown } from '../scoring/priceFilter.js';
import { evaluateRiskOverride } from '../scoring/riskOverride.js';
import { detectBottomingSetup } from '../scoring/bottomingSetup.js';
import { evaluateConfidence } from '../scoring/confidence.js';
import { phaseByKey } from '../config.js';
import { toStr } from '../data/series.js';

export function evaluateMarket(ds, day, cfg) {
  const measures = computeAllIndicators(ds, day, cfg);
  const scored = scoreAll(measures, cfg);
  const ts = totalScore(scored, cfg);

  const prices = {
    sp500: computePriceInfo(ds.series.SP500, 'S&P 500', day, cfg),
    nasdaq100: computePriceInfo(ds.series.NASDAQ100, 'Nasdaq 100', day, cfg),
  };
  const priceList = [prices.sp500, prices.nasdaq100];
  return assembleState({ day, measures, scored, ts, prices, priceList }, cfg);
}

/** 점수/가격/측정값이 이미 있을 때 판정 로직만 수행 (테스트용으로도 사용) */
export function assembleState({ day, measures, scored, ts, prices, priceList }, cfg) {
  const deepest = deepestDrawdown(priceList);
  const drawdown = deepest ? deepest.drawdown : NaN;

  const override = evaluateRiskOverride({ measures, prices: priceList }, cfg);
  const confidence = evaluateConfidence({ scored, prices: priceList }, cfg);
  const bottoming = detectBottomingSetup({ prices: priceList, scored, measures, override }, cfg);

  const rawPhase = phaseForScore(ts.total, cfg);
  let phase = rawPhase;
  const caps = [];
  if (override.maxPhase) {
    const capped = capPhase(phase, override.maxPhase, cfg);
    if (capped.rank < phase.rank) caps.push({ type: 'RISK_OVERRIDE', label: override.status || '급락 구간: VIX·HY 동시 급등', maxPhase: override.maxPhase });
    phase = capped;
  }
  const gate = priceGateCap(drawdown, cfg);
  if (gate) {
    const capped = capPhase(phase, gate.maxPhase, cfg);
    if (capped.rank < phase.rank) caps.push({ type: 'PRICE_FILTER', label: gate.label, maxPhase: gate.maxPhase });
    phase = capped;
  }
  const suppressed = phase.rank < rawPhase.rank;
  let status = phase.label;
  if (override.hard) status = cfg.override.statusText;

  return {
    date: day === undefined ? null : toStr(day), day,
    total: ts.total, totalInfo: ts,
    rawPhaseKey: rawPhase.key, phaseKey: phase.key, phase,
    suppressed, caps, status,
    drawdown, drawdownBand: deepest ? deepest.band : null, drawdownSymbol: deepest ? deepest.symbol : null,
    prices, measures, scored,
    bottoming, override, confidence,
    dataUnavailable: ts.unavailable.length > 0,
    dataNote: ts.unavailable.length ? '데이터 부족으로 종합점수 신뢰도 저하' : '',
  };
}
