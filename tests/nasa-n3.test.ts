import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdir,mkdtemp,readFile,writeFile,rm,readdir} from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import * as h5 from 'h5wasm';
import type {Dataset} from 'h5wasm';
import {TokenProvider} from '../src/backend/nasa/auth';
import {configFromEnv,type NasaConfig} from '../src/backend/nasa/config';
import {NasaHTTP} from '../src/backend/nasa/http';
import {decodeCatalog,validateCatalog,expectedMonths} from '../src/backend/nasa/cmr';
import {decodeSubset} from '../src/backend/nasa/decode';
import {NasaSource} from '../src/backend/nasa/source';
import {MemoryCache,digest} from '../src/backend/cache/memory';
import {FileCache} from '../src/backend/cache/file';
import {SingleFlight} from '../src/backend/cache/flight';
import {createAnalysisService} from '../src/backend/services/analysis';
import {createAnalysisHandler,errorResponse,readJSON} from '../src/backend/services/http';
import {nearestCell} from '../src/backend/science/coordinates';
import {ScienceError} from '../src/backend/science/errors';
import type {CatalogGranule} from '../src/backend/nasa/schemas';
import type {AnalysisRequest} from '../src/shared/schemas/analysis';
const config:NasaConfig={mode:'local',workers:4,requestTimeoutMs:1000,analysisTimeoutMs:10000,attempts:1,cache:'memory',cacheBytes:16*1024*1024};
const noSignal=()=>new AbortController().signal;
const token=()=>new TokenProvider(()=> 'mock-test-token');
const fixture=JSON.parse(readFileSync('tests/fixtures/n2/real-cases.json','utf8'));
const cmr=(start:number,end:number)=>expectedMonths(start,end).map(month=>{
 const g=fixture[0].loaded.provenance.granules.find((g:{month:string})=>g.month===month);
 return {month,granule_id:g.granule_id,filename:g.filename,opendap:g.url,updated:'2026-01-01T00:00:00Z'};
});
const rawCMR=(entries:CatalogGranule[])=>({feed:{entry:entries.map(e=>({data_center:'GES_DISC',title:'M2TMNXSLV.5.12.4:'+e.filename,id:e.granule_id,time_start:e.month+'-01T00:00:00Z',producer_granule_id:e.filename,updated:e.updated,links:[{title:'OPeNDAP',href:e.opendap}]}))}});
const sourceFor=(options:{status?:number;missing?:boolean;delay?:number;badCell?:boolean;cache?:MemoryCache}={})=>{
 const calls={cmr:0,subset:0,active:0,maxActive:0,headers:[] as {host:string;auth:string|null}[]};
 const fetcher:typeof fetch=async(input,init)=>{
  const url=new URL(String(input));calls.headers.push({host:url.hostname,auth:new Headers(init?.headers).get('authorization')});
  calls.active++;calls.maxActive=Math.max(calls.maxActive,calls.active);
  try {
   if(options.delay)await new Promise<void>((resolve,reject)=>{const timer=setTimeout(resolve,options.delay);init?.signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(new Error('aborted'));},{once:true});});
   if(options.status)return new Response('private upstream body must not escape',{status:options.status});
   if(url.hostname==='cmr.earthdata.nasa.gov'){calls.cmr++;const temporal=url.searchParams.get('temporal')!;let entries=cmr(+temporal.slice(0,4),+temporal.slice(21,25));if(options.missing)entries=entries.slice(1);return Response.json(rawCMR(entries));}
   calls.subset++;return new Response(new Uint8Array([1,2,3]));
  }finally{calls.active--;}
 };
 const decode:typeof decodeSubset=async(_bytes,entry,cell)=>{
  const city=cell.longitude===13.125?'BERLIN':'PAVLODAR';const t=fixture.find((c:{id:string})=>c.id===city+'_T2M'),q=fixture.find((c:{id:string})=>c.id===city+'_QV2M');
  const a=t.loaded.records.find((r:{month:string})=>r.month===entry.month),b=q.loaded.records.find((r:{month:string})=>r.month===entry.month);
  return {month:entry.month,cell:options.badCell?{...cell,longitude:0}:cell,values:{T2M:a.value,QV2M:b.value},units:{T2M:'K',QV2M:'kg kg-1'},response_sha256:t.loaded.provenance.granules.find((g:{month:string})=>g.month===entry.month).sha256,granule_id:entry.granule_id,filename:entry.filename,updated:entry.updated,time_label:entry.month+'-01T00:30:00.000Z',dataset:'M2TMNXSLV',version:'5.12.4',doi:'10.5067/AP1B0BA5PD2K'};
 };
 return {calls,source:new NasaSource(config,new NasaHTTP(config,token(),fetcher),options.cache||new MemoryCache(),decode)};
};
const request=fixture[0].request as AnalysisRequest;
function compareNumeric(a:unknown,b:unknown):void {
 if(typeof b==='number')assert(typeof a==='number'&&Math.abs(a-b)<=1e-12+1e-10*Math.abs(b),`${a} != ${b}`);
 else if(Array.isArray(b)){assert(Array.isArray(a));assert.equal(a.length,b.length);b.forEach((v,i)=>compareNumeric(a[i],v));}
 else if(b&&typeof b==='object'){for(const [k,v] of Object.entries(b))compareNumeric((a as Record<string,unknown>)[k],v);}
 else assert.equal(a,b);
}
test('all four raw NASA snapshot results through source/service, cold and warm cache',async()=>{
 const {source,calls}=sourceFor();const analyze=createAnalysisService(config,source);
 for(const c of fixture){const response=await analyze(c.request,new Request('http://127.0.0.1/api/analysis'));
  for(const k of ['monthly_series','annual_series','trend','quality','actual_cell','unit','source_unit','trend_unit','warnings'])compareNumeric(response[k as keyof typeof response],c.expected[k]);
  assert.equal(response.provenance.dataset,c.expected.provenance.dataset);assert.equal(response.provenance.granules.length,420);
  assert.equal(response.provenance.cache_hits,c.id.endsWith('QV2M')?420:0);
 }
 assert.equal(calls.cmr,1);assert.equal(calls.subset,840);assert(calls.maxActive<=4);
 assert(calls.headers.filter(h=>h.host==='cmr.earthdata.nasa.gov').every(h=>h.auth===null));assert(calls.headers.filter(h=>h.host==='opendap.earthdata.nasa.gov').every(h=>h.auth==='Bearer mock-test-token'));
});
test('same source request coalesces parallel callers, no cross-cell substitution',async()=>{
 const {source,calls}=sourceFor({delay:1});
 const [a,b]=await Promise.all([source.load(request),source.load({...request,variable:'QV2M'})]);
 assert.equal(calls.subset,420);assert.equal(a.records[0].month,b.records[0].month);assert.notEqual(a.records[0].value,b.records[0].value);
 const berlin=await source.load({...request,latitude:52.52,longitude:13.405});assert.equal(berlin.cell.longitude,13.125);assert.equal(calls.subset,840);
});
for(const status of [401,403,429,404,500])test('NASA HTTP '+status+' -> safe error',async()=>{
 let attempts=0;const provider=token(),http=new NasaHTTP({...config,attempts:status===429?2:1},provider,async()=>{attempts++;return new Response('secret-upstream',{status,headers:{'Retry-After':'0'}});});
 await assert.rejects(http.get(new URL(cmr(1991,1991)[0].opendap+'.dap.nc4'),true,noSignal()),(e:unknown)=>e instanceof ScienceError&&e.code===({401:'nasa_auth_required',403:'nasa_forbidden',429:'nasa_rate_limited',404:'nasa_granule_unavailable',500:'nasa_unavailable'} as Record<number,string>)[status]&&!e.message.includes('secret'));
 assert.equal(attempts,status===429?2:1);if(status===401||status===403)assert.throws(()=>provider.check(),{code:'nasa_auth_rejected'});
});
test('missing, expired and rotated token; no token or response leakage',async()=>{
 assert.throws(()=>new TokenProvider(()=>undefined).check(),{code:'nasa_auth_required'});
 const jwt='e30.'+Buffer.from(JSON.stringify({exp:1})).toString('base64url')+'.fake';assert.throws(()=>new TokenProvider(()=>jwt).check(),{code:'nasa_token_expired'});
 let value='first-test-token';const p=new TokenProvider(()=>value);p.invalidate();assert.throws(()=>p.check(),{code:'nasa_auth_rejected'});value='second-test-token';p.check();
 const source=new NasaSource(config,new NasaHTTP(config,new TokenProvider(()=>undefined),async()=>{throw new Error('network must not run');}));await assert.rejects(source.load(request),{code:'nasa_auth_required'});
 const response=errorResponse(new Error('private-password-value'));assert.equal(response.status,500);assert(!(await response.text()).includes('private-password-value'));
});
test('long Retry-After is respected without an early retry or consuming the analysis deadline',async()=>{
 let calls=0;const http=new NasaHTTP({...config,attempts:3},token(),async()=>{calls++;return new Response('private upstream',{status:429,headers:{'retry-after':'120'}});});
 let caught:unknown;try{await http.get(new URL(cmr(1991,1991)[0].opendap),true,noSignal());}catch(error){caught=error;}
 assert.equal(calls,1);assert(caught instanceof ScienceError);const response=errorResponse(caught);assert.equal(response.status,503);assert.equal(response.headers.get('retry-after'),'120');assert(!(await response.text()).includes('private upstream'));
});
test('redirects never followed and foreign TLS hosts are rejected before fetch',async()=>{
 let calls=0;const http=new NasaHTTP(config,token(),async(_input,init)=>{calls++;assert.equal(init?.redirect,'manual');return new Response(null,{status:302,headers:{location:'https://evil.invalid/steal'}});});
 await assert.rejects(http.get(new URL(cmr(1991,1991)[0].opendap+'.dap.nc4'),true,noSignal()),{code:'nasa_redirect_error'});assert.equal(calls,1);
 for(const url of ['http://opendap.earthdata.nasa.gov/collections/x','https://evil.invalid/a','https://opendap.earthdata.nasa.gov.evil.invalid/a','https://user:pass@opendap.earthdata.nasa.gov/collections/a'])await assert.rejects(http.get(new URL(url),true,noSignal()),{code:'nasa_invalid_url'});assert.equal(calls,1);
});
test('timeout, external cancellation and response-byte limits',async()=>{
 const pending:typeof fetch=async(_input,init)=>new Promise((_resolve,reject)=>{init?.signal?.addEventListener('abort',()=>reject(new Error('timeout')),{once:true});});
 const keepAlive=setInterval(()=>{},100);try{await assert.rejects(new NasaHTTP({...config,requestTimeoutMs:5},token(),pending).get(new URL(cmr(1991,1991)[0].opendap),true,noSignal()),{code:'nasa_timeout'});}finally{clearInterval(keepAlive);}
 const http=new NasaHTTP(config,token(),async()=>new Response(new Uint8Array(100)));await assert.rejects(http.get(new URL(cmr(1991,1991)[0].opendap),true,noSignal(),10),{code:'nasa_response_too_large'});
 const ctl=new AbortController();ctl.abort();await assert.rejects(http.get(new URL(cmr(1991,1991)[0].opendap),true,ctl.signal),{code:'nasa_timeout'});
});
test('CMR missing/duplicate months and unsafe product links rejected',async()=>{
 const entries=cmr(1991,1991);assert.equal(decodeCatalog(Buffer.from(JSON.stringify(rawCMR(entries))),{start_year:1991,end_year:1991}).length,12);
 assert.throws(()=>validateCatalog(entries.slice(1),{start_year:1991,end_year:1991}),{code:'nasa_incomplete_series'});
 for(const mutation of [(a:CatalogGranule[])=>a[1]={...a[0]},(a:CatalogGranule[])=>a[0].opendap='https://evil.invalid/a',(a:CatalogGranule[])=>a[0].filename='MERRA2_100.tavgM_2d_slv_Nx.200001.nc4']){const copy=structuredClone(entries);mutation(copy);assert.throws(()=>validateCatalog(copy,{start_year:1991,end_year:1991}),ScienceError);}
 const {source}=sourceFor({missing:true});await assert.rejects(source.load(request),{code:'nasa_incomplete_series'});
 const bad=sourceFor({badCell:true});await assert.rejects(bad.source.load(request),{code:'nasa_invalid_data'});assert(bad.calls.subset<=4,'siblings cancelled');
});
const bytes=new Uint8Array(readFileSync('tests/fixtures/n3/pavlodar-1991-02.nc4')),entry=cmr(1991,1991)[1],cell=nearestCell(52.27601,76.96881);
async function mutated(change:(file:h5.File)=>void){await h5.ready;const name='/test-mutated-n3.nc4';h5.FS!.writeFile(name,bytes);const file=new h5.File(name,'a');try{change(file);}finally{file.close();}const value=h5.FS!.readFile(name);h5.FS!.unlink(name);return new Uint8Array(value);}
test('real NASA NetCDF4/HDF5 memory decoding, coordinates, dimensions, units, time',async()=>{
 const record=await decodeSubset(bytes,entry,cell);const expected=fixture[0].loaded.records.find((r:{month:string})=>r.month==='1991-02');assert.equal(record.values.T2M,expected.value);assert.equal(record.cell.longitude,76.875);assert.equal(record.response_sha256,createHash('sha256').update(bytes).digest('hex'));
});
for(const variant of ['bad_magic','truncated','wrong_cell','wrong_product','wrong_units','wrong_time','wrong_calendar','fill','valid_range','wrong_dimensions'])test('HDF5 rejects '+variant,async()=>{
 let input=bytes,target=cell;
 if(variant==='bad_magic')input=new Uint8Array([1,2,3]);else if(variant==='truncated')input=bytes.slice(0,100);else if(variant==='wrong_cell')target=nearestCell(52.52,13.405);
 else input=await mutated(file=>{
  const ds=file.get('T2M') as Dataset,time=file.get('time') as Dataset;
  const attr=(object:h5.File|Dataset,name:string,value:string|number[])=>{object.delete_attribute(name);object.create_attribute(name,value);};
  if(variant==='wrong_product')attr(file,'VersionID','not-the-version');
  if(variant==='wrong_units')attr(ds,'units','°C');if(variant==='wrong_time')time.write_slice([[0,1]],new Float64Array([31*24*60]));if(variant==='wrong_calendar')attr(time,'calendar','360_day');
  if(variant==='fill')ds.write_slice([[0,1],[0,1],[0,1]],new Float32Array([999999986991104]));if(variant==='valid_range')attr(ds,'valid_range',[0,1]);if(variant==='wrong_dimensions')ds.detach_scale(1,'/lat');
 });
 await assert.rejects(decodeSubset(input,entry,target),(e:unknown)=>e instanceof ScienceError&&['nasa_invalid_format','nasa_missing_data'].includes(e.code));
});
test('HDF5 supports scale/offset before physical screening without changing units',async()=>{
 const input=await mutated(file=>{const ds=file.get('T2M') as Dataset;ds.write_slice([[0,1],[0,1],[0,1]],new Float32Array([100]));ds.create_attribute('scale_factor',[.5]);ds.create_attribute('add_offset',[230]);});
 const record=await decodeSubset(input,entry,cell);assert.equal(record.values.T2M,280);
});
test('bounded memory cache TTL and local atomic file cache corruption / no disk dependency',async()=>{
 const memory=new MemoryCache(50);await memory.set('a',{x:'small'});assert.deepEqual(await memory.get('a',1000),{x:'small'});assert.equal(await memory.get('a',0),undefined);await memory.set('big',{x:'a'.repeat(100)});assert.equal(await memory.get('big',1000),undefined);
 await mkdir('.cache',{recursive:true});const root=await mkdtemp(path.join(process.cwd(),'.cache','n3-cache-test-'));
 try{const cache=new FileCache(root),key=digest({cell:1});await cache.set(key,{value:280});assert.deepEqual(await cache.get(key,10000),{value:280});const file=path.join(root,'.cache','nasa-n3',key+'.json');const envelope=JSON.parse(await readFile(file,'utf8'));envelope.payload.value=999;await writeFile(file,JSON.stringify(envelope));assert.equal(await cache.get(key,10000),undefined);assert.equal((await readdir(path.dirname(file))).filter(n=>n.endsWith('.tmp')).length,0);}
 finally{assert(path.resolve(root).startsWith(path.join(process.cwd(),'.cache')+path.sep));await rm(root,{recursive:true,force:true});}
});
test('single-flight cancellation and capacity do not cancel another waiting caller',async()=>{
 const flights=new SingleFlight<number>(1),a=new AbortController(),b=new AbortController();let finish:(n:number)=>void=()=>{};let aborted=false;
 const producer=(signal:AbortSignal)=>new Promise<number>(resolve=>{finish=resolve;signal.addEventListener('abort',()=>aborted=true);});
 const first=flights.run('one',producer,a.signal);const second=flights.run('one',producer,b.signal);await Promise.resolve();a.abort();await assert.rejects(first,{code:'nasa_timeout'});assert.equal(aborted,false);await assert.rejects(flights.run('two',producer,noSignal()),{code:'analysis_busy'});finish(7);assert.equal(await second,7);
});
test('public dynamic mode cannot be unlocked by environment, local origin/host gate',async()=>{
 assert.equal(configFromEnv({EARTH_MODE:'local',VERCEL:'1'}).mode,'blocked');assert.equal(configFromEnv({}).mode,'blocked');
 const blocked=createAnalysisService({...config,mode:'blocked'});await assert.rejects(blocked(request,new Request('http://localhost/api/analysis')),{code:'public_access_unconfirmed'});
 const analyze=createAnalysisService(config,sourceFor().source);
 for(const req of [new Request('https://public.example/api/analysis'),new Request('http://localhost/api/analysis',{headers:{Origin:'https://evil.invalid'}})])await assert.rejects(analyze(request,req),{code:'local_only'});
 const demo=createAnalysisService({...config,mode:'demo'});const result=await demo(request,new Request('https://demo.example/api/analysis'));assert.equal(result.provenance.mode,'offline_verified_demo');assert.equal(result.provenance.network_used,false);assert(result.warnings.some(w=>w.startsWith('Explicit demonstration')));await assert.rejects(demo({...request,longitude:0},new Request('http://localhost/')),{code:'demo_cell_unavailable'});
});
test('HTTP bounded streaming JSON rejects forged content length, malformed UTF8 and URL input',async()=>{
 await assert.rejects(readJSON(new Request('http://localhost/',{method:'POST',body:' '.repeat(4097),headers:{'content-length':'1'}})),{code:'too_large'});
 await assert.rejects(readJSON(new Request('http://localhost/',{method:'POST',body:new Uint8Array([255])})),{code:'invalid_json'});
 const analyze=createAnalysisService({...config,mode:'demo'});await assert.rejects(analyze({...request,url:'https://evil.invalid/'},new Request('http://localhost/')),{code:'invalid_request'});
});
test('real loopback HTTP -> production handler/service -> NASA mocked failures and demo',async()=>{
 let handler=createAnalysisHandler(createAnalysisService({...config,mode:'demo'}));
 const server=createServer(async(req,res)=>{
  const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));
  const response=await handler(new Request('http://127.0.0.1'+req.url,{method:req.method,headers:req.headers as Record<string,string>,...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})}));
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+(server.address() as {port:number}).port+'/api/analysis';
 const post=()=>fetch(base,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(request)});
 try {
  assert.equal((await post()).status,200);
  handler=createAnalysisHandler(createAnalysisService(config,new NasaSource(config,new NasaHTTP(config,new TokenProvider(()=>undefined)))));
  let response=await post();assert.equal(response.status,503);assert.equal((await response.json()).error.code,'nasa_auth_required');
  for(const [code,status] of [['nasa_auth_required',503],['nasa_forbidden',503],['nasa_rate_limited',503],['nasa_timeout',504],['nasa_invalid_format',502],['nasa_incomplete_series',502]] as const){
   const source={load:async()=>{throw new ScienceError(code,'Controlled NASA failure',status);}} as unknown as NasaSource;
   handler=createAnalysisHandler(createAnalysisService(config,source));response=await post();assert.equal(response.status,status);assert.equal((await response.json()).error.code,code);
  }
 }finally{server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
});
