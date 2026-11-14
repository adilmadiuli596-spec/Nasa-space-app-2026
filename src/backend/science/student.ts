import 'server-only';
import {ScienceError} from './errors';
// Regularized incomplete beta: https://dlmf.nist.gov/8.17 ; N2 independently verified against SciPy.
function logGamma(z:number):number {
 const c=[676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
 if(z<0.5) return Math.log(Math.PI)-Math.log(Math.sin(Math.PI*z))-logGamma(1-z);
 z-=1; let a=0.99999999999980993;
 for(let i=0;i<c.length;i++) a+=c[i]/(z+i+1);
 const t=z+7.5;
 return 0.5*Math.log(2*Math.PI)+(z+0.5)*Math.log(t)-t+Math.log(a);
}
function fraction(a:number,b:number,x:number) {
 const floor=1e-300, clamp=(v:number)=>Math.abs(v)<floor?floor:v;
 let c=1,d=1/clamp(1-(a+b)*x/(a+1)),h=d;
 for(let m=1;m<=1000;m++) {
  let aa=m*(b-m)*x/((a+2*m-1)*(a+2*m));
  d=1/clamp(1+aa*d);c=clamp(1+aa/c);h*=d*c;
  aa=-(a+m)*(a+b+m)*x/((a+2*m)*(a+2*m+1));
  d=1/clamp(1+aa*d);c=clamp(1+aa/c);const delta=d*c;h*=delta;
  if(Math.abs(delta-1)<3e-15) return h;
 }
 throw new Error('Incomplete beta did not converge');
}
function beta(x:number,a:number,b:number):number {
 if(x<=0) return 0; if(x>=1) return 1;
 const front=Math.exp(logGamma(a+b)-logGamma(a)-logGamma(b)+a*Math.log(x)+b*Math.log1p(-x));
 return x<(a+1)/(a+b+2)?front*fraction(a,b,x)/a:1-front*fraction(b,a,1-x)/b;
}
export function twoSidedT(t:number,df:number) {
 if(!Number.isFinite(t)||!Number.isInteger(df)||df<1) throw new ScienceError('inference_failed','Invalid Student t parameters',500);
 const squared=t*t;
 return squared<df ? 1-beta(squared/(df+squared),0.5,df/2) : beta(df/(df+squared),df/2,0.5);
}
export function tCritical95(df:number) {
 if(!Number.isInteger(df)||df<1) throw new ScienceError('inference_failed','Invalid Student t degrees of freedom',500);
 let lo=0,hi=16;
 for(let i=0;i<100;i++) {const mid=(lo+hi)/2;if(twoSidedT(mid,df)>0.05)lo=mid;else hi=mid;}
 return (lo+hi)/2;
}
