import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spike} from './science-spike';
const reference=JSON.parse(readFileSync('reference/.data-check/analysis_results.json','utf8'));
function close(a:number,b:number) {assert(Math.abs(a-b)<=1e-12+1e-10*Math.abs(b),`${a} != ${b}`);}
for(const key of ['T2M_C','QV2M_g_kg']) test('OLS / HAC Python parity '+key,()=>{
 const rows=reference.annual[key], expected=reference.statistics[key].primary;
 const actual=spike(rows.map((r:{year:number})=>r.year),rows.map((r:{value:number})=>r.value));
 close(actual.slope,expected.slope_per_decade); close(actual.se!,expected.standard_error_per_decade);close(actual.p!,expected.p_value_two_sided);
 actual.ci!.forEach((v,i)=>close(v,expected.ci95_per_decade[i]));
});
test('degenerate and invalid series',()=>{
 const years=[2000,2001,2002,2003,2004];
 assert.equal(spike(years,[1,1,1,1,1]).status,'constant_series');
 assert.equal(spike(years,[1,2,3,4,5]).status,'zero_residual_variance');
 assert.throws(()=>spike(years,[1,2,NaN,3,4])); assert.throws(()=>spike([2000,2002,2003,2004,2005],[1,2,3,2,1]));
});
