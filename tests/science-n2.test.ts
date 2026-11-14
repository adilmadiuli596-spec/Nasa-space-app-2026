import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {scientificResult} from '../src/backend/science/result';
import {readMonthlyRecords} from '../src/backend/science/series';
import {annualMeans} from '../src/backend/science/aggregation';
import {convertUnits} from '../src/backend/science/units';
import {daysInMonth} from '../src/backend/science/calendar';
import {nearestCell} from '../src/backend/science/coordinates';
import {fitOLS} from '../src/backend/science/ols';
import {hacCovariance} from '../src/backend/science/hac';
import {hacTrend} from '../src/backend/science/inference';
import {interpretTrend} from '../src/backend/science/interpretation';
import {twoSidedT,tCritical95} from '../src/backend/science/student';
import {ScienceError} from '../src/backend/science/errors';
import type {AnalysisRequest} from '../src/shared/schemas/analysis';
import type {LoadedSeries} from '../src/shared/schemas/science';
import type {Result} from '../src/shared/types/api';
type Case={id:string;request:AnalysisRequest;loaded:LoadedSeries;expected:Result;historical:Partial<Result>};
const fixture=<T,>(name:string):T=>JSON.parse(readFileSync('tests/fixtures/n2/'+name+'.json','utf8'));
const cases=fixture<Case[]>('real-cases');
function close(a:number,b:number,where='') {assert(Number.isFinite(a)&&Math.abs(a-b)<=1e-12+1e-10*Math.abs(b),`${where}: ${a} != ${b}`);}
function compare(actual:unknown,expected:unknown,path='result'):void {
 if(typeof expected==='number') {assert.equal(typeof actual,'number',path);close(actual as number,expected,path);}
 else if(Array.isArray(expected)) {assert(Array.isArray(actual),path);assert.equal(actual.length,expected.length,path);expected.forEach((v,i)=>compare(actual[i],v,`${path}[${i}]`));}
 else if(expected!==null&&typeof expected==='object') {for(const [k,v] of Object.entries(expected)) compare((actual as Record<string,unknown>)[k],v,path+'.'+k);}
 else assert.equal(actual,expected,path);
}
function subset(c:Case,start:number,end:number) {
 const loaded=structuredClone(c.loaded);loaded.records=loaded.records.filter(r=>+r.month.slice(0,4)>=start&&+r.month.slice(0,4)<=end);
 loaded.provenance.granules=loaded.provenance.granules.filter(r=>+r.month.slice(0,4)>=start&&+r.month.slice(0,4)<=end);
 return {request:{...c.request,start_year:start,end_year:end},loaded};
}
for(const c of cases) test('full 420-month pipeline / original JSON / fresh Python '+c.id,()=>{
 const before=JSON.stringify(c),result=scientificResult(c.request,c.loaded);
 for(const key of ['requested','actual_cell','source_unit','unit','trend_unit','monthly_series','annual_series','trend','quality','provenance','warnings'] as const) {
  compare(result[key],c.expected[key],key);compare(result[key],c.historical[key],key+'.historical');
 }
 for(const [key,value] of Object.entries(c.expected.method)) if(!key.endsWith('_version')) compare(result.method[key],value,'method.'+key);
 assert.equal(JSON.stringify(c),before,'must not mutate data or provenance');
 assert(result.method.implementation);assert(!('numpy_version' in result.method));assert(result.timings_ms.statistical_calculation>=0);
 assert.equal(interpretTrend(result.trend).conclusion,c.id==='PAVLODAR_T2M'?'not_significant':'significant');
 assert.equal(result.monthly_series.length,420);assert.equal(result.annual_series.length,35);
});
const periods=fixture<{case:string;start:number;end:number;trend:Result['trend']}[]>('all-periods');
for(const c of cases) test('every supported contiguous 5..35-year interval '+c.id,()=>{
 const checks=periods.filter(p=>p.case===c.id);assert.equal(checks.length,496);
 for(const p of checks) {const input=subset(c,p.start,p.end);compare(scientificResult(input.request,input.loaded).trend,p.trend,c.id+':'+p.start+'-'+p.end);}
});
const numerical=fixture<{years:number[];values:number[];lag:number;params:number[];covariance:number[][];trend:Result['trend']}[]>('numerical');
numerical.forEach((f,i)=>test('independent statsmodels OLS / covariance / sensitivity '+i,()=>{
 const fit=fitOLS(f.years,f.values);compare([fit.intercept,fit.slope],f.params,'OLS');compare(hacCovariance(fit,f.lag),f.covariance,'covariance');compare(hacTrend(f.years,f.values),f.trend,'trend');
}));
fixture<{df:number;t:number;p:number;reference_p:number;reference_source:string;critical95:number}[]>('student').forEach(f=>test(`Student t tail (${f.reference_source}) and SciPy CI df=${f.df}, t=${f.t}`,()=>{
 close(twoSidedT(f.t,f.df),f.reference_p,'tail');close(twoSidedT(-f.t,f.df),f.reference_p,'symmetry');close(tCritical95(f.df),f.critical95,'critical');
}));
const rows=(year=2000)=>Array.from({length:12},(_,i)=>({month:`${year}-${String(i+1).padStart(2,'0')}`,value:280}));
for(const [value,code] of [[null,'missing_values'],[undefined,'missing_values'],[NaN,'missing_values'],[Infinity,'missing_values'],[-Infinity,'missing_values'],['280','invalid_values'],[true,'invalid_values'],[{},'invalid_values']] as const) test('monthly rejects '+String(value),()=>{
 const data:unknown[]=rows();data[5]={month:'2000-06',value};assert.throws(()=>readMonthlyRecords(data,2000,2000),(e:unknown)=>e instanceof ScienceError&&e.code===code);
});
for(const [kind,code] of [['missing','missing_months'],['duplicate','duplicate_months'],['unordered','unordered_months'],['format','invalid_month'],['day','invalid_month'],['extra','missing_months'],['empty','missing_months']] as const) test('calendar rejects '+kind,()=>{
 const data=rows();if(kind==='missing')data.splice(4,1);if(kind==='duplicate')data[1]={...data[0]};if(kind==='unordered')[data[0],data[1]]=[data[1],data[0]];if(kind==='format')data[0].month='2000-13';if(kind==='day')data[0].month='2000-01-02';if(kind==='extra')data.push({month:'2001-01',value:280});if(kind==='empty')data.length=0;
 assert.throws(()=>readMonthlyRecords(data,2000,2000),(e:unknown)=>e instanceof ScienceError&&e.code===code);
});
test('fill values, bounds, unsupported variables and unit conversion',()=>{
 const data=rows();data[0].value=1e15;assert.throws(()=>readMonthlyRecords(data,2000,2000,[1e15]),{code:'fill_values'});
 close(convertUnits([273.15,300],'T2M','K')[1],26.85);assert.equal(convertUnits([273.15],'T2M','K')[0],0);assert.equal(convertUnits([.005],'QV2M','kg kg-1')[0],5);
 for(const unit of ['°C','K ','kelvin'])assert.throws(()=>convertUnits([280],'T2M',unit),{code:'invalid_units'});
 for(const unit of ['%','g/kg','kg/kg'])assert.throws(()=>convertUnits([.005],'QV2M',unit),{code:'invalid_units'});
 for(const v of [179,331])assert.throws(()=>convertUnits([v],'T2M','K'),{code:'implausible_values'});
 for(const v of [-.1,.2])assert.throws(()=>convertUnits([v],'QV2M','kg kg-1'),{code:'implausible_values'});
 assert.throws(()=>convertUnits([NaN],'T2M','K'),{code:'missing_values'});
});
for(const [year,days,feb] of [[1900,365,28],[2000,366,29],[2001,365,28],[2024,366,29],[2100,365,28]])test('Gregorian weighting '+year,()=>{
 const data=rows(year);data.forEach((r,i)=>r.value=i===1?1:0);const annual=annualMeans(data)[0];assert.equal(annual.days,days);close(annual.value,feb/days);assert.equal(daysInMonth(year,2),feb);
});
for(const kind of ['missing','duplicate','nonfinite','wrong_day','empty'])test('annual rejects incomplete/invalid '+kind,()=>{
 const data=rows();if(kind==='missing')data.pop();if(kind==='duplicate')data[1]={...data[0]};if(kind==='nonfinite')data[1].value=NaN;if(kind==='wrong_day')data[0].month+='-02';if(kind==='empty')data.length=0;assert.throws(()=>annualMeans(data),ScienceError);
});
test('constant and mathematically exact positive / negative trends',()=>{
 const years=Array.from({length:35},(_,i)=>1991+i);
 const flat=hacTrend(years,years.map(()=>3));assert.equal(flat.status,'constant_series');assert.equal(flat.slope_per_decade,0);assert.equal(flat.r_squared,null);
 for(const sign of [-1,1]) {const trend=hacTrend(years,years.map((_,i)=>3+sign*.25*i));assert.equal(trend.status,'zero_residual_variance');close(trend.slope_per_decade,sign*2.5);assert.equal(trend.r_squared,1);assert.equal(interpretTrend(trend).conclusion,'undefined');
 for(const key of ['p_value_two_sided','ci95_per_decade','significant','standard_error_per_decade'] as const)assert.equal(trend[key],null);}
 assert(!JSON.stringify(flat).includes('NaN'));
});
test('known noisy example HAC differs from ordinary OLS and responds to lag',()=>{
 const f=numerical.find(f=>f.years.length===20&&f.values[0]>f.values.at(-1)!)!;
 const fit=fitOLS(f.years,f.values),cov=hacCovariance(fit,3),ordinary=fit.sse/(fit.n-2)/fit.sxx;
 assert(Math.abs(cov[1][1]-ordinary)>1e-8);assert.notEqual(hacCovariance(fit,1)[1][1],hacCovariance(fit,4)[1][1]);
 const trend=hacTrend(f.years,f.values);assert.equal(trend.hac_maxlags,3);assert(trend.ci95_per_decade!.lower<trend.slope_per_decade&&trend.ci95_per_decade!.upper>trend.slope_per_decade);
});
test('bad regression / lag / Student t input is rejected',()=>{
 for(const [years,values] of [[[0,1,2,3],[1,2,3,4]],[[2000,2001,2003,2004,2005],[1,2,3,4,5]],[[.5,1.5,2.5,3.5,4.5],[1,2,3,4,5]],[[1,2,3,4,5],[1,2,NaN,3,4]]])assert.throws(()=>hacTrend(years,values),ScienceError);
 const fit=fitOLS([1,2,3,4,5],[1,3,2,4,3]);for(const lag of [-1,.5,4])assert.throws(()=>hacCovariance(fit,lag),ScienceError);
 assert.throws(()=>twoSidedT(Infinity,3),ScienceError);assert.throws(()=>tCritical95(0),ScienceError);
});
test('coordinate ties, dateline, poles and source mismatch',()=>{
 assert.equal(nearestCell(52.25,76.5625).latitude,52);assert.equal(nearestCell(52.25,76.5625).longitude,76.25);
 assert.equal(nearestCell(0,180).longitude,-180);assert.equal(nearestCell(0,179.6875).longitude_index,0);assert.equal(nearestCell(90,0).latitude_index,360);
 assert.throws(()=>nearestCell(NaN,0),ScienceError);const c=structuredClone(cases[0]);c.loaded.cell.longitude=13.125;assert.throws(()=>scientificResult(c.request,c.loaded),{code:'coordinate_mismatch'});
});
test('source metadata, granule calendar, checksum declarations and request validation',()=>{
 const original=cases[0];
 for(const mutate of [(c:Case)=>{c.loaded.provenance.granules.pop();},(c:Case)=>{c.loaded.provenance.granules[0].month='1991-02';},(c:Case)=>{c.loaded.provenance.granules[0].sha256='bad';},(c:Case)=>{c.loaded.provenance.dataset='INVALID' as 'M2TMNXSLV';}]){const c=structuredClone(original);mutate(c);assert.throws(()=>scientificResult(c.request,c.loaded),{code:'invalid_source_metadata'});}
 assert.throws(()=>scientificResult({...original.request,variable:'RH'},original.loaded),{code:'invalid_request'});
 for(const url of ['https://user:password@example.test/data','https://example.test/data?token=secret','http://example.test/data','not a URL']) {
  const c=structuredClone(original);c.loaded.provenance.granules[0].url=url;
  assert.throws(()=>scientificResult(c.request,c.loaded),(e:unknown)=>e instanceof ScienceError&&e.code==='invalid_source_metadata'&&!e.message.includes('secret')&&!e.message.includes('password'));
 }
});
test('pipeline rejects incomplete input, preserves small-sample warning and undefined inference',()=>{
 const c=subset(cases[0],1991,1995);c.loaded.records.pop();assert.throws(()=>scientificResult(c.request,c.loaded),{code:'missing_months'});
 const constant=subset(cases[0],1991,1995);constant.loaded.records.forEach(r=>r.value=280);const result=scientificResult(constant.request,constant.loaded);
 assert.equal(result.trend.status,'constant_series');assert(result.warnings.some(w=>w.startsWith('Fewer than 20')));assert(result.warnings.some(w=>w.startsWith('Degenerate annual')));
});
