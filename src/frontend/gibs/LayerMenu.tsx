'use client';
import {useEffect,useRef} from 'react';
import {Icon} from '../components/Icon';
import type {GibsControl} from './use-gibs';
import {BASE_MAP_LAYERS,type BaseMapLayer} from '../map/overlays/contracts';
export function LayerMenu({open,gibs,onClose}:{open:boolean;gibs:GibsControl;onClose:()=>void}){
 const first=useRef<HTMLButtonElement>(null);useEffect(()=>{if(open)first.current?.focus({preventScroll:true});},[open]);
 const choose=(id:BaseMapLayer)=>{gibs.setEnabled(id==='temperature');onClose();};
 return <section id="layer-menu" className="layers-drawer" aria-label="Слои карты" aria-hidden={!open} inert={!open} data-open={open}>
 <div className="menu-heading"><b>Слои</b><button ref={first} type="button" className="icon-button" aria-label="Закрыть слои" onClick={onClose}><Icon name="close" size={18}/></button></div>
 <div role="radiogroup" aria-label="Картографический слой">{BASE_MAP_LAYERS.map((id,i)=>{const active=(id==='temperature')===gibs.enabled;return <button key={id} type="button" className="map-layer-choice" role="radio" aria-checked={active} onClick={()=>choose(id)} onKeyDown={e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const items=e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role=radio]');items?.[(i+1)%BASE_MAP_LAYERS.length]?.focus();}}}><Icon name={id==='temperature'?'thermo':'book'} size={23}/><span><b>{id==='temperature'?'Температура':'Обычная карта'}</b><small>{id==='temperature'?'NASA GIBS / MERRA-2':'Географическая подложка'}</small></span>{active&&<Icon name="check" size={18}/>}</button>;})}</div>
 <details className="layer-data"><summary>О данных</summary><p>Температура воздуха на высоте 2 м — среднемесячная карта, не прогноз. Дата карты не меняет период научного анализа NASA POWER.</p><p>Цветовая шкала NASA: K − 273,15 = °C. Цвет не используется для точечных измерений. Полярные шапки за ±85,05° не окрашены.</p>{gibs.catalog&&<><p>Доступные месяцы: {gibs.catalog.dates[0].slice(0,7)} — {gibs.catalog.dates.at(-1)!.slice(0,7)}. Пропуски исключены из слайдера.</p><a href={gibs.catalog.colorMapUrl} target="_blank" rel="noreferrer">Официальная шкала NASA</a></>}</details>
 </section>;
}
