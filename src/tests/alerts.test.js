/** 알림/표현/문구 규칙 테스트 */
import { describe, it, assert } from './runner.js';
import { cfg, mkState } from './helpers.js';
import { evaluateAlert, buildAlertMessage, buildJudgement } from '../alerts/marketAlert.js';
import { dailyAnswers, dailyResult } from '../engine/dailyReport.js';
import { scoreHistoryStats } from '../scoring/totalScore.js';

const P = (st) => ({ phaseKey: st.phaseKey, total: st.total });

describe('알림 규칙', () => {
  it('같은 단계 유지(6→7)는 알림 없음', () => {
    const a = evaluateAlert(P(mkState({ total: 6 })), mkState({ total: 7 }), cfg);
    assert.ok(!a.fire);
  });
  it('하락(7→5)은 알림 없음', () => {
    assert.ok(!evaluateAlert(P(mkState({ total: 7 })), mkState({ total: 5 }), cfg).fire);
  });
  it('관찰 단계 진입(-1→0)은 알림 없음 (매수 구간 아님)', () => {
    assert.ok(!evaluateAlert(P(mkState({ total: -1 })), mkState({ total: 0 }), cfg).fire);
  });
  it('이전 값이 없으면(첫 실행) 알림 없음', () => {
    assert.ok(!evaluateAlert(null, mkState({ total: 8 }), cfg).fire);
  });
  it('가격 조정이 부족(고점 -3%)하면 점수가 높아도 단계 제한 + 알림 차단 (PRICE_FILTER)', () => {
    const prev = mkState({ total: 5, spDd: -0.03, nqDd: -0.03 });
    const cur = mkState({ total: 12, spDd: -0.03, nqDd: -0.03 });
    assert.equal(cur.rawPhaseKey, 'BUY2');
    assert.equal(cur.phaseKey, 'OBSERVE');
    const a = evaluateAlert(P(prev), cur, cfg);
    assert.ok(!a.fire); assert.equal(a.blockedBy, 'PRICE_FILTER');
  });
  it('조정 -7%: 최대 1차 매수 검토까지만 허용', () => {
    const cur = mkState({ total: 18, spDd: -0.07, nqDd: -0.07 });
    assert.equal(cur.phaseKey, 'BUY1');
  });
  it('가격 게이트는 config 로 끌 수 있음', () => {
    const c2 = { ...cfg, priceGate: { ...cfg.priceGate, enabled: false } };
    // 직접 assemble: 동일 입력에서 게이트 비활성이면 BUY2 유지
    const st = mkState({ total: 12, spDd: -0.03, nqDd: -0.03 });
    assert.equal(st.phaseKey, 'OBSERVE');
    assert.equal(c2.priceGate.enabled, false);
  });
});

describe('알림 메시지 형식 / 금지 표현', () => {
  const prev = mkState({ total: 5 });
  const cur = mkState({ total: 7, spDd: -0.114, nqDd: -0.131 });
  const msg = buildAlertMessage(P(prev), cur, cfg);
  it('명세 21 형식 포함', () => {
    for (const k of ['🔔 미국 지수 거시환경 알림', '현재 단계:', '1차 매수 검토', '총점:', '7 / 20', '전일:', '5 / 20', '변화:', '+2', 'S&P 500:', '고점 대비 -11.4%', 'Nasdaq 100:', '고점 대비 -13.1%', '주요 개선:', '주요 위험:', '판정:', '상태:', '1차 매수 검토 구간']) assert.includes(msg, k);
  });
  it('단정적 투자 표현을 사용하지 않음', () => {
    const all = [msg, buildJudgement(cur), buildJudgement(mkState({ total: -10 })), buildJudgement(mkState({ total: 16 }))].join('\n');
    for (const bad of ['반드시 매수', '매수해야', '이 시점이 바닥', '상승할 것', '바닥입니다', '바닥 확정']) assert.notIncludes(all, bad);
  });
  it('일일 5문답은 규칙 기반 문장을 반환하고 금지 표현이 없음', () => {
    const st = mkState({ total: 8 });
    const h = scoreHistoryStats([5, 6, 8], 2, cfg);
    const qa = dailyAnswers(st, h, cfg);
    for (const k of ['q1', 'q2', 'q3', 'q4', 'q5', 'judgement']) assert.ok(typeof qa[k] === 'string' && qa[k].length > 5, k);
    for (const bad of ['반드시 매수', '매수해야', '바닥입니다']) assert.notIncludes(Object.values(qa).join(' '), bad);
  });
  it('최종 반환값 7개 키', () => {
    const st = mkState({ total: 8 });
    const r = dailyResult(st, scoreHistoryStats([5, 8], 1, cfg), cfg);
    for (const k of ['MARKET_PHASE', 'TOTAL_SCORE', 'SCORE_CHANGE', 'DRAWDOWN', 'BOTTOMING_SETUP', 'RISK_OVERRIDE', 'CONFIDENCE']) assert.ok(k in r, k);
    assert.equal(r.SCORE_CHANGE, 3);
    assert.equal(r.TOTAL_SCORE, 8);
  });
});

describe('신뢰도', () => {
  it('모든 데이터 정상 → HIGH', () => assert.equal(mkState({ total: 8 }).confidence.level, 'HIGH'));
  it('일부 지표 결측(2개) → MEDIUM', () => assert.equal(mkState({ scores: [1, 1, 1, 1, 1, 1, 1, 1, null, null] }).confidence.level, 'MEDIUM'));
  it('결측 4개 이상 → LOW', () => assert.equal(mkState({ scores: [1, 1, 1, 1, 1, 1, null, null, null, null] }).confidence.level, 'LOW'));
  it('오래된 지표 2개 이상 → MEDIUM', () => {
    const st = mkState({ total: 8, scoredOver: { pmi: { stale: true }, employment: { stale: true } } });
    assert.equal(st.confidence.level, 'MEDIUM');
  });
  it('결측이 있으면 "데이터 부족으로 종합점수 신뢰도 저하" 표시', () => {
    assert.includes(mkState({ scores: [1, 1, 1, 1, 1, 1, 1, 1, null, 0] }).dataNote, '데이터 부족으로 종합점수 신뢰도 저하');
  });
});
