import 'server-only';
import {analysisRequest} from '@/shared/schemas/analysis';
import {resultSchema} from '@/shared/schemas/result';
import {readMonthlyRecords} from '../science/series';
import {convertUnits,VARIABLES} from '../science/units';
import {annualMeans} from '../science/aggregation';
import {hacTrend} from '../science/inference';
import {ScienceError} from '../science/errors';
import {loadPower,POWER_ENDPOINT,type PowerPayload} from './source';
export function powerResult(input:unknown,payload:PowerPayload){
 const request=analysisRequest.parse(input),started=performance.now(),d=payload.document;
 const entries=d.properties.parameter[request.variable];
 // YYYY13 is POWER's annual aggregate. Deliberately use only the twelve monthly means.
 const records=readMonthlyRecords(Object.entries(entries).filter(([k])=>+k.slice(4)<=12&&+k.slice(0,4)>=request.start_year&&+k.slice(0,4)<=request.end_year).sort(([a],[b])=>a.localeCompare(b)).map(([k,value])=>({month:k.slice(0,4)+'-'+k.slice(4),value})),request.start_year,request.end_year,[d.header.fill_value]);
 // Adapt POWER's native C / g/kg into the existing canonical unit validator; no statistical formulas are copied.
 const canonical=records.map(r=>request.variable==='T2M'?r.value+273.15:r.value/1000);
 const values=convertUnits(canonical,request.variable,VARIABLES[request.variable].source_unit);
 const monthly=records.map((r,i)=>({month:r.month,value:values[i]})),annual=annualMeans(monthly);
 const trend=hacTrend(annual.map(r=>r.year),annual.map(r=>r.value)),count=monthly.length;
 const warnings=['NASA POWER monthly point product derived from MERRA2; not the direct GES DISC canonical series or a weather station.','POWER JSON precision and processing differ from direct MERRA-2; canonical MERRA-2 numerical targets do not apply.','POWER response coordinates identify the requested point; exact native grid-cell centre is not exposed.','HAC/t inference is approximate; structural reanalysis uncertainty and multiple testing are not quantified.'];
 if(annual.length<20)warnings.push('Fewer than 20 years: small-sample HAC confidence intervals may be unreliable.');
 if(trend.status!=='estimated')warnings.push('Degenerate series: statistical significance is undefined.');
 const result={requested:request,actual_cell:{latitude:d.geometry.coordinates[1],longitude:d.geometry.coordinates[0],kind:'power_point' as const,latitude_spacing:0.5 as const,longitude_spacing:0.625 as const},source_unit:d.parameters[request.variable].units,unit:VARIABLES[request.variable].unit,trend_unit:VARIABLES[request.variable].trend_unit,
 monthly_series:monthly,annual_series:annual,trend,
 method:{aggregation:'days-in-month weighted annual mean; 12 finite months required',model:'OLS with intercept and centered calendar year',covariance:'HAC/Newey-West',kernel:'bartlett',maxlags:3,use_correction:true,use_t:true,missing_policy:'reject; no imputation or dropping',calendar:'Gregorian',implementation:'earth-detective-typescript-n2',source_adaptation:'NASA POWER monthly C/g/kg normalized through canonical unit validator; YYYY13 excluded; LST'},
 quality:{expected_months:count,actual_months:count,missing_months:0,missing_values:0,complete_years:annual.length,physical_screening_passed:true,upstream_monthly_values_checked:840,upstream_annual_values_used:false},
 provenance:{provider:'NASA POWER',dataset:'POWER_MONTHLY_POINT' as const,version:d.header.api.version.replace(/^v/,''),doi:null,mode:'nasa_power',network_used:!payload.cache_hit,source_id:'nasa-power-monthly-point',artifact_sha256:{power_response:payload.sha256},granules:[],cache_used:payload.cache_hit,cache_hits:payload.cache_hit?count:0,cache_misses:payload.cache_hit?0:count,catalog_cache_hit:false,endpoint:POWER_ENDPOINT,request_url:payload.request_url,fetched_at:payload.fetched_at,time_standard:d.header.time_standard,upstream_sources:d.header.sources,native_source_unit:d.parameters[request.variable].units,coordinate_policy:'POWER returned request point, not a verified native grid-cell centre',retrieval:payload.cache_hit?'server_memory_cache':'direct_nasa_power_request'},warnings,timings_ms:{statistical_calculation:performance.now()-started}};
 const parsed=resultSchema.safeParse(result);if(!parsed.success)throw new ScienceError('invalid_result','NASA POWER result failed validation',500);return parsed.data;
}
export async function analyzePower(input:unknown,signal:AbortSignal){const request=analysisRequest.parse(input);return powerResult(request,await loadPower(request,signal));}

export async function analyzePowerPair(input:unknown,signal:AbortSignal,loader:typeof loadPower=loadPower){const request=analysisRequest.parse(input),payload=await loader(request,signal);return {T2M:powerResult({...request,variable:'T2M'},payload),QV2M:powerResult({...request,variable:'QV2M'},payload)};}
