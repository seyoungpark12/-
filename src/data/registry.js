/**
 * 데이터셋 레지스트리: 모든 시계열의 출처·발표지연·오래됨 기준을 한 곳에서 선언.
 * lagDays: 관측일(월간은 해당 월 1일) → 실제 발표 시점까지의 근사 지연 (point-in-time 용, 발표일은 근사값).
 * staleDays: 기준일(asOf) − 관측일 이 이 값을 넘으면 data_is_stale = true ("최신 발표값 기준" 표시).
 */
const FRED = (id) => `https://fred.stlouisfed.org/series/${id}`;
const mk = (id, name, source, extra) => ({ id, file: `${id}.csv`, name, source, sourceUrl: FRED(id), ...extra });

export const DATASETS = {
  SP500:       mk('SP500', 'S&P 500 지수', 'FRED SP500 (S&P Dow Jones Indices)', { lagDays: 0, staleDays: 7, freq: 'daily', unit: 'pt', note: 'FRED 는 최근 10년치만 제공' }),
  NASDAQ100:   mk('NASDAQ100', 'Nasdaq 100 지수', 'FRED NASDAQ100 (Nasdaq OMX)', { lagDays: 0, staleDays: 7, freq: 'daily', unit: 'pt' }),
  VIXCLS:      mk('VIXCLS', 'VIX', 'FRED VIXCLS (CBOE)', { lagDays: 0, staleDays: 7, freq: 'daily', unit: '' }),
  DGS10:       mk('DGS10', '미국 10년물 국채금리', 'FRED DGS10 (U.S. Treasury / Fed H.15)', { lagDays: 0, staleDays: 7, freq: 'daily', unit: '%' }),
  DFII10:      mk('DFII10', '10년 실질금리(TIPS)', 'FRED DFII10 (U.S. Treasury / Fed H.15)', { lagDays: 0, staleDays: 7, freq: 'daily', unit: '%' }),
  DGS6MO:      mk('DGS6MO', '미국 6개월물 국채금리', 'FRED DGS6MO (U.S. Treasury)', { lagDays: 0, staleDays: 7, freq: 'daily', unit: '%' }),
  DGS1:        mk('DGS1', '미국 1년물 국채금리', 'FRED DGS1 (U.S. Treasury)', { lagDays: 0, staleDays: 7, freq: 'daily', unit: '%' }),
  DGS2:        mk('DGS2', '미국 2년물 국채금리', 'FRED DGS2 (U.S. Treasury)', { lagDays: 0, staleDays: 7, freq: 'daily', unit: '%' }),
  DFF:         mk('DFF', '연방기금금리(Fed Funds, 실효)', 'FRED DFF (Federal Reserve)', { lagDays: 1, staleDays: 7, freq: 'daily', unit: '%' }),
  BAMLH0A0HYM2: mk('BAMLH0A0HYM2', 'ICE BofA US High Yield OAS', 'FRED BAMLH0A0HYM2 (ICE Data Indices)', { lagDays: 1, staleDays: 7, freq: 'daily', unit: '%', note: 'FRED 는 최근 3년치만 제공' }),
  BAA10Y:      mk('BAA10Y', 'Moody\'s Baa − 10Y 국채 스프레드 (HY 프록시)', 'FRED BAA10Y (Moody\'s)', { lagDays: 1, staleDays: 7, freq: 'daily', unit: '%' }),
  DTWEXBGS:    mk('DTWEXBGS', '달러지수(광의, DXY 프록시)', 'FRED DTWEXBGS (Federal Reserve Board)', { lagDays: 1, staleDays: 10, freq: 'daily', unit: 'idx', note: 'ICE DXY 아님' }),
  CPIAUCSL:    mk('CPIAUCSL', 'Headline CPI', 'FRED CPIAUCSL (U.S. BLS)', { lagDays: 45, staleDays: 75, freq: 'monthly', unit: 'idx' }),
  CPILFESL:    mk('CPILFESL', 'Core CPI', 'FRED CPILFESL (U.S. BLS)', { lagDays: 45, staleDays: 75, freq: 'monthly', unit: 'idx' }),
  PCEPI:       mk('PCEPI', 'Headline PCE', 'FRED PCEPI (U.S. BEA)', { lagDays: 58, staleDays: 90, freq: 'monthly', unit: 'idx' }),
  PCEPILFE:    mk('PCEPILFE', 'Core PCE', 'FRED PCEPILFE (U.S. BEA)', { lagDays: 58, staleDays: 90, freq: 'monthly', unit: 'idx' }),
  PAYEMS:      mk('PAYEMS', '비농업 고용(Nonfarm Payrolls)', 'FRED PAYEMS (U.S. BLS)', { lagDays: 35, staleDays: 65, freq: 'monthly', unit: '천명' }),
  UNRATE:      mk('UNRATE', '실업률', 'FRED UNRATE (U.S. BLS)', { lagDays: 35, staleDays: 65, freq: 'monthly', unit: '%' }),
  ICSA:        mk('ICSA', '신규 실업수당 청구', 'FRED ICSA (U.S. DOL)', { lagDays: 5, staleDays: 14, freq: 'weekly', unit: '건' }),
  CCSA:        mk('CCSA', '연속 실업수당 청구', 'FRED CCSA (U.S. DOL)', { lagDays: 12, staleDays: 21, freq: 'weekly', unit: '건' }),
  CES0500000003: mk('CES0500000003', '시간당 평균임금(민간)', 'FRED CES0500000003 (U.S. BLS)', { lagDays: 35, staleDays: 65, freq: 'monthly', unit: '$' }),
  PHILLY:      mk('GACDFSA066MSFRBPHI', '필라델피아 연은 제조업 지수', 'FRED GACDFSA066MSFRBPHI (Philadelphia Fed)', { file: 'PHILLY.csv', lagDays: 20, staleDays: 60, freq: 'monthly', unit: 'idx' }),
  EMPIRE:      mk('GACDISA066MSFRBNY', '뉴욕 연은 Empire State 제조업 지수', 'FRED GACDISA066MSFRBNY (New York Fed)', { file: 'EMPIRE.csv', lagDays: 15, staleDays: 60, freq: 'monthly', unit: 'idx' }),
};
// 레지스트리 key 로 접근하기 위해 id 를 key 로 통일
DATASETS.PHILLY.id = 'PHILLY';
DATASETS.EMPIRE.id = 'EMPIRE';
DATASETS.PHILLY.sourceUrl = FRED('GACDFSA066MSFRBPHI');
DATASETS.EMPIRE.sourceUrl = FRED('GACDISA066MSFRBNY');

/** 수동 입력(무료 공식 API 가 없는 데이터) 시계열 정의 */
export const MANUAL_SERIES = {
  ISM_MFG: { name: 'ISM Manufacturing PMI', unit: 'pt', staleDays: 45, lagDays: 0 },
  ISM_SVC: { name: 'ISM Services PMI', unit: 'pt', staleDays: 45, lagDays: 0 },
  FWD_EPS: { name: 'S&P 500 Forward EPS (12M)', unit: '$', staleDays: 21, lagDays: 0 },
  FWD_PE:  { name: 'S&P 500 Forward PER', unit: 'x', staleDays: 21, lagDays: 0 },
};
