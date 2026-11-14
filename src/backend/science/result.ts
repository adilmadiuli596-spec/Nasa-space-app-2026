import 'server-only';
import {analysisRequest} from '@/shared/schemas/analysis';
import {loadedSeriesSchema} from '@/shared/schemas/science';
import {resultSchema} from '@/shared/schemas/result';
import {nearestCell} from './coordinates';
import {readMonthlyRecords} from './series';
import {convertUnits,VARIABLES} from './units';
import {annualMeans} from './aggregation';
import {hacTrend} from './inference';
import {ScienceError} from './errors';

/** Pure computation over decoded observations. No network, filesystem, cache or API integration. */
export function scientificResult(requestInput:unknown,loadedInput:unknown) {
  const started=performance.now();
  const parsedRequest=analysisRequest.safeParse(requestInput),parsedLoaded=loadedSeriesSchema.safeParse(loadedInput);
  if(!parsedRequest.success) throw new ScienceError('invalid_request','Invalid analysis request');
  if(!parsedLoaded.success) throw new ScienceError('invalid_source_metadata','Source metadata failed validation',503);
  const request=parsedRequest.data,loaded=parsedLoaded.data,cell=nearestCell(request.latitude,request.longitude);
  if(Object.entries(cell).some(([key,value])=>loaded.cell[key as keyof typeof cell]!==value)) throw new ScienceError('coordinate_mismatch','Source returned a different cell than requested',503);
  const raw=readMonthlyRecords(loaded.records,request.start_year,request.end_year,loaded.fill_values);
  const granules=loaded.provenance.granules;
  if(!loaded.provenance.source_id||!loaded.provenance.provider||granules.length!==raw.length||granules.some((g,i)=>g.month!==raw[i].month||!/^G\d+-GES_DISC$/.test(g.granule_id)||!g.filename.endsWith('.'+g.month.replace('-','')+'.nc4')||!g.retrieval||!/^[0-9a-f]{64}$/.test(g.sha256))||Object.values(loaded.provenance.artifact_sha256).some(hash=>!/^[0-9a-f]{64}$/.test(hash))) throw new ScienceError('invalid_source_metadata','Granule provenance does not match the monthly series',503);
  const values=convertUnits(raw.map(r=>r.value),request.variable,loaded.source_unit);
  const monthly=raw.map((r,i)=>({month:r.month,value:values[i]})),annual=annualMeans(monthly);
  const trend=hacTrend(annual.map(r=>r.year),annual.map(r=>r.value)),spec=VARIABLES[request.variable];
  const warnings=[
    'MERRA-2 grid-cell reanalysis; not a city weather station. No independent station validation.',
    'HAC/t inference is approximate; reanalysis structural uncertainty is not quantified.'
  ];
  if(loaded.provenance.mode==='local_verified_reference') warnings.push('Stage 3B: local verified Pavlodar reference only; no dynamic NASA access.');
  if(annual.length<20) warnings.push('Fewer than 20 years: small-sample HAC confidence intervals may be unreliable.');
  if(trend.status!=='estimated') warnings.push('Degenerate annual series: p-value, confidence interval and significance are undefined, not zero.');
  const output={requested:request,actual_cell:cell,source_unit:loaded.source_unit,unit:spec.unit,trend_unit:spec.trend_unit,
    monthly_series:monthly,annual_series:annual,trend,
    method:{aggregation:'days-in-month weighted annual mean; 12 finite months required',model:'OLS with intercept and centered calendar year',covariance:'HAC/Newey-West',kernel:'bartlett',maxlags:3,use_correction:true,use_t:true,missing_policy:'reject; no imputation or dropping',calendar:'Gregorian',implementation:'earth-detective-typescript-n2',arithmetic:'IEEE-754 binary64; Neumaier summation; Lanczos/continued-fraction Student t'},
    quality:{expected_months:(request.end_year-request.start_year+1)*12,actual_months:monthly.length,missing_months:0,missing_values:0,complete_years:annual.length,physical_screening_passed:true},
    provenance:loaded.provenance,warnings,timings_ms:{...loaded.timings_ms,statistical_calculation:performance.now()-started}};
  const parsed=resultSchema.safeParse(output);
  if(!parsed.success) throw new ScienceError('invalid_result','Scientific result failed output validation',500);
  return parsed.data;
}
