import {z} from 'zod';
import {cellSchema,merraProvenanceSchema} from './result';
export const loadedSeriesSchema=z.strictObject({
 records:z.array(z.strictObject({month:z.string(),value:z.unknown()})),cell:cellSchema,source_unit:z.string(),
 fill_values:z.array(z.number().finite()).default([]),provenance:merraProvenanceSchema,
 timings_ms:z.record(z.string(),z.number().finite().nonnegative()).default({})
});
export type LoadedSeries=z.infer<typeof loadedSeriesSchema>;
