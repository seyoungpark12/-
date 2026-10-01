# US Market Macro Signal · 미국 지수 거시 매수 타이밍 시스템

S&P 500 / Nasdaq 100 을 **거시경제·금융시장 데이터**로 평가해 `관망 → 매수 관찰 → 1차 → 2차 → 적극적 매수 검토` 4단계 신호를 보여주는 **규칙 기반 모니터링 대시보드**입니다.
개별 종목 분석/추천, 자동 주문은 범위에서 제외됩니다. 점수·단계는 투자 결정을 대신하지 않으며 LLM 이 점수를 결정하지 않습니다.

```
FRED 스냅샷(data/raw) → 정규화 → 10개 지표 측정 → 지표별 -2~+2 → 총점(-20~+20)
  → 가격 조정 필터 / 급락 안전장치 → 4단계 국면 → 바닥 탐색 → 신뢰도 → 전일 대비 알림 → 대시보드
```

## 페이지 (진입 URI)
| 경로 | 설명 |
|---|---|
| `index.html` | 대시보드: 시장 상태, 점수·국면, 10개 지표 카드(클릭 시 상세 모달), 5문답, 알림, 7개 차트, 투자금 분할, 수동 입력, 데이터 현황 |
| `backtest.html` | 백테스트: 7개 에피소드 분석, 단계별 이후 수익률, 파라미터 오버라이드(JSON) |
| `tests.html` | 브라우저 테스트 러너 (필수 Test 1~8 포함 총 71개) |

## 구현 현황
- ✅ Phase 1~10 전체 (데이터 모델/수집 → 10개 지표 → 점수화 → 총점·국면 → 가격·위험 필터 → 바닥 탐색 → 대시보드 → 알림 → 백테스트 → 테스트)
- ✅ 10개 지표 점수화 `-2/-1/0/+1/+2`, 가중치·모든 임계값 `src/config.js` 로 분리
- ✅ **Point-in-time**: 과거 시점 계산 시 그 시점에 발표된 데이터만 사용 (월간 지표 발표 지연 반영, 테스트로 검증)
- ✅ 결측은 0점이 아니라 `DATA_UNAVAILABLE` 로 처리·합산 제외, 오래된 값은 `최신 발표값 기준` 표시, 신뢰도 HIGH/MEDIUM/LOW (LOW 면 알림 차단)
- ✅ 가격 조정 필터(drawdown·20/50/200MA·저점 갱신), 급락 안전장치(HARD/COMBO), 달러 급등 플래그, 바닥 탐색 가능 구간
- ✅ 점수 이력(전일/5일/20일/최근 최고·최저), 단계 진입 알림(명세 21 형식), 투자금 분할 예시

## 데이터와 한계 (중요)
모든 값은 **FRED 공개 CSV 스냅샷**(`data/raw/*.csv`, 갱신일 `data/manifest.json`)입니다. 임의 추정값은 사용하지 않습니다.

| 지표 | 사용 데이터 | 비고 |
|---|---|---|
| ① 10Y | FRED DGS10, DFII10(실질금리) | 정식 |
| ② 물가 | CPI/Core CPI(BLS), PCE/Core PCE(BEA) YoY 가속도 | 시장 예상치 대비 서프라이즈는 **미구현**(예상치 데이터 없음) |
| ③ Fed 기대 | 6M/1Y/2Y 국채금리 20일 변화 + Fed Funds | **프록시** — CME FedWatch 공개 API 없음 |
| ④ PMI | ISM(수동 입력) → 없으면 Philly/Empire Fed 서베이 | **프록시** — ISM 무료 API 없음 |
| ⑤ 고용 | PAYEMS, UNRATE(Sahm 갭), ICSA, CCSA, 시간당임금 | 정식 |
| ⑥ HY | ICE BofA HY OAS(최근 3년) → 이전 구간은 Baa−10Y | 과거 구간은 프록시 |
| ⑦ VIX | FRED VIXCLS | 정식 |
| ⑧ DXY | Fed 광의 달러지수 DTWEXBGS | **프록시**(ICE DXY 아님) |
| ⑨ EPS / ⑩ PER | **수동 입력만 가능** | 입력 전에는 `DATA_UNAVAILABLE` (현재 상태) |

- FRED 의 S&P 500 일별 지수는 **최근 10년(2016-10~)** 뿐이라 그 이전 백테스트는 **Nasdaq 100 가격**으로 낙폭을 계산합니다.
- EPS/PER/ISM 은 과거 이력이 없어 백테스트에서 결측 → 과거 점수 범위는 ±16 이하이며 신뢰도는 MEDIUM 이하입니다.
- 현재 상태: EPS·PER 미입력 → 신뢰도 MEDIUM, 가능 점수 범위 ±16. **대시보드 하단 "수동 데이터 입력"** 또는 `data/manual/manual.json` 에 실제 발표값을 넣으면 반영됩니다.
- 브라우저는 FRED 를 직접 호출할 수 없어(CORS) 스냅샷을 읽습니다. 갱신: `node scripts/update-data.mjs` 또는 `.github/workflows/update-data.yml`(**4시간마다**, GitHub 저장소 연결 + Actions 활성화 필요. 변경된 경우에만 커밋).
- 대시보드를 열어 둔 상태에서는 4시간마다 스냅샷을 다시 읽어 재계산합니다. 단, 이는 "저장소에 반영된 최신 스냅샷"을 읽는 것이며 스냅샷 자체는 위 워크플로(또는 수동 실행)가 갱신합니다.
- 참고: FRED 원천 데이터 자체의 갱신 주기는 일별 지표는 하루 1회, 월간 지표(CPI·고용 등)는 발표일에만 바뀌므로 4시간 주기는 "누락 방지" 목적입니다. 장중 실시간 시세는 아닙니다.
- EPS·PER 은 자동 연동 불가(무료 공식 API 없음) → 수동 입력.

### 🔄 데이터 업데이트 버튼
- 대시보드 상단 `🔄 데이터 업데이트` 버튼: 캐시를 우회해 스냅샷을 다시 읽고 점수·차트를 재계산합니다. 새 관측일이 생기면 "N개 시계열 갱신 (기준일 A → B)", 없으면 "새로 발표된 데이터 없음"을 표시하고, 실패하면 기존 데이터를 그대로 유지합니다 (값을 만들어 내지 않음). 페이지를 열어 둔 경우 4시간마다 같은 동작을 자동 수행합니다.
- **한계 (중요)**: 브라우저는 FRED·Yahoo·CBOE·Stooq 를 직접 호출할 수 없습니다(CORS 차단, 실측 확인). 그래서 버튼이 읽는 곳은 "스냅샷 파일"이며, 스냅샷이 갱신되지 않으면 버튼을 눌러도 새 데이터는 없습니다.
- **여러 사람이 쓰는 배포본에서 진짜 자동 갱신을 하려면** 스냅샷을 서버 쪽에서 주기적으로 갱신해야 합니다:
  1. 이 프로젝트를 GitHub 저장소로 올리고 Actions 를 켭니다 → `.github/workflows/update-data.yml` 이 4시간마다 `data/raw/*.csv` 를 갱신·커밋.
  2. `data/source.json` 의 `remoteBase` 에 `https://raw.githubusercontent.com/<계정>/<저장소>/main/` 를 입력해 재배포.
  3. 이후 방문자의 버튼/4시간 자동 갱신은 그 저장소의 최신 스냅샷을 읽습니다 (재배포 불필요). 시리즈별로 원격/배포본 중 더 최신 관측일을 쓰고, 원격 실패 시 배포본으로 대체합니다.
- `remoteBase` 가 비어 있으면(현재) 배포본 스냅샷만 읽습니다.

### EPS / Forward PER 바로 입력 (카드 → 모달)
- `#9 EPS`, `#10 Forward PER` 카드를 클릭하면 모달 안에 **입력 폼**이 열립니다 (카드에는 `＋ 값 입력 / 확인 사이트` 표시). 값이 이미 있어도 같은 곳에서 추가·삭제할 수 있습니다.
  - EPS: 기준일 · Forward 12M EPS · 출처 → **최소 3개 시점**(최신, 약 1개월 전, 약 3개월 전)이 쌓이면 점수 계산
  - PER: 기준일 · Forward PER · 5년/10년 평균(필수 중 하나) · 52주 고/저(선택) · 출처
  - 저장 시 즉시 데이터 재로드 → 점수/차트 재계산. 값은 브라우저 localStorage 에 저장되며, 하단 "수동 데이터 입력"의 `JSON 내보내기`로 `data/manual/manual.json` 에 옮기면 저장소에 영구 반영됩니다.
  - 기준일·양수 값·출처가 없으면 저장되지 않습니다 (임의값 방지).
- **값 확인 사이트**(모달 및 하단 수동 입력 섹션에 링크): FactSet Earnings Insight, Yardeni Research, S&P DJI, WSJ, multpl(후행 PER — Forward 와 정의가 달라 참고용). 목록은 `src/dashboard/inlineInput.js` 의 `REF_LINKS` 에서 수정합니다. 일부 링크는 사이트 개편 시 주소가 바뀔 수 있습니다.
- 구현 파일: `src/dashboard/inlineInput.js` (입력 패널 + 링크), `render.js`(카드 CTA/모달 슬롯), `main.js`(저장 후 재계산).

## 백테스트 첫 결과 (기본 파라미터, 있는 그대로)
| 구간 | 관찰 |
|---|---|
| 2008 금융위기 | 낙폭 -53.7%. 저점 전 매수 단계 없음, 안전장치 작동(HARD 6 / COMBO 11), 첫 1차 신호는 저점 후 +14% (바닥 직후 반응) |
| 2011 / 2018 / 2020 | **1차 신호 없음** — 점수가 저점 부근에서 충분히 올라오지 못함. 2018·2020 은 "회복 구간 신호 부재" 경고 |
| 2015~16 | 저점 후 +12% 에서 첫 신호 (늦은 편) |
| 2022 | 저점 전 매수 단계 없음, 첫 신호는 저점 후 +16% (지연) |
| 2023~24 상승장 | 알림 4회로 허용(2회) 초과 — 가격 게이트/임계값 점검 필요 |

해석: 현재 규칙은 **"너무 일찍 사지 않기"에는 강하고 "회복 초기 포착"에는 약합니다.** 이는 설계 의도(신용위기 보호)와 일치하는 면도 있으나, 늦은 신호·상승장 알림은 개선 여지가 있습니다.
다만 EPS/PER/ISM 결측 상태에서의 결과이므로 해당 데이터를 채운 뒤 재평가를 권장하며, **과거 결과에 맞춰 임계값을 억지로 맞추는 과최적화에 주의**하세요(백테스트 페이지의 오버라이드로 실험 가능).

## 구조
```
src/config.js                 모든 임계값/가중치/국면/백테스트 설정
src/data/                     series(시계열·PIT), registry(출처·지연), dataset, loader(브라우저), providers/fred.js(adapter)
src/indicators/               10개 지표 측정(treasury10y, inflation, fedExpectations, pmi, employment, creditSpread, vix, dxy, eps, valuation)
src/scoring/                  indicatorScore(순수), totalScore, marketPhase, priceFilter, riskOverride, bottomingSetup, confidence
src/alerts/marketAlert.js     단계 진입 알림/문구
src/engine/                   evaluateMarket, replay, dailyReport(5문답 + 최종 7개 반환값)
src/backtest/                 analyze(에피소드 분석), main
src/dashboard/                render, charts(ECharts), allocation, manualInput, ui, main
src/tests/                    required(Test1~8), indicators, alerts, integration
scripts/update-data.mjs       FRED 스냅샷 갱신 (Node 18+)
```
명세의 권장 구조는 TypeScript 이나, 이 프로젝트는 빌드 없이 동작하는 정적 사이트라 **ES 모듈 JavaScript(순수 함수 분리)** 로 구현했습니다. 점수 계산은 외부 I/O 없는 순수 함수이며 외부 데이터 접근은 adapter 로 분리되어 있습니다.

## 데이터 모델
정적 사이트 특성상 계산은 브라우저에서 이루어지며, 아래 테이블 스키마를 정의해 두었습니다(`market_prices`, `macro_indicators`, `indicator_scores`, `market_scores`, `alerts`). 대시보드의 **"테이블 JSON 내보내기"** 가 이 구조로 오늘 결과를 내보냅니다. 현재 앱은 이 테이블에 자동 저장하지 않습니다.

## 미구현 / 한계
- ❌ 실제 알림 **발송**(이메일/푸시) — 정적 사이트는 서버가 없어 불가. 화면 표시 + `alerts` 레코드(sent=false) 생성까지만. (외부 스케줄러 + 웹훅 필요)
- ❌ CME FedWatch / ISM / Forward EPS·PER 자동 수집 (무료 공식 API 없음 → 프록시 또는 수동 입력)
- ❌ CPI/PCE 시장 예상치 대비 서프라이즈, FOMC 일정 기반 기대
- ❌ S&P 500 2016 이전 일별 가격 (Nasdaq 100 대체)
- ❌ TypeScript 전환

## 다음 단계 제안
1. EPS/PER/ISM 실제 값 입력 후 백테스트 재실행 → 신뢰도 HIGH 구간 확보
2. 2011·2018·2020 "신호 부재" 원인 분석 (VIX 안정 판정, HY 프록시 임계값, 고용/물가 지표 기여 점검)
3. S&P 500 장기 일별 데이터 소스 확보(예: 별도 CSV 업로드) 후 2008 구간 재검증
4. 알림 발송용 외부 스케줄러(GitHub Actions + 이메일/텔레그램) 연동
