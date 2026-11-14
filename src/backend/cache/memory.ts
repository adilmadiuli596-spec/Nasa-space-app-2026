import 'server-only';
import {createHash} from 'node:crypto';
export interface Cache {get(key:string,ttlMs:number):Promise<unknown|undefined>;set(key:string,payload:unknown):Promise<void>;delete(key:string):Promise<void>;}
export function canonical(value:unknown):string {
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b,'en')).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
}
export const digest=(value:unknown)=>createHash('sha256').update(canonical(value)).digest('hex');
export class MemoryCache implements Cache {
 private entries=new Map<string,{created:number;text:string;size:number}>();private bytes=0;
 constructor(private readonly maxBytes=16*1024*1024) {}
 async get(key:string,ttlMs:number) {const e=this.entries.get(key);if(!e)return;if(Date.now()-e.created>=ttlMs){await this.delete(key);return;}this.entries.delete(key);this.entries.set(key,e);return JSON.parse(e.text);}
 async set(key:string,payload:unknown){const text=JSON.stringify(payload),size=Buffer.byteLength(text);await this.delete(key);if(size>this.maxBytes)return;while(this.bytes+size>this.maxBytes&&this.entries.size)await this.delete(this.entries.keys().next().value!);this.entries.set(key,{text,size,created:Date.now()});this.bytes+=size;}
 async delete(key:string){const e=this.entries.get(key);if(e)this.bytes-=e.size;this.entries.delete(key);}
}
