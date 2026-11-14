import {LineChart,Line,CartesianGrid,XAxis,YAxis,Tooltip,ResponsiveContainer} from 'recharts'
import {names,type Result} from './api'
const num=(x:number|null,digits=4)=>x===null?'Не определено':x.toLocaleString('ru-RU',{maximumSignificantDigits:digits})
export function Findings({result:r}:{result:Result}){
 const {trend:t,provenance:p,requested:q}=r
 const rows=r.annual_series.map((a,i)=>({...a,fit:t.fitted_values[i]}))
 return <>
  <p className="kicker">{q.variable} · {q.start_year}–{q.end_year}</p>
  <h1>{names[q.variable]}</h1><p className="subtitle">На высоте 2 м · {r.unit}</p>
  <section><h2>Среднегодовые значения</h2>
  <div className="legend"><span>Ряд</span><span>Тренд OLS</span></div>
  <div className="chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={rows} margin={{left:0,right:12,top:12,bottom:2}}>
  <CartesianGrid vertical={false} stroke="#e2e6e9"/><XAxis dataKey="year" tickLine={false} minTickGap={24}/><YAxis domain={['auto','auto']} width={47} tickLine={false}/><Tooltip formatter={v=>num(Number(v))+' '+r.unit}/>
  <Line dataKey="value" name="Среднее" stroke="#102744" strokeWidth={2} dot={false} isAnimationActive={false}/>
  <Line dataKey="fit" name="Тренд OLS" stroke="#657f93" strokeDasharray="5 4" dot={false} isAnimationActive={false}/></LineChart></ResponsiveContainer></div></section>
  <section><h2>Изменение за десятилетие</h2><strong className="slope">{t.slope_per_decade>0?'+':''}{num(t.slope_per_decade)}</strong> <span>{r.trend_unit}</span>
  <dl><dt>95% доверительный интервал</dt><dd>{t.ci95_per_decade?num(t.ci95_per_decade.lower)+' … '+num(t.ci95_per_decade.upper):'Не определён'}</dd><dt>p-value</dt><dd>{num(t.p_value_two_sided)}</dd></dl>
  <p>{t.significant===null?'Значимость не определена.':t.significant?'Тренд статистически значим':'Данных недостаточно для вывода о значимом тренде'} при α = {num(t.alpha)}.</p></section>
  <section><h2>Ячейка и источник</h2><p>Центр MERRA-2 · {r.actual_cell.latitude}°, {r.actual_cell.longitude}°<br/>Выбранная точка · {q.latitude}°, {q.longitude}°</p>
  <p>{p.provider} · {p.dataset} v{p.version}<br/><a href={'https://doi.org/'+p.doi} target="_blank" rel="noreferrer">DOI {p.doi}</a></p>
  <p>{p.mode} · {p.network_used?'С обращением к NASA':'Без сетевого обращения к NASA'}<br/>Из кэша: {p.cache_hits} мес. · Промахов: {p.cache_misses}</p></section>
  <section><h2>Ограничения</h2><p>Реанализ описывает среднее по ячейке. Локальные условия в выбранной точке могут отличаться.</p>{r.warnings.map(w=><p key={w}>{w}</p>)}</section>
 </>
}
