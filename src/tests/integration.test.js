/** 통합 테스트: data/raw 의 실제 FRED 스냅샷으로 파이프라인 검증 (브라우저 fetch 사용) */
import { describe, it, assert } from './runner.js';
import { cfg } from './helpers.js';
import { loadDataset } from '../data/loader.js';
import { evaluateMarket } from '../engine/evaluateMarket.js';
import { replay } from '../engine/replay.js';
import { toDay, toStr } from '../data/series.js';
import { computeAllIndicators } from '../indicators/index.js';

let dsPromise = null;
const getDs = () => (dsPromise = dsPromise || loadDataset(new URL('../../', import.meta.url).href));
const SET = [-2, -1, 0, 1, 2];

describe('통합: 실제 데이터', () => {
  it('데이터셋 로드: 핵심 시계열 존재', async () => {
    const ds = await getDs();
    for (const k of ['SP500', 'NASDAQ100', 'VIXCLS', 'DGS10', 'BAMLH0A0HYM2', 'BAA10Y', 'CPIAUCSL', 'PAYEMS']) assert.ok(ds.series[k] && ds.series[k].t.length > 100, k);
    assert.equal(ds.loadErrors.length, 0, JSON.stringify(ds.loadErrors));
  });
  it('최신일 평가: 모든 점수는 {-2..2 | 결측}, 총점은 범위 내', async () => {
    const ds = await getDs();
    const day = ds.series.VIXCLS.t[ds.series.VIXCLS.t.length - 1];
    const st = evaluateMarket(ds, day, cfg);
    for (const k of cfg.indicatorOrder) {
      const r = st.scored[k];
      if (r.available) assert.inSet(r.score, SET, k); else { assert.equal(r.score, null, k); assert.equal(r.status, 'DATA_UNAVAILABLE', k); }
    }
    assert.ok(st.total >= -20 && st.total <= 20);
    assert.ok(['HIGH', 'MEDIUM', 'LOW'].includes(st.confidence.level));
  });
  it('수동 입력 전에는 EPS/PER 이 DATA_UNAVAILABLE (임의 값 생성 금지)', async () => {
    const ds = await getDs();
    if ((ds.manual.FWD_EPS || []).length === 0) {
      const day = ds.series.VIXCLS.t[ds.series.VIXCLS.t.length - 1];
      const st = evaluateMarket(ds, day, cfg);
      assert.equal(st.scored.eps.status, 'DATA_UNAVAILABLE');
      assert.equal(st.scored.valuation.status, 'DATA_UNAVAILABLE');
    }
  });
  it('Point-in-time: 과거 기준일 계산이 미래 데이터에 의존하지 않음', async () => {
    const ds = await getDs();
    const day = toDay('2022-06-15');
    const full = evaluateMarket(ds, day, cfg);
    // 기준일 이후 데이터를 모두 잘라낸 데이터셋으로 동일 계산 → 결과 동일해야 함
    const cut = { ...ds, series: {} };
    for (const [k, s] of Object.entries(ds.series)) {
      let n = s.t.length; while (n > 0 && s.t[n - 1] > day) n--;
      cut.series[k] = { ...s, t: s.t.slice(0, n), v: s.v.slice(0, n) };
    }
    const part = evaluateMarket(cut, day, cfg);
    assert.equal(part.total, full.total, '총점 동일');
    assert.equal(part.phaseKey, full.phaseKey);
    for (const k of cfg.indicatorOrder) assert.equal(part.scored[k].score, full.scored[k].score, k);
  });
  it('월간 지표는 발표 지연을 반영 (2022-06-15 에는 6월 CPI 미발표)', async () => {
    const ds = await getDs();
    const m = computeAllIndicators(ds, toDay('2022-06-15'), cfg);
    assert.ok(m.inflation.available);
    assert.ok(m.inflation.obsDate <= '2022-05-01', `obsDate=${m.inflation.obsDate}`);
  });
  it('2020-03 코로나 급락: 낙폭 -25% 이하, VIX 급등 감지', async () => {
    const ds = await getDs();
    const st = evaluateMarket(ds, toDay('2020-03-23'), cfg);
    assert.ok(st.prices.sp500.available);
    assert.ok(st.prices.sp500.drawdown < -0.25, `dd=${st.prices.sp500.drawdown}`);
    assert.ok(st.measures.vix.value > 50);
  });
  it('2008-10 금융위기: 과도한 매수 단계 아님 (안전장치/점수)', async () => {
    const ds = await getDs();
    const st = evaluateMarket(ds, toDay('2008-10-10'), cfg);
    // 2008-10 은 FRED S&P500 일별(2016~) 데이터가 없으므로 가격 데이터 없음 → 신뢰도 LOW & 알림 차단
    assert.ok(st.confidence.level === 'LOW' || st.phase.rank <= 2);
  });
  it('replay: 일자 정렬, 점수 범위, 알림 레코드 형식', async () => {
    const ds = await getDs();
    const r = replay(ds, cfg, { start: '2020-01-02', end: '2020-12-31', step: 5 });
    assert.ok(r.rows.length > 40);
    for (let i = 1; i < r.rows.length; i++) assert.ok(r.rows[i].date > r.rows[i - 1].date);
    for (const row of r.rows) assert.ok(row.total >= -20 && row.total <= 20);
    for (const a of r.alerts) { assert.ok(a.message.includes('🔔')); assert.equal(a.sent, false); }
  });
});
