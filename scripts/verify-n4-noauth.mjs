import {spawn} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const wait=ms=>new Promise(r=>setTimeout(r,ms)),report={checks:[],credentials_used:false};
const browser=await chromium.launch({channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{for(const mode of ['local','blocked']){
 const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3011'],{env:{...process.env,EARTH_MODE:mode,EARTHDATA_TOKEN:'',EARTH_CACHE:'memory',NEXT_TELEMETRY_DISABLED:'1'},stdio:'ignore',windowsHide:true});
 try{let ready=false;for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:3011/api/health',{signal:AbortSignal.timeout(500)})).ok){ready=true;break;}}catch{}await wait(200);}assert(ready);const p=await browser.newPage({viewport:{width:390,height:844}});await p.goto('http://127.0.0.1:3011',{waitUntil:'domcontentloaded'});await p.locator('.mode-line').getByText(mode==='local'?'NASA · требуется авторизация сервера':'Публичный доступ NASA пока отключён',{exact:true}).waitFor();assert(await p.getByRole('button',{name:'Анализ',exact:true}).isDisabled());assert.equal(await p.locator('aside').count(),0);await p.getByRole('button',{name:'Открыть панель анализа'}).click();await p.locator('aside [role=alert]').waitFor();assert(!(await p.locator('body').textContent()).includes('EARTHDATA_TOKEN'));await p.getByLabel('Широта',{exact:true}).fill('35.68');assert.equal(await p.getByLabel('Широта',{exact:true}).inputValue(),'35.68');await p.screenshot({path:'docs/N4-noauth-'+mode+'.png'});await p.close();report.checks.push({mode,name:'safe disabled analysis, explicit explanation, phone collapsed and editable coordinates',passed:true});}
 finally{child.kill();await new Promise(r=>{child.once('close',r);setTimeout(r,2000);});}
}}catch(e){report.error=e.message;process.exitCode=1;}finally{await browser.close();await writeFile('docs/N4_NOAUTH.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
