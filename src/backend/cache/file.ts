import 'server-only';
import {mkdir,lstat,readFile,writeFile,rename,unlink,readdir,stat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {type Cache,digest} from './memory';
// Explicit local cache only. Never used on Vercel; no claim of /tmp durability.
export class FileCache implements Cache {
 private readonly root:string;
 constructor(projectRoot:string,private readonly maxBytes=64*1024*1024){this.root=path.join(path.resolve(projectRoot),'.cache','nasa-n3');}
 private async prepare(){
  const project=path.resolve(this.root,'..','..');
  for(const dir of [path.join(project,'.cache'),this.root]){try{if((await lstat(dir)).isSymbolicLink())throw new Error('symlink');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}await mkdir(dir,{recursive:true});}
  if(path.resolve(await realpath(this.root))!==this.root)throw new Error('unsafe cache path');
 }
 private file(key:string){if(!/^[a-f0-9]{64}$/.test(key))throw new Error('invalid cache key');return path.join(this.root,key+'.json');}
 async get(key:string,ttlMs:number):Promise<unknown|undefined>{try{await this.prepare();const file=this.file(key),info=await lstat(file);if(info.isSymbolicLink()||info.size>4*1024*1024)return;const row=JSON.parse(await readFile(file,'utf8'));if(row.schema!==1||row.key!==key||!Number.isFinite(row.created)||Date.now()-row.created>=ttlMs||row.created>Date.now()+1000||digest(row.payload)!==row.sha256)return;return row.payload;}catch{return;}}
 async set(key:string,payload:unknown){await this.prepare();const text=JSON.stringify({schema:1,key,created:Date.now(),payload,sha256:digest(payload)});if(Buffer.byteLength(text)>4*1024*1024)return;const temp=path.join(this.root,randomUUID()+'.tmp');try{await writeFile(temp,text,{flag:'wx',mode:0o600});await rename(temp,this.file(key));}finally{await unlink(temp).catch(()=>{});}const files=await Promise.all((await readdir(this.root)).filter(n=>/^[a-f0-9]{64}\.json$/.test(n)).map(async n=>({file:path.join(this.root,n),info:await stat(path.join(this.root,n))})));let bytes=files.reduce((s,f)=>s+f.info.size,0);for(const f of files.sort((a,b)=>a.info.mtimeMs-b.info.mtimeMs)){if(bytes<=this.maxBytes)break;await unlink(f.file).catch(()=>{});bytes-=f.info.size;}}
 async delete(key:string){await unlink(this.file(key)).catch(()=>{});}
}
