import {z} from 'zod';
import {resultSchema} from './result';
export const analysisPairSchema=z.strictObject({T2M:resultSchema,QV2M:resultSchema});
export const pairedResponseSchema=z.strictObject({results:analysisPairSchema});
export type AnalysisPair=z.infer<typeof analysisPairSchema>;
