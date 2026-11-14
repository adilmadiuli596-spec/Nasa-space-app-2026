import type {Map} from 'maplibre-gl';
/** Only published and functional base layers belong in the menu. */
export const BASE_MAP_LAYERS=['base-map','temperature'] as const;
export type BaseMapLayer=typeof BASE_MAP_LAYERS[number];
/** Future teammate adapter; type-only contract, no wind loader, renderer or menu switch. */
export type WindFrame={source:{provider:string;dataset:string;url:string;attribution:string};time:{start:string;end:string;aggregation:'instant'|'monthly'};crs:'EPSG:4326';unit:'m/s';grid:{width:number;height:number;bounds:readonly[west:number,south:number,east:number,north:number];u:Float32Array;v:Float32Array;missingValue:number}};
export interface WindOverlayAdapter {
 readonly id:'wind';
 /** Validate temporal compatibility explicitly; a monthly temperature image is not instantaneous weather. */
 loadFrame(context:{mapDate:string|null;signal:AbortSignal}):Promise<WindFrame>;
 /** Attach to the existing map; preserve its projection, base sources, point and other overlays. */
 attach(map:Map):void;
 setFrame(frame:WindFrame):void;
 setVisible(visible:boolean):void;
 /** Release animation frames, listeners, buffers and owned sources; never remove the host map. */
 dispose():void;
}
