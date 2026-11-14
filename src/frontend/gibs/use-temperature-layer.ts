'use client';
import {useEffect} from 'react';
import {addProtocol,type Map} from 'maplibre-gl';
import type {TemperatureOverlay} from '@/shared/types/gibs';
import {createGIBSLayer} from '../map/globe-friend/lib/gibs';
const ID='earth-overlay-temperature';let registered=false;
/** Native globe raster meshes extend their edge texels to the poles. Make that border
 * transparent, rather than falsely painting unobserved polar caps. All other NASA pixels
 * remain unchanged. No temperature is calculated or sampled from imagery. */
function register(){if(registered)return;addProtocol('nasa-gibs',async(request,controller)=>{
 const m=request.url.match(/^nasa-gibs:\/\/(\d{4}-\d{2}-01)\/(\d)\/(\d+)\/(\d+)$/);if(!m)throw new Error('Invalid GIBS tile');const [,date,zs,ys,xs]=m,z=+zs,y=+ys,x=+xs,n=2**z;if(z>6||x>=n||y>=n)throw new Error('Invalid GIBS grid');
 const url='https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MERRA2_2m_Air_Temperature_Monthly/default/'+date+'/GoogleMapsCompatible_Level6/'+z+'/'+y+'/'+x+'.png';
 const response=await fetch(url,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(18000)])});if(!response.ok||!response.headers.get('content-type')?.includes('image/png'))throw new Error('NASA GIBS tile unavailable');
 const blob=await response.blob();if(blob.size>2_000_000)throw new Error('GIBS tile too large');
 if(y!==0&&y!==n-1)return{data:await blob.arrayBuffer()};
 const bitmap=await createImageBitmap(blob);try{if(bitmap.width!==256||bitmap.height!==256)throw new Error('Unexpected GIBS tile size');const canvas=new OffscreenCanvas(256,256),ctx=canvas.getContext('2d');if(!ctx)throw new Error('GIBS image processing unavailable');ctx.drawImage(bitmap,0,0);if(y===0)ctx.clearRect(0,0,256,1);if(y===n-1)ctx.clearRect(0,255,256,1);return{data:await(await canvas.convertToBlob({type:'image/png'})).arrayBuffer()};}finally{bitmap.close();}
 });registered=true;}
export function useTemperatureLayer(map:Map|null,overlay?:TemperatureOverlay){
 useEffect(()=>{if(!map||!overlay)return;register();const {date,onStatus}=overlay;let disposed=false,failed=false,timer:ReturnType<typeof setTimeout>|undefined;
 const remove=()=>{if(map.getLayer(ID))map.removeLayer(ID);if(map.getSource(ID))map.removeSource(ID);};
 const fail=()=>{if(disposed||failed)return;failed=true;clearTimeout(timer);remove();onStatus('error');};
 const loaded=()=>{if(!disposed&&!failed&&map.getSource(ID)&&map.isSourceLoaded(ID)){clearTimeout(timer);onStatus('ready');}};
 const error=(e:import('maplibre-gl').ErrorEvent)=>{if('sourceId' in e&&e.sourceId===ID)fail();};
 const install=()=>{if(disposed)return;remove();failed=false;onStatus('loading');try{
  const spec=createGIBSLayer({id:ID,title:'Среднемесячная температура воздуха',product:'MERRA2_2m_Air_Temperature_Monthly',matrixSet:'GoogleMapsCompatible_Level6',maxzoom:6,format:'png',tileSize:256,availability:{dates:[date]},opacity:1});
  // Reuse the teammate GIBS descriptor and verified NASA matrix, adding only an honest polar-border mask.
  if(!spec.tiles.length)throw new Error('No GIBS tiles');
  map.addSource(ID,{type:'raster',tiles:['nasa-gibs://'+date+'/{z}/{y}/{x}'],tileSize:256,minzoom:0,maxzoom:6,bounds:[-180,-85.0511287798066,180,85.0511287798066],attribution:'<a href="https://earthdata.nasa.gov/gibs">NASA GIBS / MERRA-2</a>'});
  const before=map.getStyle().layers?.find(l=>l.type==='symbol')?.id;
  map.addLayer({id:ID,type:'raster',source:ID,paint:{'raster-opacity':1,'raster-fade-duration':0,'raster-resampling':'nearest'}},before);timer=setTimeout(fail,25000);
 }catch{fail();}};
 map.on('error',error);map.on('sourcedata',loaded);map.on('style.load',install);install();
 return()=>{disposed=true;clearTimeout(timer);map.off('error',error);map.off('sourcedata',loaded);map.off('style.load',install);remove();};
 },[map,overlay?.date,overlay?.retry,overlay?.onStatus]);
}
