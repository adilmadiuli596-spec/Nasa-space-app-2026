export type Point = { latitude: number; longitude: number }
export type Query = Point & { variable: string; start_year: number; end_year: number }
export type Catalog = {variables: { id:string; name:string; unit:string }[]; supported_period:{start_year:number;end_year:number;minimum_complete_years:number}}
export type Result = {
 requested:Query; actual_cell:Point; unit:string; trend_unit:string;
 annual_series:{year:number;value:number}[];
 trend:{fitted_values:number[];slope_per_decade:number;p_value_two_sided:number|null;ci95_per_decade:{lower:number;upper:number}|null;significant:boolean|null;alpha:number};
 provenance:{provider:string;dataset:string;version:string;doi:string;mode:string;network_used:boolean;cache_hits:number;cache_misses:number};
 warnings:string[]
}
export async function api<T>(path:string, options?:RequestInit):Promise<T>{
 const response=await fetch('/api/'+path, options)
 if(!response.ok){
   const body=await response.json().catch(()=>null)
   throw new Error(body?.error?.message || ('Backend недоступен (HTTP '+response.status+')'))
 }
 return response.json()
}
export const names:Record<string,string>={T2M:'Температура воздуха',QV2M:'Удельная влажность'}
