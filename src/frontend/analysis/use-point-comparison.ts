'use client';
import {useEffect,useRef,useState} from 'react';
import {requestAnalysisPair,type Point,type Query,type AnalysisPair,type Catalog} from '../api';
import {PairCache} from './pair-cache';
export type Slot='A'|'B';
export type NamedPoint={point:Point;title:string};
export function usePointComparison(cache:PairCache,source:Catalog['source_mode']|undefined,start:number,end:number){
 const [points,setPoints]=useState<Record<Slot,NamedPoint|null>>({A:null,B:null});
 const [errors,setErrors]=useState<Partial<Record<Slot,string>>>({}),[busy,setBusy]=useState(false),[,refresh]=useState(0);
 const context=JSON.stringify([source,start,end,points.A?.point,points.B?.point]);
 const latest=useRef(context);latest.current=context;
 const active=useRef<{controller:AbortController;context:string}|null>(null);
 function cancel(){const job=active.current;active.current=null;job?.controller.abort();setBusy(false);}
 useEffect(()=>{cancel();setErrors({});},[context]);
 useEffect(()=>()=>{active.current?.controller.abort();active.current=null;},[]);
 const results=Object.fromEntries((['A','B'] as const).map(id=>[id,points[id]&&source?cache.get({...points[id]!.point,variable:'T2M',start_year:start,end_year:end},source)??null:null])) as Record<Slot,AnalysisPair|null>;
 function choose(id:Slot,value:NamedPoint){cancel();setErrors({});setPoints(p=>({...p,[id]:{title:value.title,point:{latitude:value.point.latitude,longitude:value.point.longitude}}}));}
 async function run(){
  if(active.current||source!=='nasa_power'||!points.A||!points.B)return;
  const job={controller:new AbortController(),context};active.current=job;setBusy(true);setErrors({});
  const pending=new Map<string,Promise<AnalysisPair>>();
  const outcomes=await Promise.allSettled((['A','B'] as const).map(async id=>{
   const query:Query={...points[id]!.point,variable:'T2M',start_year:start,end_year:end};
   if(cache.get(query,source))return;
   const key=JSON.stringify(query);let request=pending.get(key);
   if(!request){request=requestAnalysisPair(query,AbortSignal.any([job.controller.signal,AbortSignal.timeout(30000)]),source);pending.set(key,request);}
   const pair=await request;
   if(active.current===job&&latest.current===job.context){cache.set(query,source,pair);refresh(v=>v+1);}
  }));
  if(active.current===job&&latest.current===job.context){const next:Partial<Record<Slot,string>>={};outcomes.forEach((o,i)=>{if(o.status==='rejected')next[i===0?'A':'B']=o.reason instanceof Error?o.reason.message:'NASA не ответила. Повторите анализ.';});setErrors(next);active.current=null;setBusy(false);refresh(v=>v+1);}
 }
 return {points,results,errors,busy,choose,run,cancel};
}
