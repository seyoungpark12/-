/**
 * 가격 조정 필터 (순수 함수).
 * drawdown = (현재가격 / 최근고점) - 1.  이 구간 자체를 매수 신호로 사용하지 않는다(상한/위험 판단의 입력으로만 사용).
 */
import { idxAtOrBefore, maxRange, minRange, mean } from '../data/series.js';

export function classifyDrawdown(dd, cfg) {
  for (const b of cfg.price.bands) if (dd >= b.min) return b.label;
  return cfg.price.bands[cfg.price.bands.length - 1].label;
}

export function computePriceInfo(series, symbol, day, cfg) {
  const c = cfg.price;
  const base = { symbol, available: false };
  if (!series || !series.t.length) return { ...base, reason: `${symbol} 가격 데이터 없음` };
  const i = idxAtOrBefore(series, day);
  if (i < 0) return { ...base, reason: `${symbol} 기준일 이전 가격 데이터 없음` };
  const age = day - series.t[i];
  if (age > c.maxStaleDays) return { ...base, stale: true, reason: `${symbol} 가격이 ${age}일 지연됨(오류 가능)` };
  if (i + 1 < c.minObs) return { ...base, reason: `${symbol} 가격 이력 ${i + 1}개 (최소 ${c.minObs}개 필요)` };

  const v = series.v;
  const close = v[i];
  const from = Math.max(0, i - c.highLookback + 1);
  const high = maxRange(v, from, i);
  let highIdx = i; for (let k = i; k >= from; k--) if (v[k] === high) { highIdx = k; break; }
  const lowFrom = Math.max(0, i - 59);
  const low = minRange(v, lowFrom, i);
  let lowIdx = i; for (let k = i; k >= lowFrom; k--) if (v[k] === low) { lowIdx = k; break; }
  const ma = (n) => (i + 1 >= n ? mean(v.slice(i - n + 1, i + 1)) : NaN);
  const ma20 = ma(20), ma50 = ma(50), ma200 = ma(200);
  const drawdown = close / high - 1;

  // 최근 check 거래일 중 '신저가(직전 window 거래일 최저 하회)' 갱신 횟수
  let newLows = 0;
  for (let k = 0; k < c.newLowCheck; k++) {
    const idx = i - k;
    if (idx - c.newLowWindow < 0) break;
    if (v[idx] < minRange(v, idx - c.newLowWindow, idx - 1)) newLows++;
  }
  return {
    symbol, available: true, stale: false,
    date: series.t[i], close, high, highIdx, highDay: series.t[highIdx], daysFromHigh: i - highIdx,
    recentLow: low, recentLowDay: series.t[lowIdx], fromRecentLow: close / low - 1,
    drawdown, band: classifyDrawdown(drawdown, cfg),
    ma20, ma50, ma200,
    aboveMa20: close > ma20, aboveMa50: close > ma50, aboveMa200: close > ma200,
    newLows, makingNewLows: newLows >= c.newLowCount,
  };
}

/** 여러 지수 중 가장 깊은 낙폭 */
export function deepestDrawdown(prices) {
  let best = null;
  for (const p of prices) if (p && p.available && (best === null || p.drawdown < best.drawdown)) best = p;
  return best;
}

/** 차트용 롤링 통계: 이동평균·낙폭 시계열 (series 전체) */
export function priceSeriesStats(series, cfg, maWindows = [50, 200]) {
  const n = series.v.length;
  const out = { t: series.t, v: series.v, ma: {}, dd: new Array(n).fill(null), high: new Array(n).fill(null) };
  for (const w of maWindows) {
    const arr = new Array(n).fill(null);
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += series.v[i];
      if (i >= w) sum -= series.v[i - w];
      if (i >= w - 1) arr[i] = sum / w;
    }
    out.ma[w] = arr;
  }
  const L = cfg.price.highLookback;
  const dq = []; // 단조 감소 deque (슬라이딩 최댓값)
  for (let i = 0; i < n; i++) {
    while (dq.length && series.v[dq[dq.length - 1]] <= series.v[i]) dq.pop();
    dq.push(i);
    while (dq[0] <= i - L) dq.shift();
    if (i + 1 >= cfg.price.minObs) { const h = series.v[dq[0]]; out.high[i] = h; out.dd[i] = series.v[i] / h - 1; }
  }
  return out;
}
