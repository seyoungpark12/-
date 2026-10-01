/** 투자금 분할 예시 (자동 주문 없음, 예시 배분만 표시) */
import { esc, fmtUsd } from './ui.js';

const LS = 'usmacro.alloc.v1';
const ROWS = [
  { key: 'buy1', label: '1차 매수 검토', phase: 'BUY1' },
  { key: 'buy2', label: '2차 매수 검토', phase: 'BUY2' },
  { key: 'buy3', label: '적극적 매수 검토', phase: 'BUY3' },
  { key: 'reserve', label: '예비 현금', phase: null },
];

export function loadAlloc(cfg) {
  try { const o = JSON.parse(localStorage.getItem(LS) || 'null'); if (o) return o; } catch (_) { /* ignore */ }
  return { total: 100000, pct: { ...cfg.allocation } };
}
function save(a) { try { localStorage.setItem(LS, JSON.stringify(a)); } catch (_) { /* ignore */ } }

export function renderAllocation(root, cfg, phaseKey) {
  const a = loadAlloc(cfg);
  const draw = () => {
    const sum = ROWS.reduce((s, r) => s + (+a.pct[r.key] || 0), 0);
    const ok = Math.abs(sum - 1) < 0.0005;
    const phaseRank = { BUY1: 1, BUY2: 2, BUY3: 3 }[phaseKey] || 0;
    let cum = 0;
    root.innerHTML = `
      <div class="form-grid">
        <div><label for="alloc-total">총 투자 예정금액 (USD)</label><input id="alloc-total" type="number" min="0" step="1000" value="${esc(a.total)}" style="width:100%"></div>
        <div><button class="btn" id="alloc-reset" type="button">기본 비율로 되돌리기</button></div>
      </div>
      <table class="alloc-table">
        <thead><tr><th>단계</th><th>비율(%)</th><th>예시 금액</th><th>누적</th></tr></thead>
        <tbody>
        ${ROWS.map((r) => {
          const p = +a.pct[r.key] || 0; const amt = a.total * p;
          const isCur = r.phase === phaseKey;
          const rank = { BUY1: 1, BUY2: 2, BUY3: 3 }[r.phase] || 0;
          if (r.phase) cum += amt;
          return `<tr class="${isCur ? 'current' : ''}"><td>${esc(r.label)}${isCur ? ' <span class="badge">현재 단계</span>' : ''}</td>
            <td><input type="number" min="0" max="100" step="1" data-k="${r.key}" value="${(p * 100).toFixed(0)}" aria-label="${esc(r.label)} 비율"></td>
            <td class="mono">${fmtUsd(amt)}</td><td class="mono">${r.phase ? (rank <= phaseRank || isCur ? fmtUsd(cum) : '<span class="muted">—</span>') : '<span class="muted">—</span>'}</td></tr>`;
        }).join('')}
        </tbody>
        <tfoot><tr><td><b>합계</b></td><td class="mono ${ok ? '' : 'neg'}" style="${ok ? '' : 'color:#fca5a5'}">${(sum * 100).toFixed(0)}%${ok ? '' : ' ⚠ 100%가 아닙니다'}</td><td class="mono">${fmtUsd(a.total * sum)}</td><td></td></tr></tfoot>
      </table>
      <p class="muted small" style="margin-top:10px">${phaseRank
        ? `현재 단계 기준으로 "${ROWS[phaseRank - 1].label}"까지의 누적 예시 금액은 <b>${fmtUsd(ROWS.slice(0, phaseRank).reduce((s, r) => s + a.total * (+a.pct[r.key] || 0), 0))}</b> 입니다.`
        : '현재는 매수 검토 단계(1차 이상)가 아니므로 누적 금액을 표시하지 않습니다.'}
      기본 예시 배분이며 실제 투자 결정을 자동 실행하지 않습니다. (자동 주문 기능 없음)</p>`;
    root.querySelector('#alloc-total').addEventListener('change', (e) => { a.total = Math.max(0, +e.target.value || 0); save(a); draw(); });
    root.querySelectorAll('input[data-k]').forEach(inp => inp.addEventListener('change', (e) => { a.pct[e.target.dataset.k] = Math.max(0, Math.min(100, +e.target.value || 0)) / 100; save(a); draw(); }));
    root.querySelector('#alloc-reset').addEventListener('click', () => { a.pct = { ...cfg.allocation }; save(a); draw(); });
  };
  draw();
}
