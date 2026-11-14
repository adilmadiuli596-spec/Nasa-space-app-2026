import {z} from 'zod';
import {pointSchema} from './coordinates';
export const healthSchema=z.object({status:z.literal('ok'),stage:z.string(),mode:z.enum(['blocked','local','demo','power']),nasa_network:z.string(),earthdata_auth:z.string(),dynamic_nasa_enabled:z.boolean(),public_dynamic_access_confirmed:z.boolean(),cache:z.enum(['memory','file']),analysis:z.string()});
export const catalogSchema=z.object({variables:z.array(z.object({id:z.enum(['T2M','QV2M']),name:z.string(),source_unit:z.string(),unit:z.string(),trend_unit:z.string()})).min(1),supported_period:z.object({start_year:z.number().int(),end_year:z.number().int(),minimum_complete_years:z.number().int().min(5)}),source_mode:z.enum(['offline_verified_demo','nasa_opendap_local','public_access_blocked','nasa_power']),dynamic_nasa_enabled:z.boolean(),available_cells:z.array(pointSchema).nullable(),coverage:z.string(),coordinate_policy:z.string(),public_dynamic_access_confirmed:z.boolean()});
export type Health=z.infer<typeof healthSchema>;
export type Catalog=z.infer<typeof catalogSchema>;
