/** 지표별 점수화 단위 테스트 (순수 함수, 합성 입력) */
import { describe, it, assert } from './runner.js';
import { cfg } from './helpers.js';
import {
  scoreY10, scoreInflation, scoreFed, scorePmi, scoreEmployment, scoreHy, scoreVix, scoreDxy, scoreEps, scoreValuation, scoreIndicator,
} from '../scoring/indicatorScore.js';
import { totalScore, scoreHistoryStats } from '../scoring/totalScore.js';
import { phaseForScore } from '../scoring/marketPhase.js';
import { classifyDrawdown, computePriceInfo, priceSeriesStats } from '../scoring/priceFilter.js';
import { makeSeries } from '../data/series.js';
import { parseFredCsv } from '../data/providers/fred.js';
import { mergeConfig, CONFIG } from '../config.js';

const SET = [-2, -1, 0, 1, 2];

describe('점수는 항상 -2/-1/0/+1/+2 중 하나', () => {
  it('10Y: 급등/상승/횡보/하락/급락', () => {
    const m = (d1, d5, d20, fromHigh = 0, realD20 = NaN) => ({ value: 4, details: { d1, d5, d20, fromHigh, realD20 } });
    assert.equal(scoreY10(m(5, 30, 50), cfg).score, -2);
    assert.equal(scoreY10(m(2, 10, 20), cfg).score, -1);
    assert.equal(scoreY10(m(0, 0, 3), cfg).score, 0);
    assert.equal(scoreY10(m(-2, -8, -15), cfg).score, 1);
    assert.equal(scoreY10(m(-5, -20, -40), cfg).score, 2);
    assert.equal(scoreY10(m(0, 0, 3, 0, -30), cfg).score, 1, '실질금리 하락 보정');
    assert.equal(scoreY10(m(0, 0, 3, 0, 30), cfg).score, -1, '실질금리 상승 보정');
  });
  it('물가: 재가속/둔화/둔화 지속', () => {
    const m = (avgAccel, avgPrev = 0, momExcess = 0) => ({ details: { avgAccel, avgPrev, momExcess } });
    assert.equal(scoreInflation(m(0.6), cfg).score, -2);
    assert.equal(scoreInflation(m(0.2), cfg).score, -1);
    assert.equal(scoreInflation(m(0), cfg).score, 0);
    assert.equal(scoreInflation(m(-0.2), cfg).score, 1);
    assert.equal(scoreInflation(m(-0.5, -0.3), cfg).score, 2);
    assert.equal(scoreInflation(m(-0.5, 0.2), cfg).score, 1, '둔화 지속이 아닌 단발 둔화는 +1');
    assert.equal(scoreInflation(m(0, 0, 1.0), cfg).score, -1, '코어 단기 재가속 경계');
  });
  it('Fed 기대', () => {
    const m = (delta) => ({ details: { delta, fedFunds: 4 } });
    assert.equal(scoreFed(m(-0.5), cfg).score, 2);
    assert.equal(scoreFed(m(-0.2), cfg).score, 1);
    assert.equal(scoreFed(m(0.0), cfg).score, 0);
    assert.equal(scoreFed(m(0.2), cfg).score, -1);
    assert.equal(scoreFed(m(0.5), cfg).score, -2);
  });
  it('PMI: 50 미만이어도 개선 방향이면 긍정 (45→46→48)', () => {
    const ism = (change3, level) => ({ details: { change3, level, source: 'ISM' } });
    const r = scorePmi(ism(3, 48), cfg);
    assert.equal(r.score, 2);
    assert.equal(scorePmi(ism(1.5, 47), cfg).score, 1);
    assert.equal(scorePmi(ism(0, 49), cfg).score, 0);
    assert.equal(scorePmi(ism(-1.5, 49), cfg).score, -1);
    assert.equal(scorePmi(ism(-4, 45), cfg).score, -2);
  });
  it('고용: 침체형 악화 -2 / 과열 -1 / 정상 둔화 +', () => {
    const base = { sahm: 0, pay3: 120, claimsGrowth: 0.02, contGrowth: 0.02, wageYoy: 3.6, wageYoy6: 4.1, wage3m: 3.4, ur: 4.2, urChange3: 0, claims4: 220000 };
    const rec = scoreEmployment({ details: { ...base, sahm: 0.6, pay3: -20, claimsGrowth: 0.35, contGrowth: 0.15 } }, cfg);
    assert.equal(rec.score, -2);
    assert.equal(scoreEmployment({ details: { ...base, sahm: 0.35, pay3: 30 } }, cfg).score, -1, '실업률 상승 + 고용 증가 급감 → 악화 포인트 2');
    assert.equal(scoreEmployment({ details: { ...base, sahm: 0.35 } }, cfg).score, 0, '경미한 약화 1점은 정상 둔화 가점 없음');
    const hot = scoreEmployment({ details: { ...base, pay3: 280, wageYoy: 4.8, wageYoy6: 4.8, ur: 3.6 } }, cfg);
    assert.equal(hot.score, -1);
    assert.includes(hot.reason, '과열');
    assert.equal(scoreEmployment({ details: base }, cfg).score, 2, '과열 완화형 정상 둔화');
    assert.equal(scoreEmployment({ details: { ...base, wageYoy6: 3.7, wage3m: 3.7 } }, cfg).score, 1);
    assert.equal(scoreEmployment({ details: { ...base, pay3: 30 } }, cfg).score, 0, '고용 증가 매우 약함(악화 포인트 1) → 중립');
  });
  it('HY: 급격한 확대 / 확대 후 안정 / 축소 지속', () => {
    const d = (o) => ({ value: 4, proxy: false, details: { d5: 0, d20: 0, d60: 0, nearPeak: 1, stabilized: false, scale: 1, ...o } });
    assert.equal(scoreHy(d({ d20: 0.3 }), cfg).score, -2);
    assert.equal(scoreHy(d({ d5: 0.15 }), cfg).score, -2);
    assert.equal(scoreHy(d({ d20: 0.1 }), cfg).score, -1);
    assert.equal(scoreHy(d({}), cfg).score, 0);
    assert.equal(scoreHy(d({ d20: -0.05 }), cfg).score, 1);
    assert.equal(scoreHy(d({ d20: -0.15, d60: -0.2 }), cfg).score, 2);
    assert.equal(scoreHy(d({ stabilized: true, d20: -0.02 }), cfg).score, 1);
  });
  it('VIX: 급등 후 빠른 하락 +2 / 안정 +1 / 급등 지속 -2', () => {
    const v = (o) => ({ value: 20, details: { d5: 0, d10: 0, d20: 0, peak: 20, peakRatio: 1, surge: false, sustainedSurge: false, ...o } });
    assert.equal(scoreVix(v({ sustainedSurge: true, peak: 40, peakRatio: 1 }), cfg).score, -2);
    assert.equal(scoreVix(v({ peak: 50, peakRatio: 0.5 }), cfg).score, 2);
    assert.equal(scoreVix(v({ peak: 35, peakRatio: 0.85, d5: -0.02 }), cfg).score, 1);
    assert.equal(scoreVix(v({ surge: true, d5: 0.2 }), cfg).score, -1);
    assert.equal(scoreVix(v({}), cfg).score, 0);
  });
  it('DXY', () => {
    const d = (d20) => ({ details: { d5: 0, d20, d60: 0 } });
    assert.equal(scoreDxy(d(3), cfg).score, -2);
    assert.equal(scoreDxy(d(1), cfg).score, -1);
    assert.equal(scoreDxy(d(0), cfg).score, 0);
    assert.equal(scoreDxy(d(-1), cfg).score, 1);
    assert.equal(scoreDxy(d(-3), cfg).score, 2);
  });
  it('EPS 리비전', () => {
    const e = (rev1, rev3, rev1Prev = 0) => ({ details: { rev1, rev3, rev1Prev } });
    assert.equal(scoreEps(e(-2, -4), cfg).score, -2);
    assert.equal(scoreEps(e(0.6, 1.5), cfg).score, 2);
    assert.equal(scoreEps(e(-0.1, -2, -1.2), cfg).score, 1, '하향세 종료');
    assert.equal(scoreEps(e(-0.8, -2, -0.5), cfg).score, -1);
    assert.equal(scoreEps(e(0, 0.2, 0), cfg).score, 0);
  });
  it('Forward PER: PER 이 낮아도 EPS 급락이면 +2 부여 안 함', () => {
    const v = (premium, dropFromHigh = -0.05) => ({ value: 17, details: { premium, dropFromHigh, ref: 18 } });
    assert.equal(scoreValuation(v(-0.1), cfg).score, 2);
    assert.equal(scoreValuation(v(-0.1), cfg, { epsScore: -2 }).score, 1, '금융위기식 EPS 급락 왜곡 방지');
    assert.equal(scoreValuation(v(0.05), cfg).score, 1);
    assert.equal(scoreValuation(v(0.15), cfg).score, 0);
    assert.equal(scoreValuation(v(0.3), cfg).score, -1);
    assert.equal(scoreValuation(v(0.5), cfg).score, -2);
  });
  it('scoreIndicator: 결측이면 score null / DATA_UNAVAILABLE (0점 대체 금지)', () => {
    const r = scoreIndicator('eps', { key: 'eps', available: false, reason: '미입력' }, cfg);
    assert.equal(r.status, 'DATA_UNAVAILABLE');
    assert.equal(r.score, null);
    assert.equal(r.available, false);
  });
  it('모든 점수 출력값이 허용 집합 내', () => {
    for (let a = -60; a <= 60; a += 7) {
      const r = scoreY10({ value: 4, details: { d1: a / 10, d5: a / 2, d20: a, fromHigh: -a, realD20: NaN } }, cfg);
      assert.inSet(r.score, SET);
    }
  });
});

describe('총점 / 국면 경계', () => {
  const edge = [[-20, 'WATCH_RISK'], [-1, 'WATCH_RISK'], [0, 'OBSERVE'], [5, 'OBSERVE'], [6, 'BUY1'], [10, 'BUY1'], [11, 'BUY2'], [15, 'BUY2'], [16, 'BUY3'], [20, 'BUY3']];
  for (const [score, key] of edge) it(`${score}점 → ${key}`, () => assert.equal(phaseForScore(score, cfg).key, key));

  it('가중치 변경이 총점에 반영됨 (config 로 분리)', () => {
    const scored = {}; cfg.indicatorOrder.forEach(k => { scored[k] = { available: true, score: 1 }; });
    assert.equal(totalScore(scored, cfg).total, 10);
    const c2 = mergeConfig(cfg, { weights: { vix: 2, hy: 2 } });
    assert.equal(totalScore(scored, c2).total, 12);
    assert.equal(cfg.weights.vix, 1, '원본 config 불변');
  });
  it('결측 지표는 합산에서 제외, rescaleMissing=true 면 비례 보정', () => {
    const scored = {}; cfg.indicatorOrder.forEach(k => { scored[k] = { available: true, score: 1 }; });
    scored.eps = { available: false, score: null }; scored.valuation = { available: false, score: null };
    assert.equal(totalScore(scored, cfg).total, 8);
    assert.equal(totalScore(scored, mergeConfig(cfg, { rescaleMissing: true })).total, 10);
  });
  it('점수 이력: 전일/5일/20일/최근 최고·최저', () => {
    const totals = [0, 1, 2, 3, 4, 5, 6, 3, 8, 7, 9, 10, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
    const i = totals.length - 1;
    const h = scoreHistoryStats(totals, i, cfg);
    assert.equal(h.current, 13); assert.equal(h.previous, 12); assert.equal(h.change, 1);
    assert.equal(h.fiveDaysAgo, totals[i - 5]); assert.equal(h.twentyDaysAgo, totals[i - 20]);
    assert.equal(h.recentMax, 13); assert.equal(h.recentMin, 0);
    const h0 = scoreHistoryStats([3], 0, cfg);
    assert.equal(h0.previous, null); assert.equal(h0.change, null);
  });
});

describe('가격 조정 필터', () => {
  it('낙폭 구간 분류', () => {
    assert.equal(classifyDrawdown(-0.03, cfg), '정상 조정');
    assert.equal(classifyDrawdown(-0.07, cfg), '조정');
    assert.equal(classifyDrawdown(-0.12, cfg), '상당한 조정');
    assert.equal(classifyDrawdown(-0.18, cfg), '큰 조정');
    assert.equal(classifyDrawdown(-0.25, cfg), '약세장/위기 가능성');
  });
  const mk = (vals, startDay = '2020-01-01') => {
    const rows = vals.map((v, i) => ({ date: new Date(Date.UTC(2020, 0, 1) + i * 86400000).toISOString().slice(0, 10), value: v }));
    return makeSeries('T', rows, { lagDays: 0 });
  };
  it('drawdown = 현재가 / 최근고점 - 1 및 이동평균', () => {
    const vals = []; for (let i = 0; i < 250; i++) vals.push(100 + i * 0.2);     // 상승
    const peak = vals[vals.length - 1];
    for (let i = 0; i < 20; i++) vals.push(peak * (1 - 0.006 * (i + 1)));       // 하락
    const s = mk(vals);
    const day = s.t[s.t.length - 1];
    const p = computePriceInfo(s, 'TEST', day, cfg);
    assert.ok(p.available);
    assert.close(p.drawdown, vals[vals.length - 1] / peak - 1, 1e-12);
    assert.close(p.high, peak, 1e-9);
    assert.ok(p.ma200 > 0 && p.ma50 > 0 && p.ma20 > 0);
    assert.ok(p.drawdown < -0.1 && p.drawdown > -0.15, `dd=${p.drawdown}`);
  });
  it('가격 이력 부족/지연 데이터는 available=false', () => {
    const s = mk([1, 2, 3]);
    assert.equal(computePriceInfo(s, 'X', s.t[2], cfg).available, false);
    const vals = new Array(300).fill(100); const s2 = mk(vals);
    assert.equal(computePriceInfo(s2, 'X', s2.t[299] + 30, cfg).available, false, '30일 지연 → 오류로 간주');
  });
  it('저점 갱신 판정: 하락 추세에서 makingNewLows', () => {
    const vals = []; for (let i = 0; i < 200; i++) vals.push(100);
    for (let i = 0; i < 30; i++) vals.push(100 - i * 1.5);
    const s = mk(vals);
    const p = computePriceInfo(s, 'X', s.t[s.t.length - 1], cfg);
    assert.ok(p.makingNewLows, `newLows=${p.newLows}`);
    const flat = mk(new Array(250).fill(100));
    assert.ok(!computePriceInfo(flat, 'X', flat.t[249], cfg).makingNewLows);
  });
  it('priceSeriesStats: 낙폭/이동평균 시계열 길이 일치', () => {
    const s = mk(Array.from({ length: 300 }, (_, i) => 100 + Math.sin(i / 10) * 10));
    const st = priceSeriesStats(s, cfg);
    assert.equal(st.dd.length, 300); assert.equal(st.ma[200].length, 300);
    assert.equal(st.ma[200][198], null); assert.ok(st.ma[200][199] !== null);
    assert.ok(st.dd[299] <= 0);
  });
});

describe('데이터 어댑터', () => {
  it('FRED CSV 파싱: 빈 값과 "." 는 건너뜀 (0 대체 금지)', () => {
    const rows = parseFredCsv('observation_date,X\n2020-01-01,1.5\n2020-01-02,\n2020-01-03,.\n2020-01-04,2.5\n');
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map(r => r.value), [1.5, 2.5]);
  });
  it('config 병합은 원본을 변경하지 않음', () => {
    const c2 = mergeConfig(CONFIG, { y10: { surge20bp: 99 } });
    assert.equal(c2.y10.surge20bp, 99); assert.equal(CONFIG.y10.surge20bp, 40); assert.equal(c2.y10.rise20bp, 15);
  });
});
