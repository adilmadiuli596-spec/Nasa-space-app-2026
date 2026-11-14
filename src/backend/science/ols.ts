import 'server-only';
import {ScienceError} from './errors';
import {sum} from './numeric';
export function fitOLS(years:readonly number[],values:readonly number[]) {
  const n=values.length;
  if(n<5||years.length!==n||!years.every(v=>typeof v==='number'&&Number.isFinite(v))||!values.every(v=>typeof v==='number'&&Number.isFinite(v))) throw new ScienceError('insufficient_years','At least 5 finite consecutive annual observations are required');
  if(years.some((v,i)=>!Number.isInteger(v)||(i>0&&v!==years[i-1]+1))) throw new ScienceError('nonconsecutive_years','HAC lags require consecutive integer calendar years');
  const meanYear=sum(years)/n,meanValue=sum(values)/n,x=years.map(v=>v-meanYear);
  const sxx=sum(x.map(v=>v*v)),slope=sum(x.map((v,i)=>v*(values[i]-meanValue)))/sxx;
  const fitted=x.map(v=>meanValue+slope*v),residual=values.map((v,i)=>v-fitted[i]);
  const sse=sum(residual.map(v=>v*v)),sst=sum(values.map(v=>(v-meanValue)**2));
  if(![meanValue,slope,sxx,sse,sst,...fitted].every(Number.isFinite)||sxx<=0) throw new ScienceError('inference_failed','OLS produced invalid numerical results',500);
  return {n,meanYear,intercept:meanValue,slope,x,sxx,fitted,residual,sse,sst};
}
export type OLSFit=ReturnType<typeof fitOLS>;
