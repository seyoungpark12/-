/**
 * 바닥 탐색 가능 구간 (BOTTOMING_SETUP) — '바닥 확정'이 아님.
 * 조건:  가격 조정 ≥ 10% (필수)
 *      + [VIX 높음 후 급등 진정, HY 확대 후 안정, 10Y 상승세 둔화/하락, 물가 악화세 둔화, EPS 하향세 둔화] 중 N개 이상 (기본 3)
 * 안전장치(HARD)가 작동 중이면 false.
 */
import { deepestDrawdown } from './priceFilter.js';

export function detectBottomingSetup({ prices, scored, measures, override }, cfg) {
  const c = cfg.bottoming;
  const deepest = deepestDrawdown(prices || []);
  const dd = deepest ? deepest.drawdown : NaN;
  const conds = [];
  const add = (key, label, known, met, detail) => conds.push({ key, label, known, met: known && !!met, detail });

  const mv = measures || {};
  const sc = scored || {};

  const vix = mv.vix && mv.vix.available ? mv.vix : null;
  add('vix', 'VIX 높음 후 급등 진정', !!vix, vix && vix.details.peak >= cfg.vix.elevated && !vix.details.sustainedSurge,
    vix ? `VIX ${vix.value.toFixed(1)} (30일 고점 ${vix.details.peak.toFixed(1)})` : '데이터 없음');

  const hy = mv.hy && mv.hy.available ? mv.hy : null;
  add('hy', 'HY Spread 상승 후 안정', !!hy, hy && hy.details.stabilized,
    hy ? `고점 대비 ${((hy.details.nearPeak - 1) * 100).toFixed(1)}%, 60일 내 상승폭 ${(hy.details.risen * 100).toFixed(0)}%` : '데이터 없음');

  const y = mv.y10 && mv.y10.available ? mv.y10 : null;
  const ys = sc.y10 && sc.y10.available ? sc.y10.score : null;
  add('y10', '10Y 금리 상승세 둔화/하락', ys !== null && !!y, ys !== null && (ys >= 1 || (ys === 0 && y.details.d5 <= 0)),
    y ? `20일 ${y.details.d20.toFixed(0)}bp, 5일 ${y.details.d5.toFixed(0)}bp` : '데이터 없음');

  const inf = sc.inflation && sc.inflation.available ? sc.inflation.score : null;
  add('inflation', '물가 악화세 둔화', inf !== null, inf !== null && inf >= 0, inf !== null ? `물가 점수 ${inf}` : '데이터 없음');

  const e = mv.eps && mv.eps.available ? mv.eps : null;
  const es = sc.eps && sc.eps.available ? sc.eps.score : null;
  add('eps', 'EPS 하향세 둔화', es !== null && !!e, es !== null && (es >= 0 || (e.details.rev1 > e.details.rev1Prev)),
    e ? `1M 리비전 ${e.details.rev1.toFixed(2)}% (직전월 ${Number.isFinite(e.details.rev1Prev) ? e.details.rev1Prev.toFixed(2) : 'n/a'}%)` : 'EPS 데이터 없음');

  const metCount = conds.filter(x => x.met).length;
  const knownCount = conds.filter(x => x.known).length;
  const ddOk = Number.isFinite(dd) && dd <= c.minDrawdown;
  const blocked = !!(override && override.hard);
  const detected = ddOk && metCount >= c.minOthers && !blocked;
  return {
    detected, label: '바닥 탐색 가능 구간', drawdown: dd, drawdownSymbol: deepest ? deepest.symbol : null,
    ddOk, metCount, knownCount, required: c.minOthers, conditions: conds, blockedByOverride: blocked,
  };
}
