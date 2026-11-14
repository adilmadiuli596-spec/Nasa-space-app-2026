import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import h5wasm from 'h5wasm/node';
import type {Dataset} from 'h5wasm/node';
await h5wasm.ready;
const path=process.argv[2]||'reference/data/MERRA2_100.tavgM_2d_slv_Nx.199101.nc4';
const bytes=await readFile(path);
const report:Record<string,unknown>={date:'2026-11-14',source:path,sha256:createHash('sha256').update(bytes).digest('hex'),magic:bytes.subarray(0,8).toString('hex')};
const file=new h5wasm.File(path,'r');
try {
 for(const name of ['T2M','QV2M']) {
  const ds=file.get(name) as Dataset;
  const values=ds.slice([[0,1],[285,286],[411,412]]) as Float32Array;
  const expected=name==='T2M'?259.11444091796875:0.0012164824875071645;
  if(values[0]!==expected) throw new Error('Python value mismatch: '+name);
  report[name]={value:values[0],shape:ds.shape,units:ds.attrs.units.value,equals_python:true};
 }
 report.status='passed';
} finally { file.close(); }
await writeFile('docs/N1_HDF5.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
