import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analysisRequest} from '../src/shared/schemas/analysis';
import {earthdataHeaders} from '../src/backend/nasa/auth';
import {createAnalysisHandler} from '../src/backend/services/http';
import {createAnalysisService} from '../src/backend/services/analysis';
import {configFromEnv} from '../src/backend/nasa/config';
import {resultSchema} from '../src/shared/schemas/result';
import {readFileSync} from 'node:fs';
const valid={latitude:52.27601,longitude:76.96881,variable:'T2M',start_year:1991,end_year:2025};
test('shared result schema accepts freshly executed current Python oracle',()=>{
 for(const name of ['N1_ORACLE_T2M.json','N1_ORACLE_QV2M.json']) {
  const result=JSON.parse(readFileSync('docs/'+name,'utf8'));
  const parsed=resultSchema.safeParse(result); assert(parsed.success,JSON.stringify(parsed.error?.issues.slice(0,3)));
 }
});
test('strict contract',()=>{assert(analysisRequest.safeParse(valid).success); for(const patch of [{latitude:91},{longitude:Infinity},{variable:'RH'},{start_year:2024},{password:'secret'},{latitude:'52'}]) assert(!analysisRequest.safeParse({...valid,...patch}).success);});
test('auth rejects foreign destinations before reading token',()=>{for(const url of ['http://opendap.earthdata.nasa.gov/collections/a','https://evil.example/collections/a','https://opendap.earthdata.nasa.gov.evil.example/collections/a']) assert.throws(()=>earthdataHeaders(new URL(url)));});
test('HTTP error contract and explicit blocked mode',async()=>{
 const POST=createAnalysisHandler(createAnalysisService(configFromEnv({EARTH_MODE:'blocked'}))); 
 for(const [body,status] of [['{',400],[JSON.stringify({...valid,latitude:91}),422],[JSON.stringify(valid),503],[' '.repeat(4097),413]] as const) {
  const response=await POST(new Request('http://localhost/api/analysis',{method:'POST',body})); assert.equal(response.status,status); const data=await response.json();assert(data.error.code);assert(!JSON.stringify(data).includes('secret'));
 }
});
