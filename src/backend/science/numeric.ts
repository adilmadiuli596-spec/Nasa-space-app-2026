import 'server-only';
// Neumaier summation reduces dependence on summation order versus binary64 BLAS.
export function sum(values:readonly number[]):number {
  let total=0,correction=0;
  for(const value of values) {const next=total+value;correction+=Math.abs(total)>=Math.abs(value)?(total-next)+value:(value-next)+total;total=next;}
  return total+correction;
}
