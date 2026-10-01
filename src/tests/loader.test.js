/** 데이터 로더 테스트: 원격(최신 스냅샷) vs 배포본 선택 로직 (fetch 를 가짜로 대체) */
import { describe, it, assert } from './runner.js';
import { loadDataset } from '../data/loader.js';
import { DATASETS } from '../data/registry.js';
import { toDay } from '../data/series.js';

const N = Object.keys(DATASETS).length;
const mkCsv = (last) => {
  const end = Date.parse(last + 'T00:00:00Z');
  const lines = ['observation_date,X'];
  for (let i = 11; i >= 0; i--) lines.push(`${new Date(end - i * 86400000).toISOString().slice(0, 10)},${(100 + (11 - i)).toFixed(2)}`);
  return lines.join('\n') + '\n';
};

/** remote: null(원격 미설정) | {last} | 'fail' | 'bad' */
async function withStub({ local, remote }, fn) {
  const orig = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('data/source.json')) return new Response(JSON.stringify({ remoteBase: remote ? 'https://remote.test/repo/main' : '' }), { status: 200 });
    if (u.includes('data/manual/manual.json')) return new Response('{}', { status: 200 });
    if (u.includes('data/manifest.json')) return new Response('{"fetched_at":"2026-01-01T00:00:00Z"}', { status: 200 });
    if (u.startsWith('https://remote.test/')) {
      if (remote === 'fail') return new Response('nope', { status: 404 });
      if (remote === 'bad') return new Response('<html>not csv</html>', { status: 200 });
      return new Response(mkCsv(remote.last), { status: 200 });
    }
    if (u.includes('data/raw/')) return new Response(mkCsv(local), { status: 200 });
    return new Response('', { status: 404 });
  };
  try { return await fn(await loadDataset('http://app.test/')); } finally { globalThis.fetch = orig; }
}

describe('데이터 로더 (원격 최신 스냅샷 선택)', () => {
  it('원격이 더 최신이면 원격 사용 (경로 사이 슬래시 보정 포함)', async () => {
    await withStub({ local: '2026-09-29', remote: { last: '2026-09-30' } }, (ds) => {
      const s = ds.series.VIXCLS;
      assert.equal(s.t[s.t.length - 1], toDay('2026-09-30'));
      assert.equal(ds.source.remote, N); assert.equal(ds.source.bundled, 0);
    });
  });
  it('원격이 더 오래됐으면 배포본 유지 (과거 데이터로 되돌리지 않음)', async () => {
    await withStub({ local: '2026-09-29', remote: { last: '2026-09-20' } }, (ds) => {
      const s = ds.series.VIXCLS;
      assert.equal(s.t[s.t.length - 1], toDay('2026-09-29'));
      assert.equal(ds.source.remote, 0); assert.equal(ds.source.remoteOlder.length, N);
    });
  });
  it('원격 실패(404)·CSV 아닌 응답이면 배포본으로 안전하게 대체, 로드 오류 없음', async () => {
    for (const bad of ['fail', 'bad']) {
      await withStub({ local: '2026-09-29', remote: bad }, (ds) => {
        const s = ds.series.VIXCLS;
        assert.equal(s.t[s.t.length - 1], toDay('2026-09-29'), bad);
        assert.equal(ds.source.remoteFailed.length, N, bad);
        assert.equal(ds.loadErrors.length, 0, bad);
      });
    }
  });
  it('원격 소스 미설정이면 배포본만 사용', async () => {
    await withStub({ local: '2026-09-29', remote: null }, (ds) => {
      assert.equal(ds.source.remoteBase, ''); assert.equal(ds.source.remote, 0); assert.equal(ds.source.bundled, N);
    });
  });
});
