/**
 * 신호 신뢰도 HIGH / MEDIUM / LOW (순수 함수).
 *  LOW   : 가격 데이터 오류/없음, 핵심(10Y·VIX·HY) 결측, 또는 결측 지표 ≥ cfg.confidence.lowUnavailable
 *  HIGH  : (결측 + 오래된) 지표 수 ≤ cfg.confidence.highMaxProblems, 위험지표 정상, 가격 정상
 *  MEDIUM: 그 외
 */
export function evaluateConfidence({ scored, prices }, cfg) {
  const c = cfg.confidence;
  const reasons = [];
  const keys = cfg.indicatorOrder;
  const unavailableKeys = keys.filter(k => !scored[k] || !scored[k].available);
  const staleKeys = keys.filter(k => scored[k] && scored[k].available && scored[k].stale);
  const proxyKeys = keys.filter(k => scored[k] && scored[k].available && scored[k].proxy);
  const coreMissing = c.coreKeys.filter(k => unavailableKeys.includes(k));
  const availPrices = (prices || []).filter(p => p && p.available);
  const priceProblem = availPrices.length === 0;

  let level = 'HIGH';
  if (priceProblem) { level = 'LOW'; reasons.push('가격 데이터 오류 또는 없음'); }
  if (coreMissing.length) { level = 'LOW'; reasons.push(`핵심 데이터 결측: ${coreMissing.join(', ')}`); }
  if (unavailableKeys.length >= c.lowUnavailable) { level = 'LOW'; reasons.push(`결측 지표 ${unavailableKeys.length}개`); }
  if (level !== 'LOW') {
    const problems = unavailableKeys.length + staleKeys.length;
    if (problems > c.highMaxProblems) {
      level = 'MEDIUM';
      if (unavailableKeys.length) reasons.push(`결측 지표 ${unavailableKeys.length}개: ${unavailableKeys.join(', ')}`);
      if (staleKeys.length) reasons.push(`오래된(최신 발표값 기준) 지표 ${staleKeys.length}개: ${staleKeys.join(', ')}`);
    }
    if ((prices || []).some(p => p && !p.available)) {
      level = level === 'HIGH' ? 'MEDIUM' : level;
      reasons.push('일부 지수 가격 데이터 사용 불가');
    }
  }
  if (level === 'HIGH') reasons.push('지표·가격 데이터가 대부분 최신이며 위험지표 정상');
  const degraded = unavailableKeys.length > 0;
  return {
    level, reasons, unavailableKeys, staleKeys, proxyKeys, coreMissing,
    degradedNote: degraded ? '데이터 부족으로 종합점수 신뢰도 저하' : '',
  };
}
