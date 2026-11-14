'use client';
import {useEffect,useRef,useState} from 'react';
import * as maplibregl from 'maplibre-gl';
import type {Point} from '../api';
import type {PointMapProps} from '@/shared/types/map';
import {createPortal} from 'react-dom';
import {Icon} from '../components/Icon';
const STYLE='https://tiles.openfreemap.org/styles/positron';
const canProject=(point:Point)=>Math.abs(point.latitude)<=85.0511287798066;
export function MapView({point,cell,pick,focusKey=0,labelsVisible=true,command,panelOpen=false,summary,showSummary=true,onOpenAnalysis}:PointMapProps){
 const host=useRef<HTMLDivElement>(null),map=useRef<maplibregl.Map|null>(null),handler=useRef(pick),selected=useRef(point);
 const layout=useRef<(()=>void)|null>(null);
 const currentLabels=useRef(labelsVisible);currentLabels.current=labelsVisible;
 handler.current=pick;selected.current=point;
 const [issue,setIssue]=useState(''),[loading,setLoading]=useState(true),[popupHost,setPopupHost]=useState<HTMLDivElement|null>(null);
 useEffect(()=>{
  if(!host.current)return;let m:maplibregl.Map;
  try{maplibregl.setWorkerUrl(`/vendor/maplibre-${maplibregl.getVersion()}/maplibre-gl-worker.mjs`);m=new maplibregl.Map({container:host.current,style:STYLE,center:[45,44],zoom:2.15,maxPitch:0,dragRotate:false,attributionControl:false,locale:{'AttributionControl.ToggleAttribution':'Источники карты'}});}
  catch{setLoading(false);setIssue('Для карты требуется WebGL. Доступны поиск и ручной ввод координат.');return;}
  map.current=m;m.touchZoomRotate.disableRotation();
  m.addControl(new maplibregl.AttributionControl({compact:true,customAttribution:'<a href="https://maplibre.org/" target="_blank" rel="noreferrer">MapLibre</a>'}),'bottom-left');
  // Keep the library's source credits and native keyboard-accessible details control.
  const credits=host.current.querySelector<HTMLDetailsElement>('.maplibregl-ctrl-attrib');
  const closeCredits=()=>{credits?.classList.remove('maplibregl-compact-show');credits?.removeAttribute('open');};
  m.once('load',closeCredits);
  credits?.addEventListener('keydown',e=>{if(e.key==='Escape'){closeCredits();credits.querySelector<HTMLElement>('summary')?.focus();}});
  const timer=window.setTimeout(()=>{if(!m.areTilesLoaded())setIssue('Подложка загружается медленно. Координаты и научный анализ остаются доступны.');},20000);
  m.on('style.load',()=>{
   for(const layer of m.getStyle().layers||[]){if(layer.type==='symbol')m.setLayoutProperty(layer.id,'visibility',currentLabels.current?'visible':'none');if(layer.type==='fill'&&/water/i.test(layer.id)&&!/waterway|water_name/i.test(layer.id))m.setPaintProperty(layer.id,'fill-color','#BFE7FC');}

  });
  m.on('click',e=>handler.current({latitude:+e.lngLat.lat.toFixed(5),longitude:+e.lngLat.wrap().lng.toFixed(5)}));
  m.on('movestart',()=>host.current?.removeAttribute('data-map-ready'));
  m.on('error',()=>{setLoading(false);setIssue('Часть подложки не загрузилась. Можно повторить загрузку или ввести координаты.');});
  m.on('idle',()=>{if(m.areTilesLoaded()&&m.isStyleLoaded()){setLoading(false);setIssue('');host.current?.setAttribute('data-map-ready','true');}});
  const observer=new ResizeObserver(()=>{m.resize();layout.current?.();const p=selected.current;if(p&&canProject(p)&&!m.getBounds().contains([p.longitude,p.latitude]))m.jumpTo({center:[p.longitude,p.latitude]});});observer.observe(host.current);
  return()=>{clearTimeout(timer);observer.disconnect();m.remove();map.current=null;};
 },[]);
 useEffect(()=>{
  const m=map.current;if(!m||!point||!canProject(point))return;
  const el=document.createElement('div');el.className='point';el.title='Выбранная точка';
  el.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 32" width="30" height="40" aria-hidden="true"><path d="M12 32C10 28 0 20 0 12a12 12 0 0 1 24 0c0 8-10 16-12 20Z" fill="white"/><path d="M12 28C9 23 2 19 2 12a10 10 0 0 1 20 0c0 7-7 11-10 16Z" fill="#FC3D21"/><circle cx="12" cy="11" r="4" fill="white"/></svg>';
  el.dataset.anchor='bottom';el.dataset.latitude=String(point.latitude);el.dataset.longitude=String(point.longitude);
  const marker=new maplibregl.Marker({element:el,anchor:'bottom'}).setLngLat([point.longitude,point.latitude]).addTo(m);
  if(!m.getBounds().contains([point.longitude,point.latitude]))m.easeTo({center:[point.longitude,point.latitude],duration:400});return()=>{marker.remove();};
 },[point?.latitude,point?.longitude]);
 useEffect(()=>{const m=map.current,p=selected.current;if(m&&p&&canProject(p)&&focusKey)m.easeTo({center:[p.longitude,p.latitude],zoom:Math.max(6,m.getZoom()),duration:400});},[focusKey]);

 useEffect(()=>{const m=map.current;if(m?.isStyleLoaded())for(const layer of m.getStyle().layers||[])if(layer.type==='symbol')m.setLayoutProperty(layer.id,'visibility',labelsVisible?'visible':'none');},[labelsVisible]);
 useEffect(()=>{const m=map.current;if(!m||!command)return;if(command.type==='in')m.zoomIn();else if(command.type==='out')m.zoomOut();else m.easeTo({center:[15,25],zoom:1.5,duration:400});},[command]);
 useEffect(()=>{
  const m=map.current;if(!m)return;
  const update=()=>{
   const small=innerWidth<=600,canvasHeight=m.getCanvas().clientHeight;
   const header=parseFloat(getComputedStyle(document.querySelector('main')!).getPropertyValue('--header-bottom'))||100;
   const width=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--panel-width'))||488;
   const height=small&&panelOpen?document.querySelector('aside')?.getBoundingClientRect().height||0:0;
   const top=Math.min(header,canvasHeight/3),padding={top,right:!small&&panelOpen?width+30:16,bottom:Math.min(height+12,Math.max(0,canvasHeight-top-44)),left:60};
   // Finish camera/layout as one transaction: an older easeTo must not restore old padding.
   m.stop();const p=selected.current;
   if(p&&canProject(p))m.jumpTo({center:[p.longitude,p.latitude],padding});else m.setPadding(padding);
  };
  layout.current=update;update();window.addEventListener('resize',update);
  return()=>{window.removeEventListener('resize',update);if(layout.current===update)layout.current=null;};
 },[panelOpen]);

 useEffect(()=>{
  const m=map.current;if(!m||!point||!summary||!showSummary||!canProject(point)){setPopupHost(null);return;}
  const host=document.createElement('div');host.addEventListener('click',e=>e.stopPropagation());
  const popup=new maplibregl.Popup({closeButton:false,closeOnClick:false,anchor:'bottom',offset:[0,-44],maxWidth:'260px',className:'point-popup'}).setLngLat([point.longitude,point.latitude]).setDOMContent(host).addTo(m);
  setPopupHost(host);return()=>{popup.remove();setPopupHost(null);};
 },[summary,showSummary,point?.latitude,point?.longitude]);

 const outside=point&&!canProject(point);
 return <>{popupHost&&summary&&createPortal(<div className="point-card"><b title={summary.title}>{summary.title}</b><strong data-testid="point-value">{summary.value===null?'Данные недоступны':summary.value.toLocaleString('ru-RU',{maximumFractionDigits:2})+' '+summary.unit}</strong><span data-testid="point-year">Среднегодовое · {summary.year}</span><span>{summary.source}</span><button type="button" aria-label="Открыть научную панель" title="Открыть научный анализ" onClick={()=>onOpenAnalysis?.()}><Icon name="chart" size={19}/></button></div>,popupHost)}<div className="map" ref={host} aria-label="Интерактивная карта мира"/>{(issue||loading||outside)&&<div className="mapIssue" role="status">{outside?'Эта широта вне видимой области 2D-проекции. Для анализа сохранены введённые координаты.':issue||'Загрузка подложки карты…'}{issue&&<button type="button" onClick={()=>{setIssue('');setLoading(true);host.current?.removeAttribute('data-map-ready');map.current?.setStyle(STYLE);}}>Повторить карту</button>}</div>}</>;
}

