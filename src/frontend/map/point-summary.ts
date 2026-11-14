import type {Result} from '@/shared/types/api';
import type {PointSummary} from '@/shared/types/map';
// Display an existing API value. No aggregation, interpolation or inference here.
export function pointSummary(result:Result|null,title:string):PointSummary|undefined{
 if(!result)return undefined;
 const year=result.requested.end_year,row=result.annual_series.find(r=>r.year===year);
 return {title,year,variable:result.requested.variable,value:row&&Number.isFinite(row.value)?row.value:null,unit:result.requested.variable==='T2M'?'°C':'г/кг'};
}
