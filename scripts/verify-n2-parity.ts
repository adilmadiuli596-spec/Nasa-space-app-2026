import {readFile,writeFile} from 'node:fs/promises';
import {scientificResult} from '../src/backend/science/result';
import type {Result} from '../src/shared/types/api';
type Metrics={max_absolute_error:number;worst_path:string;numeric_leaves:number;failures:string[]};
const cases=JSON.parse(await readFile('tests/fixtures/n2/real-cases.json','utf8'));
const reports=[];
function compare(actual:unknown,expected:unknown,path:string,metrics:Metrics):void {
 if(typeof expected==='number') {
  const error=Math.abs((actual as number)-expected);metrics.numeric_leaves++;
  if(error>metrics.max_absolute_error){metrics.max_absolute_error=error;metrics.worst_path=path;}
  if(typeof actual!=='number'||!Number.isFinite(actual)||error>1e-12+1e-10*Math.abs(expected))metrics.failures.push(path);
 } else if(Array.isArray(expected)) {
  if(!Array.isArray(actual)||actual.length!==expected.length){metrics.failures.push(path+'.length');return;}
  expected.forEach((v,i)=>compare(actual[i],v,`${path}[${i}]`,metrics));
 } else if(expected!==null&&typeof expected==='object') {
  for(const [key,value] of Object.entries(expected))compare((actual as Record<string,unknown>)[key],value,path+'.'+key,metrics);
 } else if(actual!==expected)metrics.failures.push(path);
}
for(const c of cases) {
 const actual=scientificResult(c.request,c.loaded);
 const comparisons:Record<string,Metrics>={};
 for(const [name,expected] of [['fresh_python',c.expected],['original_3C_json',c.historical]] as const) {
  const metrics:Metrics={max_absolute_error:0,worst_path:'',numeric_leaves:0,failures:[]};
  for(const key of ['requested','actual_cell','source_unit','unit','trend_unit','monthly_series','annual_series','trend','quality','provenance','warnings'] as const)compare(actual[key],expected[key],key,metrics);
  for(const [key,value] of Object.entries(expected.method))if(!key.endsWith('_version'))compare(actual.method[key],value,'method.'+key,metrics);
  comparisons[name]=metrics;
 }
 const fields=['slope_per_decade','standard_error_per_decade','p_value_two_sided','ci95_per_decade','r_squared','fitted_values'] as const;
 const errors:Record<string,unknown>={};for(const field of fields) {
  const a=actual.trend[field],b=c.expected.trend[field];
  errors[field]=typeof a==='number'?Math.abs(a-(b as number)):Array.isArray(a)?Math.max(...a.map((v,i)=>Math.abs(v-(b as number[])[i]))):a&&typeof a==='object'?Object.fromEntries(Object.entries(a).map(([k,v])=>[k,Math.abs(v-(b as Record<string,number>)[k])])):null;
 }
 reports.push({id:c.id,python:c.expected.trend,typescript:actual.trend,absolute_errors:errors,comparisons});
}
const allPassed=reports.every(r=>Object.values(r.comparisons).every(c=>!c.failures.length));
await writeFile('docs/N2_PARITY.json',JSON.stringify({rtol:1e-10,atol:1e-12,all_passed:allPassed,excluded_runtime_fields:['method.*_version (Python libraries replaced by truthful TS implementation metadata)','timings_ms (measured durations, not scientific equality)'],reports},null,2));
if(!allPassed)throw new Error('Numerical parity failed');console.log('All four full scientific results match fresh Python and original JSON');
