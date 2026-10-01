#!/usr/bin/env node
/**
 * FRED 공개 CSV 스냅샷 갱신 스크립트 (Node 18+).
 *   node scripts/update-data.mjs
 * - data/raw/*.csv 를 최신 데이터로 갱신. '내용이 바뀐 파일이 있을 때만' data/manifest.json 을 갱신(불필요한 커밋 방지).
 * - 실패한 시계열은 기존 파일을 유지합니다 (임의 값 생성 없음). 종료 코드 1 = 일부 실패.
 */
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SERIES = {
  'SP500.csv': ['SP500', '1990-01-01'], 'NASDAQ100.csv': ['NASDAQ100', '1990-01-01'], 'VIXCLS.csv': ['VIXCLS', '1990-01-01'],
  'DGS10.csv': ['DGS10', '2000-01-01'], 'DFII10.csv': ['DFII10', '2003-01-01'], 'DGS6MO.csv': ['DGS6MO', '2000-01-01'], 'DGS1.csv': ['DGS1', '2000-01-01'], 'DGS2.csv': ['DGS2', '2000-01-01'],
  'DFF.csv': ['DFF', '2000-01-01'], 'BAMLH0A0HYM2.csv': ['BAMLH0A0HYM2', '1996-01-01'], 'BAA10Y.csv': ['BAA10Y', '1990-01-01'], 'DTWEXBGS.csv': ['DTWEXBGS', '2006-01-01'],
  'CPIAUCSL.csv': ['CPIAUCSL', '1995-01-01'], 'CPILFESL.csv': ['CPILFESL', '1995-01-01'], 'PCEPI.csv': ['PCEPI', '1995-01-01'], 'PCEPILFE.csv': ['PCEPILFE', '1995-01-01'],
  'PAYEMS.csv': ['PAYEMS', '1995-01-01'], 'UNRATE.csv': ['UNRATE', '1995-01-01'], 'ICSA.csv': ['ICSA', '1995-01-01'], 'CCSA.csv': ['CCSA', '1995-01-01'], 'CES0500000003.csv': ['CES0500000003', '2006-01-01'],
  'PHILLY.csv': ['GACDFSA066MSFRBPHI', '1990-01-01'], 'EMPIRE.csv': ['GACDISA066MSFRBNY', '2001-01-01'],
};

await mkdir(join(root, 'data/raw'), { recursive: true });
const failed = [], changed = [];
for (const [file, [id, start]] of Object.entries(SERIES)) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${start}`;
  const path = join(root, 'data/raw', file);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (!/^observation_date|^DATE/i.test(text) || text.split('\n').length < 10) throw new Error('unexpected content');
    let old = ''; try { old = await readFile(path, 'utf8'); } catch (_) { /* 신규 */ }
    if (old !== text) { await writeFile(path, text); changed.push(id); console.log('UPD ', id); }
    else console.log('same', id);
  } catch (e) {
    failed.push(id); console.error('FAIL', id, String(e));
  }
}
if (changed.length || failed.length) {
  const manifest = { fetched_at: new Date().toISOString(), fetched_by: 'scripts/update-data.mjs (FRED fredgraph.csv)', changed, failed, note: 'data/raw/*.csv 는 FRED 공개 CSV 스냅샷입니다.' };
  await writeFile(join(root, 'data/manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
}
console.log(`\n변경 ${changed.length}개 / 실패 ${failed.length}개`);
if (failed.length) { console.error(`일부 실패: ${failed.join(', ')} (기존 파일 유지)`); process.exit(1); }
