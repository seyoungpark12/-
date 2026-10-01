/**
 * 7개 차트 (ECharts). 모든 데이터는 실제 시계열/리플레이 결과이며 임의 생성값 없음.
 *  1 S&P 500 + 200일선   2 S&P 500 Drawdown   3 거시 종합점수   4 지표별 점수 히트맵
 *  5 10년물 금리   6 VIX   7 HY Spread
 */
import { toStr } from '../data/series.js';
import { priceSeriesStats } from '../scoring/priceFilter.js';
import { INDICATOR_META } from '../indicators/meta.js';

const TXT = '#9fb0d8', GRID = '#26335a';
const charts = [];

function baseOption(extra = {}) {
  return {
    backgroundColor: 'transparent', animation: false,
    textStyle: { fontFamily: 'Noto Sans KR, Inter, sans-serif', color: TXT },
    grid: { left: 52, right: 18, top: 28, bottom: 52 },
    tooltip: { trigger: 'axis', backgroundColor: '#0e1630', borderColor: '#3b5fd0', textStyle: { color: '#e8ecf8', fontSize: 12 }, axisPointer: { type: 'cross', label: { backgroundColor: '#2c4aa8' } } },
    xAxis: { type: 'time', axisLine: { lineStyle: { color: GRID } }, axisLabel: { color: TXT }, splitLine: { show: false } },
    yAxis: { type: 'value', scale: true, axisLabel: { color: TXT }, splitLine: { lineStyle: { color: GRID, opacity: .5 } } },
    dataZoom: [{ type: 'inside', filterMode: 'none' }, { type: 'slider', height: 18, bottom: 8, borderColor: GRID, backgroundColor: '#0e1630', fillerColor: 'rgba(122,162,255,.18)', textStyle: { color: TXT }, filterMode: 'none' }],
    ...extra,
  };
}

function mount(id, option) {
  const el = document.getElementById(id);
  if (!el) return null;
  const c = echarts.init(el, null, { renderer: 'canvas' });
  c.setOption(option);
  charts.push(c);
  return c;
}

const pairs = (t, v, minDay = -Infinity) => { const o = []; for (let i = 0; i < t.length; i++) if (t[i] >= minDay && v[i] !== null && Number.isFinite(v[i])) o.push([toStr(t[i]), v[i]]); return o; };

/** rows: replay rows, alerts: [{date,...}] */
export function renderCharts(ds, cfg, rows, alerts) {
  charts.length = 0;
  const sp = ds.series.SP500;
  const minDay = sp ? sp.t[0] : -Infinity;
  const stats = sp ? priceSeriesStats(sp, cfg, [50, 200]) : null;

  // ① S&P 500 + 200MA
  if (stats) {
    mount('chart-sp', baseOption({
      legend: { top: 0, textStyle: { color: TXT }, data: ['S&P 500', '50일선', '200일선'] },
      series: [
        { name: 'S&P 500', type: 'line', showSymbol: false, data: pairs(stats.t, stats.v), lineStyle: { width: 1.4, color: '#7aa2ff' } },
        { name: '50일선', type: 'line', showSymbol: false, data: pairs(stats.t, stats.ma[50]), lineStyle: { width: 1, color: '#94a3b8', type: 'dashed' } },
        { name: '200일선', type: 'line', showSymbol: false, data: pairs(stats.t, stats.ma[200]), lineStyle: { width: 1.6, color: '#f59e0b' } },
      ],
    }));
    // ② Drawdown
    mount('chart-dd', baseOption({
      tooltip: { ...baseOption().tooltip, valueFormatter: (v) => (v === null || v === undefined ? '-' : (v * 100).toFixed(1) + '%') },
      yAxis: { ...baseOption().yAxis, axisLabel: { color: TXT, formatter: (v) => (v * 100).toFixed(0) + '%' }, max: 0 },
      series: [{
        name: 'Drawdown', type: 'line', showSymbol: false, data: pairs(stats.t, stats.dd), lineStyle: { width: 1.2, color: '#fb7185' },
        areaStyle: { color: 'rgba(251,113,133,.22)' },
        markLine: { symbol: 'none', silent: true, label: { color: TXT, formatter: (p) => (p.value * 100).toFixed(0) + '%' }, lineStyle: { color: '#64748b', type: 'dashed' }, data: [{ yAxis: -0.05 }, { yAxis: -0.10 }, { yAxis: -0.15 }, { yAxis: -0.20 }] },
      }],
    }));
  }

  // ③ 종합점수
  if (rows && rows.length) {
    const phaseColors = cfg.phases;
    const alertPts = (alerts || []).map(a => { const r = rows.find(x => x.date === a.date); return r ? { name: '알림', coord: [r.date, r.total], value: r.total } : null; }).filter(Boolean);
    mount('chart-score', baseOption({
      yAxis: { type: 'value', min: -20, max: 20, interval: 5, axisLabel: { color: TXT }, splitLine: { lineStyle: { color: GRID, opacity: .5 } } },
      legend: { top: 0, textStyle: { color: TXT }, data: ['종합점수', '최종 단계 기준선'] },
      series: [{
        name: '종합점수', type: 'line', step: 'end', showSymbol: false, data: rows.map(r => [r.date, r.total]), lineStyle: { width: 1.6, color: '#7aa2ff' },
        markLine: { symbol: 'none', silent: true, label: { color: TXT, formatter: (p) => p.name }, lineStyle: { type: 'dashed', opacity: .7 },
          data: phaseColors.filter(p => p.rank >= 1).map(p => ({ yAxis: p.minScore, name: p.short, lineStyle: { color: p.color } })) },
        markPoint: { symbol: 'pin', symbolSize: 34, itemStyle: { color: '#f59e0b' }, label: { color: '#000', fontSize: 10, formatter: '🔔' }, data: alertPts },
      }],
    }));

    // ④ 지표별 점수 히트맵
    const keys = cfg.indicatorOrder;
    const names = keys.map(k => INDICATOR_META[k].name);
    const dates = rows.map(r => r.date);
    const data = [];
    rows.forEach((r, xi) => keys.forEach((k, yi) => { const s = r.scores[k]; if (s !== null && s !== undefined) data.push([xi, yi, s]); }));
    mount('chart-heat', {
      backgroundColor: 'transparent', animation: false, textStyle: { fontFamily: 'Noto Sans KR, sans-serif', color: TXT },
      grid: { left: 96, right: 20, top: 16, bottom: 80 },
      tooltip: { backgroundColor: '#0e1630', borderColor: '#3b5fd0', textStyle: { color: '#e8ecf8', fontSize: 12 }, formatter: (p) => `${dates[p.value[0]]}<br/>${names[p.value[1]]}: <b>${p.value[2] > 0 ? '+' : ''}${p.value[2]}</b>` },
      xAxis: { type: 'category', data: dates, axisLabel: { color: TXT, interval: Math.max(1, Math.floor(dates.length / 8)) }, axisLine: { lineStyle: { color: GRID } }, splitArea: { show: false } },
      yAxis: { type: 'category', data: names, inverse: true, axisLabel: { color: TXT, fontSize: 11 }, axisLine: { lineStyle: { color: GRID } } },
      dataZoom: [{ type: 'inside', filterMode: 'none' }, { type: 'slider', height: 18, bottom: 8, borderColor: GRID, backgroundColor: '#0e1630', textStyle: { color: TXT }, filterMode: 'none' }],
      visualMap: { type: 'piecewise', orient: 'horizontal', left: 'center', bottom: 34, textStyle: { color: TXT }, itemWidth: 14, itemHeight: 14, pieces: [{ value: -2, color: '#ef4444', label: '-2' }, { value: -1, color: '#f97316', label: '-1' }, { value: 0, color: '#475569', label: '0' }, { value: 1, color: '#4ade80', label: '+1' }, { value: 2, color: '#16a34a', label: '+2' }] },
      series: [{ type: 'heatmap', data, progressive: 0, emphasis: { itemStyle: { borderColor: '#fff', borderWidth: 1 } } }],
    });
  }

  // ⑤ 10Y  ⑥ VIX  ⑦ HY
  const s10 = ds.series.DGS10, vx = ds.series.VIXCLS, hy = ds.series.BAMLH0A0HYM2, baa = ds.series.BAA10Y;
  if (s10) mount('chart-y10', baseOption({
    yAxis: { ...baseOption().yAxis, axisLabel: { color: TXT, formatter: '{value}%' } },
    series: [{ name: '10Y', type: 'line', showSymbol: false, data: pairs(s10.t, s10.v, minDay), lineStyle: { width: 1.3, color: '#38bdf8' } }],
  }));
  if (vx) mount('chart-vix', baseOption({
    series: [{ name: 'VIX', type: 'line', showSymbol: false, data: pairs(vx.t, vx.v, minDay), lineStyle: { width: 1.2, color: '#c084fc' },
      markLine: { symbol: 'none', silent: true, label: { color: TXT }, lineStyle: { color: '#64748b', type: 'dashed' }, data: [{ yAxis: cfg.vix.elevated, name: String(cfg.vix.elevated) }, { yAxis: cfg.vix.extreme, name: String(cfg.vix.extreme) }] } }],
  }));
  if (hy || baa) {
    const series = [];
    if (hy) series.push({ name: 'HY OAS', type: 'line', showSymbol: false, data: pairs(hy.t, hy.v, minDay), lineStyle: { width: 1.5, color: '#f472b6' } });
    if (baa) series.push({ name: 'Baa−10Y (프록시)', type: 'line', showSymbol: false, data: pairs(baa.t, baa.v, minDay), lineStyle: { width: 1, color: '#94a3b8', type: 'dashed' } });
    mount('chart-hy', baseOption({ legend: { top: 0, textStyle: { color: TXT } }, yAxis: { ...baseOption().yAxis, axisLabel: { color: TXT, formatter: '{value}%p' } }, series }));
  }
  window.addEventListener('resize', () => charts.forEach(c => c.resize()));
  return charts;
}

/** 모든 차트의 표시 구간 일괄 변경 (years=0 이면 전체). 히트맵은 category 축이라 비율로 변환 */
export function setRange(years, rows) {
  const end = new Date();
  charts.forEach(c => {
    const opt = c.getOption();
    const isCat = opt.xAxis && opt.xAxis[0] && opt.xAxis[0].type === 'category';
    if (years === 0) { c.dispatchAction({ type: 'dataZoom', start: 0, end: 100 }); return; }
    if (isCat && rows && rows.length) {
      const cutoff = new Date(end); cutoff.setFullYear(cutoff.getFullYear() - years);
      const idx = rows.findIndex(r => r.date >= cutoff.toISOString().slice(0, 10));
      c.dispatchAction({ type: 'dataZoom', start: idx < 0 ? 0 : (idx / rows.length) * 100, end: 100 });
    } else {
      const start = new Date(end); start.setFullYear(start.getFullYear() - years);
      c.dispatchAction({ type: 'dataZoom', startValue: start.getTime(), endValue: end.getTime() });
    }
  });
}

/** 모달용 미니 라인 차트 */
export function renderSpark(elId, ds, seriesId, days = 260) {
  const s = ds.series[seriesId];
  const el = document.getElementById(elId);
  if (!el || !s || s.t.length < 3) { if (el) el.innerHTML = '<div class="muted small">차트 데이터 없음</div>'; return null; }
  const n = Math.min(s.t.length, s.meta.freq === 'monthly' || s.meta.freq === 'manual' ? 36 : s.meta.freq === 'weekly' ? 120 : days);
  const from = s.t.length - n;
  const data = []; for (let i = from; i < s.t.length; i++) data.push([toStr(s.t[i]), s.v[i]]);
  const c = echarts.init(el);
  c.setOption({
    backgroundColor: 'transparent', animation: false, textStyle: { color: TXT },
    grid: { left: 46, right: 10, top: 10, bottom: 24 },
    tooltip: { trigger: 'axis', backgroundColor: '#0e1630', borderColor: '#3b5fd0', textStyle: { color: '#e8ecf8', fontSize: 12 } },
    xAxis: { type: 'time', axisLabel: { color: TXT, fontSize: 10 }, axisLine: { lineStyle: { color: GRID } } },
    yAxis: { type: 'value', scale: true, axisLabel: { color: TXT, fontSize: 10 }, splitLine: { lineStyle: { color: GRID, opacity: .4 } } },
    series: [{ type: 'line', showSymbol: n < 60, symbolSize: 4, data, lineStyle: { width: 1.5, color: '#7aa2ff' }, areaStyle: { color: 'rgba(122,162,255,.12)' } }],
  });
  return c;
}
