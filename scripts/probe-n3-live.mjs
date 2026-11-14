import {readFile,writeFile} from 'node:fs/promises';
const base='http://127.0.0.1:3010';
const cases=JSON.parse(await readFile('tests/fixtures/n2/real-cases.json','utf8'));
let report={date:'2026-11-14',mode:'local_authorized',fresh_NASA_verified:false,requests:[],comparisons:[],third_cell:'not_checked'};
function compare(a,b,path,errors){if(typeof b==='number'){const error=Math.abs(a-b);if(typeof a!=='number'||!Number.isFinite(a)||error>1e-12+1e-10*Math.abs(b))errors.push({path,absolute_error:error});}else if(Array.isArray(b)){if(!Array.isArray(a)||a.length!==b.length){errors.push({path,problem:'length'});return;}b.forEach((v,i)=>compare(a[i],v,path+'['+i+']',errors));}else if(b&&typeof b==='object'){for(const[k,v]of Object.entries(b))compare(a[k],v,path+'.'+k,errors);}else if(a!==b)errors.push({path,problem:'value'});}
async function save(){await writeFile('docs/N3_LIVE.json',JSON.stringify(report,null,2));}
try{
 const health=await(await fetch(base+'/api/health',{signal:AbortSignal.timeout(3000)})).json();report.health=health;if(health.mode!=='local')throw new Error('Expected explicit local mode');
 for(const c of cases){
  const started=performance.now();console.log('Starting authorized NASA analysis '+c.id);
  const r=await fetch(base+'/api/analysis',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(c.request),signal:AbortSignal.timeout(290000)});const text=await r.text(),data=JSON.parse(text);
  const row={id:c.id,status:r.status,duration_ms:performance.now()-started,response_bytes:Buffer.byteLength(text)};
  if(!r.ok){row.error=data.error?.code||'unknown';report.requests.push(row);await save();console.log(JSON.stringify(row));break;}
  row.cache_hits=data.provenance.cache_hits;row.cache_misses=data.provenance.cache_misses;row.network_used=data.provenance.network_used;row.timings_ms=data.timings_ms;report.requests.push(row);
  const errors=[];for(const field of ['monthly_series','annual_series','trend','quality','actual_cell','source_unit','unit','trend_unit','warnings'])compare(data[field],c.expected[field],field,errors);
  for(const field of ['provider','dataset','version','doi'])compare(data.provenance[field],c.expected.provenance[field],'provenance.'+field,errors);
  compare(data.provenance.granules.map(g=>({month:g.month,granule_id:g.granule_id,filename:g.filename,url:g.url})),c.expected.provenance.granules.map(g=>({month:g.month,granule_id:g.granule_id,filename:g.filename,url:g.url})),'granules',errors);
  report.comparisons.push({id:c.id,passed:!errors.length,errors,slope:data.trend.slope_per_decade,p:data.trend.p_value_two_sided,ci:data.trend.ci95_per_decade,provenance_note:'Current transport/cache/hashes/timings are measured anew, not substituted from the historical oracle'});
  await writeFile('docs/N3_LIVE_'+c.id+'.json',JSON.stringify(data,null,2));await save();console.log(JSON.stringify(row));
 }
 if(report.requests.length===4&&report.requests.every(r=>r.status===200)){
  const startedRepeat=performance.now();const repeat=await fetch(base+'/api/analysis',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(cases[0].request),signal:AbortSignal.timeout(290000)});const repeatData=await repeat.json();report.repeat={status:repeat.status,duration_ms:performance.now()-startedRepeat,...(repeat.ok?{cache_hits:repeatData.provenance.cache_hits,cache_misses:repeatData.provenance.cache_misses,network_used:repeatData.provenance.network_used}:{error:repeatData.error?.code})};await save();
  const startedParallel=performance.now();const parallel=await Promise.all(cases.slice(0,2).map(async c=>{const r=await fetch(base+'/api/analysis',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(c.request),signal:AbortSignal.timeout(290000)});const d=await r.json();return {id:c.id,status:r.status,...(r.ok?{cache_hits:d.provenance.cache_hits,network_used:d.provenance.network_used}:{error:d.error?.code})};}));report.parallel={duration_ms:performance.now()-startedParallel,results:parallel};await save();
  const third={latitude:35.68,longitude:139.69,variable:'T2M',start_year:1991,end_year:2025},started=performance.now();console.log('Starting distinct Tokyo grid cell');
  const r=await fetch(base+'/api/analysis',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(third),signal:AbortSignal.timeout(290000)}),data=await r.json();
  report.third_cell={requested:third,status:r.status,duration_ms:performance.now()-started,...(r.ok?{actual_cell:data.actual_cell,monthly_count:data.monthly_series.length,slope:data.trend.slope_per_decade,cache_hits:data.provenance.cache_hits,cache_misses:data.provenance.cache_misses}:{error:data.error?.code})};
  if(r.ok)await writeFile('docs/N3_LIVE_TOKYO_T2M.json',JSON.stringify(data,null,2));
 }
 report.fresh_NASA_verified=report.comparisons.length===4&&report.comparisons.every(c=>c.passed);
}catch(error){report.run_error=error?.name||'unknown';}
await save();console.log(JSON.stringify(report,null,2));
