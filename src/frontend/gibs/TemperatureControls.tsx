'use client';
import {useState} from 'react';
import {Icon} from '../components/Icon';
import type {GibsControl} from './use-gibs';
const months=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
export function TemperatureControls({gibs}:{gibs:GibsControl}){
 const [legend,setLegend]=useState(false);if(!gibs.enabled)return null;
 const {catalog:c,date,status,error}=gibs,year=date.slice(0,4),month=date.slice(5,7),label=date?months[+month-1]+' '+year:'Температура';
 const index=c?.dates.indexOf(date)??-1,choose=(d:string)=>{if(c?.dates.includes(d))gibs.setDate(d);};
 return <><section className="map-timebar" aria-label="Время температурной карты" data-gibs-status={error?'error':status}>
 <div className="timebar-caption"><b>Температура</b><span>NASA GIBS</span></div>
 {error?<div className="timebar-message" role="status">NASA GIBS недоступен. <button type="button" onClick={gibs.retry}>Повторить</button></div>:!c?<div className="timebar-message" role="status">Загрузка доступных месяцев…</div>:<>
 <div className="timebar-date"><button type="button" className="timebar-step" aria-label="Предыдущий доступный месяц" disabled={index<=0} onClick={()=>choose(c.dates[index-1])}><Icon name="back" size={18}/></button><label><span className="sr-only">Год температурной карты</span><select aria-label="Год температурной карты" value={year} onChange={e=>{const target=e.target.value+'-'+month+'-01';choose(c.dates.includes(target)?target:c.dates.find(d=>d.startsWith(e.target.value+'-'))!);}}>{[...new Set(c.dates.map(d=>d.slice(0,4)))].map(y=><option key={y}>{y}</option>)}</select></label><label><span className="sr-only">Месяц температурной карты</span><select aria-label="Месяц температурной карты" value={month} onChange={e=>choose(year+'-'+e.target.value+'-01')}>{months.map((m,i)=>{const value=String(i+1).padStart(2,'0');return <option key={value} value={value} disabled={!c.dates.includes(year+'-'+value+'-01')}>{m}</option>;})}</select></label><button type="button" className="timebar-step next-month" aria-label="Следующий доступный месяц" disabled={index<0||index===c.dates.length-1} onClick={()=>choose(c.dates[index+1])}><Icon name="back" size={18}/></button></div>
 <input className="map-month-slider" type="range" aria-label="Слайдер месяцев карты" aria-valuetext={label} min={0} max={c.dates.length-1} value={index} onChange={e=>choose(c.dates[+e.target.value])}/>
 <div className="timebar-status" role="status">{status==='loading'?'Загрузка карты…':status==='error'?<>Слой не загрузился. <button type="button" onClick={gibs.retry}>Повторить</button></>:'Среднемесячная температура · не прогноз'}</div></>}
 </section>
 {c&&<section className="map-temperature-legend" aria-label="Легенда температуры"><button type="button" className="legend-trigger" aria-label={legend?'Скрыть легенду температуры':'Показать легенду температуры'} aria-expanded={legend} onClick={()=>setLegend(v=>!v)}><b>°C</b><span>Шкала NASA</span><Icon name="chevron" size={16}/></button>{legend&&<div className="temperature-scale" aria-label="Официальная шкала NASA в градусах Цельсия"><div className="temperature-palette">{c.colors.map((color,i)=><span key={i} style={{background:color}}/>)}</div><div className="temperature-ticks">{c.ticks.map((t,i)=><span key={i} style={{left:t.position*100+'%',transform:i===0?'none':i===c.ticks.length-1?'translateX(-100%)':'translateX(-50%)'}}>{i===0?'≤':i===c.ticks.length-1?'≥':''}{t.celsius.toLocaleString('ru-RU',{maximumFractionDigits:2})}</span>)}</div></div>}</section>}
 </>;
}
