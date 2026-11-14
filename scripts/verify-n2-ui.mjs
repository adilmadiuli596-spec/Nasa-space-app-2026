import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const browser=await chromium.launch({channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const report={date:'2026-11-14',page_errors:[],tiles:0,desktop:false,mobile:false,pending_analysis:false};
try {
 const page=await browser.newPage({viewport:{width:1440,height:900},locale:'ru-RU'});
 page.on('pageerror',e=>report.page_errors.push(e.message));
 page.on('response',r=>{if(r.ok()&&r.url().includes('tiles.openfreemap.org')&&/\.pbf|\.mvt/.test(r.url()))report.tiles++;});
 const base='http://127.0.0.1:3010';
 assert.equal((await page.request.get(base+'/vendor/maplibre-6.18.0/maplibre-gl-worker.mjs')).status(),200);
 for(const [route,status] of [['health',200],['variables',200]]) assert.equal((await page.request.get(base+'/api/'+route)).status(),status);
 assert.equal((await page.request.post(base+'/api/analysis',{data:{latitude:91,longitude:0,variable:'T2M'}})).status(),422);
 assert.equal((await page.request.post(base+'/api/analysis',{data:Buffer.from('{'),headers:{'content-type':'application/json'}})).status(),400);
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Анализ',exact:true}).waitFor();
 await page.locator('.maplibregl-canvas').waitFor();

 if(!report.tiles) await page.waitForResponse(r=>r.ok()&&r.url().includes('tiles.openfreemap.org')&&/\.pbf|\.mvt/.test(r.url()),{timeout:20000}).catch(()=>null);
 assert.equal(await page.locator('.header').count(),1);assert.equal(await page.locator('aside').count(),1);
 assert.equal(await page.locator('.maplibregl-ctrl-zoom-in').count(),1);
 assert((await page.locator('.map').boundingBox()).height>800);
 assert((await page.locator('.maplibregl-ctrl-top-left').boundingBox()).y>=87);
 const header=await page.locator('.header').boundingBox(),panel=await page.locator('aside').boundingBox();
 assert(header.x>0&&header.x+header.width<=1441); assert(panel.x>720);report.desktop=true;
 await page.screenshot({path:'docs/N2-1440.png'});
 await page.getByRole('button',{name:'Анализ',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Научный backend ещё не перенесён'}).waitFor();report.pending_analysis=true;
 await page.setViewportSize({width:390,height:844});await page.reload({waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Открыть панель анализа'}).waitFor();assert.equal(await page.locator('aside').count(),0);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'docs/N2-390.png'});
 await page.getByRole('button',{name:'Открыть панель анализа'}).click();assert.equal(await page.locator('aside').count(),1);
 await page.getByRole('button',{name:'Закрыть панель'}).click();assert.equal(await page.locator('aside').count(),0);report.mobile=true;
 assert.deepEqual(report.page_errors,[]);
 report.tile_delivery=report.tiles>0?'observed':'not_observed';
 report.full_map_rendering='not_verified_external_requests_intermittent';
 await writeFile('docs/N2_UI.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
} finally {await browser.close();}
