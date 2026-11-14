import {writeFile} from 'node:fs/promises';
import {discoverJanuary1991} from '../src/backend/nasa/cmr';
import {earthdataHeaders} from '../src/backend/nasa/auth';
const report:Record<string,unknown>={date:'2026-11-14',runtime:process.version,cmr:'not_checked',authenticated:'not_checked',credentials_configured:Boolean(process.env.EARTHDATA_TOKEN)};
try {
 const granule=await discoverJanuary1991(); report.cmr={status:'passed',...granule};
 if(process.env.EARTHDATA_TOKEN) {
  const url=new URL(granule.opendap+'.nc4?T2M[0:1:0][285:1:285][411:1:411],QV2M[0:1:0][285:1:285][411:1:411],lat[285:1:285],lon[411:1:411],time[0:1:0]');
  const response=await fetch(url,{headers:earthdataHeaders(url),redirect:'manual',signal:AbortSignal.timeout(30000)});
  report.authenticated={http_status:response.status,redirect_followed:false};
  if(response.ok) { const b=Buffer.from(await response.arrayBuffer()); report.subset_bytes=b.length; await writeFile('.cache/live-subset.nc4',b); }
 } else report.authenticated='not_tested_no_process_token';
} catch(e) { report.cmr={status:'failed',error_type:e instanceof Error?e.name:'unknown'}; }
await writeFile('docs/N1_NASA_NODE.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
