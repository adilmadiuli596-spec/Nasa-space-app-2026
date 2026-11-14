import 'server-only';
import type {GibsCatalog} from '@/shared/types/gibs';
export const LAYER='MERRA2_2m_Air_Temperature_Monthly' as const;
const ROOT='https://gibs.earthdata.nasa.gov';
export const WMTS3857=ROOT+'/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml';
export const WMTS4326=ROOT+'/wmts/epsg4326/best/1.0.0/WMTSCapabilities.xml';
export const COLORMAP=ROOT+'/colormaps/v1.3/'+LAYER+'.xml';
const attr=(s:string,key:string)=>s.match(new RegExp('(?:^|\\s)'+key+'="([^"]*)"'))?.[1];
function layer(xml:string){const found=[...xml.matchAll(/<Layer\b[^>]*>[\s\S]*?<\/Layer>/g)].find(m=>m[0].includes('<ows:Identifier>'+LAYER+'</ows:Identifier>'));if(!found)throw new Error('GIBS layer missing');return found[0];}
/** Only canonical monthly dates advertised by BOTH projections are usable. No nearest-month substitution. */
export function expandMonthly(values:string[]):{dates:string[];excluded:number}{const dates=new Set<string>();let excluded=0;for(const v of values){const m=v.match(/^(\d{4})-(\d{2})-(\d{2})\/(\d{4})-(\d{2})-(\d{2})\/P1M$/);if(!m)throw new Error('Unsupported GIBS time interval');const [,ys,ms,ds,ye,me,de]=m;if(ds!=='01'||de!=='01'){excluded++;continue;}let a=Number(ys)*12+Number(ms)-1,b=Number(ye)*12+Number(me)-1;if(a>b||b-a>2400||+ms<1||+ms>12||+me<1||+me>12)throw new Error('Invalid monthly interval');for(;a<=b;a++)dates.add(Math.floor(a/12)+'-'+String(a%12+1).padStart(2,'0')+'-01');}return{dates:[...dates].sort(),excluded};}
export function parseCatalog(mercator:string,geographic:string,colormap:string,checkedAt=new Date().toISOString()):GibsCatalog{
 const a=layer(mercator),b=layer(geographic),times=(s:string)=>[...s.matchAll(/<Value>([^<]+)<\/Value>/g)].map(m=>m[1]);
 if(!a.includes('<Format>image/png</Format>')||!a.includes('<TileMatrixSet>GoogleMapsCompatible_Level6</TileMatrixSet>')||!b.includes('<TileMatrixSet>2km</TileMatrixSet>'))throw new Error('Unexpected GIBS matrix or format');
 const ma=expandMonthly(times(a)),mb=new Set(expandMonthly(times(b)).dates),dates=ma.dates.filter(d=>mb.has(d));if(!dates.length)throw new Error('No GIBS months');
 const cm=colormap.match(/<ColorMap title="Air Temperature" units="K">([\s\S]*?)<\/ColorMap>/)?.[1];if(!cm)throw new Error('Unexpected temperature units');
 const entries=[...cm.matchAll(/<ColorMapEntry\b([^>]+)\/>/g)],colors=entries.map(m=>{const rgb=attr(m[1],'rgb');if(!rgb||!/^\d{1,3},\d{1,3},\d{1,3}$/.test(rgb)||rgb.split(',').some(v=>+v>255))throw new Error('Invalid NASA palette');return 'rgb('+rgb+')';});if(colors.length<2)throw new Error('Empty palette');
 const ticks=[...cm.matchAll(/<LegendEntry\b([^>]+)\/>/g)].filter(m=>attr(m[1],'showLabel')==='true').map(m=>{const kelvin=Number(attr(m[1],'label')),id=Number(attr(m[1],'id'));if(!Number.isFinite(kelvin)||!Number.isInteger(id)||id<1||id>colors.length)throw new Error('Invalid legend');return{kelvin,celsius:Math.round((kelvin-273.15)*100)/100,position:(id-1)/(colors.length-1)};});
 // Endpoint limits come from official sourceValue intervals, never from sampled tile pixels.
 const first=attr(entries[0][1],'sourceValue')?.match(/^\[-INF,(\d+)\)$/),last=attr(entries.at(-1)![1],'sourceValue')?.match(/^\[(\d+),\+INF\)$/);if(!first||!last)throw new Error('Unexpected legend endpoints');
 ticks.unshift({kelvin:+first[1],celsius:+first[1]-273.15,position:0});ticks.push({kelvin:+last[1],celsius:+last[1]-273.15,position:1});
 const advertised=a.match(/<Default>([^<]+)<\/Default>/)?.[1];
 return{layer:LAYER,dates,defaultDate:advertised&&dates.includes(advertised)?advertised:dates.at(-1)!,checkedAt,colors,ticks,sourceUnit:'K',displayUnit:'°C',crs:'EPSG:3857',matrixSet:'GoogleMapsCompatible_Level6',maxZoom:6,polarLimit:85.0511287798066,capabilitiesUrl:WMTS3857,colorMapUrl:COLORMAP,legendUrl:ROOT+'/legends/'+LAYER+'_H.svg',excludedNonMonthlyDates:ma.excluded};
}
async function xml(url:string){const r=await fetch(url,{signal:AbortSignal.timeout(20000),cache:'no-store'});if(!r.ok)throw new Error('NASA metadata unavailable');const reader=r.body?.getReader();if(!reader)throw new Error('Empty NASA metadata');const chunks:Uint8Array[]=[];let size=0;try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>7_000_000)throw new Error('NASA metadata too large');chunks.push(part.value);}}finally{await reader.cancel();}return Buffer.concat(chunks).toString('utf8');}
let cached:{catalog:GibsCatalog;until:number}|undefined,inflight:Promise<GibsCatalog>|undefined;
export async function getGibsCatalog():Promise<GibsCatalog>{if(cached&&Date.now()<cached.until)return cached.catalog;if(inflight)return inflight;inflight=Promise.all([xml(WMTS3857),xml(WMTS4326),xml(COLORMAP)]).then(([a,b,c])=>{const catalog=parseCatalog(a,b,c);cached={catalog,until:Date.now()+86400000};return catalog;}).finally(()=>{inflight=undefined;});return inflight;}
