import {analyze} from '@/backend/services/analysis';
import {createAnalysisHandler} from '@/backend/services/http';
export const runtime='nodejs';
export const maxDuration=300;
export const POST=createAnalysisHandler(analyze);
