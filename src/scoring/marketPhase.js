/** 총점 → 4단계 매수 국면 (순수 함수). 투자 결정을 자동으로 내리지 않는 '모니터링 신호'. */
import { phaseByKey, phaseByRank } from '../config.js';

export function phaseForScore(total, cfg) {
  let chosen = cfg.phases[0];
  for (const p of cfg.phases) if (total >= p.minScore && p.rank >= chosen.rank) chosen = p;
  return chosen;
}

/** 단계를 maxKey 이하로 제한 */
export function capPhase(phase, maxKey, cfg) {
  const max = phaseByKey(cfg, maxKey);
  return phase.rank > max.rank ? max : phase;
}

export function minPhase(a, b) { return a.rank <= b.rank ? a : b; }

/**
 * 가격 조정 게이트: 지수가 고점 부근이면(추격매수 방지) 단계 상한 적용.
 * drawdown 은 대상 지수 중 가장 깊은 값. 이 규칙은 '매수 신호'가 아니라 '상한'만 부여한다.
 */
export function priceGateCap(drawdown, cfg) {
  const g = cfg.priceGate;
  if (!g || !g.enabled || !Number.isFinite(drawdown)) return null;
  for (const r of g.rules) {
    if (drawdown > r.ddAbove) return { maxPhase: r.maxPhase, label: r.label };
  }
  return null;
}

export { phaseByRank };
