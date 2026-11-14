import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {findLocation} from '../src/frontend/location';
import {checkedResult,api,ApiError,connection} from '../src/frontend/api';
import {health,variables} from '../src/backend/services/catalog';
const result=JSON.parse(readFileSync('docs/N3_LIVE_PAVLODAR_T2M.json','utf8'));
test('local city search and explicit coordinate formats',()=>{
 assert.deepEqual(findLocation('  PaVLoDaR '),{latitude:52.27601,longitude:76.96881});assert.deepEqual(findLocation('Берлин'),{latitude:52.52,longitude:13.405});assert.deepEqual(findLocation('Tokyo'),{latitude:35.68,longitude:139.69});
 for(const input of ['35.68, 139.69','35.68 139.69','35,68; 139,69'])assert.deepEqual(findLocation(input),{latitude:35.68,longitude:139.69});
 for(const input of ['Paris','','91, 12','12, 181','35','1,2,3','NaN, 12','Infinity, 0'])assert.equal(findLocation(input),null);
});
test('result contract matches submitted query and genuine source mode',()=>{
 assert.equal(checkedResult(result,result.requested,'nasa_opendap_local').trend.slope_per_decade,result.trend.slope_per_decade);
 assert.throws(()=>checkedResult(result,{...result.requested,longitude:13.405}),/другому запросу/);
 assert.throws(()=>checkedResult(result,result.requested,'offline_verified_demo'),/Источник результата/);
 const invalid=structuredClone(result);invalid.trend.fitted_values=[];assert.throws(()=>checkedResult(invalid,result.requested),ApiError);
});
test('client API localizes errors and never echoes unknown server details or auto-retries',async()=>{
 const original=globalThis.fetch;let calls=0;
 try{globalThis.fetch=async()=>{calls++;return Response.json({error:{code:'nasa_auth_required',message:'private-detail-must-not-render'}},{status:503});};await assert.rejects(api('analysis'),(error:unknown)=>error instanceof ApiError&&error.message.includes('не авторизован')&&!error.message.includes('private-detail'));assert.equal(calls,1);
 globalThis.fetch=async()=>Response.json({error:{code:'unknown',message:'private-detail'}},{status:502});await assert.rejects(api('analysis'),(error:unknown)=>error instanceof ApiError&&!error.message.includes('private-detail'));
 globalThis.fetch=async()=>new Response('not JSON',{status:200});await assert.rejects(api('health'),{code:'invalid_result'});
 }finally{globalThis.fetch=original;}
});
test('health and catalog are validated independently of secret configuration',async()=>{
 const original=globalThis.fetch;try{globalThis.fetch=async input=>Response.json(String(input).endsWith('/health')?health():variables());const result=await connection(new AbortController().signal);assert(result.health.mode);assert.equal(result.catalog.variables.length,2);
 globalThis.fetch=async()=>Response.json({status:'ok'});await assert.rejects(connection(new AbortController().signal),{code:'invalid_result'});
 }finally{globalThis.fetch=original;}
});
