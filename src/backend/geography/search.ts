import 'server-only';
import {boundsSchema,placesSchema,type Place} from '@/shared/schemas/geography';
export class GeographyError extends Error{constructor(public code:string,public status:number){super(code);}}
const clean=(x:unknown,max=180)=>typeof x==='string'?x.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,max):'';
export function parsePlaces(input:unknown){
 const data=input as {type?:string;features?:unknown[]};if(data?.type!=='FeatureCollection'||!Array.isArray(data.features)||data.features.length>30)throw new GeographyError('invalid_geography',502);
 const places:Place[]=[];
 for(const feature of data.features){
  const f=feature as {geometry?:{type?:string;coordinates?:number[]};properties?:Record<string,unknown>},p=f?.properties;
  if(!p||f.geometry?.type!=='Point'||!Array.isArray(f.geometry.coordinates))continue;
  const [longitude,latitude]=f.geometry.coordinates,name=clean(p.name);if(!name)continue;
  const type=clean(p.type)||clean(p.osm_value),kind=['country','state','county','district','region','administrative'].includes(type)?'area':'city';
  if(!['country','state','county','district','region','administrative','city','town','village','hamlet','locality','municipality'].includes(type))continue;
  if(kind==='area')continue;
  const extent=p.extent as number[]|undefined;
  const parsed=Array.isArray(extent)&&extent.length===4?boundsSchema.safeParse([extent[0],extent[3],extent[2],extent[1]]):null;
  const place={id:clean(`${p.osm_type||''}:${p.osm_id||places.length}`,100),name,detail:[...new Set([clean(p.state),clean(p.country)].filter(x=>x&&x!==name))].join(', ').slice(0,240),latitude,longitude,kind,bounds:parsed?.success?parsed.data:null};
  const checked=placesSchema.shape.places.element.safeParse(place);if(checked.success&&!places.some(v=>v.id===checked.data.id))places.push(checked.data);if(places.length===5)break;
 }
 return placesSchema.parse({provider:'Photon / OpenStreetMap',places});
}
export function createGeographySearch(fetcher:typeof fetch=fetch,now:()=>number=Date.now){
 const cache=new Map<string,{until:number;value:ReturnType<typeof parsePlaces>}>();let active=false,last=-Infinity;
 return async(query:string,signal:AbortSignal)=>{
  const q=query.trim().replace(/\s+/g,' ');if(q.length<2||q.length>100||/[\u0000-\u001f\u007f]/.test(q))throw new GeographyError('invalid_search',400);
  if(process.env.EARTH_GEOCODING==='off')throw new GeographyError('search_disabled',503);
  const key=q.toLocaleLowerCase(),hit=cache.get(key);if(hit&&hit.until>now()){cache.delete(key);cache.set(key,hit);return hit.value;}
  if(active||now()-last<1200)throw new GeographyError('search_busy',429);
  active=true;last=now();
  try{
   const url=new URL('https://photon.komoot.io/api/');url.searchParams.set('q',q);url.searchParams.set('limit','5');url.searchParams.set('lang','en');for(const layer of ['city','locality'])url.searchParams.append('layer',layer);
   const response=await fetcher(url,{signal:AbortSignal.any([signal,AbortSignal.timeout(10000)]),redirect:'error',headers:{accept:'application/json','user-agent':'EarthDetective/0.1 (interactive place search)'},cache:'no-store'});
   if(!response.ok)throw new GeographyError(response.status===429?'search_busy':'search_unavailable',response.status===429?429:502);
   const reader=response.body?.getReader();if(!reader)throw new GeographyError('invalid_geography',502);let size=0;const chunks:Uint8Array[]=[];
   try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>512*1024)throw new GeographyError('invalid_geography',502);chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
   const bytes=Buffer.concat(chunks),value=parsePlaces(JSON.parse(bytes.toString('utf8')));cache.set(key,{value,until:now()+24*60*60*1000});while(cache.size>64)cache.delete(cache.keys().next().value!);return value;
  }catch(e){if(e instanceof GeographyError)throw e;throw new GeographyError('search_unavailable',502);}finally{active=false;}
 };
}
export const searchPlaces=createGeographySearch();
