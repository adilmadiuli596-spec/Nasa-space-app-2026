import { z } from 'zod';
import {pointSchema} from './coordinates';
export const analysisRequest = pointSchema.extend({
  variable:z.enum(['T2M','QV2M']), start_year:z.number().int().min(1991).max(2025).default(1991),
  end_year:z.number().int().min(1991).max(2025).default(2025)
}).refine(x=>x.end_year-x.start_year>=4,{message:'At least 5 complete calendar years are required'});
export type AnalysisRequest = z.infer<typeof analysisRequest>;
