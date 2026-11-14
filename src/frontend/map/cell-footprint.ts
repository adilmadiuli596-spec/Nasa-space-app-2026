import type {Result} from '@/shared/types/api';
// Display geometry only. The server chooses the cell; this does not choose or average data.
export function cellFootprint(cell:Result['actual_cell']){
 const south=Math.max(-90,cell.latitude-cell.latitude_spacing/2),north=Math.min(90,cell.latitude+cell.latitude_spacing/2),west=cell.longitude-cell.longitude_spacing/2,east=cell.longitude+cell.longitude_spacing/2;
 const spans=west< -180?[[-180,east],[west+360,180]]:east>180?[[west,180],[-180,east-360]]:[[west,east]];
 return {type:'FeatureCollection' as const,features:spans.map(([w,e])=>({type:'Feature' as const,properties:{},geometry:{type:'Polygon' as const,coordinates:[[[w,south],[e,south],[e,north],[w,north],[w,south]]]}}))};
}
