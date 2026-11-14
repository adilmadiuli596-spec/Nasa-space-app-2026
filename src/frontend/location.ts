import {pointSchema} from '@/shared/schemas/coordinates';
import type {Point} from '@/shared/types/api';
export const places=[
 {name:'Павлодар',aliases:['павлодар','pavlodar'],latitude:52.27601,longitude:76.96881},
 {name:'Берлин',aliases:['берлин','berlin'],latitude:52.52,longitude:13.405},
 {name:'Токио',aliases:['токио','tokyo','tokio'],latitude:35.68,longitude:139.69}
] as const;
export function findLocation(query:string):Point|null {
 const text=query.trim().toLowerCase(),place=places.find(p=>p.aliases.some(a=>a===text));
 if(place)return {latitude:place.latitude,longitude:place.longitude};
 return parseCoordinates(text);
}
export function parseCoordinates(text:string):Point|null{
 text=text.trim();
 const parts=text.trim().includes(';')?text.split(';').map(s=>s.trim().replace(',','.')):text.split(/[,\s]+/);
 if(parts.length!==2||parts.some(s=>!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)))return null;
 const point=pointSchema.safeParse({latitude:Number(parts[0]),longitude:Number(parts[1])});return point.success?point.data:null;
}

