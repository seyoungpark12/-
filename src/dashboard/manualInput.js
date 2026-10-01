/**
 * 수동 데이터 입력 (ISM PMI / Forward EPS / Forward PER / PER 벤치마크).
 * 무료 공식 API 가 없는 항목. 값은 브라우저 localStorage 에만 저장되며,
 * 'JSON 내보내기'로 data/manual/manual.json 에 반영하면 저장소에 영구 보관할 수 있다.
 * 임의로 추정한 값을 넣지 말 것 — 입력 전에는 해당 지표가 DATA_UNAVAILABLE 로 남는다.
 */
import { esc, toast } from './ui.js';
import { readLocalManual, writeLocalManual } from '../data/loader.js';
import { MANUAL_SERIES } from '../data/registry.js';
import { refLinksHtml } from './inlineInput.js';

export function renderManualInput(root, onChange) {
  const draw = () => {
    const m = readLocalManual();
    const today = new Date().toISOString().slice(0, 10);
    const b = m.peBench || {};
    root.innerHTML = `
      <p class="muted small" style="margin-top:0">공식 무료 API 가 없는 항목입니다. <b>신뢰 가능한 출처의 실제 발표값만</b> 입력하세요 (임의 추정 금지). 입력하지 않으면 해당 지표는 <b>DATA_UNAVAILABLE</b> 로 처리되고 점수는 0으로 대체되지 않습니다.</p>
      <form id="manual-form" class="form-grid" autocomplete="off">
        <div><label for="mf-series">항목</label>
          <select id="mf-series" style="width:100%">${Object.entries(MANUAL_SERIES).map(([k, d]) => `<option value="${k}">${esc(d.name)}</option>`).join('')}</select></div>
        <div><label for="mf-date">기준일</label><input id="mf-date" type="date" value="${today}" required style="width:100%"></div>
        <div><label for="mf-value">값</label><input id="mf-value" type="number" step="any" required style="width:100%"></div>
        <div><label for="mf-source">출처</label><input id="mf-source" type="text" placeholder="예: ISM / FactSet Earnings Insight" required style="width:100%"></div>
        <div><button class="btn primary" type="submit">추가</button></div>
      </form>
      <details style="margin-top:14px"><summary style="cursor:pointer;font-weight:600">PER 벤치마크 (5년/10년 평균, 52주 고·저) — 선택</summary>
        <form id="bench-form" class="form-grid" style="margin-top:10px">
          ${[['avg5y', '5년 평균'], ['avg10y', '10년 평균'], ['high52w', '52주 최고'], ['low52w', '52주 최저']].map(([k, l]) => `<div><label for="bf-${k}">${l}</label><input id="bf-${k}" type="number" step="any" value="${b[k] ?? ''}" style="width:100%"></div>`).join('')}
          <div><label for="bf-source">출처</label><input id="bf-source" type="text" value="${esc(b.source || '')}" style="width:100%"></div>
          <div><button class="btn" type="submit">저장</button></div>
        </form></details>
      ${refLinksHtml('valuation')}
      <div class="manual-list" id="manual-list">${listHtml(m)}</div>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
        <button class="btn" id="manual-export" type="button">JSON 내보내기 (data/manual/manual.json 용)</button>
        <label class="btn" style="margin:0;display:inline-block">JSON 가져오기<input id="manual-import" type="file" accept="application/json" hidden></label>
        <button class="btn danger" id="manual-clear" type="button">브라우저 입력값 모두 삭제</button>
      </div>`;

    root.querySelector('#manual-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const key = root.querySelector('#mf-series').value;
      const date = root.querySelector('#mf-date').value;
      const value = parseFloat(root.querySelector('#mf-value').value);
      const source = root.querySelector('#mf-source').value.trim();
      if (!date || !Number.isFinite(value) || value <= 0 || !source) { toast('기준일·양수 값·출처를 모두 입력하세요'); return; }
      const cur = readLocalManual();
      const arr = (cur[key] || []).filter(r => r.date !== date);
      arr.push({ date, value, source, release_date: date, period: date.slice(0, 7) });
      arr.sort((x, y) => (x.date < y.date ? -1 : 1));
      cur[key] = arr; writeLocalManual(cur);
      toast('저장되었습니다. 점수를 다시 계산합니다.'); onChange(); draw();
    });
    root.querySelector('#bench-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const g = (k) => parseFloat(root.querySelector('#bf-' + k).value);
      const bench = { avg5y: g('avg5y'), avg10y: g('avg10y'), high52w: g('high52w'), low52w: g('low52w'), source: root.querySelector('#bf-source').value.trim() || '수동 입력', as_of: new Date().toISOString().slice(0, 10) };
      const cur = readLocalManual(); cur.peBench = bench; writeLocalManual(cur);
      toast('벤치마크 저장'); onChange(); draw();
    });
    root.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', () => {
      const [k, d] = btn.dataset.del.split('|');
      const cur = readLocalManual(); cur[k] = (cur[k] || []).filter(r => r.date !== d); writeLocalManual(cur); onChange(); draw();
    }));
    root.querySelector('#manual-export').addEventListener('click', () => {
      const cur = readLocalManual();
      const out = { ISM_MFG: cur.ISM_MFG || [], ISM_SVC: cur.ISM_SVC || [], FWD_EPS: cur.FWD_EPS || [], FWD_PE: cur.FWD_PE || [], peBench: cur.peBench || null };
      const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'manual.json'; a.click(); URL.revokeObjectURL(a.href);
    });
    root.querySelector('#manual-import').addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { const o = JSON.parse(await f.text()); const cur = readLocalManual(); for (const k of Object.keys(MANUAL_SERIES)) if (Array.isArray(o[k])) cur[k] = o[k]; if (o.peBench) cur.peBench = o.peBench; writeLocalManual(cur); toast('가져오기 완료'); onChange(); draw(); }
      catch (err) { toast('JSON 형식 오류: ' + err.message); }
    });
    root.querySelector('#manual-clear').addEventListener('click', () => { if (confirm('브라우저에 저장된 수동 입력값을 모두 삭제할까요?')) { writeLocalManual({}); onChange(); draw(); } });
  };
  draw();
  return draw;
}

function listHtml(m) {
  const rows = [];
  for (const [k, d] of Object.entries(MANUAL_SERIES)) for (const r of (m[k] || [])) rows.push({ k, name: d.name, ...r });
  if (!rows.length && !m.peBench) return '<div class="muted small">브라우저에 저장된 수동 입력값이 없습니다.</div>';
  rows.sort((a, b) => (a.date < b.date ? 1 : -1));
  return rows.map(r => `<div class="row"><span class="mono">${esc(r.date)}</span><span>${esc(r.name)}</span><b class="mono">${esc(r.value)}</b><span class="muted">${esc(r.source || '')}</span><button class="btn small danger" data-del="${r.k}|${r.date}" type="button" aria-label="삭제">삭제</button></div>`).join('')
    + (m.peBench ? `<div class="row"><span>PER 벤치마크</span><span class="muted">5y ${esc(m.peBench.avg5y)} · 10y ${esc(m.peBench.avg10y)} · 고 ${esc(m.peBench.high52w)} · 저 ${esc(m.peBench.low52w)}</span></div>` : '');
}
