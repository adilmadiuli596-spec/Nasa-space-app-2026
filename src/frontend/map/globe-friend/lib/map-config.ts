import type {CameraState} from '../types/map.types';
// Host basemap replaces all standalone EOX/demo services. Globe engine remains MapLibre.
export const DEFAULT_VIEW:CameraState={center:{lng:35,lat:15},zoom:0.9,bearing:0,pitch:0};
export const HOST_STYLE='https://tiles.openfreemap.org/styles/positron';
export function createBaseStyle(){return HOST_STYLE;}
