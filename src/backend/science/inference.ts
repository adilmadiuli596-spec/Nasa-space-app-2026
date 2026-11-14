import 'server-only';
import {fitOLS} from './ols';
import {hacCovariance} from './hac';
import {twoSidedT,tCritical95} from './student';
import {ScienceError} from './errors';
import type {Result} from '@/shared/types/api';
export function hacTrend(years:readonly number[],values:readonly number[]):Result['trend'] {
  const fit=fitOLS(years,values),tolerance=64*Number.EPSILON*Math.max(1,...values.map(Math.abs));
  const common={fitted_values:fit.fitted,n_years:fit.n,residual_degrees_of_freedom:fit.n-2,alpha:0.05 as const,hac_maxlags:3 as const,multiple_testing_correction:'none' as const};
  if(Math.max(...values)-Math.min(...values)<=tolerance) return {...common,status:'constant_series',slope_per_decade:0,standard_error_per_decade:null,p_value_two_sided:null,ci95_per_decade:null,significant:null,r_squared:null};
  if(Math.max(...fit.residual.map(Math.abs))<=tolerance) return {...common,status:'zero_residual_variance',slope_per_decade:fit.slope*10,standard_error_per_decade:null,p_value_two_sided:null,ci95_per_decade:null,significant:null,r_squared:1};
  const slope=fit.slope*10,se=Math.sqrt(hacCovariance(fit,3)[1][1])*10;
  const p=twoSidedT(slope/se,fit.n-2),critical=tCritical95(fit.n-2);
  const lower=slope-critical*se,upper=slope+critical*se,r2=1-fit.sse/fit.sst;
  if(![slope,se,p,lower,upper,r2].every(Number.isFinite)||se<=0||p<0||p>1) throw new ScienceError('inference_failed','HAC inference produced invalid numerical results',500);
  return {...common,status:'estimated',slope_per_decade:slope,standard_error_per_decade:se,p_value_two_sided:p,ci95_per_decade:{lower,upper},significant:p<0.05,r_squared:r2};
}
