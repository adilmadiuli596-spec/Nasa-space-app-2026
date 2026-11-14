import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import type {Dataset,File} from 'h5wasm';
import type {Cell} from './types';
import {ScienceError} from '../science/errors';
import {daysInMonth} from '../science/calendar';
import {convertUnits} from '../science/units';
import {subsetSchema,type CatalogGranule,type SubsetRecord} from './schemas';
const numeric=(value:unknown):number[]=>{
 const data=typeof value==='number'?[value]:Array.isArray(value)||ArrayBuffer.isView(value)?Array.from(value as ArrayLike<unknown>):[];
 if(!data.length||data.some(v=>typeof v!=='number'||!Number.isFinite(v)))throw new Error('numeric metadata');return data as number[];
};
const scalar=(value:unknown)=>{const a=numeric(value);if(a.length!==1)throw new Error('scalar');return a[0];};
const text=(value:unknown)=>{if(typeof value!=='string')throw new Error('text metadata');return value.replace(/\0/g,'').trim();};
function timeLabel(ds:Dataset,month:string) {
 const units=text(ds.attrs.units?.value),calendar=ds.attrs.calendar?text(ds.attrs.calendar.value):'standard';
 if(!['standard','gregorian','proleptic_gregorian'].includes(calendar))throw new Error('calendar');
 const m=/^(minutes|hours|seconds|days) since (\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?: ?(?:UTC|Z))?$/.exec(units);if(!m)throw new Error('time units');
 const base=Date.parse(m[2]+'T'+m[3]+'Z');if(!Number.isFinite(base)||new Date(base).toISOString().slice(0,10)!==m[2])throw new Error('time epoch');
 const factor=({seconds:1000,minutes:60000,hours:3600000,days:86400000} as Record<string,number>)[m[1]],value=scalar(ds.value);
 const date=new Date(base+value*factor);if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==month+'-01')throw new Error('time month');
 return date.toISOString();
}
export function validateSubset(input:unknown,entry:CatalogGranule,cell:Cell):SubsetRecord {
 const parsed=subsetSchema.safeParse(input);if(!parsed.success)throw new ScienceError('nasa_invalid_data','Cached NASA subset failed schema validation',502);
 const row=parsed.data;
 if(row.month!==entry.month||row.granule_id!==entry.granule_id||row.filename!==entry.filename||row.updated!==entry.updated||!row.time_label.startsWith(entry.month+'-01')||Object.entries(cell).some(([k,v])=>row.cell[k as keyof Cell]!==v))throw new ScienceError('nasa_invalid_data','NASA subset does not match the requested cell or granule',502);
 convertUnits([row.values.T2M],'T2M',row.units.T2M);convertUnits([row.values.QV2M],'QV2M',row.units.QV2M);return row;
}
export async function decodeSubset(bytes:Uint8Array,entry:CatalogGranule,cell:Cell):Promise<SubsetRecord> {
 if(bytes.length>2*1024*1024||Buffer.from(bytes.subarray(0,8)).toString('hex')!=='894844460d0a1a0a')throw new ScienceError('nasa_invalid_format','NASA response is not a bounded NetCDF4/HDF5 subset',502);
 const h=await import('h5wasm');await h.ready;if(!h.FS)throw new ScienceError('nasa_decoder_unavailable','HDF5 memory filesystem unavailable',503);
 const filename='/merra-'+randomUUID()+'.nc4';let file:File|undefined;
 // No await between open/read/close: HDF5 calls are serialized on the JS thread.
 try {
  h.FS.writeFile(filename,bytes);file=new h.File(filename,'r');
  const attrs=file.attrs;
  if(text(attrs.ShortName?.value)!=='M2TMNXSLV'||text(attrs.VersionID?.value)!=='5.12.4'||text(attrs.identifier_product_doi?.value)!=='10.5067/AP1B0BA5PD2K')throw new Error('product');
  const year=+entry.month.slice(0,4),month=+entry.month.slice(5);
  if(text(attrs.RangeBeginningDate?.value)!==entry.month+'-01'||text(attrs.RangeEndingDate?.value)!==entry.month+'-'+daysInMonth(year,month))throw new Error('range');
  const dataset=(name:string,shape:number[])=>{const ds=file!.get(name);if(!(ds instanceof h.Dataset)||JSON.stringify(ds.shape)!==JSON.stringify(shape))throw new Error('shape');return ds;};
  for(const [name,value,unit] of [['lat',cell.latitude,'degrees_north'],['lon',cell.longitude,'degrees_east']] as const){const ds=dataset(name,[1]);if(scalar(ds.value)!==value||text(ds.attrs.units?.value)!==unit)throw new Error('coordinates');}
  const label=timeLabel(dataset('time',[1]),entry.month),values={} as {T2M:number;QV2M:number};
  for(const variable of ['T2M','QV2M'] as const) {
   const ds=dataset(variable,[1,1,1]);
   for(const [i,name] of ['time','lat','lon'].entries()){const scales=ds.get_attached_scales(i);if(scales.length!==1||scales[0].split('/').at(-1)!==name)throw new Error('dimension order');}
   const unit=text(ds.attrs.units?.value);if(unit!==(variable==='T2M'?'K':'kg kg-1'))throw new Error('units');
   const raw=scalar(ds.value);
   for(const name of ['_FillValue','missing_value'])if(ds.attrs[name]&&numeric(ds.attrs[name].value).includes(raw))throw new ScienceError('nasa_missing_data','NASA subset contains fill or missing observations; no imputation',502);
   if(ds.attrs.valid_range){const range=numeric(ds.attrs.valid_range.value);if(range.length!==2||raw<range[0]||raw>range[1])throw new Error('valid range');}
   const scale=ds.attrs.scale_factor?scalar(ds.attrs.scale_factor.value):1,offset=ds.attrs.add_offset?scalar(ds.attrs.add_offset.value):0;
   values[variable]=raw*scale+offset;convertUnits([values[variable]],variable,unit);
  }
  return validateSubset({month:entry.month,cell,values,units:{T2M:'K',QV2M:'kg kg-1'},response_sha256:createHash('sha256').update(bytes).digest('hex'),granule_id:entry.granule_id,filename:entry.filename,updated:entry.updated,time_label:label,dataset:'M2TMNXSLV',version:'5.12.4',doi:'10.5067/AP1B0BA5PD2K'},entry,cell);
 } catch(error){if(error instanceof ScienceError&&error.code==='nasa_missing_data')throw error;throw new ScienceError('nasa_invalid_format','NASA HDF5 product, dimensions, calendar, coordinates, units or values are invalid',502);}
 finally {try{file?.close();}finally{try{h.FS.unlink(filename);}catch{}}}
}
