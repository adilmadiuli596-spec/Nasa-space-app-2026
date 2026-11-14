import {spawn,execFileSync} from 'node:child_process';
import {readFile,writeFile,stat} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const cases=JSON.parse(await readFile('tests/fixtures/n2/real-cases.json','utf8'));
const report={date:'2026-11-14',deployment_tested:false,nasa_network_used:false,modes:[],responses:[],comparisons:[],demo_timings:[],memory:[]};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function memory(pid){try{return JSON.parse(execFileSync('powershell.exe',['-NoProfile','-Command',`Get-Process -Id ${Number(pid)} | Select-Object Id,WorkingSet64,PeakWorkingSet64 | ConvertTo-Json -Compress`],{encoding:'utf8',timeout:5000,windowsHide:true}));}catch{return {status:'not_measured'};}}
function compare(a,b,where=''){
 if(typeof b==='number')assert(typeof a==='number'&&Math.abs(a-b)<=1e-12+1e-10*Math.abs(b),where);
 else if(Array.isArray(b)){assert(Array.isArray(a));assert.equal(a.length,b.length);b.forEach((v,i)=>compare(a[i],v,where+'['+i+']'));}
 else if(b&&typeof b==='object')for(const [k,v] of Object.entries(b))compare(a[k],v,where+'.'+k);
 else assert.equal(a,b,where);
}
async function withServer(mode,work){
 const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3011'],{env:{...process.env,EARTH_MODE:mode,EARTHDATA_TOKEN:'',EARTH_CACHE:'memory',NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe'],windowsHide:true});
 let logs='';child.stdout.on('data',b=>logs+=b.toString());child.stderr.on('data',b=>logs+=b.toString());
 try{let ready=false;for(let i=0;i<150;i++){try{if((await fetch('http://127.0.0.1:3011/api/health',{signal:AbortSignal.timeout(1000)})).ok){ready=true;break;}}catch{}if(child.exitCode!==null)throw new Error('Next server exited');await wait(200);}assert(ready,'Next startup timeout');report.memory.push({mode,phase:'before',...memory(child.pid)});await work('http://127.0.0.1:3011');report.memory.push({mode,phase:'after',...memory(child.pid)});}
 finally{child.kill();await new Promise(resolve=>{child.once('close',resolve);setTimeout(resolve,2000);});await writeFile('docs/N4_HTTP_'+mode+'.log',logs);}
}
async function post(base,body){const started=performance.now(),r=await fetch(base+'/api/analysis',{method:'POST',headers:{'content-type':'application/json'},body:typeof body==='string'?body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});const text=await r.text();return {status:r.status,bytes:Buffer.byteLength(text),duration_ms:performance.now()-started,data:JSON.parse(text)};}
await withServer('demo',async base=>{
 const health=await (await fetch(base+'/api/health')).json(),variables=await (await fetch(base+'/api/variables')).json();assert.equal(health.mode,'demo');assert.equal(variables.source_mode,'offline_verified_demo');assert.equal(variables.available_cells.length,2);report.modes.push({mode:'demo',health,variables});
 for(const c of cases){const r=await post(base,c.request);assert.equal(r.status,200);for(const field of ['monthly_series','annual_series','trend','quality','actual_cell','source_unit','unit','trend_unit'])compare(r.data[field],c.expected[field],c.id+'.'+field);for(const field of ['provider','dataset','version','doi'])assert.equal(r.data.provenance[field],c.expected.provenance[field]);assert.equal(r.data.provenance.mode,'offline_verified_demo');assert.equal(r.data.provenance.network_used,false);assert(r.data.warnings.some(w=>w.startsWith('Explicit demonstration')));report.responses.push({id:c.id,status:r.status,response_bytes:r.bytes});report.comparisons.push({id:c.id,status:'passed',p:r.data.trend.p_value_two_sided,slope:r.data.trend.slope_per_decade,ci:r.data.trend.ci95_per_decade,metadata:'NASA product/cell/units checked; runtime provenance honestly labels offline demo'});report.demo_timings.push({id:c.id,phase:'first',duration_ms:r.duration_ms});const warm=await post(base,c.request);assert.equal(warm.status,200);report.demo_timings.push({id:c.id,phase:'repeat_no_NASA_cache_claim',duration_ms:warm.duration_ms});}
 for(const [id,body,status] of [['bad_json','{',400],['coordinates',{...cases[0].request,latitude:91},422],['unexpected_url',{...cases[0].request,url:'https://evil.invalid'},422],['other_cell',{...cases[0].request,latitude:35.68,longitude:139.69},404],['oversize',' '.repeat(4097),413]]){const r=await post(base,body);assert.equal(r.status,status);report.responses.push({id,status:r.status,error:r.data.error.code});}
 const parallel=await Promise.all([post(base,cases[0].request),post(base,cases[1].request)]);assert(parallel.every(r=>r.status===200));report.responses.push({id:'parallel_demo',statuses:parallel.map(r=>r.status)});
});
await withServer('blocked',async base=>{const r=await post(base,cases[0].request);assert.equal(r.status,503);assert.equal(r.data.error.code,'public_access_unconfirmed');report.responses.push({id:'public_dynamic_blocked',status:r.status,error:r.data.error.code});});
await withServer('local',async base=>{const r=await post(base,cases[0].request);assert.equal(r.status,503);assert.equal(r.data.error.code,'nasa_auth_required');report.responses.push({id:'local_missing_token',status:r.status,error:r.data.error.code});const cross=await fetch(base+'/api/analysis',{method:'POST',headers:{'content-type':'application/json',origin:'https://evil.invalid'},body:JSON.stringify(cases[0].request)});assert.equal(cross.status,403);report.responses.push({id:'cross_origin',status:cross.status});});
const trace='.next/server/app/api/analysis/route.js.nft.json',nft=JSON.parse(await readFile(trace,'utf8'));const files=nft.files.map(f=>path.resolve(path.dirname(trace),f));
report.local_trace={files:files.length,bytes:(await Promise.all(files.map(async f=>(await stat(f)).size))).reduce((a,b)=>a+b,0),hdf5_assets:files.filter(f=>f.includes('h5wasm')).map(f=>path.relative(process.cwd(),f)),unexpected_sources:files.filter(f=>/[\\/](reference|tests|\.cache)[\\/]/.test(f)||/^\.env/.test(path.basename(f)))};
assert.equal(report.local_trace.unexpected_sources.length,0);assert(report.local_trace.hdf5_assets.length>=2);
await writeFile('docs/N4_HTTP.json',JSON.stringify(report,null,2));console.log(JSON.stringify({status:'passed',responses:report.responses,trace:report.local_trace,memory:report.memory},null,2));

