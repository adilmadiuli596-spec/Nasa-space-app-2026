import 'server-only';
import {analyzePower} from '../power/analysis';
import {analysisRequest} from '@/shared/schemas/analysis';
import {scientificResult} from '../science/result';
import {ScienceError} from '../science/errors';
import {configFromEnv,type NasaConfig} from '../nasa/config';
import {NasaSource} from '../nasa/source';
import {NasaHTTP} from '../nasa/http';
import {loadDemo,DEMO_WARNING} from '../nasa/demo';
import {FileCache} from '../cache/file';
import {MemoryCache} from '../cache/memory';
export function assertLocalRequest(request:Request) {
 const url=new URL(request.url),hosts=['localhost','127.0.0.1','[::1]'];
 const host=request.headers.get('host')||url.host;
 let hostURL:URL;try{hostURL=new URL('http://'+host);}catch{throw new ScienceError('local_only','Dynamic NASA access is local-only',403);}
 if(!hosts.includes(url.hostname)||!hosts.includes(hostURL.hostname))throw new ScienceError('local_only','Dynamic NASA access is local-only',403);
 const origin=request.headers.get('origin');if(origin){let value:URL;try{value=new URL(origin);}catch{throw new ScienceError('local_only','Cross-origin NASA access is blocked',403);}if(!hosts.includes(value.hostname)||value.host!==host||!['http:','https:'].includes(value.protocol))throw new ScienceError('local_only','Cross-origin NASA access is blocked',403);}
}
export function createAnalysisService(config:NasaConfig,source=new NasaSource(config,new NasaHTTP(config),config.cache==='file'?new FileCache(process.cwd()):new MemoryCache(config.cacheBytes))) {
 return async (input:unknown,request:Request)=>{
  const parsed=analysisRequest.safeParse(input);if(!parsed.success)throw new ScienceError('invalid_request','Invalid analysis request');
  if(config.mode==='power')return analyzePower(parsed.data,request.signal);
  if(config.mode==='blocked')throw new ScienceError('public_access_unconfirmed','Dynamic Earthdata access is blocked for public use. Choose explicit demo mode or local authorized operation',503);
  if(config.mode==='local')assertLocalRequest(request);
  const loaded=config.mode==='demo'?loadDemo(parsed.data):await source.load(parsed.data,request.signal);
  const result=scientificResult(parsed.data,loaded);
  if(config.mode==='demo')result.warnings.push(DEMO_WARNING);
  return result;
 };
}
let service:ReturnType<typeof createAnalysisService>|undefined;let signature='';
export async function analyze(input:unknown,request:Request) {const config=configFromEnv();const next=JSON.stringify(config);if(!service||signature!==next){service=createAnalysisService(config);signature=next;}return service(input,request);}
