import 'server-only';
import type {z} from 'zod';
import type {cellSchema} from '@/shared/schemas/result';
export type Cell=z.infer<typeof cellSchema>;
