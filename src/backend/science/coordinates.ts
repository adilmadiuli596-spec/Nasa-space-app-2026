import 'server-only';
import {pointSchema} from '@/shared/schemas/coordinates';
import {ScienceError} from './errors';
export function nearestCell(latitude:number,longitude:number) {
  if(!pointSchema.safeParse({latitude,longitude}).success) throw new ScienceError('invalid_coordinates','Latitude/longitude are outside geographic bounds');
  let latitude_index=0,longitude_index=0,latDistance=Infinity,lonDistance=Infinity;
  // Scan exactly like numpy.argmin: strict improvement preserves lower-index ties.
  for(let i=0;i<361;i++) {const d=Math.abs(-90+i*0.5-latitude);if(d<latDistance){latDistance=d;latitude_index=i;}}
  for(let j=0;j<576;j++) {const d=Math.abs((((-180+j*0.625-longitude+180)%360)+360)%360-180);if(d<lonDistance){lonDistance=d;longitude_index=j;}}
  return {latitude:-90+latitude_index*0.5,longitude:-180+longitude_index*0.625,latitude_index,longitude_index,latitude_spacing:0.5 as const,longitude_spacing:0.625 as const};
}
