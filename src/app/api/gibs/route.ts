import {getGibsCatalog} from '@/backend/gibs/catalog';
export const runtime='nodejs';export const maxDuration=30;
export async function GET(){try{return Response.json(await getGibsCatalog(),{headers:{'Cache-Control':'public, max-age=3600, s-maxage=86400'}});}catch{return Response.json({error:'gibs_metadata_unavailable',message:'NASA GIBS временно недоступен. Карта и NASA POWER продолжают работать.'},{status:503,headers:{'Cache-Control':'no-store'}});}}
