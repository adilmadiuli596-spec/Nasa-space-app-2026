'use client';
import {useEffect,useRef,useState,type RefObject} from 'react';
import {placesSchema,type Place} from '@/shared/schemas/geography';
import type {Point} from '../api';
import {parseCoordinates} from '../location';
import {Icon} from './Icon';
export function GeoSearch({inputRef,select,coordinates}:{inputRef:RefObject<HTMLInputElement|null>;select:(p:Place)=>void;coordinates:(p:Point)=>void}){
 const [query,setQuery]=useState(''),[results,setResults]=useState<Place[]>([]),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const current=useRef<AbortController|null>(null);
 useEffect(()=>()=>current.current?.abort(),[]);
 function invalidate(){current.current?.abort();current.current=null;setBusy(false);setResults([]);setError('');setOpen(false);}
 async function search(e:React.FormEvent){e.preventDefault();if(current.current)return;inputRef.current?.focus();const value=query.trim();const point=parseCoordinates(value);if(point){coordinates(point);setOpen(false);return;}setOpen(true);setResults([]);setError('');if(value.length<2||value.length>100){setError('Введите от 2 до 100 символов или координаты.');return;}
  const ctl=new AbortController();current.current=ctl;setBusy(true);
  try{const response=await fetch('/api/places?q='+encodeURIComponent(value),{signal:AbortSignal.any([ctl.signal,AbortSignal.timeout(12000)]),cache:'no-store'});if(!response.ok)throw new Error(response.status===429?'Подождите пару секунд перед следующим поиском.':'Поиск временно недоступен. Можно выбрать точку на карте или ввести координаты.');const data=placesSchema.safeParse(await response.json());if(!data.success)throw new Error('Поиск вернул некорректные данные. Используйте координаты.');if(current.current===ctl){setResults(data.data.places);if(!data.data.places.length)setError('Место не найдено. Уточните название или введите координаты.');}}
  catch(e){if(current.current===ctl)setError(e instanceof Error&&e.name==='TimeoutError'?'Поиск не ответил вовремя. Используйте карту или координаты.':e instanceof Error&&e.message.startsWith('Поиск')||e instanceof Error&&e.message.startsWith('Подождите')?(e as Error).message:'Нет связи с поиском. Используйте карту или координаты.');}
  finally{if(current.current===ctl){current.current=null;setBusy(false);}}
 }
 return <div className="search-shell" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setOpen(false);}}>
  <form className="geo-search" onSubmit={search} role="search"><Icon name="search"/><input ref={inputRef} aria-label="Поиск города или координат" placeholder="Город или координаты…" autoComplete="off" maxLength={100} value={query} onChange={e=>{invalidate();setQuery(e.target.value);}} onFocus={()=>{if(results.length||error)setOpen(true);}} onKeyDown={e=>{if(e.key==='Escape'){invalidate();e.stopPropagation();}}}/><button aria-label="Найти" title="Найти" disabled={busy}>{busy?<span className="spinner"/>:<Icon name="arrow" size={18}/>}</button></form>
  {open&&<div className="search-results" aria-label="Результаты поиска"><div className="search-caption"><span>{busy?'Ищем географические объекты…':'Результаты поиска'}</span><button type="button" className="icon-button small" aria-label="Закрыть поиск" onClick={()=>setOpen(false)}><Icon name="close" size={16}/></button></div>{error&&<p role="alert">{error}</p>}{results.map(p=><button type="button" className="search-result" key={p.id} onClick={()=>{select(p);setOpen(false);setQuery(p.name);}}><Icon name={p.kind==='area'?'area':'pin'} size={20}/><span><b>{p.name}</b><small>{p.detail||'OpenStreetMap'} · {p.kind==='area'?'Территория':'Город / населённый пункт'}</small></span></button>)}<small className="search-credit">Названия передаются <a href="https://photon.komoot.io/" target="_blank" rel="noreferrer">Photon</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>. Поиск только по нажатию.</small></div>}
 </div>;
}

