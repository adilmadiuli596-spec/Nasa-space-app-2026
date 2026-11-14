import {variables} from '@/backend/services/catalog';
export const runtime='nodejs';
export async function GET() { return Response.json(variables()); }
