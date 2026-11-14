import 'server-only';
export type Mode='blocked'|'local'|'demo';
export type NasaConfig={mode:Mode;workers:number;requestTimeoutMs:number;analysisTimeoutMs:number;attempts:number;cache:'memory'|'file';cacheBytes:number};
export function configFromEnv(env:Readonly<Record<string,string|undefined>>=process.env):NasaConfig {
 const requested=env.EARTH_MODE||'blocked';
 const mode:Mode=requested==='demo'?'demo':requested==='local'&&!env.VERCEL?'local':'blocked';
 return {mode,workers:4,requestTimeoutMs:20000,analysisTimeoutMs:270000,attempts:3,cache:env.EARTH_CACHE==='file'&&!env.VERCEL?'file':'memory',cacheBytes:16*1024*1024};
}
export const PUBLIC_DYNAMIC_ACCESS_CONFIRMED=false;
