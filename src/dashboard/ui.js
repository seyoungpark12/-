/** 대시보드 공용 UI 헬퍼 */
export const esc = (s) => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const fmtPct = (x, d = 1) => (Number.isFinite(x) ? `${x > 0 ? '+' : ''}${(x * 100).toFixed(d)}%` : 'n/a');
export const fmtNum = (x, d = 2) => (Number.isFinite(x) ? x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : 'n/a');
export const fmtSigned = (x) => (x === null || x === undefined || !Number.isFinite(x) ? 'n/a' : x > 0 ? `+${x}` : `${x}`);
export const fmtUsd = (x) => (Number.isFinite(x) ? '$' + Math.round(x).toLocaleString('en-US') : 'n/a');

export function scoreClass(score) {
  if (score === null || score === undefined) return 'sc-na';
  return { '-2': 'sc-m2', '-1': 'sc-m1', '0': 'sc-0', '1': 'sc-p1', '2': 'sc-p2' }[String(score)];
}

export function phaseBadge(phase, label) {
  return `<span class="phase-badge" style="color:${phase.color};border-color:${phase.color};background:${phase.color}1f">${phase.emoji} ${esc(label || phase.label)}</span>`;
}

export function toast(msg, ms = 2600) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div'); el.id = 'toast';
    el.style.cssText = 'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:#1d2a55;border:1px solid #3b5fd0;color:#fff;padding:10px 18px;border-radius:10px;z-index:99;font-size:14px;opacity:0;transition:opacity .2s;pointer-events:none';
    document.body.appendChild(el);
  }
  el.textContent = msg; el.style.opacity = '1';
  clearTimeout(el._t); el._t = setTimeout(() => { el.style.opacity = '0'; }, ms);
}

export const NAV = [
  ['index.html', '대시보드'], ['backtest.html', '백테스트'], ['tests.html', '테스트'],
];
export function topbar(active) {
  return `<header class="topbar"><span class="brand">📈 US MARKET MACRO SIGNAL</span><nav>${NAV.map(([h, t]) => `<a href="${h}" class="${h === active ? 'active' : ''}">${t}</a>`).join('')}</nav></header>`;
}

export const DISCLAIMER = '이 시스템은 미국 주요 지수(S&P 500 / Nasdaq 100)의 거시환경을 규칙 기반으로 모니터링하는 도구이며 투자 자문이 아닙니다. 점수와 단계는 "현재 거시환경이 어떤 국면에 가까운지"를 나타내는 신호일 뿐 매수·매도 결정을 대신하지 않고, 자동 주문 기능도 없습니다. 개별 종목 추천은 범위에서 제외됩니다. 투자 판단과 책임은 이용자 본인에게 있습니다.';
