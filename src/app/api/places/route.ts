import {searchPlaces,GeographyError} from '@/backend/geography/search';
export const runtime='nodejs';
export const maxDuration=15;
export async function GET(request:Request){
 try{const url=new URL(request.url);return Response.json(await searchPlaces(url.searchParams.get('q')||'',request.signal),{headers:{'cache-control':'no-store'}});}
 catch(error){const e=error instanceof GeographyError?error:new GeographyError('search_unavailable',502);return Response.json({error:{code:e.code}},{status:e.status,headers:{'cache-control':'no-store',...(e.status===429?{'retry-after':'2'}:{})}});}
}
