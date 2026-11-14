import 'server-only';
import data from './demo-data.json';
import {nearestCell} from '../science/coordinates';
import {ScienceError} from '../science/errors';
import {VARIABLES} from '../science/units';
import {digest} from '../cache/memory';
import type {AnalysisRequest} from '@/shared/schemas/analysis';
import type {LoadedSeries} from '@/shared/schemas/science';
export const DEMO_WARNING='Explicit demonstration: preloaded real NASA 1991–2025 snapshots for two grid cells only; not fresh or global dynamic analysis.';
export const demoCells=data.cells.map(c=>({latitude:c.cell.latitude,longitude:c.cell.longitude}));
export function loadDemo(request:AnalysisRequest):LoadedSeries {
 const cell=nearestCell(request.latitude,request.longitude),snapshot=data.cells.find(c=>c.cell.latitude===cell.latitude&&c.cell.longitude===cell.longitude);
 if(!snapshot)throw new ScienceError('demo_cell_unavailable','Demonstration contains only the preserved Pavlodar and Berlin NASA cells',404);
 const start=`${request.start_year}-01`,end=`${request.end_year}-12`,selected=snapshot.rows.filter(r=>r.month>=start&&r.month<=end);
 return {records:selected.map(r=>({month:r.month,value:r.values[request.variable]})),cell,source_unit:VARIABLES[request.variable].source_unit,fill_values:[],timings_ms:{},provenance:{provider:'NASA GES DISC',dataset:'M2TMNXSLV',version:'5.12.4',doi:'10.5067/AP1B0BA5PD2K',mode:'offline_verified_demo',network_used:false,source_id:'n3-preserved-scientific-snapshots',artifact_sha256:{snapshot:digest(snapshot)},granules:selected.map(r=>({...r.granule,retrieval:'preloaded_scientific_snapshot'})),cache_used:false,cache_hits:0,cache_misses:0,catalog_cache_hit:false}};
}
