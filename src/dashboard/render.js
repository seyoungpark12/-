/** 대시보드 렌더링 (HTML 문자열 → innerHTML). 모든 동적 텍스트는 esc() 처리. */
import { esc, fmtPct, fmtSigned, scoreClass, phaseBadge } from './ui.js';
import { INDICATOR_META } from '../indicators/meta.js';
import { phaseByKey } from '../config.js';
import { dailyAnswers } from '../engine/dailyReport.js';
import { improvementsAndRisks } from '../alerts/marketAlert.js';

const ddClass = (x) => (Number.isFinite(x) && x < -0.0005 ? 'neg' : 'zero');

function gauge(total, cfg) {
  const pos = ((total + 20) / 40) * 100;
  const ticks = cfg.phases.filter(p => p.rank >= 1).map(p => `<span class="tick" style="left:${((p.minScore + 20) / 40) * 100}%"></span>`).join('');
  return `<div class="gauge" role="img" aria-label="거시 점수 ${total} / 20">${ticks}<span class="marker" style="left:${Math.max(0, Math.min(100, pos))}%"></span></div>
    <div class="gauge-labels"><span>-20</span><span>0</span><span>6</span><span>11</span><span>16</span><span>+20</span></div>`;
}

function marketRow(p, name) {
  if (!p.available) return `<div class="mk-row"><span class="name">${name}</span><span class="muted">${esc(p.reason || '데이터 없음')}</span></div>`;
  return `<div class="mk-row"><span class="name">${name}</span><span class="dd ${ddClass(p.drawdown)}">${fmtPct(p.drawdown)}</span></div>
    <div class="mk-sub">${esc(p.band)} · 종가 ${p.close.toLocaleString('en-US', { maximumFractionDigits: 0 })} · 200일선 ${p.aboveMa200 ? '위' : '아래'}</div>`;
}

export function renderHero(el, view, cfg) {
  const { state: st, history: h, asOf } = view;
  const phase = phaseByKey(cfg, st.phaseKey);
  const label = st.override.hard ? cfg.override.statusText : phase.label;
  const phaseForBadge = st.override.hard ? { ...phase, emoji: '⛔', color: '#ef4444' } : phase;
  const answers = dailyAnswers(st, h, cfg);
  const prevTxt = h.previous === null ? 'n/a' : h.previous;
  const chg = h.change === null ? 'n/a' : fmtSigned(h.change);

  const flagBottom = st.bottoming.detected
    ? `<span style="color:#4ade80">🟢 DETECTED</span><div class="small muted">바닥 탐색 가능 구간 (${st.bottoming.metCount}/${st.bottoming.required}+ 조건 충족)</div>`
    : `<span class="muted">⚪ NOT DETECTED</span><div class="small muted">${st.bottoming.ddOk ? `가격 조건 충족, 보조 조건 ${st.bottoming.metCount}/${st.bottoming.required}` : '가격 조정 10% 미만'}</div>`;
  const ov = st.override;
  const flagRisk = ov.hard ? `<span style="color:#f87171">🔴 HARD — ${esc(cfg.override.statusText)}</span><div class="small muted">${esc(ov.reasons.join('; '))}</div>`
    : ov.combo ? `<span style="color:#fbbf24">🟠 COMBO — VIX·HY 동시 급등</span><div class="small muted">2차·적극적 매수 단계 억제</div>`
    : `<span class="muted">⚪ NONE</span>`;
  const cf = st.confidence;
  const flagConf = { HIGH: '🟢 HIGH', MEDIUM: '🟡 MEDIUM', LOW: '🔴 LOW' }[cf.level];

  let status = '';
  if (st.override.flags.length) status += `<div class="hero-status cap">⚠ ${esc(st.override.flags.map(f => f.label).join(' / '))}</div>`;
  if (st.suppressed) {
    status += `<div class="hero-status ${st.override.active ? 'risk' : 'cap'}">⛔ 점수 기준 단계는 <b>${esc(phaseByKey(cfg, st.rawPhaseKey).label)}</b> 이나 ${esc(st.caps.map(c => c.label).join(', '))} 로 <b>${esc(phase.label)}</b> 까지만 표시합니다. (단계 상승 억제 — 알림 미발생)</div>`;
  }
  if (st.dataUnavailable) status += `<div class="hero-status info">ℹ ${esc(st.dataNote)} — 결측 지표 ${st.totalInfo.unavailable.length}개는 0점이 아니라 <b>DATA_UNAVAILABLE</b> 로 처리되어 합산에서 제외됩니다 (가능 점수 범위 ±${st.totalInfo.maxPossible}).</div>`;
  const staleN = cf.staleKeys.length;
  if (staleN) status += `<div class="hero-status info">🕒 최신 발표값 기준: ${staleN}개 지표(${esc(cf.staleKeys.map(k => INDICATOR_META[k].name).join(', '))})는 다음 발표 전까지 직전 발표값을 유지합니다.</div>`;
  if (cf.proxyKeys.length) status += `<div class="hero-status info">ⓘ 프록시 사용 지표: ${esc(cf.proxyKeys.map(k => INDICATOR_META[k].name).join(', '))} (카드의 PROXY 배지 참조)</div>`;

  el.innerHTML = `
    <div class="hero-brand">US MARKET MACRO SIGNAL</div>
    <div class="hero-asof">데이터 기준일 ${esc(asOf)} · 규칙 기반 모니터링 신호 (투자 자문 아님)</div>
    <div class="hero-grid">
      <div class="hero-card"><h3>시장 상태 · 고점 대비</h3>${marketRow(st.prices.sp500, 'S&P 500')}${marketRow(st.prices.nasdaq100, 'Nasdaq 100')}
        <div class="mk-sub" style="margin-top:10px">가장 깊은 낙폭: <b>${esc(st.drawdownBand || 'n/a')}</b></div></div>
      <div class="hero-card score-center"><h3>MACRO SCORE</h3>
        <div class="score-big">${st.total}<small> / 20</small></div>
        ${phaseBadge(phaseForBadge, label)}
        <div class="score-delta">전일: <b>${esc(prevTxt)}</b> · 변화: <b>${esc(chg)}</b> · 5일 전: <b>${h.fiveDaysAgo === null ? 'n/a' : h.fiveDaysAgo}</b> · 20일 전: <b>${h.twentyDaysAgo === null ? 'n/a' : h.twentyDaysAgo}</b></div>
        <div class="score-delta">최근 ${h.window}거래일 최고 <b>${h.recentMax}</b> / 최저 <b>${h.recentMin}</b></div>
        ${gauge(st.total, cfg)}</div>
      <div class="hero-card"><h3>신호 상태</h3>
        <div class="flag-row"><span class="k">BOTTOMING SETUP</span><span class="v">${flagBottom}</span></div>
        <div class="flag-row"><span class="k">RISK OVERRIDE</span><span class="v">${flagRisk}</span></div>
        <div class="flag-row"><span class="k">CONFIDENCE</span><span class="v">${flagConf}<div class="small muted">${esc(cf.reasons[0] || '')}</div></span></div></div>
    </div>
    ${status}
    <div class="interp"><h3>핵심 해석</h3><div>${esc(answers.judgement)}</div>
      <div class="arrow">→ 현재: ${esc(label)} 구간${st.bottoming.detected ? ' · 바닥 탐색 가능 구간' : ''}</div></div>`;
  return answers;
}

export function renderQA(el, answers) {
  const items = [
    ['1. 시장은 얼마나 조정됐는가?', answers.q1], ['2. 거시환경은 악화되고 있는가, 악화 속도가 둔화되고 있는가?', answers.q2],
    ['3. 금융시장의 스트레스는 증가하는가, 안정되고 있는가?', answers.q3], ['4. 기업이익 전망은 하향되는가, 바닥을 형성하는가?', answers.q4],
    ['5. 현재는 어느 국면인가?', answers.q5],
  ];
  el.innerHTML = items.map(([q, a]) => `<div class="qa"><div class="q">${esc(q)}</div><div class="a">${esc(a)}</div></div>`).join('');
}

export function renderCards(el, view, cfg) {
  const st = view.state;
  el.innerHTML = cfg.indicatorOrder.map((k) => {
    const meta = INDICATOR_META[k], r = st.scored[k], m = r.m || {};
    const sc = r.available ? (r.score > 0 ? '+' + r.score : String(r.score)) : 'N/A';
    const cls = scoreClass(r.available ? r.score : null);
    const badges = [];
    if (!r.available) badges.push('<span class="badge na">DATA_UNAVAILABLE</span>');
    if (r.available && r.stale) badges.push('<span class="badge stale">최신 발표값 기준</span>');
    if (r.available && r.proxy) badges.push('<span class="badge proxy">PROXY</span>');
    return `<button class="icard ${cls}" data-key="${k}" type="button" aria-label="${esc(meta.name)} 상세 보기">
      <div class="no">#${meta.no}</div><div class="nm" style="color:var(--text)">${esc(meta.name)}</div>
      <div class="sc ${cls}">${sc}</div>
      <div class="val">${r.available ? esc(m.valueText || '') : esc(r.reason || '데이터 없음')}</div>
      <div class="tag">${esc(r.tag || '')}</div>
      <div class="meta">${r.available ? `<span>${esc(m.obsDate || '')}</span>` : ''}${badges.join('')}${(k === 'eps' || k === 'valuation') ? `<span class="card-input-cta">${r.available ? '✍ 값 추가·확인' : '＋ 값 입력 / 확인 사이트'}</span>` : ''}</div></button>`;
  }).join('');
}

/** 모달 본문 */
export function modalHtml(key, view, cfg) {
  const meta = INDICATOR_META[key], r = view.state.scored[key], m = r.m || {};
  const sc = r.available ? (r.score > 0 ? '+' + r.score : String(r.score)) : 'N/A';
  const comps = (m.components || []).map(c => `<tr><td>${esc(c.label)}</td><td>${esc(c.valueText)}</td><td class="mono">${esc(c.obsDate || '')}${c.stale ? ' <span class="badge stale">최신 발표값 기준</span>' : ''}</td><td>${esc(c.source || '')}</td></tr>`).join('');
  const src = m.sourceUrl ? `<a href="${esc(m.sourceUrl)}" target="_blank" rel="noopener">${esc(m.source)}</a>` : esc(m.source || '—');
  return `
    <div class="modal-head"><h3>#${meta.no} ${esc(meta.name)} <span class="muted" style="font-weight:400;font-size:13px">${esc(meta.ko)}</span></h3>
      <span class="phase-badge ${scoreClass(r.available ? r.score : null)}" style="font-size:16px;margin:0;padding:3px 14px;border-color:currentColor">${sc}</span>
      <button class="x" data-close aria-label="닫기" type="button">✕</button></div>
    <div class="modal-body">
      ${r.available ? '' : `<div class="error-box">⛔ DATA_UNAVAILABLE — ${esc(r.reason)}<br><span class="small">이 지표는 0점으로 처리하지 않고 총점 합산에서 제외되며, 종합점수 신뢰도가 낮아집니다.</span></div>`}
      ${r.available ? `<div class="kv">
        <span class="k">현재값</span><span><b>${esc(m.valueText)}</b></span>
        <span class="k">이전값</span><span>${esc(m.previousText || 'n/a')} <span class="muted small">${esc(m.previousLabel || '')}</span></span>
        <span class="k">변화(${esc(m.change1mLabel || '1개월')})</span><span>${esc(m.change1mText || 'n/a')}</span>
        <span class="k">점수</span><span><b class="${scoreClass(r.score)}" style="font-size:20px">${sc}</b> <span class="muted small">(-2 ~ +2)</span></span>
        <span class="k">데이터 기준일</span><span class="mono">${esc(m.obsDate)}${m.oldestObsDate && m.oldestObsDate !== m.obsDate ? ` <span class="muted small">(가장 오래된 구성값 ${esc(m.oldestObsDate)})</span>` : ''} ${m.stale ? '<span class="badge stale">최신 발표값 기준</span>' : ''}</span>
        <span class="k">발표일(추정)</span><span class="mono">${esc(m.releaseDate || 'n/a')}</span>
        <span class="k">대상 기간</span><span>${esc(m.period || 'n/a')}</span>
        <span class="k">데이터 출처</span><span>${src}</span>
      </div>
      <div class="reason-box"><b>점수 부여 이유</b><br>${esc(r.reason)}</div>
      ${m.proxy ? `<div class="hero-status info">ⓘ <b>프록시 사용</b> — ${esc(m.proxyNote || '')}</div>` : ''}
      ${comps ? `<table class="comp-table"><thead><tr><th>구성 데이터</th><th>값</th><th>기준일</th><th>출처</th></tr></thead><tbody>${comps}</tbody></table>` : ''}
      <h4 style="margin:18px 0 4px;font-size:13px;color:var(--muted)">최근 추이 · ${esc((m.seriesIds || [meta.chartSeries])[0] || '')}</h4>
      <div id="modal-spark" style="height:200px"></div>` : `<div class="kv" style="margin-top:12px"><span class="k">지표</span><span>${esc(meta.ko)}</span></div>
        ${key === 'pmi' ? '<p class="muted">하단 <b>수동 데이터 입력</b> 섹션에서 ISM PMI 실제 값을 입력하면 자동으로 점수가 계산됩니다. (미입력 시 Philly/Empire Fed 로 대체 가능한 경우 프록시 사용)</p>' : ''}`}
      ${key === 'eps' || key === 'valuation' ? '<div id="input-slot"></div>' : ''}
    </div>`;
}

export function renderAlertPanel(el, view, cfg) {
  const al = view.alert;
  const parts = [];
  if (al.fire) parts.push(`<div class="alert-box alert-new">${esc(al.message)}</div><p class="small" style="color:#fbbf24;margin-top:8px">🔔 최신 거래일에 새로운 단계 진입이 발생했습니다.</p>`);
  else {
    const reason = al.blockedBy === 'LOW_CONFIDENCE' ? '신뢰도 LOW — 알림 차단' : al.blockedBy === 'RISK_OVERRIDE' ? '급락 위험 안전장치로 단계 상승 억제 — 알림 차단' : al.blockedBy === 'PRICE_FILTER' ? '가격 조정 필터로 단계 상승 억제 — 알림 차단' : '직전 거래일 대비 새로운 매수 구간 진입 없음';
    parts.push(`<div class="alert-item"><span class="badge">알림 없음</span> ${esc(reason)}</div>`);
  }
  const recent = (view.alerts || []).slice(-5).reverse();
  if (recent.length) parts.push(`<h4 style="margin:16px 0 4px;font-size:13px;color:var(--muted)">최근 90거래일 내 알림 이력</h4>` + recent.map(a => `<div class="alert-item"><span class="mono">${esc(a.date)}</span><span>${esc(phaseByKey(cfg, a.previous_phase).label)} → <b>${esc(phaseByKey(cfg, a.current_phase).label)}</b></span><span class="mono muted">${a.score}/20</span></div>`).join(''));
  const { improvements, risks } = improvementsAndRisks(view.state);
  parts.push(`<div class="two-col" style="margin-top:14px"><div><h4 style="margin:0 0 6px;font-size:13px;color:#4ade80">주요 개선</h4>${improvements.length ? improvements.map(x => `<div class="small">• ${esc(x)}</div>`).join('') : '<div class="small muted">해당 없음</div>'}</div>
    <div><h4 style="margin:0 0 6px;font-size:13px;color:#f87171">주요 위험</h4>${risks.length ? risks.map(x => `<div class="small">• ${esc(x)}</div>`).join('') : '<div class="small muted">해당 없음</div>'}</div></div>`);
  el.innerHTML = parts.join('');
}

export function renderDataStatus(el, ds, view) {
  const rows = Object.values(ds.series).map(s => {
    const last = s.t[s.t.length - 1];
    return { id: s.id, name: s.meta.name, source: s.meta.source, last: new Date(last * 86400000).toISOString().slice(0, 10), n: s.t.length, lag: s.meta.lagDays || 0, manual: !!s.meta.manual };
  });
  const missing = (ds.missing || []).map(k => `<tr><td>${esc(k)}</td><td colspan="4" style="color:#fca5a5">로드 실패/없음</td></tr>`).join('');
  el.innerHTML = `<div class="table-wrap"><table class="data-table"><thead><tr><th>시계열</th><th>설명</th><th>최근 관측일</th><th>관측 수</th><th>출처</th></tr></thead><tbody>
    ${rows.map(r => `<tr><td class="mono">${esc(r.id)}${r.manual ? ' <span class="badge">수동</span>' : ''}</td><td>${esc(r.name)}</td><td class="mono">${esc(r.last)}</td><td class="mono">${r.n.toLocaleString()}</td><td class="small muted">${esc(r.source)}</td></tr>`).join('')}${missing}
  </tbody></table></div>
  <p class="muted small" style="margin-top:8px">${ds.manifest ? `스냅샷 갱신: ${esc(ds.manifest.fetched_at || '')}` : ''} · 수동 입력(ISM/EPS/PER)이 없으면 해당 지표는 DATA_UNAVAILABLE 입니다. 월간 지표는 발표 전까지 직전 발표값을 유지하며 "최신 발표값 기준"으로 표시됩니다.</p>`;
}
