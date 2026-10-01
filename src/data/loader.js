/**
 * 브라우저용 데이터 로더 (외부 I/O). 점수 계산과 분리되어 있음.
 * 1) data/raw/*.csv (FRED 스냅샷, 배포본)  + (선택) data/source.json 의 remoteBase 에 있는 최신 스냅샷
 * 2) data/manual/manual.json  3) localStorage 수동 입력
 *
 * remoteBase 가 설정되면 시리즈마다 원격/배포본 중 '마지막 관측일이 더 늦은 쪽'을 사용한다.
 * (원격이 실패하거나 더 오래된 경우 배포본으로 안전하게 대체. 값을 만들어 내지 않음)
 */
import { DATASETS } from './registry.js';
import { buildDataset } from './dataset.js';
import { parseFredCsv } from './providers/fred.js';

export const MANUAL_LS_KEY = 'usmacro.manual.v1';

const looksLikeCsv = (t) => typeof t === 'string' && /^observation_date|^DATE/i.test(t) && t.split('\n').length >= 10;
const lastObs = (t) => { const r = parseFredCsv(t); return r.length ? r[r.length - 1].date : ''; };
const withSlash = (s) => (s && !s.endsWith('/') ? s + '/' : s);

async function readSource(baseUrl) {
  try {
    const res = await fetch(`${baseUrl}data/source.json`, { cache: 'no-cache' });
    if (res.ok) return withSlash(String((await res.json()).remoteBase || '').trim());
  } catch (_) { /* 선택 파일 */ }
  return '';
}

/** @param fresh true 면 캐시 우회 쿼리를 붙여 최신본을 강제로 다시 읽음 */
export async function loadDataset(baseUrl = '', { fresh = false } = {}) {
  const bust = fresh ? `?_=${Date.now()}` : '';
  const remoteBase = await readSource(baseUrl);
  const texts = {};
  const errors = [];
  const src = { remoteBase, remote: 0, bundled: 0, remoteFailed: [], remoteOlder: [] };

  await Promise.all(Object.keys(DATASETS).map(async (key) => {
    const rel = `data/raw/${DATASETS[key].file}`;
    let local = null, remote = null;
    try {
      const res = await fetch(`${baseUrl}${rel}${bust}`, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      local = await res.text();
    } catch (e) { if (!remoteBase) { errors.push({ key, error: String(e) }); return; } }
    if (remoteBase) {
      try {
        const res = await fetch(`${remoteBase}${rel}${bust}`, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const t = await res.text();
        if (!looksLikeCsv(t)) throw new Error('unexpected content');
        remote = t;
      } catch (_) { src.remoteFailed.push(key); }
    }
    if (remote && (!local || lastObs(remote) >= lastObs(local))) { texts[key] = remote; src.remote++; }
    else if (local) { texts[key] = local; src.bundled++; if (remote) src.remoteOlder.push(key); }
    else errors.push({ key, error: '로컬/원격 모두 실패' });
  }));

  let fileManual = {};
  try {
    const res = await fetch(`${baseUrl}data/manual/manual.json`, { cache: 'no-cache' });
    if (res.ok) fileManual = await res.json();
  } catch (_) { /* 선택 파일 */ }

  const manual = mergeManual(fileManual, readLocalManual());
  const ds = buildDataset(texts, manual);
  ds.loadErrors = errors;
  ds.loadedAt = new Date().toISOString();
  ds.source = src;
  try { ds.manifest = await (await fetch(`${(remoteBase || baseUrl)}data/manifest.json${bust}`, { cache: 'no-cache' })).json(); } catch (_) {
    try { ds.manifest = await (await fetch(`${baseUrl}data/manifest.json${bust}`, { cache: 'no-cache' })).json(); } catch (__) { ds.manifest = null; }
  }
  return ds;
}

export function readLocalManual() {
  try { return JSON.parse(localStorage.getItem(MANUAL_LS_KEY) || '{}'); } catch (_) { return {}; }
}
export function writeLocalManual(obj) {
  localStorage.setItem(MANUAL_LS_KEY, JSON.stringify(obj));
}

/** 같은 날짜는 localStorage(b) 가 파일(a)을 덮어씀 */
export function mergeManual(a, b) {
  const out = { peBench: b.peBench || a.peBench || null };
  for (const k of ['ISM_MFG', 'ISM_SVC', 'FWD_EPS', 'FWD_PE']) {
    const map = new Map();
    for (const r of (a[k] || [])) map.set(r.date, r);
    for (const r of (b[k] || [])) map.set(r.date, r);
    out[k] = [...map.values()];
  }
  return out;
}
