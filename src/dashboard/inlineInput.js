/**
 * #9 EPS / #10 Forward PER 카드(모달)에서 바로 값을 입력하는 패널 + 확인용 참고 사이트 링크.
 * - 저장 위치: localStorage (readLocalManual/writeLocalManual) — 기존 '수동 데이터 입력' 섹션과 동일 저장소
 * - 임의 추정값 금지: 기준일·양수 값·출처가 모두 있어야 저장됨
 */
import { esc, toast } from './ui.js';
import { readLocalManual, writeLocalManual } from '../data/loader.js';

/** 값 확인용 참고 사이트. (사이트 개편으로 주소가 바뀔 수 있으니 접속이 안 되면 사이트명으로 검색) */
export const REF_LINKS = {
  eps: [
    { name: 'FactSet Earnings Insight', url: 'https://insight.factset.com/topic/earnings', note: '매주 발표 · S&P 500 12개월 Forward EPS / Forward P/E 를 가장 쉽게 확인 (리포트 PDF 의 "Forward 12M EPS")' },
    { name: 'Yardeni Research — Charts', url: 'https://yardeni.com/charts/', note: 'S&P 500 Forward Earnings / Forward P/E 차트 (검색: "Forward Earnings")' },
    { name: 'S&P Dow Jones Indices — S&P 500', url: 'https://www.spglobal.com/spdji/en/indices/equity/sp-500/', note: '공식 지수 페이지 · 하단 "Additional Material" 의 S&P 500 Earnings & Estimates 엑셀' },
  ],
  valuation: [
    { name: 'FactSet Earnings Insight', url: 'https://insight.factset.com/topic/earnings', note: 'Forward 12M P/E + 5년·10년 평균 P/E 가 같은 리포트에 함께 표시 (벤치마크 입력에 가장 적합)' },
    { name: 'Yardeni Research — Charts', url: 'https://yardeni.com/charts/', note: 'S&P 500 Forward P/E 차트 (검색: "Forward P/E")' },
    { name: 'WSJ — S&P 500 P/E', url: 'https://www.wsj.com/market-data/stocks/peyields', note: 'P/E 및 추정(Estimate) P/E 표 · 일부 구간은 로그인/구독 필요' },
    { name: 'multpl — S&P 500 PE (후행)', url: 'https://www.multpl.com/s-p-500-pe-ratio', note: '⚠ 후행(Trailing) PER 입니다. Forward PER 와 정의가 달라 이 칸에 넣지 마세요 (참고용)' },
  ],
};

/** 모달 하단 참고 링크 블록 */
export function refLinksHtml(key) {
  const list = REF_LINKS[key] || [];
  if (!list.length) return '';
  return `<div class="ref-links"><h4>🔗 값 확인 사이트</h4>
    <ul>${list.map(l => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.name)} ↗</a><span class="muted small"> — ${esc(l.note)}</span></li>`).join('')}</ul>
    <p class="muted small" style="margin:6px 0 0">사이트 개편으로 주소가 바뀌었거나 접속이 안 되면 사이트명으로 검색하세요. 출처마다 정의(Forward 12M 등)가 다르므로 <b>한 곳의 값으로 일관되게</b> 입력하는 것을 권장합니다.</p></div>`;
}

const today = () => new Date().toISOString().slice(0, 10);

function pointsList(manual, serieKey, unit) {
  const local = readLocalManual()[serieKey] || [];
  const localDates = new Set(local.map(r => r.date));
  const rows = [...(manual[serieKey] || [])].sort((a, b) => (a.date < b.date ? 1 : -1));
  if (!rows.length) return '<div class="muted small">저장된 값이 없습니다.</div>';
  return rows.map(r => `<div class="row"><span class="mono">${esc(r.date)}</span><b class="mono">${esc(r.value)}${unit}</b><span class="muted small">${esc(r.source || '')}</span>${localDates.has(r.date) ? `<button class="btn small danger" type="button" data-ip-del="${serieKey}|${esc(r.date)}">삭제</button>` : '<span class="muted small">(파일)</span>'}</div>`).join('');
}

/** 입력 패널 HTML. key: 'eps' | 'valuation' */
export function inputPanelHtml(key, ds) {
  const manual = ds.manual || {};
  if (key === 'eps') {
    const n = (manual.FWD_EPS || []).length;
    return `<div class="input-panel" id="input-panel">
      <h4>✍️ Forward EPS 직접 입력</h4>
      <p class="muted small" style="margin:0 0 8px">현재 <b>${n}</b>개 입력됨 · 점수 계산에는 <b>최소 3개 시점</b>(최신, 약 1개월 전, 약 3개월 전)이 필요합니다. 한 번에 하나씩 추가하세요.</p>
      <form id="ip-form" class="form-grid" autocomplete="off">
        <div><label for="ip-date">기준일</label><input id="ip-date" type="date" value="${today()}" required></div>
        <div><label for="ip-value">Forward 12M EPS ($)</label><input id="ip-value" type="number" step="any" min="0" placeholder="예: 두 자리~세 자리 숫자" required></div>
        <div><label for="ip-source">출처</label><input id="ip-source" type="text" placeholder="예: FactSet Earnings Insight" required></div>
        <div><button class="btn primary" type="submit">추가</button></div>
      </form>
      <div class="manual-list" style="margin-top:10px">${pointsList(manual, 'FWD_EPS', '')}</div>
    </div>${refLinksHtml('eps')}`;
  }
  const b = manual.peBench || {};
  const n = (manual.FWD_PE || []).length;
  return `<div class="input-panel" id="input-panel">
    <h4>✍️ Forward PER 직접 입력</h4>
    <p class="muted small" style="margin:0 0 8px">현재 <b>${n}</b>개 입력됨 · 점수 계산에는 <b>최신 Forward PER + 5년 또는 10년 평균 PER</b>이 필요합니다. FactSet Earnings Insight 에는 이 값들이 함께 나옵니다.</p>
    <form id="ip-form" class="form-grid" autocomplete="off">
      <div><label for="ip-date">기준일</label><input id="ip-date" type="date" value="${today()}" required></div>
      <div><label for="ip-value">Forward PER (배)</label><input id="ip-value" type="number" step="any" min="0" placeholder="예: 20.5" required></div>
      <div><label for="ip-avg5">5년 평균 PER</label><input id="ip-avg5" type="number" step="any" min="0" value="${b.avg5y ?? ''}"></div>
      <div><label for="ip-avg10">10년 평균 PER</label><input id="ip-avg10" type="number" step="any" min="0" value="${b.avg10y ?? ''}"></div>
      <div><label for="ip-hi">52주 최고 (선택)</label><input id="ip-hi" type="number" step="any" min="0" value="${b.high52w ?? ''}"></div>
      <div><label for="ip-lo">52주 최저 (선택)</label><input id="ip-lo" type="number" step="any" min="0" value="${b.low52w ?? ''}"></div>
      <div style="grid-column:span 2"><label for="ip-source">출처</label><input id="ip-source" type="text" value="${esc(b.source || '')}" placeholder="예: FactSet Earnings Insight" required style="width:100%"></div>
      <div><button class="btn primary" type="submit">저장</button></div>
    </form>
    <div class="manual-list" style="margin-top:10px">${pointsList(manual, 'FWD_PE', 'x')}</div>
  </div>${refLinksHtml('valuation')}`;
}

/** 모달 안의 입력 패널 이벤트 연결. onSaved: 저장 후 재계산 콜백 */
export function bindInputPanel(root, key, onSaved) {
  const form = root.querySelector('#ip-form');
  if (!form) return;
  const num = (id) => { const el = root.querySelector(id); return el && el.value !== '' ? parseFloat(el.value) : NaN; };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const date = root.querySelector('#ip-date').value;
    const value = num('#ip-value');
    const source = root.querySelector('#ip-source').value.trim();
    if (!date || !Number.isFinite(value) || value <= 0 || !source) { toast('기준일·양수 값·출처를 모두 입력하세요'); return; }
    const cur = readLocalManual();
    const sk = key === 'eps' ? 'FWD_EPS' : 'FWD_PE';
    const arr = (cur[sk] || []).filter(r => r.date !== date);
    arr.push({ date, value, source, release_date: date, period: date.slice(0, 7) });
    arr.sort((x, y) => (x.date < y.date ? -1 : 1));
    cur[sk] = arr;
    if (key === 'valuation') {
      const a5 = num('#ip-avg5'), a10 = num('#ip-avg10'), hi = num('#ip-hi'), lo = num('#ip-lo');
      const bad = [a5, a10, hi, lo].some(v => Number.isFinite(v) && v <= 0);
      if (bad) { toast('평균/52주 값은 0보다 커야 합니다'); return; }
      if (Number.isFinite(a5) || Number.isFinite(a10)) {
        cur.peBench = { avg5y: Number.isFinite(a5) ? a5 : null, avg10y: Number.isFinite(a10) ? a10 : null, high52w: Number.isFinite(hi) ? hi : null, low52w: Number.isFinite(lo) ? lo : null, source, as_of: date };
      }
    }
    writeLocalManual(cur);
    toast('저장했습니다. 점수를 다시 계산합니다.');
    await onSaved();
  });
  root.querySelectorAll('[data-ip-del]').forEach(btn => btn.addEventListener('click', async () => {
    const [k, d] = btn.dataset.ipDel.split('|');
    const cur = readLocalManual(); cur[k] = (cur[k] || []).filter(r => r.date !== d); writeLocalManual(cur);
    await onSaved();
  }));
}
