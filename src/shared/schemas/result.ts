import {z} from 'zod';
import {analysisRequest} from './analysis';
import {pointSchema} from './coordinates';
export {pointSchema} from './coordinates';
const finite=z.number().finite();
const publicSourceUrl=z.string().url().refine(value=>{
 try {const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.search&&!url.hash;}
 catch {return false;}
},{message:'Source URL must be public HTTPS without credentials or query parameters'});
export const cellSchema=pointSchema.extend({latitude_index:z.number().int().min(0).max(360),longitude_index:z.number().int().min(0).max(575),latitude_spacing:z.literal(0.5),longitude_spacing:z.literal(0.625)});
export const merraProvenanceSchema=z.strictObject({provider:z.string(),dataset:z.literal('M2TMNXSLV'),version:z.literal('5.12.4'),doi:z.literal('10.5067/AP1B0BA5PD2K'),mode:z.string(),network_used:z.boolean(),source_id:z.string(),artifact_sha256:z.record(z.string(),z.string()),granules:z.array(z.strictObject({month:z.string(),granule_id:z.string(),filename:z.string(),retrieval:z.string(),sha256:z.string(),url:publicSourceUrl.nullable()})),cache_used:z.boolean(),cache_hits:z.number().int().nonnegative(),cache_misses:z.number().int().nonnegative(),catalog_cache_hit:z.boolean()});

export const powerCellSchema=pointSchema.extend({kind:z.literal('power_point'),latitude_spacing:z.literal(0.5),longitude_spacing:z.literal(0.625)});
export const powerProvenanceSchema=merraProvenanceSchema.omit({dataset:true,version:true,doi:true,mode:true,granules:true}).extend({provider:z.literal('NASA POWER'),dataset:z.literal('POWER_MONTHLY_POINT'),version:z.string().min(1),doi:z.null(),mode:z.literal('nasa_power'),granules:z.array(z.never()).length(0),endpoint:z.literal('https://power.larc.nasa.gov/api/temporal/monthly/point'),request_url:z.string().url().refine(value=>{try{const u=new URL(value);return u.origin==='https://power.larc.nasa.gov'&&u.pathname==='/api/temporal/monthly/point'&&!u.username&&!u.password&&!u.hash&&[...u.searchParams.keys()].every(k=>['parameters','community','latitude','longitude','start','end','format'].includes(k));}catch{return false;}}),fetched_at:z.string().datetime(),time_standard:z.literal('LST'),upstream_sources:z.array(z.string()),native_source_unit:z.enum(['C','g/kg']),coordinate_policy:z.string(),retrieval:z.enum(['server_memory_cache','direct_nasa_power_request'])});
export const provenanceSchema=z.union([merraProvenanceSchema,powerProvenanceSchema]);
export const resultSchema=z.strictObject({
 requested:analysisRequest,actual_cell:z.union([cellSchema,powerCellSchema]),source_unit:z.string(),unit:z.string(),trend_unit:z.string(),
 monthly_series:z.array(z.strictObject({month:z.string(),value:finite})),
 annual_series:z.array(z.strictObject({year:z.number().int(),value:finite,months:z.literal(12),days:z.number().int()})),
 trend:z.strictObject({fitted_values:z.array(finite),status:z.enum(['estimated','constant_series','zero_residual_variance']),slope_per_decade:finite,standard_error_per_decade:finite.nullable(),p_value_two_sided:finite.min(0).max(1).nullable(),ci95_per_decade:z.strictObject({lower:finite,upper:finite}).nullable(),significant:z.boolean().nullable(),alpha:z.literal(0.05),r_squared:finite.nullable(),n_years:z.number().int(),residual_degrees_of_freedom:z.number().int(),hac_maxlags:z.literal(3),multiple_testing_correction:z.literal('none')}),
 method:z.record(z.string(),z.union([z.string(),z.number(),z.boolean()])),quality:z.record(z.string(),z.union([z.string(),z.number(),z.boolean()])),
 provenance:provenanceSchema,warnings:z.array(z.string()),timings_ms:z.record(z.string(),finite)
});
