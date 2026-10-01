/** 10개 지표의 표시용 메타 */
export const INDICATOR_META = {
  y10:        { no: 1,  name: '10Y Treasury',    ko: '미국 10년물 국채금리',  chartSeries: 'DGS10',   unit: '%' },
  inflation:  { no: 2,  name: 'Inflation',       ko: '미국 CPI / PCE',       chartSeries: 'CPILFESL', unit: '% YoY' },
  fed:        { no: 3,  name: 'Fed Expectation', ko: 'Fed 금리 기대',         chartSeries: 'DGS2',    unit: '%' },
  pmi:        { no: 4,  name: 'ISM PMI',         ko: '미국 PMI',             chartSeries: 'PHILLY',  unit: 'pt' },
  employment: { no: 5,  name: 'Employment',      ko: '미국 고용',             chartSeries: 'ICSA',    unit: '' },
  hy:         { no: 6,  name: 'HY Spread',       ko: 'High Yield 신용스프레드', chartSeries: 'BAMLH0A0HYM2', unit: '%' },
  vix:        { no: 7,  name: 'VIX',             ko: 'VIX 변동성',           chartSeries: 'VIXCLS',  unit: '' },
  dxy:        { no: 8,  name: 'DXY',             ko: '달러지수',              chartSeries: 'DTWEXBGS', unit: 'idx' },
  eps:        { no: 9,  name: 'EPS',             ko: 'S&P 500 EPS 전망',     chartSeries: 'FWD_EPS', unit: '$' },
  valuation:  { no: 10, name: 'Forward PER',     ko: 'S&P 500 Forward PER',  chartSeries: 'FWD_PE',  unit: 'x' },
};
