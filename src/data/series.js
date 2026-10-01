/**
 * 시계열 유틸 (순수 함수). 날짜는 'YYYY-MM-DD' 문자열 ↔ 1970-01-01 기준 일수(day number) 로 변환해 사용.
 * Point-in-time: idxAsOf(series, day) 는 (관측일 + 발표지연 lagDays) <= day 인 마지막 관측치만 반환 → 미래 정보 사용 방지.
 */
export const DAY_MS = 86400000;

export function toDay(str) {
  return Math.round(Date.UTC(+str.slice(0, 4), +str.slice(5, 7) - 1, +str.slice(8, 10)) / DAY_MS);
}
export function toStr(day) {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}
export function addMonths(day, m) {
  const dt = new Date(day * DAY_MS);
  const y = dt.getUTCFullYear(), mo = dt.getUTCMonth() + m, d = dt.getUTCDate();
  const dim = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
  return Math.round(Date.UTC(y, mo, Math.min(d, dim)) / DAY_MS);
}

/** rows: [{date:'YYYY-MM-DD', value:Number}] → Series. 값이 유한하지 않은 행은 제외(0 으로 채우지 않음). */
export function makeSeries(id, rows, meta = {}) {
  const t = [], v = [];
  for (const r of rows) {
    if (!Number.isFinite(r.value)) continue;
    t.push(toDay(r.date));
    v.push(r.value);
  }
  return { id, t, v, meta };
}

/** t[i] <= day 인 마지막 인덱스 (없으면 -1) */
export function idxAtOrBefore(s, day) {
  let lo = 0, hi = s.t.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (s.t[mid] <= day) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

/** point-in-time: t[i] + lag <= day */
export function idxAsOf(s, day, lag) {
  const L = lag === undefined ? (s.meta.lagDays || 0) : lag;
  return idxAtOrBefore(s, day - L);
}

/** i 번째 관측치의 k개월 전 관측 인덱스 (허용오차 tol일, 없으면 -1) */
export function monthIdx(s, i, k, tol = 20) {
  if (k === 0) return i;
  const target = addMonths(s.t[i], -k);
  const j = idxAtOrBefore(s, target);
  if (j < 0 || target - s.t[j] > tol) return -1;
  return j;
}
export function valueMonthsBack(s, i, k, tol = 20) {
  const j = monthIdx(s, i, k, tol);
  return j < 0 ? NaN : s.v[j];
}
/** i 번째 관측치 기준 days 일 전 값 (허용오차 tol일) */
export function valueDaysBack(s, i, days, tol) {
  const target = s.t[i] - days;
  const j = idxAtOrBefore(s, target);
  if (j < 0 || target - s.t[j] > tol) return NaN;
  return s.v[j];
}

export function maxRange(arr, a, b) {
  let m = -Infinity;
  for (let i = Math.max(0, a); i <= b; i++) if (arr[i] > m) m = arr[i];
  return m;
}
export function minRange(arr, a, b) {
  let m = Infinity;
  for (let i = Math.max(0, a); i <= b; i++) if (arr[i] < m) m = arr[i];
  return m;
}
export function mean(xs) {
  const a = xs.filter(Number.isFinite);
  return a.length ? a.reduce((p, c) => p + c, 0) / a.length : NaN;
}
