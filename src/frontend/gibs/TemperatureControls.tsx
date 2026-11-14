'use client';
import {useEffect,useState} from 'react';
import type {GibsControl} from './use-gibs';
const months=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
export function TemperatureControls({gibs,compact,mobile,onExpand}:{gibs:GibsControl;compact:boolean;mobile:boolean;onExpand:()=>void}){
 const [legend,setLegend]=useState(!mobile),[expanded,setExpanded]=useState(!mobile);useEffect(()=>{setLegend(!mobile);setExpanded(!mobile);},[mobile]);if(!gibs.enabled)return null;
 const {catalog:c,date,status,error}=gibs,label=date?months[+date.slice(5,7)-1]+' '+date.slice(0,4):'NASA GIBS',year=date.slice(0,4),month=date.slice(5,7);
 const choose=(d:string)=>{if(c?.dates.includes(d)){gibs.setDate(d);}};
 return <section className={'gibs-widget'+(compact?' gibs-compact':'')} aria-label="Температура на карте" data-gibs-status={error?'error':status}>
 <div className="gibs-heading"><button type="button" className="gibs-expand" aria-label="Настроить месяц температуры" aria-expanded={!compact&&expanded} onClick={()=>{if(compact){onExpand();setExpanded(true);}else setExpanded(v=>!v);}}><span className="gibs-dot"/>Карта · {label}<span aria-hidden="true">{!compact&&expanded?'⌃':'⌄'}</span></button><button className="gibs-close" type="button" aria-label="Выключить температуру" onClick={()=>gibs.setEnabled(false)}>×</button></div>
 {!compact&&expanded&&<><p className="gibs-description">Среднемесячная · воздух 2 м · не прогноз</p>
 {error?<p className="gibs-error" role="status">{error}<button type="button" onClick={gibs.retry}>Повторить GIBS</button></p>:!c?<p role="status">Проверяем доступные месяцы NASA…</p>:<>
 <div className="gibs-date"><label>Год<select aria-label="Год температурной карты" value={year} onChange={e=>{const target=e.target.value+'-'+month+'-01';choose(c.dates.includes(target)?target:c.dates.find(d=>d.startsWith(e.target.value+'-'))!);}}>{[...new Set(c.dates.map(d=>d.slice(0,4)))].map(y=><option key={y}>{y}</option>)}</select></label><label>Месяц<select aria-label="Месяц температурной карты" value={month} onChange={e=>choose(year+'-'+e.target.value+'-01')}>{months.map((m,i)=>{const num=String(i+1).padStart(2,'0');return <option key={num} value={num} disabled={!c.dates.includes(year+'-'+num+'-01')}>{m}{c.dates.includes(year+'-'+num+'-01')?'':' · нет данных'}</option>;})}</select></label></div>
 <input className="gibs-slider" type="range" aria-label="Время температурной карты" aria-valuetext={label} min={0} max={c.dates.length-1} value={c.dates.indexOf(date)} onChange={e=>choose(c.dates[+e.target.value])}/><div className="gibs-range"><span>{c.dates[0].slice(0,7)}</span><span>Только доступные месяцы</span><span>{c.dates.at(-1)!.slice(0,7)}</span></div>
 <div className="gibs-load" role="status">{status==='loading'?'Загрузка слоя NASA…':status==='error'?<>Слой не загрузился. Подложка сохранена. <button type="button" onClick={gibs.retry}>Повторить</button></>:'NASA GIBS / MERRA-2 · слой загружен'}</div>
 <button type="button" className="gibs-legend-toggle" aria-expanded={legend} onClick={()=>setLegend(v=>!v)}>{legend?'Скрыть легенду':'Показать легенду'} · °C</button>
 {legend&&<div className="gibs-legend" aria-label="Официальная шкала NASA в градусах Цельсия"><div className="gibs-palette">{c.colors.map((color,i)=><span key={i} style={{background:color}}/>)}</div><div className="gibs-ticks">{c.ticks.map((t,i)=><span key={i} style={{left:t.position*100+'%',transform:i===0?'none':i===c.ticks.length-1?'translateX(-100%)':'translateX(-50%)'}}>{i===0?'≤':i===c.ticks.length-1?'≥':''}{t.celsius.toLocaleString('ru-RU',{maximumFractionDigits:2})}</span>)}</div></div>}
 <details className="gibs-about"><summary>О слое и шкале</summary><p>Официальная палитра NASA: K − 273,15 = °C. За ±85,05° температура не окрашена. Цвет не используется для точечных измерений. Период анализа и T2M/QV2M выбираются независимо.</p><a href={c.colorMapUrl} target="_blank" rel="noreferrer">Источник шкалы NASA</a></details><p className="gibs-independent">Карта: GIBS / MERRA-2 · анализ: NASA POWER</p></>}
 </>}
 </section>;
}
