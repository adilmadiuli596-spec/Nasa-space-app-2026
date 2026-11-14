import 'server-only';
import {ScienceError} from '../science/errors';
import type {AnalysisRequest} from '@/shared/schemas/analysis';
import {granuleSchema,type CatalogGranule} from './schemas';
import {assertNASAUrl} from './auth';
import {NasaHTTP} from './http';
import {configFromEnv} from './config';
// Compatibility for the N1 read-only probe; no separate scientific implementation.
export async function discoverJanuary1991(){const request={start_year:1991,end_year:1991};const entry=decodeCatalog(await new NasaHTTP(configFromEnv()).get(cmrURL(request),false,AbortSignal.timeout(25000),4*1024*1024),request)[0];return {id:entry.granule_id,filename:entry.filename,opendap:entry.opendap};}
export function expectedMonths(start:number,end:number) {return Array.from({length:(end-start+1)*12},(_,i)=>`${start+Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')}`);}
export function cmrURL(request:Pick<AnalysisRequest,'start_year'|'end_year'>) {
 const url=new URL('https://cmr.earthdata.nasa.gov/search/granules.json');
 url.search=new URLSearchParams({short_name:'M2TMNXSLV',version:'5.12.4',temporal:`${request.start_year}-01-01T00:00:00Z,${request.end_year}-12-31T23:59:59Z`,page_size:'500',sort_key:'start_date'}).toString();return url;
}
export function validateCatalog(input:unknown,request:Pick<AnalysisRequest,'start_year'|'end_year'>):CatalogGranule[] {
 try {
  const entries=granuleSchema.array().parse(input),months=expectedMonths(request.start_year,request.end_year);
  if(entries.length!==months.length||entries.some((e,i)=>e.month!==months[i]))throw new ScienceError('nasa_incomplete_series','NASA catalog must contain exactly one granule per month',502);
  for(const entry of entries){const url=new URL(entry.opendap);assertNASAUrl(url,true);
   if(url.search||url.hash||decodeURIComponent(url.pathname)!==`/collections/C1276812859-GES_DISC/granules/M2TMNXSLV.5.12.4:${entry.filename}`||!entry.filename.endsWith('.'+entry.month.replace('-','')+'.nc4'))throw new Error();}
  return entries;
 }catch(error){if(error instanceof ScienceError)throw error;throw new ScienceError('nasa_invalid_catalog','NASA catalog metadata are invalid',502);}
}
export function decodeCatalog(bytes:Uint8Array,request:Pick<AnalysisRequest,'start_year'|'end_year'>) {
 try {
  const raw=JSON.parse(new TextDecoder().decode(bytes)).feed.entry;
  if(!Array.isArray(raw))throw new Error();
  return validateCatalog(raw.map(e=>{
   if(e.data_center!=='GES_DISC'||!e.title?.startsWith('M2TMNXSLV.5.12.4:'))throw new Error();
   const link=e.links?.find((l:{inherited?:boolean;title?:string})=>!l.inherited&&l.title?.startsWith('OPeNDAP'));
   return {month:e.time_start?.slice(0,7),granule_id:e.id,filename:e.producer_granule_id,opendap:link?.href,updated:e.updated};
  }),request);
 }catch(error){if(error instanceof ScienceError)throw error;throw new ScienceError('nasa_invalid_catalog','NASA CMR returned an invalid catalog',502);}
}
export function subsetURL(entry:CatalogGranule,cell:{latitude_index:number;longitude_index:number}) {
 const url=new URL(entry.opendap+'.dap.nc4');
 const ce=['T2M','QV2M'].map(v=>`/${v}[0:1:0][${cell.latitude_index}:1:${cell.latitude_index}][${cell.longitude_index}:1:${cell.longitude_index}]`).join(';')+`;/lat[${cell.latitude_index}:1:${cell.latitude_index}];/lon[${cell.longitude_index}:1:${cell.longitude_index}];/time[0:1:0]`;
 url.search=new URLSearchParams({'dap4.ce':ce}).toString();return url;
}
