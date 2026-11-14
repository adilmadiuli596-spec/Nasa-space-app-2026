import {useEffect,useRef,useState} from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type {Point} from './api'

export function MapView({point,cell,pick}:{point:Point|null;cell?:Point;pick:(point:Point)=>void}){
 const host=useRef<HTMLDivElement>(null), map=useRef<maplibregl.Map|null>(null)
 const handler=useRef(pick)
 const selected=useRef(point)
 selected.current=point
 handler.current=pick
 const [issue,setIssue]=useState('')
 useEffect(()=>{
  if(!host.current)return
  let m:maplibregl.Map
  try {
   m=new maplibregl.Map({container:host.current,style:'https://tiles.openfreemap.org/styles/positron',center:[45,44],zoom:2.15,maxPitch:0})
  } catch {setIssue('Для карты требуется WebGL. Можно ввести координаты вручную.');return}
  map.current=m
  m.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-left')
  m.addControl(new maplibregl.ScaleControl({unit:'metric'}),'bottom-left')
  m.on('click',e=>handler.current({latitude:+e.lngLat.lat.toFixed(5),longitude:+e.lngLat.wrap().lng.toFixed(5)}))
  m.on('error',()=>setIssue('Часть карты не загрузилась. Доступен ввод координат.'))
  m.on('idle',()=>{if(m.areTilesLoaded() && m.isStyleLoaded())setIssue('')})
  const observer=new ResizeObserver(()=>{
   m.resize()
   const p=selected.current
   if(p&&!m.getBounds().contains([p.longitude,p.latitude]))m.jumpTo({center:[p.longitude,p.latitude]})
  })
  observer.observe(host.current)
  return ()=>{observer.disconnect();m.remove();map.current=null}
 },[])
 useEffect(()=>{
  const m=map.current
  if(!m||!point)return
  const el=document.createElement('div');el.className='point';el.title='Выбранная точка'
  const marker=new maplibregl.Marker({element:el}).setLngLat([point.longitude,point.latitude]).addTo(m)
  if(!m.getBounds().contains([point.longitude,point.latitude]))m.easeTo({center:[point.longitude,point.latitude],duration:400})
  return ()=>{marker.remove()}
 },[point?.latitude,point?.longitude])
 useEffect(()=>{
  if(!map.current||!cell)return
  const el=document.createElement('div');el.className='cell';el.title='Центр ячейки NASA'
  const marker=new maplibregl.Marker({element:el}).setLngLat([cell.longitude,cell.latitude]).addTo(map.current)
  return ()=>{marker.remove()}
 },[cell])
 return <><div className="map" ref={host} aria-label="Глобальная карта"/>{issue&&<small className="mapIssue">{issue}</small>}</>
}
