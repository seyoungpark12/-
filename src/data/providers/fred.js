/**
 * FRED(fredgraph.csv) 어댑터.
 * - parseFredCsv: 순수 함수 (테스트 가능)
 * - fredCsvUrl: 갱신 스크립트(scripts/update-data.mjs)에서 사용
 * 브라우저에서는 FRED 가 CORS 를 허용하지 않으므로 저장소의 data/raw/*.csv 스냅샷을 읽습니다.
 * 환경변수로 API Key 를 쓰는 공식 API(api.stlouisfed.org)를 쓰려면 이 adapter 만 교체하면 됩니다.
 */
export function fredCsvUrl(seriesId, startDate = '1990-01-01') {
  return `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(seriesId)}&cosd=${startDate}`;
}

/** CSV 텍스트 → [{date, value}] . 빈 값/'.' 는 건너뜀(결측을 0 으로 대체하지 않음). */
export function parseFredCsv(text) {
  const rows = [];
  const lines = text.split(/\r?\n/);
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(',');
    if (parts.length < 2) continue;
    const raw = parts[1].trim();
    if (raw === '' || raw === '.') continue;
    const value = parseFloat(raw);
    if (!Number.isFinite(value)) continue;
    rows.push({ date: parts[0].trim(), value });
  }
  return rows;
}
