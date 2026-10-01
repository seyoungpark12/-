/**
 * 급락 중 안전장치 (순수 함수).
 *  HARD : VIX 급등 지속 AND HY Spread 급등 지속 AND 지수 가격이 최근 저점을 계속 갱신
 *         → 총점이 높아도 status = '하락 위험 지속', 단계 상한 = cfg.override.maxPhase
 *  COMBO: HY Spread 급등 + VIX 급등 동시 발생 → 적극적 매수(2차·적극) 신호 억제, 상한 = cfg.override.comboMaxPhase
 *  FLAGS: 달러 급등 → 글로벌 긴축 위험 플래그 (단계 상한은 변경하지 않음)
 */
export function evaluateRiskOverride({ measures, prices }, cfg) {
  const vix = measures && measures.vix && measures.vix.available ? measures.vix.details : null;
  const hy = measures && measures.hy && measures.hy.available ? measures.hy.details : null;
  const dxy = measures && measures.dxy && measures.dxy.available ? measures.dxy.details : null;
  const availPrices = (prices || []).filter(p => p && p.available);
  const newLowIdx = availPrices.filter(p => p.makingNewLows).map(p => p.symbol);

  const vixSurge = !!(vix && vix.surge), hySurge = !!(hy && hy.surge);
  const vixSustained = !!(vix && vix.sustainedSurge), hySustained = !!(hy && hy.sustainedSurge);
  const newLow = newLowIdx.length > 0;

  const hard = vixSustained && hySustained && newLow;
  const combo = vixSurge && hySurge;
  const flags = [];
  if (dxy && (dxy.d20 >= cfg.dxy.surge20 || dxy.d5 >= cfg.dxy.flagSurge5)) {
    flags.push({ key: 'DXY_SURGE', label: '달러 급격한 강세 — 글로벌 금융여건 긴축 위험' });
  }
  const reasons = [];
  if (hard) reasons.push(`VIX 급등 지속 + HY Spread 급등 지속 + ${newLowIdx.join('/')} 저점 갱신 중`);
  else if (combo) reasons.push('VIX 급등과 HY Spread 급등이 동시에 발생');

  return {
    active: hard || combo,
    level: hard ? 'HARD' : combo ? 'COMBO' : 'NONE',
    hard, combo,
    maxPhase: hard ? cfg.override.maxPhase : combo ? cfg.override.comboMaxPhase : null,
    status: hard ? cfg.override.statusText : null,
    reasons, flags,
    conditions: { vixSurge, hySurge, vixSustained, hySustained, newLow, newLowIdx },
    evaluable: !!(vix && hy),
  };
}
