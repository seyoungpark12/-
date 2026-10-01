/**
 * 총점 = Σ(지표 점수 × 가중치).  가중치 기본 1 → -20 ~ +20.
 * 결측 지표는 0점으로 취급하지 않고 합산에서 제외. (cfg.rescaleMissing=true 면 10/사용가능 수 로 비례 보정)
 */
export function totalScore(scored, cfg) {
  let sum = 0, n = 0, wUsed = 0, wAll = 0;
  const unavailable = [];
  for (const key of cfg.indicatorOrder) {
    const w = cfg.weights[key] === undefined ? 1 : cfg.weights[key];
    wAll += w;
    const r = scored[key];
    if (!r || !r.available || !Number.isFinite(r.score)) { unavailable.push(key); continue; }
    sum += r.score * w; n += 1; wUsed += w;
  }
  const scale = cfg.rescaleMissing && wUsed > 0 ? wAll / wUsed : 1;
  const total = Math.round(sum * scale);
  return {
    total, rawSum: sum, availableCount: n, unavailable, scaled: scale !== 1,
    maxPossible: Math.round(2 * wUsed * scale), minPossible: -Math.round(2 * wUsed * scale),
    scoreRange: [-Math.round(2 * wAll), Math.round(2 * wAll)],
  };
}

/** 점수 변화 이력: totals(과거→현재 순서의 배열) 와 현재 인덱스 */
export function scoreHistoryStats(totals, i, cfg) {
  const w = (cfg && cfg.scoreHistory && cfg.scoreHistory.recentWindow) || 60;
  const cur = totals[i];
  const get = (k) => (i - k >= 0 && Number.isFinite(totals[i - k]) ? totals[i - k] : null);
  const slice = totals.slice(Math.max(0, i - w + 1), i + 1).filter(Number.isFinite);
  const prev = get(1);
  return {
    current: cur,
    previous: prev,
    change: prev === null ? null : cur - prev,
    fiveDaysAgo: get(5),
    twentyDaysAgo: get(20),
    change5: get(5) === null ? null : cur - get(5),
    change20: get(20) === null ? null : cur - get(20),
    recentMax: slice.length ? Math.max(...slice) : null,
    recentMin: slice.length ? Math.min(...slice) : null,
    window: w,
  };
}
