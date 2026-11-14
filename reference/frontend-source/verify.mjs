import assert from 'node:assert/strict'
import { chromium } from 'playwright'
const browser = await chromium.launch({channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']})
try {
 const page = await browser.newPage({viewport:{width:1440,height:900},locale:'ru-RU'})
 const errors=[]
 page.on('pageerror', e=>{errors.push(e.message);console.error(e.message)})
 page.on('requestfailed', r=>console.error(r.url().split('?')[0],r.failure()?.errorText))
 let tiles=0
 page.on('response', r=>{if(r.ok() && r.url().includes('tiles.openfreemap.org') && /\.pbf|\.mvt/.test(r.url()))tiles++})
 await page.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded'})
 const analyze=page.getByRole('button',{name:'Анализ',exact:true})
 await page.locator('aside.compact').waitFor()
 assert((await page.locator('aside').boundingBox()).height<350)
 await page.setViewportSize({width:390,height:844})
 await page.reload({waitUntil:'domcontentloaded'})
 await page.getByRole('button',{name:'Открыть панель анализа'}).waitFor()
 assert.equal(await page.locator('aside').count(),0)
 for(const [city,lon] of [['Павлодар',76.875],['Берлин',13.125]]){
  await page.getByRole('button',{name:city,exact:true}).click()
  for(const variable of ['T2M','QV2M']){
   await page.getByLabel('Показатель').selectOption(variable)
   const pending=page.waitForResponse(r=>r.url().endsWith('/api/analysis'),{timeout:120000})
   await analyze.click()
   const response=await pending
   const data=await response.json()
   assert.equal(response.status(),200,JSON.stringify(data.error))
   assert.equal(data.requested.variable,variable)
   assert.equal(data.actual_cell.longitude,lon)
   assert.equal(data.annual_series.length,35)
   assert.equal(data.trend.fitted_values.length,35)
   assert.equal(data.provenance.cache_hits,420)
   await page.locator('.recharts-line-curve').first().waitFor()
   assert.equal(await page.locator('.recharts-line-curve').count(),2)
   if((city==='Павлодар' && variable==='T2M') || (city==='Берлин' && variable==='QV2M')){
    const slug=city==='Берлин'?'berlin':'pavlodar'
    for(const [width,height] of [[390,844],[1440,900]]){
     await page.setViewportSize({width,height})
     await page.waitForFunction(()=> {
      const panel=document.querySelector('.inside').getBoundingClientRect()
      const chart=document.querySelector('.chart').getBoundingClientRect()
      const stats=document.querySelector('dl').getBoundingClientRect()
      return chart.top>=panel.top && stats.bottom<=panel.bottom &&
       document.documentElement.scrollWidth<=innerWidth && document.documentElement.scrollHeight<=innerHeight
     })
     await page.waitForLoadState('networkidle')
     await page.screenshot({path:'../docs/4A1-'+slug+'-'+width+'.png'})
    }
   }
   console.log(city,variable,JSON.stringify(data.trend.slope_per_decade),data.provenance.cache_hits)
  }
 }
 await page.getByRole('button',{name:'Закрыть панель'}).click()
 await page.getByRole('button',{name:'Открыть панель анализа'}).click()
 await page.locator('.slope').waitFor()
 for (const [w,h] of [[1440,900],[768,1024],[390,844]]){
  await page.setViewportSize({width:w,height:h})
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth && document.documentElement.scrollHeight<=innerHeight))
 }
 await page.setViewportSize({width:1440,height:900})
 await page.locator('.maplibregl-canvas').click({position:{x:500,y:330}})
 assert.notEqual(await page.getByLabel('Широта',{exact:true}).inputValue(),'52.52')
 await page.getByLabel('Широта',{exact:true}).fill('45')
 await page.getByLabel('Долгота',{exact:true}).fill('60')
 await page.route('**/api/analysis',r=>r.fulfill({status:503,json:{error:{message:'NASA authorization required'}}}))
 await analyze.click()
 await page.getByText('NASA authorization required').waitFor()
 await page.unroute('**/api/analysis')
 let release
 const hold=new Promise(resolve=>release=resolve)
 await page.route('**/api/analysis',async route=>{await hold;await route.abort().catch(()=>{})})
 await analyze.click()
 await page.getByRole('button',{name:'Отменить ожидание'}).click()
 await page.getByText(/Ожидание отменено/).waitFor()
 release()
 assert.equal(await page.locator('.slope').count(),0)
 assert.deepEqual(errors,[])
 console.log('Layout, chart, selection, cancellation and error checks passed. Tile responses:',tiles)
 assert(tiles>0,'No successful vector tile observed')
} finally {await browser.close()}
