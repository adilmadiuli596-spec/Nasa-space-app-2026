'use client';
import {useEffect,useRef,useState,useCallback} from 'react';
import {createPortal} from 'react-dom';
import {Marker,Popup} from 'maplibre-gl';
import type {PointMapProps,MapCamera} from '@/shared/types/map';
import {useEarthMap} from './globe-friend/hooks/useEarthMap';
import {normalizePoint,isMapSurface} from './globe-friend/lib/geo-utils';
import {HOST_STYLE} from './globe-friend/lib/map-config';
import {SpaceBackdrop} from './globe-friend/SpaceBackdrop';
import {useTemperatureLayer} from '../gibs/use-temperature-layer';
import {mapPadding,globeOverviewZoom} from './camera-layout';
import {Icon} from '../components/Icon';
import {useComparisonMarkers} from './comparison-markers';
// Host adapter over the teammate EarthMap lifecycle/projection/selection implementation.
export function GlobeMapView({timeControlsVisible=false,temperature,comparisonPoints,onComparisonPointSelect,point,pick,initialCamera,onCameraChange,focusKey=0,labelsVisible=true,command,panelOpen=false,summary,showSummary=true,onOpenAnalysis,space=false,onFailure}:{space?:boolean;onFailure:()=>void}&PointMapProps){
 const container=useRef<HTMLDivElement>(null),latest=useRef({pick,point,onCameraChange,onFailure});latest.current={pick,point,onCameraChange,onFailure};
 const overview=useRef(true),laidOut=useRef(false);
 const initial=useRef(initialCamera),layout=useRef<()=>void>(()=>{}),[popupHost,setPopupHost]=useState<HTMLDivElement|null>(null);
 const changed=useCallback((camera:{center:{lat:number;lng:number};zoom:number;bearing:number;pitch:number})=>{latest.current.onCameraChange?.({center:{latitude:camera.center.lat,longitude:camera.center.lng},zoom:camera.zoom,bearing:camera.bearing,pitch:camera.pitch});},[]);
 const fail=useCallback(()=>latest.current.onFailure(),[]);
 const {map,ready,error,basemapLoading}=useEarthMap(container,{selectedDate:'1991-01-01',mode:'globe',baseStyle:HOST_STYLE,initialView:{center:initial.current?{lat:initial.current.center.latitude,lng:initial.current.center.longitude}:{lat:point?.latitude??25,lng:point?.longitude??45},zoom:typeof window!=='undefined'&&innerWidth<=600?(panelOpen?-0.4:0.6):1.8,bearing:0,pitch:0},onCameraChange:changed,onError:fail});
 useTemperatureLayer(ready?map:null,temperature);
 useComparisonMarkers(ready?map:null,comparisonPoints,'3d',onComparisonPointSelect);
 useEffect(()=>{if(!map||!ready)return;
  // Projection effect and surface selection are adapted directly from teammate EarthMap.
  map.setProjection({type:'globe'});map.setMinZoom(-2);map.setSky({'sky-color':'#0a1734','horizon-color':'#9fdcff','sky-horizon-blend':0.1,'atmosphere-blend':['interpolate',['linear'],['zoom'],0,0.65,4,0.65,7,0]});map.dragRotate.disable();map.touchZoomRotate.disableRotation();
  const select=(e:import('maplibre-gl').MapMouseEvent)=>{if(isMapSurface(map,e.point)){const p=normalizePoint({lat:e.lngLat.lat,lng:e.lngLat.lng});latest.current.pick({latitude:+p.lat.toFixed(5),longitude:+p.lng.toFixed(5)});}};
  const moving=()=>container.current?.removeAttribute('data-map-ready');
  const idle=()=>{if(map.isStyleLoaded()&&map.areTilesLoaded())container.current?.setAttribute('data-map-ready','true');};
  map.on('click',select);map.on('movestart',moving);map.on('idle',idle);container.current?.setAttribute('data-projection','globe');
  for(const layer of map.getStyle().layers??[])if(layer.type==='fill'&&/water/i.test(layer.id)&&!/waterway|water_name/i.test(layer.id))map.setPaintProperty(layer.id,'fill-color','#BFE7FC');
  return()=>{map.off('click',select);map.off('movestart',moving);map.off('idle',idle);};
 },[map,ready]);
 useEffect(()=>{if(!map||!ready)return;for(const layer of map.getStyle().layers??[])if(layer.type==='symbol')map.setLayoutProperty(layer.id,'visibility',labelsVisible?'visible':'none');},[map,ready,labelsVisible]);
 useEffect(()=>{if(!map||!ready)return;
  const update=()=>{map.stop();const p=latest.current.point,c=map.getCenter(),padding=mapPadding(map);let latitude=p?.latitude??c.lat,longitude=p?.longitude??c.lng,zoom=globeOverviewZoom(map,latitude,padding);if(overview.current&&zoom<=-2&&Math.abs(latitude)>75){latitude=Math.sign(latitude)*75;zoom=globeOverviewZoom(map,latitude,padding);}const duration=laidOut.current&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches?180:0;map.easeTo({center:[longitude,latitude],padding,...(overview.current?{zoom}:{}),duration});laidOut.current=true;};
  const userZoom=(e:import('maplibre-gl').MapLibreEvent)=>{if(e.originalEvent)overview.current=false;};
  layout.current=update;update();const observer=new ResizeObserver(()=>{map.resize();update();});if(container.current)observer.observe(container.current);const dock=document.querySelector('.right-column');if(dock)observer.observe(dock);window.addEventListener('resize',update);map.on('zoomstart',userZoom);return()=>{observer.disconnect();window.removeEventListener('resize',update);map.off('zoomstart',userZoom);};
 },[map,ready,panelOpen,timeControlsVisible]);
 useEffect(()=>{if(!map||!ready||comparisonPoints||!point)return;const el=document.createElement('div');el.className='point';el.title='Выбранная точка';el.dataset.anchor='bottom';el.dataset.latitude=String(point.latitude);el.dataset.longitude=String(point.longitude);
 el.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 32" width="30" height="40" aria-hidden="true"><path d="M12 32C10 28 0 20 0 12a12 12 0 0 1 24 0c0 8-10 16-12 20Z" fill="white"/><path d="M12 28C9 23 2 19 2 12a10 10 0 0 1 20 0c0 7-7 11-10 16Z" fill="#FC3D21"/><circle cx="12" cy="11" r="4" fill="white"/></svg>';
 const marker=new Marker({element:el,anchor:'bottom',opacityWhenCovered:0}).setLngLat([point.longitude,point.latitude]).addTo(map);return()=>{marker.remove();};
 },[map,ready,point?.latitude,point?.longitude,Boolean(comparisonPoints)]);
 useEffect(()=>{if(!map||!ready)return;const p=latest.current.point;if(p){if(overview.current)layout.current();else{map.stop();map.easeTo({center:[p.longitude,p.latitude],duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:350});}}},[map,ready,point?.latitude,point?.longitude,focusKey]);
 useEffect(()=>{if(!map||!ready||!command)return;if(command.type==='in'){overview.current=false;map.zoomIn();}else if(command.type==='out'){overview.current=false;map.zoomOut();}else{overview.current=true;layout.current();}},[map,ready,command]);
 useEffect(()=>{if(!map||!ready||!point||!summary||!showSummary){setPopupHost(null);return;}const host=document.createElement('div');host.addEventListener('click',e=>e.stopPropagation());const popup=new Popup({closeButton:false,closeOnClick:false,anchor:'bottom',offset:[0,-44],maxWidth:'260px',className:'point-popup'}).setLngLat([point.longitude,point.latitude]).setDOMContent(host).addTo(map);setPopupHost(host);return()=>{popup.remove();setPopupHost(null);};},[map,ready,summary,showSummary,point?.latitude,point?.longitude]);
 return <div className="globe-root" data-renderer="3d">{space&&<SpaceBackdrop map={map} active/>}<div className="map globe-canvas" ref={container} aria-label="Интерактивный 3D-глобус"/>{popupHost&&summary&&createPortal(<div className="point-card"><b title={summary.title}>{summary.title}</b><strong data-testid="point-value">{summary.value===null?'Данные недоступны':summary.value.toLocaleString('ru-RU',{maximumFractionDigits:2})+' '+summary.unit}</strong><span data-testid="point-year">Среднегодовое · {summary.year} · {summary.period}</span><span>{summary.source}</span><button type="button" aria-label="Открыть научную панель" onClick={()=>onOpenAnalysis?.()}><Icon name="chart" size={19}/></button></div>,popupHost)}{(error||!ready)&&<div className="globe-status" role="status">{error?'3D недоступен. Возвращаем 2D…':'Загрузка 3D-глобуса…'}</div>}{ready&&basemapLoading&&<span className="sr-only" role="status">Загрузка подложки глобуса</span>}</div>;
}
