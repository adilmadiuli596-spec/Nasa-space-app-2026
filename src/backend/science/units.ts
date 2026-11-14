import 'server-only';
import {ScienceError} from './errors';
export const VARIABLES={
  T2M:{source_unit:'K',unit:'°C',trend_unit:'°C/decade',lower:180,upper:330},
  QV2M:{source_unit:'kg kg-1',unit:'g/kg',trend_unit:'(g/kg)/decade',lower:0,upper:0.1}
} as const;
export type Variable=keyof typeof VARIABLES;
export function convertUnits(values:readonly number[],variable:Variable,sourceUnit:string):number[] {
  const spec=VARIABLES[variable];
  if(!spec) throw new ScienceError('invalid_variable','Unsupported NASA variable');
  if(sourceUnit!==spec.source_unit) throw new ScienceError('invalid_units','Source units do not match the NASA variable');
  if(!values.every(v=>typeof v==='number'&&Number.isFinite(v))) throw new ScienceError('missing_values','Non-finite or missing monthly values; no imputation is allowed');
  if(values.some(v=>v<spec.lower||v>spec.upper)) throw new ScienceError('implausible_values','Monthly values exceed broad physical screening bounds');
  return values.map(v=>variable==='T2M'?v-273.15:v*1000);
}
