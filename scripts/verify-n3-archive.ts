import {readFile,readdir,writeFile} from 'node:fs/promises';
import {decodeSubset} from '../src/backend/nasa/decode';
import {nearestCell} from '../src/backend/science/coordinates';
import type {CatalogGranule} from '../src/backend/nasa/schemas';
import {MemoryCache,digest} from '../src/backend/cache/memory';
const manifest=JSON.parse(await readFile('reference/.data-check/manifest.json','utf8'));
const raw=JSON.parse(await readFile('reference/.data-check/monthly_values.json','utf8'));
const files=(await readdir('reference/.data-check/granules')).filter(f=>f.endsWith('.nc4')).sort();
const cell=nearestCell(52.27601,76.96881),cache=new MemoryCache(),before=process.memoryUsage();let peak=before.rss,totalBytes=0;
const started=performance.now();
for(const file of files){
 const month=file.slice(0,7),m=manifest.find((r:{month:string})=>r.month===month),expected=raw.find((r:{month:string})=>r.month===month);
 const entry:CatalogGranule={month,granule_id:m.granule_id,filename:m.filename,opendap:m.opendap,updated:'2026-01-01T00:00:00Z'};
 const bytes=new Uint8Array(await readFile('reference/.data-check/granules/'+file));totalBytes+=bytes.length;
 const record=await decodeSubset(bytes,entry,cell);for(const name of ['T2M','QV2M'] as const)if(record.values[name]!==expected[name])throw new Error('Archive scientific mismatch');
 await cache.set(digest({month,cell}),record);peak=Math.max(peak,process.memoryUsage().rss);
}
const cold=performance.now()-started,warmStarted=performance.now();
for(const file of files){const item=await cache.get(digest({month:file.slice(0,7),cell}),1000000);if(!item)throw new Error('Warm cache lost a month');}
const report={date:'2026-11-14',mode:'offline_archived_NASA_subset_replay_not_live_network',subsets:files.length,variables_checked_per_subset:2,source_bytes:totalBytes,hdf5_validation_and_cache_fill_ms:cold,warm_decoded_cache_read_ms:performance.now()-warmStarted,process_memory_before:before,process_memory_after:process.memoryUsage(),sampled_peak_rss_bytes:peak,permanent_data_files_written:false,notes:['419 real preserved HDF5 subsets; January 1991 is a global file and deliberately not accepted as a subset','CMR updated timestamp is a replay placeholder, not a fresh catalog retrieval','This is decoding/cache timing, not a cold 420-month NASA network or Vercel benchmark']};
await writeFile('docs/N3_ARCHIVE.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
