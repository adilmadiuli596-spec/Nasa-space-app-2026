import 'server-only';
import {ScienceError} from '../science/errors';
import {assertNASAUrl,TokenProvider} from './auth';
import type {NasaConfig} from './config';
export class Semaphore {
 private active=0;private queue:(()=>void)[]=[];
 constructor(private readonly limit:number) {}
 async run<T>(work:()=>Promise<T>,signal:AbortSignal):Promise<T> {
  if(signal.aborted)throw new ScienceError('nasa_timeout','NASA operation cancelled or timed out',504);
  await new Promise<void>((resolve,reject)=>{
   const start=()=>{signal.removeEventListener('abort',cancel);this.active++;resolve();};
   const cancel=()=>{this.queue=this.queue.filter(f=>f!==start);reject(new ScienceError('nasa_timeout','NASA operation cancelled or timed out',504));};
   if(this.active<this.limit)start();else{this.queue.push(start);signal.addEventListener('abort',cancel,{once:true});}
  });
  try {if(signal.aborted)throw new ScienceError('nasa_timeout','NASA operation cancelled or timed out',504);return await work();}
  finally {this.active--;this.queue.shift()?.();}
 }
}
const processNetworkLimit=new Semaphore(4);
export class NasaRetryError extends ScienceError {
 constructor(code:string,readonly retryAfterSeconds:number){super(code,'NASA requests a later retry; the server will not retry earlier than instructed',503);}
}
const delay=(ms:number,signal:AbortSignal)=>new Promise<void>((resolve,reject)=>{
 const done=()=>{signal.removeEventListener('abort',cancel);resolve();};
 const timer=setTimeout(done,ms);const cancel=()=>{clearTimeout(timer);reject(new ScienceError('nasa_timeout','NASA operation cancelled or timed out',504));};
 signal.addEventListener('abort',cancel,{once:true});if(signal.aborted)cancel();
});
export class NasaHTTP {
 constructor(private readonly config:NasaConfig,readonly auth=new TokenProvider(),private readonly fetcher:typeof fetch=fetch) {}
 async get(url:URL,authenticated:boolean,signal:AbortSignal,maxBytes=2*1024*1024):Promise<Uint8Array> {
  assertNASAUrl(url,authenticated);
  return processNetworkLimit.run(async()=>{
   for(let attempt=0;attempt<this.config.attempts;attempt++) {
    const timeout=AbortSignal.timeout(this.config.requestTimeoutMs),combined=AbortSignal.any([signal,timeout]);
    let retry=300*2**attempt;
    try {
     const response=await this.fetcher(url,{headers:authenticated?this.auth.headers(url):{},redirect:'manual',signal:combined,cache:'no-store'});
     if(response.status===401||response.status===403) {if(authenticated)this.auth.invalidate();await response.body?.cancel();throw new ScienceError(response.status===401?'nasa_auth_required':'nasa_forbidden','NASA rejected authorization; replace the local token or check application permissions',503);}
     if(response.status>=300&&response.status<400) {await response.body?.cancel();throw new ScienceError('nasa_redirect_error','NASA redirect refused; authorization was not forwarded',503);}
     if(response.status===429||[500,502,503,504].includes(response.status)) {
      const header=response.headers.get('retry-after')||'';
      const seconds=/^\d+$/.test(header)?Number(header):Math.ceil((Date.parse(header)-Date.now())/1000);
      const retrySeconds=Number.isSafeInteger(seconds)&&seconds>=0?seconds:undefined;
      if(retrySeconds!==undefined)retry=retrySeconds*1000;
      await response.body?.cancel();
      if(retry>10000||attempt+1===this.config.attempts)throw new NasaRetryError(response.status===429?'nasa_rate_limited':'nasa_unavailable',Math.max(1,retrySeconds??10));
     } else if(response.status!==200) {await response.body?.cancel();throw new ScienceError(response.status===404?'nasa_granule_unavailable':'nasa_http_error','NASA returned an unexpected HTTP response',502);}
     else {
      if(Number(response.headers.get('content-length')||0)>maxBytes){await response.body?.cancel();throw new ScienceError('nasa_response_too_large','NASA subset exceeds the allowed response size; global downloads refused',502);}
      const reader=response.body?.getReader();if(!reader)throw new ScienceError('nasa_invalid_format','NASA returned an empty response',502);
      const chunks:Uint8Array[]=[];let length=0;
      try {while(true){const item=await reader.read();if(item.done)break;length+=item.value.length;if(length>maxBytes)throw new ScienceError('nasa_response_too_large','NASA response exceeds the safety size limit',502);chunks.push(item.value);}}
      catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
      const result=new Uint8Array(length);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}return result;
     }
    } catch(error) {
     if(error instanceof ScienceError)throw error;
     if(signal.aborted)throw new ScienceError('nasa_timeout','NASA analysis cancelled or exceeded its deadline',504);
     if(attempt+1===this.config.attempts)throw new ScienceError(timeout.aborted?'nasa_timeout':'nasa_transport_error',timeout.aborted?'NASA network timeout':'NASA HTTPS request failed; TLS verification remains enabled',timeout.aborted?504:502);
    }
    await delay(retry,signal);
   }
   throw new ScienceError('nasa_unavailable','NASA request did not complete',503);
  },signal);
 }
}
