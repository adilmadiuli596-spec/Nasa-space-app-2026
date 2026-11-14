import 'server-only';
import {z} from 'zod';
import {cellSchema} from '@/shared/schemas/result';
export const granuleSchema=z.strictObject({month:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),granule_id:z.string().regex(/^G\d+-GES_DISC$/),filename:z.string().regex(/^MERRA2_\d{3}\.tavgM_2d_slv_Nx\.\d{6}\.nc4$/),opendap:z.string(),updated:z.string().refine(s=>Number.isFinite(Date.parse(s)))});
export type CatalogGranule=z.infer<typeof granuleSchema>;
export const subsetSchema=z.strictObject({month:z.string(),cell:cellSchema,values:z.strictObject({T2M:z.number().finite(),QV2M:z.number().finite()}),units:z.strictObject({T2M:z.literal('K'),QV2M:z.literal('kg kg-1')}),response_sha256:z.string().regex(/^[0-9a-f]{64}$/),granule_id:z.string(),filename:z.string(),updated:z.string(),time_label:z.string(),dataset:z.literal('M2TMNXSLV'),version:z.literal('5.12.4'),doi:z.literal('10.5067/AP1B0BA5PD2K')});
export type SubsetRecord=z.infer<typeof subsetSchema>;
