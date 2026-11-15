import type {Result} from '../api';
export type AnnualChartInput={annual_series:readonly {year:number;value:number}[];trend:{fitted_values:readonly number[]}};
export type AnnualChartRow={year:number;A:number|null;ATrend:number|null;B:number|null;BTrend:number|null};
export function matchingChartResult(r:Result|null|undefined,variable:'T2M'|'QV2M',start:number,end:number){return r&&r.requested.variable===variable&&r.requested.start_year===start&&r.requested.end_year===end?r:null;}
// Join by real calendar year, retaining gaps. Fitted values already come from the backend.
export function buildAnnualChartRows(a:AnnualChartInput|null,b:AnnualChartInput|null,start:number,end:number):AnnualChartRow[]{
 if(!Number.isInteger(start)||!Number.isInteger(end)||end<start||end-start>200)return [];
 const index=(r:AnnualChartInput|null)=>new Map(r?.annual_series.map((p,i)=>[p.year,{value:Number.isFinite(p.value)?p.value:null,fit:Number.isFinite(r.trend.fitted_values[i])?r.trend.fitted_values[i]:null}])??[]);
 const aa=index(a),bb=index(b);return Array.from({length:end-start+1},(_,i)=>{const year=start+i,x=aa.get(year),y=bb.get(year);return {year,A:x?.value??null,ATrend:x?.fit??null,B:y?.value??null,BTrend:y?.fit??null};});
}
