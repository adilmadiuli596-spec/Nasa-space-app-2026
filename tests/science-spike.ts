// N1 compatibility adapter; no duplicate scientific algorithm.
import {hacTrend} from '../src/backend/science/inference';
export function spike(years:number[],values:number[]) {
 const r=hacTrend(years,values);
 return {status:r.status,slope:r.slope_per_decade,se:r.standard_error_per_decade,p:r.p_value_two_sided,ci:r.ci95_per_decade?[r.ci95_per_decade.lower,r.ci95_per_decade.upper]:null};
}
