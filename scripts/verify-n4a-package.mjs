import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
const root=process.cwd(),pack=path.resolve(process.argv[2]);
assert(pack.startsWith('D:\\2026-10-27\\2026-11-14\\files-pasted-by-the-user-earth\\work\\N4-runtime-'));
await fs.mkdir(pack,{recursive:false});
const require=createRequire(path.join(root,'package.json')),{nodeFileTrace}=require('next/dist/compiled/@vercel/nft');
const report={date:'2026-11-14',cloud_deploy_tested:false,kind:'Local Windows traced-package smoke, not a Vercel artifact',checks:[]};
async function walk(dir){let out=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())out.push(...await walk(f));else out.push(f);}return out;}
const files=new Set(),traces=(await walk(path.join(root,'.next'))).filter(p=>p.endsWith('.nft.json')&&!p.includes(path.sep+'cache'+path.sep));
for(const trace of traces)for(const f of JSON.parse(await fs.readFile(trace,'utf8')).files)files.add(path.resolve(path.dirname(trace),f));
const entry='node_modules/next/dist/server/lib/start-server.js';
const bootTrace=await nodeFileTrace([entry],{base:root,processCwd:root});for(const f of bootTrace.fileList)files.add(path.resolve(root,f));
const required=JSON.parse(await fs.readFile('.next/required-server-files.json','utf8'));
for(const f of required.files)files.add(path.resolve(root,f));
for(const folder of ['.next/server','.next/static','public'])for(const f of await walk(path.join(root,folder)))files.add(f);
files.add(path.join(root,'package.json'));
let bytes=0;for(const f of files){const rel=path.relative(root,f);assert(!rel.startsWith('..')&&!path.isAbsolute(rel),'outside root');assert(!/^(reference|tests|docs|\.cache)([\\/]|$)/.test(rel)&&!path.basename(rel).startsWith('.env'),rel);assert(!rel.startsWith('src')||rel.replaceAll('\\','/')==='src/backend/nasa/demo-data.json',rel);const to=path.join(pack,rel);await fs.mkdir(path.dirname(to),{recursive:true});await fs.copyFile(f,to);bytes+=(await fs.stat(to)).size;}
report.runtime_files=files.size;report.runtime_bytes=bytes;report.trace_count=traces.length;report.boot_trace_warnings=bootTrace.warnings.size;
const apiTrace=path.join(root,'.next/server/app/api/analysis/route.js.nft.json'),apiFiles=JSON.parse(await fs.readFile(apiTrace,'utf8')).files.map(f=>path.resolve(path.dirname(apiTrace),f));
report.analysis_trace={files:apiFiles.length,bytes:(await Promise.all(apiFiles.map(async f=>(await fs.stat(f)).size))).reduce((a,b)=>a+b,0),hdf5_assets:apiFiles.filter(f=>f.includes('h5wasm')).map(f=>path.relative(root,f))};
const buildFiles=(await walk(path.join(root,'.next'))).filter(f=>!f.includes(path.sep+'cache'+path.sep));report.build_without_cache_bytes=(await Promise.all(buildFiles.map(async f=>(await fs.stat(f)).size))).reduce((a,b)=>a+b,0);
const config={...required.config,outputFileTracingRoot:pack,turbopack:{root:pack}};delete config.env;
await fs.writeFile(path.join(pack,'bootstrap.cjs'),`process.env.__NEXT_PRIVATE_STANDALONE_CONFIG=${JSON.stringify(JSON.stringify(config))};\nconst Module=require('module'),path=require('path'),original=Module._resolveFilename;\nModule._resolveFilename=function(...args){const f=original.apply(this,args);if(path.isAbsolute(f)&&!f.startsWith(__dirname+path.sep))throw new Error('Module outside isolated package');return f;};\nrequire('./node_modules/next/dist/server/lib/start-server.js').startServer({dir:__dirname,isDev:false,hostname:'127.0.0.1',port:3012,allowRetry:false});\n`);
const wait=ms=>new Promise(r=>setTimeout(r,ms)),base='http://127.0.0.1:3012';
let child;
async function serve(mode,work){let logs='';child=spawn(process.execPath,['bootstrap.cjs'],{cwd:pack,env:{...process.env,EARTH_MODE:mode,EARTHDATA_TOKEN:'',EARTH_CACHE:'file',VERCEL:'1',NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe'],windowsHide:true});child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);try{let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/api/health',{signal:AbortSignal.timeout(500)})).ok){ready=true;break;}}catch{}if(child.exitCode!==null)throw new Error('Package startup failed: '+logs);await wait(200);}assert(ready,'Package timeout '+logs);await work();}finally{child.kill();await new Promise(r=>{child.once('close',r);setTimeout(r,2000);});await fs.writeFile(path.join(root,'docs/N4A_PACKAGE_'+mode+'.log'),logs);}}
try{
 await serve('demo',async()=>{
  const health=await(await fetch(base+'/api/health')).json();assert.equal(health.mode,'demo');report.health=health;
  const geo=await fetch(base+'/api/places?q=x');assert.equal(geo.status,400);report.checks.push({name:'packaged geography route validates input without upstream',passed:true});const html=await(await fetch(base)).text();assert(html.includes('Earth Detective'));
  const catalog=await(await fetch(base+'/api/variables')).json();assert.equal(catalog.available_cells.length,2);
  const request={latitude:52.52,longitude:13.405,variable:'T2M',start_year:1991,end_year:2025};
  const post=q=>fetch(base+'/api/analysis',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(q)});
  const r=await post(request),d=await r.json();assert.equal(r.status,200);assert.equal(d.provenance.mode,'offline_verified_demo');assert.equal(d.provenance.network_used,false);assert.equal(d.monthly_series.length,420);assert(Math.abs(d.trend.slope_per_decade-.59097349)<1e-8);
  assert.equal((await post({...request,latitude:35.68,longitude:139.69})).status,404);
  const workers=await walk(path.join(pack,'public/vendor'));const worker=workers.find(f=>f.endsWith('worker.mjs'));assert(worker);assert.equal((await fetch(base+'/'+path.relative(path.join(pack,'public'),worker).replaceAll('\\','/'))).status,200);
  report.checks.push({name:'self-contained public demo, API and worker asset',passed:true});
 });
 await serve('local',async()=>{const h=await(await fetch(base+'/api/health')).json();assert.equal(h.mode,'blocked');assert.equal(h.dynamic_nasa_enabled,false);report.checks.push({name:'Vercel forces private local mode blocked',passed:true});});
 await assert.rejects(fs.access(path.join(pack,'.env')));await assert.rejects(fs.access(path.join(pack,'reference')));await assert.rejects(fs.access(path.join(pack,'.cache')));report.checks.push({name:'no env/reference/permanent cache copied or generated',passed:true});
}catch(e){report.error=e.message;process.exitCode=1;}
await fs.writeFile(path.join(root,'docs/N4A_PACKAGE.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));




