/** 명세 31. 반드시 구현해야 하는 테스트 (Test 1 ~ 8) */
import { describe, it, assert } from './runner.js';
import { cfg, mkState, scoresForTotal } from './helpers.js';
import { evaluateAlert } from '../alerts/marketAlert.js';

const prevOf = (st) => ({ phaseKey: st.phaseKey, total: st.total });

describe('Test 1~2: 극단 점수', () => {
  it('Test 1: 모든 지표 +2 → 총점 20, 적극적 매수 검토', () => {
    const st = mkState({ scores: new Array(10).fill(2) });
    assert.equal(st.total, 20);
    assert.equal(st.phaseKey, 'BUY3');
    assert.equal(st.phase.label, '적극적 매수 검토');
  });
  it('Test 2: 모든 지표 -2 → 총점 -20, 관망/위험구간', () => {
    const st = mkState({ scores: new Array(10).fill(-2) });
    assert.equal(st.total, -20);
    assert.equal(st.phaseKey, 'WATCH_RISK');
    assert.equal(st.phase.label, '관망 / 위험구간');
  });
});

describe('Test 3~5: 단계 진입 알림', () => {
  it('Test 3: 5 → 6 : 1차 매수 검토 진입 알림', () => {
    const p = mkState({ total: 5 }), c = mkState({ total: 6 });
    assert.equal(p.phaseKey, 'OBSERVE'); assert.equal(c.phaseKey, 'BUY1');
    const a = evaluateAlert(prevOf(p), c, cfg);
    assert.ok(a.fire, '알림 발생');
    assert.includes(a.message, '1차 매수 검토');
    assert.includes(a.message, '6 / 20');
  });
  it('Test 4: 10 → 11 : 2차 매수 검토 진입 알림', () => {
    const p = mkState({ total: 10 }), c = mkState({ total: 11 });
    assert.equal(p.phaseKey, 'BUY1'); assert.equal(c.phaseKey, 'BUY2');
    const a = evaluateAlert(prevOf(p), c, cfg);
    assert.ok(a.fire);
    assert.includes(a.message, '2차 매수 검토');
    assert.includes(a.message, '11 / 20');
  });
  it('Test 5: 15 → 16 : 적극적 매수 검토 진입 알림', () => {
    const p = mkState({ total: 15 }), c = mkState({ total: 16 });
    assert.equal(p.phaseKey, 'BUY2'); assert.equal(c.phaseKey, 'BUY3');
    const a = evaluateAlert(prevOf(p), c, cfg);
    assert.ok(a.fire);
    assert.includes(a.message, '적극적 매수 검토');
    assert.includes(a.message, '16 / 20');
  });
});

describe('Test 6: 급락 중 안전장치', () => {
  const crash = {
    total: 16, spDd: -0.22, nqDd: -0.25, spNewLows: 4,
    measures: {
      vix: { details: { surge: true, sustainedSurge: true, peak: 45, peakRatio: 1, d5: 0.3 }, value: 45 },
      hy: { details: { surge: true, sustainedSurge: true, nearPeak: 1, d5: 0.2, d20: 0.4 } },
    },
  };
  it('총점 16 + VIX 급등 + HY 급등 + 가격 저점 갱신 → 적극적 매수 단계 상승 금지', () => {
    const st = mkState(crash);
    assert.equal(st.total, 16);
    assert.equal(st.rawPhaseKey, 'BUY3', '점수만 보면 적극적 매수');
    assert.ok(st.override.hard, 'HARD 안전장치 작동');
    assert.ok(st.phase.rank < 4, '최종 단계는 적극적 매수 아님');
    assert.equal(st.phaseKey, cfg.override.maxPhase);
    assert.equal(st.status, '하락 위험 지속');
    assert.ok(st.suppressed);
  });
  it('안전장치로 억제되면 단계 진입 알림을 발생시키지 않는다', () => {
    const prev = mkState({ total: 5, spDd: -0.2, nqDd: -0.2 });
    const cur = mkState({ ...crash, total: 16 });
    const a = evaluateAlert(prevOf(prev), cur, cfg);
    assert.ok(!a.fire, '알림 차단');
    assert.equal(a.blockedBy, 'RISK_OVERRIDE');
  });
  it('VIX·HY 급등 동시 발생(저점 갱신 없음)이면 2차/적극적 단계를 억제 (COMBO)', () => {
    const st = mkState({ total: 17, measures: { vix: { details: { surge: true } }, hy: { details: { surge: true } } } });
    assert.equal(st.override.level, 'COMBO');
    assert.ok(st.phase.rank <= 2);
    assert.equal(st.phaseKey, 'BUY1');
  });
  it('안전장치 조건 일부만 충족되면 작동하지 않음', () => {
    const st = mkState({ total: 16, spNewLows: 4, measures: { vix: { details: { surge: true, sustainedSurge: true } } } });
    assert.ok(!st.override.active);
    assert.equal(st.phaseKey, 'BUY3');
  });
});

describe('Test 7: 바닥 탐색 가능 구간', () => {
  it('가격 -15% + VIX 안정 + HY 안정 + 10Y 하락 + EPS 하향세 둔화 → BOTTOMING_SETUP = true', () => {
    const scores = [1, 0, 0, 0, 0, 1, 1, 0, 0, 0]; // y10 +1, hy +1, vix +1, eps 0
    const st = mkState({
      scores, spDd: -0.15, nqDd: -0.17,
      measures: {
        vix: { value: 22, details: { peak: 38, peakRatio: 0.58, surge: false, sustainedSurge: false, d5: -0.1 } },
        hy: { details: { stabilized: true, nearPeak: 0.93, risen: 0.4, d5: -0.01 } },
        y10: { details: { d20: -25, d5: -8 } },
        eps: { details: { rev1: -0.2, rev1Prev: -1.4 } },
      },
    });
    assert.ok(st.bottoming.ddOk, '가격 조정 ≥ 10%');
    assert.ok(st.bottoming.metCount >= 3, `충족 조건 ${st.bottoming.metCount}`);
    assert.equal(st.bottoming.detected, true);
    assert.equal(st.bottoming.label, '바닥 탐색 가능 구간');
  });
  it('가격 조정이 10% 미만이면 다른 조건이 충족돼도 false', () => {
    const st = mkState({
      scores: [1, 0, 0, 0, 0, 1, 1, 0, 0, 0], spDd: -0.04, nqDd: -0.05,
      measures: { vix: { value: 22, details: { peak: 38, peakRatio: 0.58 } }, hy: { details: { stabilized: true } }, y10: { details: { d20: -25, d5: -8 } } },
    });
    assert.equal(st.bottoming.detected, false);
  });
  it('HARD 안전장치 작동 중이면 BOTTOMING_SETUP 은 false', () => {
    const st = mkState({
      total: 8, spDd: -0.25, nqDd: -0.25, spNewLows: 5,
      measures: { vix: { details: { surge: true, sustainedSurge: true, peak: 50 } }, hy: { details: { surge: true, sustainedSurge: true } } },
    });
    assert.equal(st.bottoming.detected, false);
  });
});

describe('Test 8: 핵심 데이터 누락', () => {
  it('핵심 데이터(VIX/HY) 누락 → confidence = LOW, 매수 단계 알림 차단', () => {
    // [y10, infl, fed, pmi, emp, hy, vix, dxy, eps, val] — hy/vix 결측
    const scores = [2, 2, 2, 0, 0, null, null, 0, 0, 0];
    const prev = mkState({ scores: [1, 2, 2, 0, 0, null, null, 0, 0, 0] });   // 총점 5
    const cur = mkState({ scores });                                          // 총점 6
    assert.equal(cur.confidence.level, 'LOW');
    assert.equal(cur.total, 6);
    assert.equal(cur.phaseKey, 'BUY1');
    const a = evaluateAlert(prevOf(prev), cur, cfg);
    assert.ok(!a.fire, '알림 차단');
    assert.equal(a.blockedBy, 'LOW_CONFIDENCE');
    assert.includes(cur.dataNote, '데이터 부족으로 종합점수 신뢰도 저하');
  });
  it('가격 데이터 오류 → LOW', () => {
    const st = mkState({ total: 8, priceUnavailable: true });
    assert.equal(st.confidence.level, 'LOW');
  });
  it('결측 지표를 0점으로 처리하지 않음 (DATA_UNAVAILABLE)', () => {
    const st = mkState({ scores: [2, 2, null, 0, 0, 1, 1, 0, null, 0] });
    assert.equal(st.scored.fed.status, 'DATA_UNAVAILABLE');
    assert.equal(st.scored.fed.score, null);
    assert.equal(st.totalInfo.availableCount, 8);
    assert.deepEqual(st.totalInfo.unavailable, ['fed', 'eps']);
    assert.equal(st.total, 6);
  });
});
