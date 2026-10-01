/**
 * 각 지표 → -2/-1/0/+1/+2 점수 (순수 함수).
 * 입력: indicators/*.js 가 계산한 측정값(m), config.  출력: { score, reason, tag }
 *  - tag: 알림/요약에 쓰이는 짧은 상태 문구 (점수>0 이면 '개선', 점수<0 이면 '위험' 항목으로 사용)
 * 데이터가 없으면(m.available === false) 점수를 만들지 않고 DATA_UNAVAILABLE 로 반환 (0점으로 대체 금지).
 */
const clamp2 = (x) => Math.max(-2, Math.min(2, x));
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : 'n/a');
const sg = (x, d = 2) => (Number.isFinite(x) ? (x > 0 ? '+' : '') + x.toFixed(d) : 'n/a');
const out = (score, reason, tag) => ({ score: clamp2(score), reason, tag });

export function scoreY10(m, cfg) {
  const c = cfg.y10, d = m.details;
  const base = `10년물 ${f(m.value)}% (전일 ${sg(d.d1, 0)}bp, 5일 ${sg(d.d5, 0)}bp, 20일 ${sg(d.d20, 0)}bp, 최근 고점 대비 ${sg(d.fromHigh, 0)}bp)`;
  if (d.d20 >= c.surge20bp || d.d5 >= c.surge5bp) return out(-2, `${base} → 장기금리 급등`, '10년물 금리 급등');
  if (d.d20 >= c.rise20bp) return out(-1, `${base} → 장기금리 상승`, '10년물 금리 상승');
  if (d.d20 <= -c.plunge20bp) return out(2, `${base} → 장기금리 급락`, '10년물 금리 급락');
  if (d.d20 <= -c.fall20bp) return out(1, `${base} → 장기금리 하락`, '10년물 금리 하락');
  if (Number.isFinite(d.realD20)) {
    if (d.realD20 <= -c.realAdjBp) return out(1, `${base}. 명목은 횡보이나 실질금리 20일 ${sg(d.realD20, 0)}bp 하락 → +1`, '실질금리 하락');
    if (d.realD20 >= c.realAdjBp) return out(-1, `${base}. 명목은 횡보이나 실질금리 20일 ${sg(d.realD20, 0)}bp 상승 → -1`, '실질금리 상승');
  }
  if (d.fromHigh <= -c.retreatBp && d.d20 < 0) return out(1, `${base} → 고점에서 후퇴하며 안정`, '10년물 금리 고점 후퇴');
  return out(0, `${base} → 횡보`, '10년물 금리 횡보');
}

export function scoreInflation(m, cfg) {
  const c = cfg.inflation, d = m.details;
  const base = `물가 YoY 3개월 가속도 평균 ${sg(d.avgAccel)}%p (직전 구간 ${sg(d.avgPrev)}%p)`;
  let s, tag, why;
  if (d.avgAccel >= c.surgeAccel) { s = -2; tag = '물가 급격한 재가속'; why = '물가 급격한 재가속'; }
  else if (d.avgAccel >= c.riseAccel) { s = -1; tag = '물가 재상승'; why = '물가 재상승'; }
  else if (d.avgAccel <= -c.strongEase && Number.isFinite(d.avgPrev) && d.avgPrev <= -c.persistPrev) { s = 2; tag = '물가 둔화 지속'; why = '물가 둔화 지속'; }
  else if (d.avgAccel <= -c.easeAccel) { s = 1; tag = '물가 둔화'; why = '물가 둔화'; }
  else { s = 0; tag = '물가 변화 없음'; why = '변화 없음'; }
  let reason = `${base} → ${why}`;
  if (Number.isFinite(d.momExcess) && d.momExcess >= c.momGuard && s >= 0) {
    s -= 1; tag = '코어 물가 단기 재가속 경계';
    reason += `. 코어CPI 3개월 연율이 YoY보다 ${sg(d.momExcess, 1)}%p 높아 단기 재가속 경계로 -1`;
  }
  return out(s, reason, tag);
}

export function scoreFed(m, cfg) {
  const c = cfg.fed, d = m.details.delta;
  const base = `시장금리(6M/1Y/2Y) 20일 평균 변화 ${sg(d)}%p (Fed Funds ${f(m.details.fedFunds)}%)`;
  if (d <= -c.strong) return out(2, `${base} → 완화 기대 증가`, 'Fed 완화 기대 증가');
  if (d <= -c.mild) return out(1, `${base} → 완화 기대 소폭 증가`, 'Fed 완화 기대 소폭 증가');
  if (d >= c.strong) return out(-2, `${base} → 긴축 기대 급격 증가`, 'Fed 긴축 기대 급증');
  if (d >= c.mild) return out(-1, `${base} → 긴축 기대 증가`, 'Fed 긴축 기대 증가');
  return out(0, `${base} → 변화 없음`, 'Fed 기대 변화 없음');
}

export function scorePmi(m, cfg) {
  const d = m.details;
  const c = d.source === 'ISM' ? cfg.pmi.ism : cfg.pmi.regional;
  const src = d.source === 'ISM' ? 'ISM PMI' : '지역연은 서베이(프록시)';
  const lvl = d.source === 'ISM' ? ` (50 ${d.level >= 50 ? '이상' : '미만'}: ${f(d.level, 1)})` : '';
  const base = `${src} 3개월 변화 ${sg(d.change3, 1)}${lvl}`;
  if (d.change3 >= c.strong) return out(2, `${base} → 급격한 개선/회복${d.source === 'ISM' && d.level < 50 ? ' (50 미만이어도 개선 방향 반영)' : ''}`, 'PMI 급격한 개선');
  if (d.change3 >= c.mild) return out(1, `${base} → 개선${d.source === 'ISM' && d.level < 50 ? ' (50 미만이나 개선 방향)' : ''}`, 'PMI 개선');
  if (d.change3 <= -c.strong) return out(-2, `${base} → 급격한 악화`, 'PMI 급격한 악화');
  if (d.change3 <= -c.mild) return out(-1, `${base} → 악화`, 'PMI 악화');
  return out(0, `${base} → 횡보`, 'PMI 횡보');
}

export function scoreEmployment(m, cfg) {
  const c = cfg.employment, d = m.details;
  let dp = 0; const why = [];
  if (d.sahm >= c.sahmStrong) { dp += 2; why.push(`실업률 Sahm 갭 ${sg(d.sahm)}%p(침체 신호 수준)`); }
  else if (d.sahm >= c.sahmMild) { dp += 1; why.push(`실업률 상승 ${sg(d.sahm)}%p`); }
  if (d.pay3 <= c.payrollNeg) { dp += 2; why.push(`비농업 3개월 평균 ${sg(d.pay3, 0)}천명(감소)`); }
  else if (d.pay3 < c.payrollWeak) { dp += 1; why.push(`비농업 3개월 평균 ${sg(d.pay3, 0)}천명(약함)`); }
  if (d.claimsGrowth >= c.claimsStrong) { dp += 2; why.push(`신규 청구 13주 대비 ${sg(d.claimsGrowth * 100, 0)}%`); }
  else if (d.claimsGrowth >= c.claimsMild) { dp += 1; why.push(`신규 청구 13주 대비 ${sg(d.claimsGrowth * 100, 0)}%`); }
  if (d.contGrowth >= c.contClaimsMild) { dp += 1; why.push(`연속 청구 13주 대비 ${sg(d.contGrowth * 100, 0)}%`); }
  const summary = `악화 포인트 ${dp}점` + (why.length ? ` (${why.join(', ')})` : '');

  if (dp >= c.dpSevere) return out(-2, `${summary} → 침체형 급격한 고용 악화`, '고용 급격한 악화');
  if (dp >= c.dpMild) return out(-1, `${summary} → 고용 악화 조짐`, '고용 악화 조짐');

  const hot = [d.pay3 >= c.overheatPayroll, d.wageYoy >= c.overheatWageYoy, d.ur <= c.overheatUR].filter(Boolean).length;
  if (hot >= c.overheatNeeded) return out(-1, `${summary}. 과열 신호 ${hot}개(고용 3M ${sg(d.pay3, 0)}천명, 임금 YoY ${f(d.wageYoy)}%, 실업률 ${f(d.ur, 1)}%) → 고용 과열 지속`, '고용 과열 지속');

  // 악화 포인트가 1점이라도 있으면(경미한 약화) '정상 둔화'로 가점하지 않고 중립 처리
  if (dp >= 1) return out(0, `${summary} → 경미한 약화 신호가 있어 정상 둔화로 가점하지 않고 중립`, '고용 경미한 약화(중립)');

  const cool = [
    d.pay3 >= c.coolPayrollMin && d.pay3 <= c.coolPayrollMax,
    !(d.urChange3 > c.coolURChangeMax),
    d.wage3m <= c.coolWage3mMax || d.wageYoy <= (d.wageYoy6 - c.coolWageFall6m),
    d.claimsGrowth < 0.10 || !Number.isFinite(d.claimsGrowth),
  ];
  const coolN = cool.filter(Boolean).length;
  const wageFalling = Number.isFinite(d.wageYoy6) && d.wageYoy <= d.wageYoy6 - c.coolWageFall6m;
  if (coolN === 4 && wageFalling) return out(2, `${summary}. 일자리 증가 완만(3M ${sg(d.pay3, 0)}천명), 임금 둔화(YoY ${f(d.wageYoy)}%), 청구 안정 → 과열 완화형 정상 둔화`, '고용 과열 완화(정상 둔화)');
  if (coolN >= 3) return out(1, `${summary}. 정상 둔화 조건 ${coolN}/4 충족(3M ${sg(d.pay3, 0)}천명, 실업률 3개월 ${sg(d.urChange3, 1)}%p) → 완만한 둔화`, '고용 완만한 둔화');
  return out(0, `${summary}. 과열도 악화도 아닌 안정 상태`, '고용 안정');
}

export function scoreHy(m, cfg) {
  const c = cfg.hy, d = m.details, k = d.scale;
  const base = `${m.proxy ? 'Baa−10Y(프록시)' : 'HY OAS'} ${f(m.value)}%p (5일 ${sg(d.d5 * 100, 1)}%, 20일 ${sg(d.d20 * 100, 1)}%, 60일 ${sg(d.d60 * 100, 1)}%, 60일 고점 대비 ${sg((d.nearPeak - 1) * 100, 1)}%)`;
  if (d.d5 >= c.surge5 * k || d.d20 >= c.surge20 * k) return out(-2, `${base} → 스프레드 급격한 확대`, 'HY 스프레드 급격한 확대');
  if (d.stabilized) return out(1, `${base} → 확대 후 고점에서 안정(확대세 둔화)`, 'HY 스프레드 확대세 둔화');
  if (d.d20 >= c.widen20 * k) return out(-1, `${base} → 스프레드 확대`, 'HY 스프레드 확대');
  if (d.d20 <= -c.tight20 * k && d.d60 <= -c.tight60 * k) return out(2, `${base} → 스프레드 축소 지속`, 'HY 스프레드 축소 지속');
  if (d.d20 <= -c.easeD20 * k) return out(1, `${base} → 스프레드 축소`, 'HY 스프레드 축소');
  return out(0, `${base} → 변화 없음`, 'HY 스프레드 변화 없음');
}

export function scoreVix(m, cfg) {
  const c = cfg.vix, d = m.details;
  const base = `VIX ${f(m.value)} (5일 ${sg(d.d5 * 100, 1)}%, 20일 ${sg(d.d20 * 100, 1)}%, ${c.peakWindow}일 고점 ${f(d.peak)} 대비 ${sg((d.peakRatio - 1) * 100, 1)}%)`;
  if (d.sustainedSurge) return out(-2, `${base} → 급등 지속`, 'VIX 급등 지속');
  if (d.peak >= c.elevated && d.peakRatio <= c.calmRatio) return out(2, `${base} → 공포 급등 후 빠르게 하락`, 'VIX 급등 후 빠른 안정');
  if (d.peak >= c.elevated && d.peakRatio <= c.easeRatio && d.d5 <= c.d5Tol) return out(1, `${base} → 높은 VIX 이후 안정`, 'VIX 안정');
  if (d.surge) return out(-1, `${base} → 변동성 상승`, 'VIX 상승');
  if (m.value >= c.extreme) return out(-1, `${base} → 극단적으로 높은 수준(안정 전)`, 'VIX 높은 수준');
  return out(0, `${base} → 평균적 수준`, 'VIX 평균적 수준');
}

export function scoreDxy(m, cfg) {
  const c = cfg.dxy, d = m.details;
  const base = `달러지수(광의) 5일 ${sg(d.d5)}%, 20일 ${sg(d.d20)}%, 60일 ${sg(d.d60)}%`;
  if (d.d20 >= c.surge20) return out(-2, `${base} → 달러 급등`, '달러 급등');
  if (d.d20 >= c.rise20) return out(-1, `${base} → 달러 상승`, '달러 상승');
  if (d.d20 <= -c.plunge20) return out(2, `${base} → 달러 뚜렷한 하락`, '달러 뚜렷한 하락');
  if (d.d20 <= -c.fall20) return out(1, `${base} → 달러 하락`, '달러 하락');
  return out(0, `${base} → 횡보/안정`, '달러 횡보');
}

export function scoreEps(m, cfg) {
  const c = cfg.eps, d = m.details;
  const base = `Forward EPS 1개월 ${sg(d.rev1)}%, 3개월 ${sg(d.rev3)}% (직전월 ${sg(d.rev1Prev)}%)`;
  if (d.rev1 <= c.badRev1 || (d.rev3 <= c.badRev3 && !(d.rev1 >= 0))) return out(-2, `${base} → 급격한 하향`, 'EPS 전망 급격한 하향');
  if (d.rev1 >= c.strongRev1 && d.rev3 >= c.strongRev3) return out(2, `${base} → 상향 지속`, 'EPS 전망 상향 지속');
  if (d.rev1 > c.downRev1 && d.rev1Prev <= c.downRev1) return out(1, `${base} → 하향세 종료`, 'EPS 하향세 종료');
  if (d.rev1 >= c.mildRev1) return out(1, `${base} → 상향/반등`, 'EPS 전망 반등');
  if (d.rev1 <= c.downRev1 || d.rev3 <= c.downRev3) return out(-1, `${base} → 하향`, 'EPS 전망 하향 지속');
  return out(0, `${base} → 횡보`, 'EPS 전망 횡보');
}

export function scoreValuation(m, cfg, ctx = {}) {
  const c = cfg.valuation, d = m.details;
  const base = `Forward PER ${f(m.value, 1)}x (5y/10y 평균 ${f(d.ref, 1)}x 대비 ${sg(d.premium * 100, 1)}%, 52주 고점 대비 ${sg(d.dropFromHigh * 100, 1)}%)`;
  if (d.premium <= c.plus2Premium || (d.dropFromHigh <= c.plus2DropFromHigh && d.premium <= c.neutralPremium)) {
    if (ctx.epsScore !== undefined && ctx.epsScore <= c.capWhenEpsScore) {
      return out(1, `${base} → 밸류에이션 부담 감소로 +2 대상이나, EPS가 급격히 하향 중이라 PER만으로 +2를 부여하지 않고 +1로 제한`, '밸류에이션 부담 감소(EPS 하향으로 제한)');
    }
    return out(2, `${base} → 조정으로 밸류에이션 부담 크게 감소`, '밸류에이션 부담 크게 감소');
  }
  if (d.premium <= c.plus1Premium) return out(1, `${base} → 적정 수준으로 정상화`, '밸류에이션 정상화');
  if (d.premium <= c.neutralPremium) return out(0, `${base} → 중립`, '밸류에이션 중립');
  if (d.premium <= c.minus1Premium) return out(-1, `${base} → 고평가`, '밸류에이션 고평가');
  return out(-2, `${base} → 고평가 심화`, '밸류에이션 고평가 심화');
}

const SCORERS = {
  y10: scoreY10, inflation: scoreInflation, fed: scoreFed, pmi: scorePmi, employment: scoreEmployment,
  hy: scoreHy, vix: scoreVix, dxy: scoreDxy, eps: scoreEps, valuation: scoreValuation,
};

/** 한 지표 점수화. 결과 항상 {key, available, score(-2..2|null), status, reason, tag, m} */
export function scoreIndicator(key, m, cfg, ctx = {}) {
  if (!m || !m.available) {
    return { key, available: false, score: null, status: 'DATA_UNAVAILABLE', reason: (m && m.reason) || '데이터 없음', tag: '데이터 없음', m: m || { key, available: false }, stale: false };
  }
  const r = SCORERS[key](m, cfg, ctx);
  return { key, available: true, score: r.score, status: 'OK', reason: r.reason, tag: r.tag, m, stale: !!m.stale, proxy: !!m.proxy };
}

/** 10개 지표 전체 점수화 (valuation 이 eps 점수를 참조하므로 eps 먼저) */
export function scoreAll(measures, cfg) {
  const res = {};
  for (const key of cfg.indicatorOrder) {
    if (key === 'valuation') continue;
    res[key] = scoreIndicator(key, measures[key], cfg);
  }
  const epsScore = res.eps && res.eps.available ? res.eps.score : undefined;
  res.valuation = scoreIndicator('valuation', measures.valuation, cfg, { epsScore });
  const ordered = {};
  for (const key of cfg.indicatorOrder) ordered[key] = res[key];
  return ordered;
}
