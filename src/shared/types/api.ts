import type {z} from 'zod';
import type {pointSchema,resultSchema} from '../schemas/result';
export type Point=z.infer<typeof pointSchema>;
// The selector's raw string is validated by analysisRequest at the HTTP boundary.
export type Query=Point & {variable:string;start_year:number;end_year:number};
export type Result=z.infer<typeof resultSchema>;
export type {Catalog,Health} from '../schemas/catalog';
