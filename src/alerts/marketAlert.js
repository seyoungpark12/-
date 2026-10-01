/**
 * 단계 진입 알림 (순수 함수).
 *  - 이전 단계 → 현재 단계로 '처음 상승 진입'했을 때, 현재 단계가 cfg.alerts.minPhase(기본 1차) 이상이면 알림.
 *  - 가격/위험 필터로 단계 상승이 억제된 경우(suppressed), 또는 신뢰도 LOW 인 경우 알림 차단.
 *  - 문구는 "~하세요/~해야 합니다/바닥입니다/상승할 것입니다" 같은 단정 표현을 쓰지 않는다.
 */
import { phaseByKey } from '../config.js';

const sgn = (x) => (x === null || x === undefined ? 'n/a' : x > 0 ? `+${x}` : `${x}`);
const pct = (x) => (Number.isFinite(x) ? `${(x * 100).toFixed(1)}%` : 'n/a');

/**
 * prev: { phaseKey, total } | null  (직전 거래일의 '최종' 단계/점수)
 * cur : evaluateMarket 결과(MarketState)
 * 반환: { fire:boolean, blockedBy:string|null, entry:boolean, message:string|null, record }
 */
export function evaluateAlert(prev, cur, cfg) {
  const curPhase = phaseByKey(cfg, cur.phaseKey);
  const minRank = phaseByKey(cfg, cfg.alerts.minPhase).rank;
  const prevPhase = prev ? phaseByKey(cfg, prev.phaseKey) : null;
  const escalated = !!prevPhase && curPhase.rank > prevPhase.rank;
  const reachesAlertZone = curPhase.rank >= minRank;
  const crossedIntoAlertZone = escalated && reachesAlertZone;

  // 억제 사유 판단
  let blockedBy = null;
  const rawRank = phaseByKey(cfg, cur.rawPhaseKey).rank;
  const wouldHaveEscalated = !!prevPhase && rawRank > prevPhase.rank && rawRank >= minRank;
  if (crossedIntoAlertZone || wouldHaveEscalated) {
    if (cfg.alerts.blockOnLowConfidence && cur.confidence.level === 'LOW') blockedBy = 'LOW_CONFIDENCE';
    else if (!crossedIntoAlertZone && wouldHaveEscalated) blockedBy = cur.override.active ? 'RISK_OVERRIDE' : 'PRICE_FILTER';
  }
  const fire = crossedIntoAlertZone && !blockedBy;
  const message = fire ? buildAlertMessage(prev, cur, cfg) : null;
  return {
    fire, blockedBy, escalated, wouldHaveEscalated,
    message,
    record: fire ? {
      date: cur.date, previous_phase: prevPhase ? prevPhase.key : null, current_phase: curPhase.key,
      score: cur.total, message, sent: false,
    } : null,
  };
}

export function improvementsAndRisks(cur) {
  const improvements = [], risks = [];
  for (const k of Object.keys(cur.scored)) {
    const r = cur.scored[k];
    if (!r.available) continue;
    if (r.score > 0) improvements.push(`${r.tag}${r.stale ? ' (최신 발표값 기준)' : ''}`);
    else if (r.score < 0) risks.push(`${r.tag}${r.stale ? ' (최신 발표값 기준)' : ''}`);
  }
  // 약한 지표(0점)도 위험 요인으로 보강: PMI/EPS 등 명시적으로 확인이 필요한 항목
  for (const k of ['pmi', 'eps']) {
    const r = cur.scored[k];
    if (r && r.available && r.score === 0) risks.push(`${k === 'pmi' ? 'PMI 개선 확인 필요' : 'EPS 전망 개선 확인 필요'}`);
  }
  for (const k of Object.keys(cur.scored)) if (!cur.scored[k].available) risks.push(`${k} 데이터 없음`);
  return { improvements, risks };
}

export function buildJudgement(cur) {
  const pos = Object.values(cur.scored).filter(r => r.available && r.score > 0).length;
  const neg = Object.values(cur.scored).filter(r => r.available && r.score < 0).length;
  if (cur.override.hard) return '금융 스트레스 악화가 지속되는 구간으로, 점수가 높더라도 매수 단계 상향을 제한합니다. 추가 확인이 필요한 구간입니다.';
  if (neg > pos) return '거시환경 악화 요인이 개선 요인보다 많은 상태입니다. 추가 확인이 필요한 구간입니다.';
  if (pos > neg && neg > 0) return '거시환경 악화 속도가 둔화되고 있으나 완전한 개선 국면은 아닙니다.';
  if (pos > 0 && neg === 0) return '거시환경 개선 신호가 증가했으며 뚜렷한 위험 지표는 확인되지 않습니다.';
  return '거시환경이 뚜렷한 방향성 없이 혼조 상태입니다.';
}

export function buildAlertMessage(prev, cur, cfg) {
  const phase = phaseByKey(cfg, cur.phaseKey);
  const { improvements, risks } = improvementsAndRisks(cur);
  const dd = (p) => (p && p.available ? `고점 대비 ${(p.drawdown * 100).toFixed(1)}%` : '가격 데이터 없음');
  const lines = [
    '🔔 미국 지수 거시환경 알림', '',
    '현재 단계:', phase.label, '',
    '총점:', `${cur.total} / 20`, '',
    '전일:', prev ? `${prev.total} / 20` : 'n/a', '',
    '변화:', sgn(prev ? cur.total - prev.total : null), '',
    'S&P 500:', dd(cur.prices.sp500), '',
    'Nasdaq 100:', dd(cur.prices.nasdaq100), '',
    '주요 개선:', ...(improvements.length ? improvements.map(x => `- ${x}`) : ['- 해당 없음']), '',
    '주요 위험:', ...(risks.length ? risks.map(x => `- ${x}`) : ['- 해당 없음']), '',
    '판정:', buildJudgement(cur), '',
    '상태:', `${phase.label} 구간`,
  ];
  return lines.join('\n');
}

/** 짧은 형식(제목/요약) */
export function buildShortAlert(cur, cfg) {
  const phase = phaseByKey(cfg, cur.phaseKey);
  return `🔔 매수 구간 진입\n현재: ${phase.label}\n총점: ${cur.total}/20`;
}

export { pct };
