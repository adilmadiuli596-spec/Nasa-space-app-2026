import {readFile,writeFile} from 'node:fs/promises';
import {spike} from '../tests/science-spike';
const reference=JSON.parse(await readFile('reference/.data-check/analysis_results.json','utf8'));
const results:Record<string,unknown>={};
for(const variable of ['T2M_C','QV2M_g_kg']) {
 const rows=reference.annual[variable], expected=reference.statistics[variable].primary;
 const actual=spike(rows.map((r:{year:number})=>r.year),rows.map((r:{value:number})=>r.value));
 results[variable]={actual,expected,absolute_error:{slope:Math.abs(actual.slope-expected.slope_per_decade),se:Math.abs(actual.se!-expected.standard_error_per_decade),p:Math.abs(actual.p!-expected.p_value_two_sided),ci:actual.ci!.map((v,i)=>Math.abs(v-expected.ci95_per_decade[i]))}};
}
await writeFile('docs/N1_SCIENCE.json',JSON.stringify({rtol:1e-10,atol:1e-12,production_backend_replaced:false,results},null,2));
console.log('Scientific parity evidence written');
