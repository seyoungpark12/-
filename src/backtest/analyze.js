/**
 * 백테스트 분석 (순수 함수).
 * 목적은 '수익률 최대화'가 아니라 다음을 확인하는 것:
 *   - 급락 초기에 너무 빨리 매수 단계가 되는가?   - 바닥 근처에서 점수가 실제로 개선되는가?
 *   - 회복 후 너무 늦게 신호가 나오는가?          - 신용위기에서 안전장치가 작동하는가?
 *   - 4단계 신호가 실제 시장 국면 변화와 어느 정도 일치하는가?
 * 입력 rows 는 replay() 결과(point-in-time 점수) 이며, 가격은 원 시계열에서 일 단위로 읽는다.
 */
import { idxAtOrBefore, toDay, toStr } from '../data/series.js';
import { phaseByKey } from '../config.js';

const DAY = 1;
const nz = (x) => (Number.isFinite(x) ? x : null);

/** 에피소드 가격 시계열 선택: S&P 500 이력이 (시작일-300일) 이전부터 있으면 S&P, 아니면 Nasdaq 100 */
export function pickPriceSeries(ds, startDay) {
  const sp = ds.series.SP500;
  if (sp && sp.t.length && sp.t[0] <= startDay - 300) return { id: 'SP500', label: 'S&P 500', series: sp, proxy: false };
  const nq = ds.series.NASDAQ100;
  if (nq && nq.t.length && nq.t[0] <= startDay - 300) return { id: 'NASDAQ100', label: 'Nasdaq 100 (S&P 500 일별 이력 없음 → 대체)', series: nq, proxy: true };
  return null;
}

function windowIdx(series, a, b) {
  return [idxAtOrBefore(series, a - 1) + 1, idxAtOrBefore(series, b)];
}

/** 구간 내 최대 낙폭(running peak 기준)과 해당 고점/저점 인덱스 */
export function maxDrawdownIn(series, i0, i1) {
  let peak = i0, best = { dd: 0, ip: i0, it: i0 };
  const v = series.v;
  for (let k = i0; k <= i1; k++) {
    if (v[k] > v[peak]) peak = k;
    const dd = v[k] / v[peak] - 1;
    if (dd < best.dd) best = { dd, ip: peak, it: k };
  }
  return best;
}

function scoreAtFactory(rows) {
  return (day) => {
    let lo = 0, hi = rows.length - 1, ans = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (rows[mid].day <= day) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
    return ans < 0 ? null : rows[ans].total;
  };
}

export function episodeAnalysis(ds, cfg, rows, ep) {
  const a = toDay(ep.start), b = toDay(ep.end);
  const px = pickPriceSeries(ds, a);
  if (!px) return { ep, available: false, reason: '가격 데이터 없음' };
  const [i0, i1] = windowIdx(px.series, a, b);
  if (i1 - i0 < 20) return { ep, available: false, reason: '구간 내 가격 데이터 부족' };
  const S = px.series, v = S.v, t = S.t;
  const j = cfg.backtest.judge;
  const rk = (key) => phaseByKey(cfg, key).rank;
  const BUY1 = phaseByKey(cfg, 'BUY1').rank, BUY2 = phaseByKey(cfg, 'BUY2').rank;

  const md = maxDrawdownIn(S, i0, i1);
  const peakDay = t[md.ip], troughDay = t[md.it], peakPx = v[md.ip], troughPx = v[md.it];
  const rowsIn = rows.filter(r => r.day >= a && r.day <= b);
  const scoreAt = scoreAtFactory(rows);

  // 구간 running peak (신호 시점의 고점 대비 낙폭)
  const runPeak = new Array(i1 - i0 + 1);
  { let p = -Infinity; for (let k = i0; k <= i1; k++) { p = Math.max(p, v[k]); runPeak[k - i0] = p; } }
  const metric = (day) => {
    const k = Math.min(i1, Math.max(i0, idxAtOrBefore(S, day)));
    const price = v[k];
    const before = day <= troughDay;
    return {
      date: toStr(day), day, price,
      ddFromPeak: price / runPeak[k - i0] - 1,
      beforeTrough: before,
      furtherDrop: before ? troughPx / price - 1 : null,          // 신호 이후 저점까지 추가 하락
      aboveTrough: !before ? price / troughPx - 1 : null,         // 신호 시점이 저점보다 얼마나 위인가
      daysToTrough: troughDay - day,
    };
  };

  const alertRows = rowsIn.filter(r => r.alert === 1);
  const alerts = alertRows.map(r => ({ ...metric(r.day), phaseKey: r.phaseKey, total: r.total, label: phaseByKey(cfg, r.phaseKey).label }));
  const firstBuy1Row = rowsIn.find(r => rk(r.phaseKey) >= BUY1) || null;
  const firstBuy1AfterTroughRow = rowsIn.find(r => r.day >= troughDay && rk(r.phaseKey) >= BUY1) || null;

  // 단계 분포
  const phaseCount = {}; for (const p of cfg.phases) phaseCount[p.key] = 0;
  rowsIn.forEach(r => { phaseCount[r.phaseKey]++; });
  const buy1PlusRows = rowsIn.filter(r => rk(r.phaseKey) >= BUY1);
  const buy2PlusRows = rowsIn.filter(r => rk(r.phaseKey) >= BUY2);
  const buy1Before = buy1PlusRows.filter(r => r.day < troughDay).length;
  const buy1After = buy1PlusRows.length - buy1Before;

  // 점수 흐름
  const sTrM30 = scoreAt(troughDay - 30), sTr = scoreAt(troughDay), sTrP30 = scoreAt(troughDay + 30), sTrP60 = scoreAt(troughDay + 60);
  const scoreWin = rowsIn.filter(r => r.day >= peakDay && r.day <= troughDay + 90);
  const minRow = scoreWin.reduce((m, r) => (m === null || r.total < m.total ? r : m), null);
  const maxRow = rowsIn.reduce((m, r) => (m === null || r.total > m.total ? r : m), null);

  // 안전장치 (고점→저점 구간)
  const drop = rowsIn.filter(r => r.day >= peakDay && r.day <= troughDay);
  const hardDays = drop.filter(r => r.override === 'HARD').length;
  const comboDays = drop.filter(r => r.override === 'COMBO').length;
  const firstOv = drop.find(r => r.override !== 'NONE');
  const suppressedRawBuy2 = drop.filter(r => rk(r.rawPhaseKey) >= BUY2 && rk(r.phaseKey) < rk(r.rawPhaseKey)).length;
  const leakBuy2 = drop.filter(r => rk(r.phaseKey) >= BUY2).length;

  // 바닥 탐색
  const bRows = rowsIn.filter(r => r.bottoming);
  const bFirst = bRows[0] || null;
  const bMetric = bFirst ? metric(bFirst.day) : null;

  // 회복
  let rec10 = null, rec20 = null, recPeak = null;
  for (let k = md.it + 1; k <= i1; k++) {
    if (rec10 === null && v[k] >= troughPx * 1.10) rec10 = t[k];
    if (rec20 === null && v[k] >= troughPx * 1.20) rec20 = t[k];
    if (recPeak === null && v[k] >= peakPx) recPeak = t[k];
  }

  // 첫 알림 이후 선행 수익률(참고)
  const fwd = {};
  const first = alerts[0];
  if (first) {
    const k0 = idxAtOrBefore(S, first.day);
    for (const n of cfg.backtest.fwdDays) fwd[n] = k0 + n < v.length ? v[k0 + n] / v[k0] - 1 : null;
  }

  const st = {
    ep, available: true, price: { id: px.id, label: px.label, proxy: px.proxy },
    peak: { date: toStr(peakDay), day: peakDay, px: peakPx }, trough: { date: toStr(troughDay), day: troughDay, px: troughPx },
    maxDD: md.dd, daysPeakToTrough: troughDay - peakDay,
    rowCount: rowsIn.length,
    alerts, firstAlert: alerts[0] || null,
    firstBuy1: firstBuy1Row ? metric(firstBuy1Row.day) : null,
    firstBuy1AfterTrough: firstBuy1AfterTroughRow ? metric(firstBuy1AfterTroughRow.day) : null,
    phaseCount, phaseShare: Object.fromEntries(Object.entries(phaseCount).map(([k, n]) => [k, rowsIn.length ? n / rowsIn.length : 0])),
    buy1PlusShare: rowsIn.length ? buy1PlusRows.length / rowsIn.length : 0,
    buy2PlusShare: rowsIn.length ? buy2PlusRows.length / rowsIn.length : 0,
    buy1Before, buy1After,
    score: {
      troughM30: sTrM30, trough: sTr, troughP30: sTrP30, troughP60: sTrP60,
      improvement30: sTrM30 !== null && sTrP30 !== null ? sTrP30 - sTrM30 : null,
      min: minRow ? { date: minRow.date, total: minRow.total, offsetDays: minRow.day - troughDay } : null,
      max: maxRow ? { date: maxRow.date, total: maxRow.total } : null,
    },
    override: { dropRows: drop.length, hardDays, comboDays, firstDate: firstOv ? firstOv.date : null, suppressedRawBuy2, leakBuy2 },
    bottoming: { count: bRows.length, first: bMetric, beforeTrough: bRows.filter(r => r.day < troughDay).length },
    recovery: { rec10: rec10 === null ? null : toStr(rec10), rec20: rec20 === null ? null : toStr(rec20), recPeak: recPeak === null ? null : toStr(recPeak), rec10Day: rec10, rec20Day: rec20 },
    fwd,
  };
  st.findings = buildFindings(st, cfg, j);
  return st;
}

const pc = (x, d = 1) => (Number.isFinite(x) ? `${(x * 100).toFixed(d)}%` : 'n/a');

/** 규칙 기반 판정 문장 (ok / warn / bad / info) */
export function buildFindings(st, cfg, j) {
  const f = [];
  const add = (level, text) => f.push({ level, text });
  const ep = st.ep;

  if (ep.type === 'bull') {
    add('info', `구간 최대 낙폭 ${pc(st.maxDD)} (${st.price.label}) — 상승장 구간.`);
    if (st.alerts.length <= j.bullAlertMax) add('ok', `상승장에서 단계 진입 알림 ${st.alerts.length}회 (허용 ${j.bullAlertMax}회 이하) — 추격 매수 신호가 억제됨.`);
    else add('warn', `상승장에서 단계 진입 알림 ${st.alerts.length}회 — 허용(${j.bullAlertMax}회) 초과. 가격 조정 게이트/임계값 점검 필요.`);
    if (st.buy2PlusShare <= j.bullAlertMax * 0 + j.bullBuy2ShareMax) add('ok', `2차 이상 단계 비중 ${pc(st.buy2PlusShare)} (상한 ${pc(j.bullBuy2ShareMax, 0)}).`);
    else add('warn', `2차 이상 단계 비중 ${pc(st.buy2PlusShare)} — 상승장에서 과도. 가격 게이트(고점 부근 상한) 조정 검토.`);
    return f;
  }

  add('info', `${st.price.label} 고점 ${st.peak.date} → 저점 ${st.trough.date} (${st.daysPeakToTrough}일), 낙폭 ${pc(st.maxDD)}.`);
  if (st.price.proxy) add('info', 'S&P 500 일별 이력이 없는 구간이라 Nasdaq 100 가격으로 낙폭을 계산했습니다.');

  const first = st.firstBuy1;
  if (!first) {
    add('warn', '구간 내 1차 매수 검토 이상 단계가 한 번도 발생하지 않았습니다 (신호 부재 — 임계값/결측 지표 영향 점검).');
  } else {
    if (first.beforeTrough) {
      const fd = first.furtherDrop;
      const msg = `첫 1차 이상 단계 ${first.date} (고점 대비 ${pc(first.ddFromPeak)}, 저점 ${first.daysToTrough}일 전) → 이후 저점까지 추가 ${pc(-fd)} 하락.`;
      if (-fd >= -j.earlyWarn) add('warn', `급락 초기 조기 진입 가능성: ${msg}`);
      else if (-fd >= -j.earlyInfo) add('info', msg);
      else add('ok', msg);
    } else {
      add('ok', `첫 1차 이상 단계 ${first.date} — 저점(${st.trough.date}) 이후(저점 대비 ${pc(first.aboveTrough)}). 저점 이전에는 매수 단계가 없었음(조기 진입 방지).`);
    }
  }

  if (st.score.improvement30 !== null) {
    const imp = st.score.improvement30;
    if (imp >= j.scoreImprove) add('ok', `저점 전후 점수 개선: ${st.score.troughM30} → ${st.score.troughP30} (+${imp}, 저점 -30일 → +30일).`);
    else add('warn', `저점 전후 점수 개선이 약함: ${st.score.troughM30} → ${st.score.troughP30} (${imp >= 0 ? '+' : ''}${imp}). 점수가 바닥 형성을 늦게/약하게 반영.`);
  }
  if (st.score.min) {
    const off = st.score.min.offsetDays;
    add('info', `점수 최저 ${st.score.min.total} (${st.score.min.date}) — 가격 저점 대비 ${off === 0 ? '같은 날' : off < 0 ? `${-off}일 먼저` : `${off}일 늦게`} 형성.`);
  }

  if (st.maxDD <= j.deepBear) {
    if (st.override.hardDays + st.override.comboDays > 0) {
      add('ok', `안전장치 작동: 고점~저점 ${st.override.dropRows}개 시점 중 HARD ${st.override.hardDays}회 · COMBO ${st.override.comboDays}회 (첫 작동 ${st.override.firstDate}); 2차 이상 상향 ${st.override.suppressedRawBuy2}회 억제.`);
    } else add('warn', `낙폭 ${pc(st.maxDD)} 의 위기성 하락인데 안전장치(VIX·HY 급등)가 한 번도 작동하지 않음 — 급등 판정 임계값 점검.`);
    if (st.override.leakBuy2 > 0) add('warn', `고점~저점 구간에서 2차 이상 매수 단계가 ${st.override.leakBuy2}회 표시됨 — 하락 중 과도한 단계 상승 가능성.`);
    else add('ok', '고점~저점 구간에서 2차 이상 매수 단계가 표시되지 않음.');
  }

  const fb = st.firstBuy1AfterTrough;
  if (fb) {
    const reb = fb.aboveTrough;
    if (reb > j.lateRebound) add('warn', `회복 후 지연: 저점 이후 첫 1차 이상 단계가 저점 대비 ${pc(reb)} 반등한 뒤(${fb.date})에 발생.`);
    else add('ok', `저점 이후 첫 1차 이상 단계 ${fb.date} (저점 대비 ${pc(reb)}, 반등 초기).`);
  } else if (st.recovery.rec10) add('warn', `저점 이후 +10% 반등(${st.recovery.rec10})까지 1차 이상 단계가 나오지 않음 — 회복 구간 신호 부재.`);

  if (st.buy1PlusShare > 0) {
    const afterShare = st.buy1After / (st.buy1Before + st.buy1After);
    add(afterShare >= 0.6 ? 'ok' : 'info', `1차 이상 단계 ${st.buy1Before + st.buy1After}개 시점 중 저점 이후 ${pc(afterShare, 0)} (이전 ${st.buy1Before} / 이후 ${st.buy1After}).`);
  }
  if (st.bottoming.first) {
    const bm = st.bottoming.first;
    add('info', `바닥 탐색 가능 구간 첫 감지 ${bm.date} (${bm.beforeTrough ? `저점 ${bm.daysToTrough}일 전, 이후 추가 ${pc(-bm.furtherDrop)} 하락` : `저점 이후 ${pc(bm.aboveTrough)}`}); 총 ${st.bottoming.count}개 시점 (저점 이전 ${st.bottoming.beforeTrough}).`);
  } else add('info', '구간 내 바닥 탐색 가능 구간이 감지되지 않음.');
  if (st.firstAlert && st.fwd[126] !== undefined && st.fwd[126] !== null) add('info', `참고: 첫 알림(${st.firstAlert.date}) 이후 63/126/252거래일 수익률 ${[63, 126, 252].map(n => pc(st.fwd[n])).join(' / ')} (결과 확인용이며 미래 성과를 의미하지 않음).`);
  return f;
}

/** 단계별 선행 수익률 통계 (겹치는 구간 존재 → 통계적 독립 아님) */
export function phaseForwardStats(ds, cfg, rows, instrumentId) {
  const S = ds.series[instrumentId];
  if (!S) return null;
  const buckets = {};
  for (const p of cfg.phases) buckets[p.key] = { n: 0, dd: [], fwd: Object.fromEntries(cfg.backtest.fwdDays.map(n => [n, []])) };
  let used = 0;
  for (const r of rows) {
    const k = idxAtOrBefore(S, r.day);
    if (k < 0 || r.day - S.t[k] > 7) continue;
    if (S.t[0] > r.day - 252) continue;
    const bk = buckets[r.phaseKey];
    bk.n++; used++;
    const dd = r.drawdown;
    if (dd !== null && dd !== undefined) bk.dd.push(dd);
    for (const n of cfg.backtest.fwdDays) if (k + n < S.v.length) bk.fwd[n].push(S.v[k + n] / S.v[k] - 1);
  }
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const out = {};
  for (const p of cfg.phases) {
    const bk = buckets[p.key];
    out[p.key] = {
      n: bk.n, avgDD: mean(bk.dd),
      fwd: Object.fromEntries(cfg.backtest.fwdDays.map(n => [n, { n: bk.fwd[n].length, mean: mean(bk.fwd[n]), median: median(bk.fwd[n]), hit: bk.fwd[n].length ? bk.fwd[n].filter(x => x > 0).length / bk.fwd[n].length : null, worst: bk.fwd[n].length ? Math.min(...bk.fwd[n]) : null }])),
    };
  }
  return { instrument: instrumentId, used, stats: out };
}

export { nz, DAY };
