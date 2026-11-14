import 'server-only';
import {z} from 'zod';
import {createHash} from 'node:crypto';
import {MemoryCache} from '../cache/memory';
import {SingleFlight} from '../cache/flight';
import {ScienceError} from '../science/errors';
import type {AnalysisRequest} from '@/shared/schemas/analysis';
export const POWER_ENDPOINT='https://power.larc.nasa.gov/api/temporal/monthly/point';
export const powerResponseSchema=z.object({
 type:z.literal('Feature'),geometry:z.object({type:z.literal('Point'),coordinates:z.array(z.number().finite()).min(2)}),
 header:z.object({title:z.string(),api:z.object({version:z.string(),name:z.string()}),sources:z.array(z.string()),fill_value:z.number().finite(),time_standard:z.string(),start:z.string(),end:z.string()}),
 properties:z.object({parameter:z.object({T2M:z.record(z.string(),z.number().finite()),QV2M:z.record(z.string(),z.number().finite())})}),
 parameters:z.object({T2M:z.object({units:z.literal('C'),longname:z.string()}),QV2M:z.object({units:z.literal('g/kg'),longname:z.string()})}),messages:z.array(z.string())
});
export type PowerDocument=z.infer<typeof powerResponseSchema>;
export type PowerPayload={document:PowerDocument;sha256:string;fetched_at:string;request_url:string;cache_hit:boolean};
const memory=new MemoryCache(4*1024*1024),flights=new SingleFlight<PowerPayload>(2);
export function validatePower(document:unknown,latitude:number,longitude:number):PowerDocument {
 const parsed=powerResponseSchema.safeParse(document);
 if(!parsed.success)throw new ScienceError('nasa_invalid_format','NASA POWER response format or source units are invalid',502);
 const d=parsed.data,[lon,lat]=d.geometry.coordinates;
 // POWER returns requested coordinates rounded to three decimals, not a certified cell centre.
 if(Math.abs(lat-latitude)>0.0011||Math.abs(lon-longitude)>0.0011)throw new ScienceError('nasa_invalid_data','NASA POWER returned a different point',502);
 if(!d.header.sources.includes('MERRA2')||d.header.start!=='19910101'||d.header.end!=='20251231'||d.header.time_standard!=='LST'||d.messages.length)throw new ScienceError('nasa_invalid_data','NASA POWER source, period or quality messages require review',502);
 for(const variable of ['T2M','QV2M'] as const){
  const values=d.properties.parameter[variable];
  if(Object.keys(values).some(k=>!/^\d{4}(0[1-9]|1[0-3])$/.test(k)||+k.slice(0,4)<1991||+k.slice(0,4)>2025))throw new ScienceError('nasa_invalid_data','Unexpected POWER temporal key',502);
  for(let year=1991;year<=2025;year++)for(let month=1;month<=12;month++){
   const v=values[`${year}${String(month).padStart(2,'0')}`];
   if(typeof v!=='number'||!Number.isFinite(v)||v===d.header.fill_value)throw new ScienceError('nasa_missing_data','NASA POWER monthly series contains missing values',502);
   if(variable==='T2M'?(v< -93.15||v>56.85):(v<0||v>100))throw new ScienceError('nasa_invalid_data','NASA POWER monthly physical bounds failed',502);
  }
 }
 return d;
}
export function createPowerLoader(fetcher:typeof fetch=fetch,cache=new MemoryCache(4*1024*1024),flight=new SingleFlight<PowerPayload>(2)) {
 return async(request:AnalysisRequest,signal:AbortSignal):Promise<PowerPayload>=>{
  // Five decimal places are substantially finer than the source grid, without floating-point key noise.
  const latitude=+request.latitude.toFixed(5),longitude=+request.longitude.toFixed(5),key=`POWER-v1:${latitude}:${longitude}`;
  const cached=await cache.get(key,86400000) as PowerPayload|undefined;if(cached)return {...cached,cache_hit:true};
  return flight.run(key,async shared=>{
   const url=new URL(POWER_ENDPOINT);url.search=new URLSearchParams({parameters:'T2M,QV2M',community:'RE',latitude:String(latitude),longitude:String(longitude),start:'1991',end:'2025',format:'JSON'}).toString();
   const deadline=AbortSignal.any([shared,AbortSignal.timeout(23000)]);
   for(let attempt=0;attempt<2;attempt++){
    try{
     const response=await fetcher(url,{signal:AbortSignal.any([deadline,AbortSignal.timeout(10000)]),redirect:'error',cache:'no-store',headers:{Accept:'application/json'}});
     if(response.status===429)throw new ScienceError('nasa_rate_limited','NASA POWER rate limit; retry later',429);
     if(!response.ok){if(response.status>=500&&attempt===0)continue;throw new ScienceError('nasa_unavailable','NASA POWER request failed',502);}
     const reader=response.body?.getReader();if(!reader)throw new ScienceError('nasa_invalid_format','NASA POWER response has no body',502);
     const chunks:Uint8Array[]=[];let bytes=0;
     try{while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.length;if(bytes>1024*1024)throw new ScienceError('nasa_response_too_large','NASA POWER response exceeds size limit',502);chunks.push(part.value);}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
     const raw=Buffer.concat(chunks),sha256=createHash('sha256').update(raw).digest('hex');let json:unknown;
     try{json=JSON.parse(raw.toString('utf8'));}catch{throw new ScienceError('nasa_invalid_format','NASA POWER response is not JSON',502);}
     const document=validatePower(json,latitude,longitude),payload={document,sha256,fetched_at:new Date().toISOString(),request_url:url.href,cache_hit:false};
     await cache.set(key,payload);return payload;
    }catch(error){if(error instanceof ScienceError)throw error;if(deadline.aborted||attempt===1)throw new ScienceError('nasa_timeout','NASA POWER request timed out or could not connect',504);}
   }
   throw new ScienceError('nasa_unavailable','NASA POWER unavailable',502);
  },signal);
 };
}
export const loadPower=createPowerLoader(fetch,memory,flights);
