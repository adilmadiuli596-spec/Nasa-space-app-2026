import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base='http://127.0.0.1:3014',report={checks:[],errors:[],analysis_requests_to_backend:0};let browser;
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3014'],{env:{...process.env,EARTH_MODE:'demo',EARTHDATA_TOKEN:'',NEXT_TELEMETRY_DISABLED:'1'},stdio:'ignore',windowsHide:true});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function check(name,fn){await fn();report.checks.push(name);console.log('PASS '+name);}
try{
 for(let i=0;i<100;i++){try{if((await fetch(base+'/api/health')).ok)break;}catch{}await wait(200);}
 browser=await chromium.launch({channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:900},locale:'ru-RU'});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 // Existing verified demo data; no fresh NASA download.
 
 page.on('request',r=>{if(r.url()===base+'/api/analysis')report.analysis_requests_to_backend++;});
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!document.querySelector('.primary')?.disabled);
 await page.locator('[data-map-ready=true]').waitFor({timeout:45000});
 await page.getByRole('button',{name:'Выбрать место или координаты',exact:true}).click();
 await page.getByRole('region',{name:'Выбор местоположения'}).getByRole('button',{name:'Берлин',exact:true}).click();
 await page.getByRole('button',{name:'Анализ',exact:true}).click();await page.getByTestId('slope').waitFor();
 const credits=page.locator('.maplibregl-ctrl-attrib'),trigger=page.getByLabel('Источники карты',{exact:true});
 async function fit(){await wait(250);const d=await page.evaluate(()=>({w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight}));assert.equal(d.w,d.sw);assert.equal(d.h,d.sh);for(const sel of ['header','aside','.maplibregl-ctrl-attrib']){if(!await page.locator(sel).count())continue;const b=await page.locator(sel).boundingBox();assert(b&&b.x>=0&&b.y>=0&&b.x+b.width<=d.w+1&&b.y+b.height<=d.h+1,sel+JSON.stringify(b));}}
 async function attribution(){assert(!(await credits.getAttribute('class')).includes('compact-show'));await trigger.focus();await page.keyboard.press('Enter');await wait(100);assert((await credits.getAttribute('class')).includes('compact-show'));for(const text of ['OpenStreetMap','OpenMapTiles','OpenFreeMap','MapLibre'])assert((await credits.innerText()).includes(text));const links=credits.locator('a');for(let i=0;i<await links.count();i++)assert(await links.nth(i).getAttribute('href'));await fit();await page.keyboard.press('Escape');assert(!(await credits.getAttribute('class')).includes('compact-show'));}
 await check('desktop: compact centered header, unified radii, no outer scroll',async()=>{await fit();const b=await page.locator('header').boundingBox();assert.equal(b.width,1180);assert.equal(Math.round(b.x),130);assert.equal(await page.locator('.primary').evaluate(e=>getComputedStyle(e).borderRadius),'16px');report.desktop_header=b;});
 await check('desktop: native info trigger, keyboard, readable credit links, Escape',attribution);
 await wait(500);await page.locator('[data-map-ready=true]').waitFor({timeout:45000});await page.screenshot({path:'docs/N4A1B-desktop.png'});
 await page.setViewportSize({width:390,height:844});await wait(450);
 await check('mobile: header, tabs, dropdown and layout stay inside viewport',async()=>{await fit();for(const tab of ['Обзор','Графики','Методика']){await page.getByRole('tab',{name:tab,exact:true}).click();await fit();}await page.locator('.period-select summary').click();const b=await page.getByRole('listbox').boundingBox();assert(b.x>=0&&b.x+b.width<=390);await page.keyboard.press('Escape');await page.getByRole('tab',{name:'Графики',exact:true}).click();});
 await check('mobile: attribution opens above panel and preserves all source links',attribution);
 await trigger.click();await fit();await page.screenshot({path:'docs/N4A1B-mobile.png'});await page.keyboard.press('Escape');
 await check('mobile: collapsed panel keeps attribution available',async()=>{await page.getByRole('button',{name:'Закрыть панель',exact:true}).click();await fit();await trigger.click();await fit();assert((await credits.innerText()).includes('OpenStreetMap'));await page.keyboard.press('Escape');});
 await check('no browser errors',()=>assert.deepEqual(report.errors,[]));
}catch(e){report.failure=e.message;process.exitCode=1;console.error(e.message);}finally{await browser?.close();child.kill();await new Promise(r=>{child.once('close',r);setTimeout(r,1000);});await fs.writeFile('docs/N4A1B_BROWSER.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.checks.length,failure:report.failure}));}


