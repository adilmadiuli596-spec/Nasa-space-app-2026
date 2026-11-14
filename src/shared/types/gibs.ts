export type GibsCatalog={layer:'MERRA2_2m_Air_Temperature_Monthly';dates:string[];defaultDate:string;checkedAt:string;colors:string[];ticks:{kelvin:number;celsius:number;position:number}[];sourceUnit:'K';displayUnit:'°C';crs:'EPSG:3857';matrixSet:'GoogleMapsCompatible_Level6';maxZoom:6;polarLimit:number;capabilitiesUrl:string;colorMapUrl:string;legendUrl:string;excludedNonMonthlyDates:number};
export type GibsStatus='loading'|'ready'|'error';
export type TemperatureOverlay={date:string;retry:number;onStatus:(status:GibsStatus)=>void};
