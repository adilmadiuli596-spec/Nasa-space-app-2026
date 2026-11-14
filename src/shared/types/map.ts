import type {Point,Result} from './api';
export type MapCommand={id:number;type:'in'|'out'|'world'};
export type PointSummary={title:string;year:number;source?:string;variable:'T2M'|'QV2M';value:number|null;unit:'°C'|'г/кг'};
export type PointMapProps={summary?:PointSummary;showSummary?:boolean;onOpenAnalysis?:()=>void;point:Point|null;cell?:Result['actual_cell'];pick:(point:Point)=>void;focusKey?:number;labelsVisible?:boolean;command?:MapCommand;panelOpen?:boolean};
// Future adapters consume these descriptors; N4A does not render scientific layers.
export type ScientificMapLayer=FutureMonthlyTemperatureLayer|FutureTrendLayer;
export type LegendStop={sourceValue:number;displayValue:number;color:string;label:string};
export type FutureMonthlyTemperatureLayer={
 status:'planned'|'unavailable';sourceId:'nasa-gibs';layerId:'MERRA2_2m_Air_Temperature_Monthly';variable:'T2M';
 sourceUnit:'K';displayUnit:'°C';year:number;month:number;time:string;crs:'EPSG:3857';
 matrixSet:'GoogleMapsCompatible_Level6';tileSize:256;minZoom:0;maxZoom:6;
 capabilitiesUrl:string;metadataUrl:string;colorMapUrl:string;validTimes:readonly string[];
 legend:{status:'not-loaded'|'metadata-verified';stops:readonly LegendStop[];noDataLabel:string};
 attribution:string;error?:'metadata-unavailable'|'date-unavailable'|'layer-unavailable';
};
export type FutureTrendLayer={
 status:'planned'|'unavailable';sourceId:'earth-detective-derived-merra2';layerId:null;
 variable:'T2M';unit:'°C/decade';startYear:1991;endYear:2025;crs:'EPSG:3857';
 sourceDataset:'M2TMNXSLV';sourceVersion:'5.12.4';method:'OLS-HAC3-Bartlett-Student-t';
 metadataUrl:null;tiles:null;legend:null;attribution:string;
};

