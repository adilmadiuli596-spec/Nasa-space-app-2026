import {mkdir,writeFile,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const probe=new URL('../src/app/boundary-probe/',import.meta.url);
await mkdir(probe,{recursive:true}); await mkdir('.cache',{recursive:true});
try {
 await writeFile(new URL('page.tsx',probe),`'use client';\nimport {health} from '@/backend/services/catalog';\nexport default function Probe(){return <pre>{JSON.stringify(health())}</pre>;}\n`);
 const result=spawnSync(process.execPath,['node_modules/next/dist/bin/next','build','--webpack'],{encoding:'utf8',env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},timeout:120000});
 const log=result.stdout+'\n'+result.stderr;await writeFile('.cache/server-only-negative.log',log);
 if(result.status===0||!log.includes('server-only')) throw new Error('Next did not reject backend import');
 await writeFile('docs/N1_SERVER_ONLY.json',JSON.stringify({status:'passed',negative_build_exit:result.status,backend_client_import_rejected:true,probe_removed:true},null,2));
 console.log('Next.js rejected client -> server-only import');
} finally {await rm(probe,{recursive:true,force:true});}
