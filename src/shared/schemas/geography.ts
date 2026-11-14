import {z} from 'zod';
import {pointSchema} from './coordinates';
export const boundsSchema=z.tuple([z.number().min(-180).max(180),z.number().min(-90).max(90),z.number().min(-180).max(180),z.number().min(-90).max(90)]).refine(([w,s,e,n])=>w<e&&s<n&&e-w<=180,'Invalid or antimeridian bounds');
export type Bounds=z.infer<typeof boundsSchema>;
export const placeSchema=pointSchema.extend({id:z.string().max(100),name:z.string().min(1).max(180),detail:z.string().max(240),kind:z.enum(['city','area']),bounds:boundsSchema.nullable()});
export const placesSchema=z.object({provider:z.literal('Photon / OpenStreetMap'),places:z.array(placeSchema).max(5)});
export type Place=z.infer<typeof placeSchema>;
