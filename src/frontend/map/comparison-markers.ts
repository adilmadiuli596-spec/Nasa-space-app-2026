'use client';
import {useEffect,useRef} from 'react';
import {Marker,type Map as EarthMap} from 'maplibre-gl';
import type {ComparisonMapPoint} from '@/shared/types/map';
import {mapPadding} from './camera-layout';
export function fitComparisonPoints(map:EarthMap,points:readonly ComparisonMapPoint[]){
 if(!points.length)return;const lons=points.map(p=>p.point.longitude),lats=points.map(p=>Math.max(-85.051128,Math.min(85.051128,p.point.latitude)));
 let west=Math.min(...lons),east=Math.max(...lons);if(east-west>180){const a=west;west=east;east=a+360;}
 const padding=mapPadding(map);for(const side of ['top','right','bottom','left'] as const)padding[side]+=20;
 map.fitBounds([[west,Math.min(...lats)],[east,Math.max(...lats)]],{padding,maxZoom:4,duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:180});
}
export function useComparisonMarkers(map:EarthMap|null,points:readonly ComparisonMapPoint[]|undefined,mode:'2d'|'3d',onSelect?: (id:'A'|'B')=>void){
 const callback=useRef(onSelect);callback.current=onSelect;
 useEffect(()=>{if(!map||!points)return;const markers=points.filter(p=>mode==='3d'||Math.abs(p.point.latitude)<=85.051128).map(p=>{
  const el=document.createElement('button');el.type='button';el.className='comparison-map-marker slot-'+p.id+(p.active?' selected':'');el.textContent=p.id;el.title='Точка '+p.id+' · '+p.title;el.setAttribute('aria-label',el.title);el.dataset.comparisonMarker=p.id;el.dataset.latitude=String(p.point.latitude);el.dataset.longitude=String(p.point.longitude);
  el.onclick=e=>{e.stopPropagation();callback.current?.(p.id);};return new Marker({element:el,anchor:'bottom',opacityWhenCovered:0}).setLngLat([p.point.longitude,p.point.latitude]).addTo(map);
 });if(mode==='2d')fitComparisonPoints(map,points);return()=>{markers.forEach(m=>m.remove());};},[map,points,mode]);
}
