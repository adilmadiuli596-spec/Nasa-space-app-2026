import 'server-only';
import {ScienceError} from '../science/errors';
import {analysisRequest} from '@/shared/schemas/analysis';
import type {AnalysisPair} from '@/shared/schemas/pair';
import type {Result} from '@/shared/types/api';
import {NasaRetryError} from '../nasa/http';
export function createAnalysisHandler(service:(input:unknown,request:Request)=>Promise<Result>,pairedService?:(input:unknown,request:Request)=>Promise<AnalysisPair>) {
 return async(request:Request)=>{
  try {const parsed=analysisRequest.safeParse(await readJSON(request));if(!parsed.success)throw new ScienceError('invalid_request','Invalid analysis request');const paired=request.headers.get('X-Analysis-Variables')==='T2M,QV2M';return Response.json(paired&&pairedService?{results:await pairedService(parsed.data,request)}:await service(parsed.data,request),{headers:{'Cache-Control':'no-store'}});}
  catch(error){return errorResponse(error);}
 };
}
export async function readJSON(request:Request,maxBytes=4096):Promise<unknown> {
 if(Number(request.headers.get('content-length')||0)>maxBytes)throw new ScienceError('too_large','Request too large',413);
 const reader=request.body?.getReader();if(!reader)throw new ScienceError('invalid_json','Invalid JSON',400);
 let size=0;const chunks:Uint8Array[]=[];
 try {while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>maxBytes)throw new ScienceError('too_large','Request too large',413);chunks.push(part.value);}}
 catch(error){await reader.cancel().catch(()=>{});if(error instanceof ScienceError)throw error;throw new ScienceError('invalid_json','Invalid JSON',400);}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new ScienceError('invalid_json','Invalid JSON',400);}
}
export function errorResponse(error:unknown) {
 const publicError=error instanceof ScienceError?error:new ScienceError('internal_error','Analysis could not be completed',500);
 return Response.json({error:{code:publicError.code,message:publicError.message}},{status:publicError.status,headers:{'Cache-Control':'no-store',...(error instanceof NasaRetryError?{'Retry-After':String(error.retryAfterSeconds)}:publicError.code==='nasa_rate_limited'||publicError.code==='analysis_busy'?{'Retry-After':'10'}:{})}});
}
