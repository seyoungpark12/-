/**
 * 모든 점수 기준·임계값·가중치는 이 파일(config)에서만 관리합니다.
 * 백테스트 결과에 따라 값을 수정하거나, backtest.html 의 "파라미터 오버라이드"로 덮어쓸 수 있습니다.
 * (점수 계산 로직은 이 값을 인자로 받는 순수 함수입니다.)
 */
export const CONFIG = {
  version: 1,

  /** 데이터가 (staleDays × 이 값) 보다 오래되면 '오래된 값'이 아니라 사용 불가(DATA_UNAVAILABLE)로 처리 */
  staleHardMultiple: 4,

  /** 4단계 매수 국면 + 관망/위험구간. minScore 이상인 가장 높은 단계를 선택. */
  phases: [
    { key: 'WATCH_RISK', rank: 0, minScore: -1000, label: '관망 / 위험구간',  short: '관망', color: '#ef4444', emoji: '🔴' },
    { key: 'OBSERVE',    rank: 1, minScore: 0,     label: '매수 관찰',        short: '관찰', color: '#eab308', emoji: '🟡' },
    { key: 'BUY1',       rank: 2, minScore: 6,     label: '1차 매수 검토',    short: '1차',  color: '#f97316', emoji: '🟠' },
    { key: 'BUY2',       rank: 3, minScore: 11,    label: '2차 매수 검토',    short: '2차',  color: '#22c55e', emoji: '🟢' },
    { key: 'BUY3',       rank: 4, minScore: 16,    label: '적극적 매수 검토', short: '적극', color: '#3b82f6', emoji: '🔵' },
  ],

  indicatorOrder: ['y10', 'inflation', 'fed', 'pmi', 'employment', 'hy', 'vix', 'dxy', 'eps', 'valuation'],

  /** 지표별 가중치 (기본 1 = 단순 합산). 백테스트 후 조정 가능. */
  weights: { y10: 1, inflation: 1, fed: 1, pmi: 1, employment: 1, hy: 1, vix: 1, dxy: 1, eps: 1, valuation: 1 },

  /**
   * 결측 지표 처리.
   * false(기본): 사용 가능한 지표 점수만 합산 (결측을 0점으로 취급하지 않음. 최대 가능점수가 낮아져 보수적).
   * true: 합계 × (10 / 사용가능 지표 수) 로 비례 보정.
   */
  rescaleMissing: false,

  /* ---------- ① 10년물 (bp 기준) ---------- */
  y10: {
    lookbackHigh: 60,   // 최근 고점 비교 관측치 수
    surge20bp: 40,      // 20일 +40bp 이상 → 급등
    surge5bp: 25,       // 5일 +25bp 이상 → 급등
    rise20bp: 15,       // 20일 +15bp 이상 → 상승
    fall20bp: 10,       // 20일 -10bp 이하 → 하락
    plunge20bp: 30,     // 20일 -30bp 이하 → 급락
    realAdjBp: 25,      // 명목 0점일 때 실질금리 20일 변화 ±25bp 면 ±1 보정
    retreatBp: 25,      // 명목 0점이어도 최근 고점 대비 -25bp 이상 후퇴 + 20일 하락이면 +1
  },

  /* ---------- ② 물가 (YoY 가속도, %p) ---------- */
  inflation: {
    surgeAccel: 0.5,    // 평균 YoY 3개월 변화 ≥ +0.5%p → 급격한 재가속
    riseAccel: 0.15,    // ≥ +0.15%p → 재상승
    easeAccel: 0.15,    // ≤ -0.15%p → 둔화
    strongEase: 0.4,    // ≤ -0.4%p 이고 직전 구간도 둔화 → 둔화 지속
    persistPrev: 0.1,   // 직전 3개월 YoY 변화 ≤ -0.1%p
    momGuard: 0.6,      // 코어CPI 최근 3개월 연율 − YoY ≥ 0.6%p 이면 1점 차감(단기 재가속 경계)
    minSeries: 2,
  },

  /* ---------- ③ Fed 기대 (국채 6M/1Y/2Y 20일 평균 변화, %p) ---------- */
  fed: { strong: 0.35, mild: 0.12, minTenors: 2, tenorWeights: { DGS6MO: 0.3, DGS1: 0.3, DGS2: 0.4 } },

  /* ---------- ④ PMI ---------- */
  pmi: {
    ism:      { strong: 3,  mild: 1 },   // ISM 3개월 변화(포인트)
    regional: { strong: 12, mild: 4 },   // 지역 연은 서베이 3개월 이동평균의 3개월 변화
    ismMinPoints: 4,
  },

  /* ---------- ⑤ 고용 ---------- */
  employment: {
    sahmStrong: 0.5, sahmMild: 0.3,         // 실업률 3개월 평균 − 직전 12개월 3개월평균 최저
    payrollNeg: 0, payrollWeak: 50,         // 3개월 평균 비농업 증감(천명)
    claimsMild: 0.15, claimsStrong: 0.30,   // 신규 청구 4주 평균의 13주 전 대비 증가율
    contClaimsMild: 0.10,                   // 연속 청구
    dpSevere: 4, dpMild: 2,                 // 악화 포인트 합계
    overheatPayroll: 250, overheatWageYoy: 4.5, overheatUR: 3.8, overheatNeeded: 2,
    coolPayrollMin: 50, coolPayrollMax: 200, coolURChangeMax: 0.2, coolWage3mMax: 3.8, coolWageFall6m: 0.3,
  },

  /* ---------- ⑥ HY Spread (비율 변화) ---------- */
  hy: {
    surge5: 0.12, surge20: 0.25, widen20: 0.08,
    tight20: 0.10, tight60: 0.10, easeD20: 0.04,
    sustainedD20: 0.20, sustainedNearPeak: 0.97,
    stabD5Max: 0.02, stabBelowPeak: 0.97, risenMin: 0.15,
    minHistory: 60,
    proxyScale: 0.5,     // OAS 이력 부족 시 Baa−10Y 프록시 사용: 비율 임계값 × 0.5
  },

  /* ---------- ⑦ VIX ---------- */
  vix: {
    elevated: 25, extreme: 30,
    surge5: 0.15, surge20: 0.25,
    calmRatio: 0.70, easeRatio: 0.90, peakNear: 0.95,
    peakWindow: 30, d5Tol: 0.05,
  },

  /* ---------- ⑧ 달러 (광의 달러지수 % 변화) ---------- */
  dxy: { surge20: 2.0, rise20: 0.8, fall20: 0.8, plunge20: 2.0, flagSurge5: 1.2 },

  /* ---------- ⑨ EPS 리비전 (%) ---------- */
  eps: { strongRev1: 0.5, strongRev3: 1.0, mildRev1: 0.3, downRev1: -0.3, downRev3: -1.0, badRev1: -1.5, badRev3: -3.0, minPoints: 3 },

  /* ---------- ⑩ Forward PER (평균 대비 프리미엄) ---------- */
  valuation: {
    plus2Premium: -0.05, plus2DropFromHigh: -0.15,
    plus1Premium: 0.10, neutralPremium: 0.20, minus1Premium: 0.35,
    capWhenEpsScore: -2,   // EPS 가 급격한 하향(-2)이면 PER +2 를 +1 로 제한
    minHistoryPoints: 12,
  },

  /* ---------- 가격 조정 필터 ---------- */
  price: {
    highLookback: 252, minObs: 120,
    newLowWindow: 60, newLowCheck: 10, newLowCount: 3,   // 최근 10거래일 중 '60일 신저가' 갱신이 3회 이상이면 저점 갱신 중
    maxStaleDays: 7,
    bands: [
      { min: -0.05, label: '정상 조정' },
      { min: -0.10, label: '조정' },
      { min: -0.15, label: '상당한 조정' },
      { min: -0.20, label: '큰 조정' },
      { min: -1,    label: '약세장/위기 가능성' },
    ],
  },

  /**
   * 가격 조정 게이트 ("상승장 추격매수 방지").
   * 거시점수가 높아도 지수가 고점 부근이면 단계를 제한. 이 구간 자체가 매수 신호는 아님.
   * 규칙은 위에서부터 평가하며 drawdown > ddAbove 인 첫 규칙을 적용. enabled:false 로 끌 수 있음.
   */
  priceGate: {
    enabled: true,
    rules: [
      { ddAbove: -0.05, maxPhase: 'OBSERVE', label: '가격 조정 부족(고점 대비 -5% 이내)' },
      { ddAbove: -0.10, maxPhase: 'BUY1',    label: '조정 폭 제한(고점 대비 -10% 이내)' },
    ],
  },

  /* ---------- 급락 중 안전장치 ---------- */
  override: {
    maxPhase: 'OBSERVE',      // VIX·HY 급등 지속 + 저점 갱신 → 이 단계로 제한
    comboMaxPhase: 'BUY1',    // VIX·HY 동시 급등 → 2차·적극적 매수 신호 억제
    statusText: '하락 위험 지속',
  },

  /* ---------- 바닥 탐색 ---------- */
  bottoming: { minDrawdown: -0.10, minOthers: 3 },

  /* ---------- 신뢰도 ---------- */
  confidence: {
    coreKeys: ['y10', 'vix', 'hy'],
    lowUnavailable: 4,        // 결측 지표 4개 이상 → LOW
    highMaxProblems: 1,       // HIGH 허용 (결측+오래된) 지표 수
  },

  /* ---------- 알림 ---------- */
  alerts: { minPhase: 'BUY1', blockOnLowConfidence: true },

  /* ---------- 점수 이력 ---------- */
  scoreHistory: { recentWindow: 60 },

  /* ---------- 투자금 분할 예시 ---------- */
  allocation: { buy1: 0.20, buy2: 0.25, buy3: 0.35, reserve: 0.20 },

  /* ---------- 리플레이/백테스트 ---------- */
  replay: { start: '2001-01-02' },
  backtest: {
    episodes: [
      { id: '2008', name: '2008 금융위기',        type: 'bear', start: '2007-10-01', end: '2010-03-31' },
      { id: '2011', name: '2011 조정',            type: 'bear', start: '2011-04-15', end: '2012-03-31' },
      { id: '2015', name: '2015~2016 조정',       type: 'bear', start: '2015-05-15', end: '2016-12-31' },
      { id: '2018', name: '2018 조정',            type: 'bear', start: '2018-09-01', end: '2019-06-30' },
      { id: '2020', name: '2020 코로나 급락',      type: 'bear', start: '2020-02-01', end: '2020-12-31' },
      { id: '2022', name: '2022 금리인상 약세장',  type: 'bear', start: '2021-11-01', end: '2023-06-30' },
      { id: '2023', name: '2023~2024 상승장',     type: 'bull', start: '2023-10-01', end: '2024-12-31' },
    ],
    fwdDays: [63, 126, 252],
    /** 에피소드 자동 판정 기준 (백테스트 결과를 보고 조정) */
    judge: {
      earlyWarn: -0.10,      // 첫 1차 신호 이후 추가 하락이 이 값 이하 → 조기 진입 경고
      earlyInfo: -0.05,      // 이 값 이하 → 참고
      scoreImprove: 3,       // 저점 -30일 → +30일 점수 개선폭 최소
      lateRebound: 0.15,     // 저점 대비 +15% 반등 후에야 신호 → 회복 후 지연
      deepBear: -0.20,       // 안전장치 점검 대상 낙폭
      bullAlertMax: 2,       // 상승장에서 허용 알림 수
      bullBuy2ShareMax: 0.15 // 상승장에서 2차 이상 단계 비중 상한
    },
  },
};

/** 깊은 병합 (배열은 교체). 원본은 변경하지 않음. */
export function mergeConfig(base, overrides) {
  if (overrides === null || overrides === undefined) return clone(base);
  if (Array.isArray(base) || typeof base !== 'object' || base === null) return clone(overrides);
  const out = {};
  for (const k of Object.keys(base)) out[k] = clone(base[k]);
  for (const k of Object.keys(overrides)) {
    const o = overrides[k], b = base[k];
    if (o && typeof o === 'object' && !Array.isArray(o) && b && typeof b === 'object' && !Array.isArray(b)) out[k] = mergeConfig(b, o);
    else out[k] = clone(o);
  }
  return out;
}

function clone(x) {
  if (Array.isArray(x)) return x.map(clone);
  if (x && typeof x === 'object') { const o = {}; for (const k of Object.keys(x)) o[k] = clone(x[k]); return o; }
  return x;
}

export function phaseByKey(cfg, key) { return cfg.phases.find(p => p.key === key); }
export function phaseByRank(cfg, rank) { return cfg.phases.find(p => p.rank === rank); }
