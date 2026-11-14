'use client';
import {useEffect,useMemo,useState} from 'react';
import type {GibsCatalog,GibsStatus,TemperatureOverlay} from '@/shared/types/gibs';
export function useGibs(){const [enabled,setEnabled]=useState(true),[catalog,setCatalog]=useState<GibsCatalog|null>(null),[date,setDate]=useState(''),[renderDate,setRenderDate]=useState(''),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[status,setStatus]=useState<GibsStatus>('loading');
 useEffect(()=>{if(!enabled||catalog)return;const ctl=new AbortController();setError('');fetch('/api/gibs',{signal:AbortSignal.any([ctl.signal,AbortSignal.timeout(28000)])}).then(async r=>{if(!r.ok)throw new Error('metadata');const c:GibsCatalog=await r.json();if(c.layer!=='MERRA2_2m_Air_Temperature_Monthly'||!c.dates?.length||c.dates.length>2400||!c.dates.includes(c.defaultDate)||!c.colors?.length||c.colors.length>256)throw new Error('metadata');if(!ctl.signal.aborted){setCatalog(c);setDate(c.defaultDate);}}).catch(()=>{if(!ctl.signal.aborted)setError('NASA GIBS временно недоступен. Карта и анализ NASA POWER работают независимо.');});return()=>ctl.abort();},[enabled,catalog,attempt]);
 useEffect(()=>{setStatus('loading');setRenderDate('');const timer=setTimeout(()=>setRenderDate(date),200);return()=>clearTimeout(timer);},[date]);
 const overlay=useMemo<TemperatureOverlay|undefined>(()=>enabled&&catalog&&renderDate===date&&catalog.dates.includes(date)?{date,retry:attempt,onStatus:setStatus}:undefined,[enabled,catalog,date,renderDate,attempt]);
 return{enabled,setEnabled,catalog,date,setDate,error,status,retry:()=>{setError('');setStatus('loading');setAttempt(n=>n+1);},overlay};
}
export type GibsControl=ReturnType<typeof useGibs>;
