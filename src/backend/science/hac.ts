import 'server-only';
import type {OLSFit} from './ols';
import {ScienceError} from './errors';
import {sum} from './numeric';
// Separate sensitivity helper; the primary scientific result always uses lag 3.
export function hacCovariance(fit:OLSFit,maxlags=3):[[number,number],[number,number]] {
  if(!Number.isInteger(maxlags)||maxlags<0||maxlags>=fit.n-1) throw new ScienceError('invalid_hac_lags','HAC lag must be an integer below n-1');
  const z=fit.residual.map((e,i)=>[e,e*fit.x[i]]);
  const meat=[[0,0],[0,0]];
  for(let a=0;a<2;a++) for(let b=0;b<2;b++) {
    meat[a][b]=sum(z.map(r=>r[a]*r[b]));
    for(let lag=1;lag<=maxlags;lag++) meat[a][b]+=(1-lag/(maxlags+1))*sum(z.slice(lag).map((r,i)=>r[a]*z[i][b]+r[b]*z[i][a]));
  }
  const bread=[1/fit.n,1/fit.sxx],correction=fit.n/(fit.n-2);
  const covariance=meat.map((row,a)=>row.map((v,b)=>v*bread[a]*bread[b]*correction)) as [[number,number],[number,number]];
  if(covariance.flat().some(v=>!Number.isFinite(v))) throw new ScienceError('inference_failed','HAC covariance produced invalid numerical results',500);
  return covariance;
}
