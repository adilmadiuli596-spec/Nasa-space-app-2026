import 'server-only';
import type {AnalysisRequest} from '@/shared/schemas/analysis';
import type {LoadedSeries} from '@/shared/schemas/science';
import {nearestCell} from '../science/coordinates';
import {ScienceError} from '../science/errors';
import {VARIABLES} from '../science/units';
import {type Cache,MemoryCache,digest} from '../cache/memory';
import {SingleFlight} from '../cache/flight';
import {NasaHTTP} from './http';
import type {NasaConfig} from './config';
import {cmrURL,decodeCatalog,subsetURL,validateCatalog} from './cmr';
import {decodeSubset,validateSubset} from './decode';
import type {CatalogGranule,SubsetRecord} from './schemas';
type Common={entries:CatalogGranule[];rows:{row:SubsetRecord;hit:boolean}[];catalogHit:boolean;catalogMs:number;sourceMs:number};
export class NasaSource {
 private flights=new SingleFlight<Common>(2);
 constructor(private readonly config:NasaConfig,private readonly http=new NasaHTTP(config),private readonly cache:Cache=new MemoryCache(config.cacheBytes),private readonly decode=decodeSubset) {}
 async load(request:AnalysisRequest,clientSignal:AbortSignal=new AbortController().signal):Promise<LoadedSeries> {
  this.http.auth.check();
  const cell=nearestCell(request.latitude,request.longitude);
  const jobKey=digest({start:request.start_year,end:request.end_year,cell,auth:this.http.auth.fingerprint()});
  const common=await this.flights.run(jobKey,async signal=>{
   const started=performance.now(),group=new AbortController(),deadline=AbortSignal.any([signal,group.signal,AbortSignal.timeout(this.config.analysisTimeoutMs)]),catalogKey=digest({kind:'cmr-n3-v1',start:request.start_year,end:request.end_year,dataset:'M2TMNXSLV',version:'5.12.4'});
   let entries:CatalogGranule[]|undefined,catalogHit=false;
   const cached=await this.cache.get(catalogKey,6*3600000);
   if(cached!==undefined){try{entries=validateCatalog(cached,request);catalogHit=true;}catch{await this.cache.delete(catalogKey);}}
   if(!entries){entries=decodeCatalog(await this.http.get(cmrURL(request),false,deadline,4*1024*1024),request);await this.cache.set(catalogKey,entries).catch(()=>{});}
   const catalogMs=performance.now()-started,rows=new Array<{row:SubsetRecord;hit:boolean}>(entries.length);let next=0;
   const work=async()=>{while(next<entries!.length){if(deadline.aborted)throw new ScienceError('nasa_timeout','NASA analysis deadline exceeded',504);const i=next++,entry=entries![i];
    const key=digest({kind:'cell-month-n3-v1',cell,entry,dataset:'M2TMNXSLV',variables:['T2M','QV2M']});
    const cachedRow=await this.cache.get(key,30*86400000);let row:SubsetRecord|undefined,hit=false;
    if(cachedRow!==undefined){try{row=validateSubset(cachedRow,entry,cell);hit=true;}catch{await this.cache.delete(key);}}
    if(!row){row=await this.decode(await this.http.get(subsetURL(entry,cell),true,deadline),entry,cell);row=validateSubset(row,entry,cell);await this.cache.set(key,row).catch(()=>{});}
    rows[i]={row,hit};
   }};
   // Abort siblings after any failure; drain all workers before releasing the job slot.
   let firstError:unknown;
   await Promise.allSettled(Array.from({length:this.config.workers},()=>work().catch(error=>{if(firstError===undefined)firstError=error;group.abort();throw error;})));
   if(firstError!==undefined)throw firstError;
   if(deadline.aborted)throw new ScienceError('nasa_timeout','NASA analysis deadline exceeded',504);
   return {entries,rows,catalogHit,catalogMs,sourceMs:performance.now()-started};
  },clientSignal);
  const hits=common.rows.filter(r=>r.hit).length;
  const records=common.rows.map(({row})=>({month:row.month,value:row.values[request.variable]}));
  return {records,cell,source_unit:VARIABLES[request.variable].source_unit,fill_values:[],
   provenance:{provider:'NASA GES DISC',dataset:'M2TMNXSLV',version:'5.12.4',doi:'10.5067/AP1B0BA5PD2K',mode:'nasa_opendap',network_used:!common.catalogHit||hits!==records.length,source_id:'M2TMNXSLV.5.12.4',artifact_sha256:{cmr_manifest:digest(common.entries),normalized_series:digest(records)},granules:common.rows.map(({row,hit},i)=>({month:row.month,granule_id:row.granule_id,filename:row.filename,retrieval:hit?(this.config.cache==='file'?'file_cache':'memory_cache'):'opendap_subset',sha256:row.response_sha256,url:common.entries[i].opendap})),cache_used:common.catalogHit||hits>0,cache_hits:hits,cache_misses:records.length-hits,catalog_cache_hit:common.catalogHit},
   timings_ms:{catalog:common.catalogMs,source_total:common.sourceMs}};
 }
}
