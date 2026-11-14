import {spawn} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3011'],{env:{...process.env,EARTH_MODE:'demo',EARTHDATA_TOKEN:'',NEXT_TELEMETRY_DISABLED:'1'},stdio:'ignore',windowsHide:true});
let browser;const report={date:'2026-11-14',mode:'offline_verified_demo',page_errors:[],desktop:false,mobile:false,chart:false,explicit_demo_warning:false};
try{
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:3011/api/health',{signal:AbortSignal.timeout(500)})).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}assert(ready);
 browser=await chromium.launch({channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:900},locale:'ru-RU'});page.on('pageerror',e=>report.page_errors.push(e.message));
 await page.goto('http://127.0.0.1:3011/',{waitUntil:'domcontentloaded'});const button=page.getByRole('button',{name:'Анализ',exact:true});await button.waitFor();await page.locator('.maplibregl-canvas').waitFor();
 await button.click();await page.locator('.slope').waitFor();await page.getByText('offline_verified_demo',{exact:false}).waitFor();
 assert(await page.locator('.chart svg').count()>0);report.chart=true;assert(await page.getByText('Explicit demonstration:',{exact:false}).count()>0);report.explicit_demo_warning=true;
 const panel=await page.locator('aside').boundingBox();assert(panel.x>720);report.desktop=true;await page.screenshot({path:'docs/N3-1440.png'});
 await page.setViewportSize({width:390,height:844});await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Открыть панель анализа'}).waitFor();assert.equal(await page.locator('aside').count(),0);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.getByRole('button',{name:'Анализ',exact:true}).click();await page.locator('.slope').waitFor();await page.screenshot({path:'docs/N3-390.png'});await page.getByRole('button',{name:'Закрыть панель'}).click();assert.equal(await page.locator('aside').count(),0);report.mobile=true;assert.deepEqual(report.page_errors,[]);
 await writeFile('docs/N3_UI.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser?.close();child.kill();await new Promise(resolve=>{child.once('close',resolve);setTimeout(resolve,2000);});}
