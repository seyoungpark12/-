/**
 * 매일 답해야 하는 5개 질문 + 최종 반환(MARKET_PHASE, TOTAL_SCORE, SCORE_CHANGE, DRAWDOWN, BOTTOMING_SETUP, RISK_OVERRIDE, CONFIDENCE).
 * 모든 문장은 규칙 기반 템플릿이며 LLM 이 점수를 결정하지 않는다.
 */
import { phaseByKey } from '../config.js';
import { buildJudgement } from '../alerts/marketAlert.js';

const pct = (x) => (Number.isFinite(x) ? `${(x * 100).toFixed(1)}%` : 'n/a');

export function dailyAnswers(state, history, cfg) {
  const s = state.scored, m = state.measures;
  const get = (k) => (s[k] && s[k].available ? s[k] : null);

  // Q1 조정 정도
  const sp = state.prices.sp500, nq = state.prices.nasdaq100;
  const q1 = (state.drawdownSymbol)
    ? `S&P 500 ${sp.available ? `고점 대비 ${pct(sp.drawdown)}` : '가격 데이터 없음'}, Nasdaq 100 ${nq.available ? `고점 대비 ${pct(nq.drawdown)}` : '가격 데이터 없음'}. 시장 상태: ${state.drawdownBand} (가장 깊은 낙폭: ${state.drawdownSymbol}).`
    : '가격 데이터를 사용할 수 없어 조정 폭을 판단할 수 없습니다.';

  // Q2 거시환경 방향
  const macroKeys = ['inflation', 'fed', 'pmi', 'employment', 'y10'].map(get).filter(Boolean);
  const macroSum = macroKeys.reduce((a, r) => a + r.score, 0);
  const chg = history && history.change20 !== null && history.change20 !== undefined ? history.change20 : null;
  let q2;
  if (!macroKeys.length) q2 = '거시 지표 데이터가 부족해 판단할 수 없습니다.';
  else {
    const dir = macroSum >= 3 ? '악화 속도가 뚜렷하게 둔화되고 개선 신호가 늘고 있습니다' : macroSum >= 1 ? '악화 속도가 둔화되는 흐름입니다' : macroSum <= -3 ? '악화가 이어지고 있습니다' : macroSum <= -1 ? '악화 요인이 우세합니다' : '뚜렷한 방향성이 없습니다';
    q2 = `거시 5개 지표(금리·물가·Fed·PMI·고용) 점수 합 ${macroSum >= 0 ? '+' : ''}${macroSum}: ${dir}.` + (chg !== null ? ` 총점 20거래일 변화 ${chg >= 0 ? '+' : ''}${chg}.` : '');
  }

  // Q3 금융시장 스트레스
  const stress = ['hy', 'vix', 'dxy'].map(get).filter(Boolean);
  const stressSum = stress.reduce((a, r) => a + r.score, 0);
  let q3;
  if (state.override.hard) q3 = `금융 스트레스가 증가하며 안전장치가 작동 중입니다 (${state.override.reasons.join('; ')}).`;
  else if (state.override.combo) q3 = `VIX와 HY Spread가 동시에 급등해 스트레스가 증가하고 있습니다. 2차·적극적 매수 단계는 억제됩니다.`;
  else if (!stress.length) q3 = '스트레스 지표 데이터가 부족합니다.';
  else q3 = `HY·VIX·달러 점수 합 ${stressSum >= 0 ? '+' : ''}${stressSum}: ` + (stressSum >= 2 ? '금융시장 스트레스가 안정되고 있습니다.' : stressSum <= -2 ? '금융시장 스트레스가 증가하고 있습니다.' : '뚜렷한 스트레스 변화가 없습니다.');
  if (state.override.flags.length) q3 += ' ⚠ ' + state.override.flags.map(f => f.label).join(', ');

  // Q4 기업이익
  const eps = get('eps');
  let q4;
  if (!eps) q4 = 'Forward EPS 데이터가 입력되지 않아 기업이익 전망은 DATA_UNAVAILABLE 입니다 (수동 입력 필요).';
  else q4 = `${eps.reason}. ` + (eps.score >= 1 ? '하향세 종료/상향 흐름으로 바닥 형성 여부를 관찰할 수 있습니다.' : eps.score < 0 ? '하향 조정이 이어지고 있어 추가 확인이 필요합니다.' : '뚜렷한 방향 없이 횡보 중입니다.');

  // Q5 단계
  const ph = phaseByKey(cfg, state.phaseKey);
  let q5 = `${ph.emoji} ${state.override.hard ? cfg.override.statusText : ph.label} (총점 ${state.total}/20).`;
  if (state.suppressed) q5 += ` 점수 기준 단계는 "${phaseByKey(cfg, state.rawPhaseKey).label}" 이나 ${state.caps.map(c => c.label).join(', ')} 로 상향이 제한되었습니다.`;

  return {
    q1, q2, q3, q4, q5,
    judgement: buildJudgement(state),
  };
}

/** 최종 반환 객체 */
export function dailyResult(state, history, cfg) {
  return {
    MARKET_PHASE: state.phaseKey,
    MARKET_PHASE_LABEL: state.status,
    TOTAL_SCORE: state.total,
    SCORE_CHANGE: history ? history.change : null,
    DRAWDOWN: { SP500: state.prices.sp500.available ? state.prices.sp500.drawdown : null, NASDAQ100: state.prices.nasdaq100.available ? state.prices.nasdaq100.drawdown : null, DEEPEST: Number.isFinite(state.drawdown) ? state.drawdown : null },
    BOTTOMING_SETUP: state.bottoming.detected,
    RISK_OVERRIDE: state.override.level,
    CONFIDENCE: state.confidence.level,
  };
}
