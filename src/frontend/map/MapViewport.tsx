'use client';
import {Component,lazy,Suspense,useRef,useState,useCallback} from 'react';
import type {PointMapProps,MapCamera} from '@/shared/types/map';
import {MapView} from './MapView';
class GlobeBoundary extends Component<{onFailure:()=>void;children:import('react').ReactNode},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return {failed:true};}componentDidCatch(){this.props.onFailure();}render(){return this.state.failed?null:this.props.children;}}
const Globe=lazy(()=>import('./GlobeMapView').then(m=>({default:m.GlobeMapView})));
export function MapViewport(props:PointMapProps&{mode:'2d'|'3d';onModeChange:(mode:'2d'|'3d')=>void;space?:boolean}){
 const camera=useRef<MapCamera|undefined>(undefined),[fallback,setFallback]=useState(false);
 const save=useCallback((value:MapCamera)=>{camera.current=value;},[]);
 const failed=useCallback(()=>{setFallback(true);props.onModeChange('2d');},[props.onModeChange]);
 return <><Suspense fallback={<div className="globe-status" role="status">Загрузка 3D-модуля…</div>}>{props.mode==='3d'?<GlobeBoundary onFailure={failed}><Globe {...props} initialCamera={camera.current} onCameraChange={save} onFailure={failed}/></GlobeBoundary>:<MapView {...props} initialCamera={camera.current} onCameraChange={save}/>}</Suspense>{fallback&&props.mode==='2d'&&<div className="map-fallback" role="status">3D недоступен. Включён режим 2D.<button type="button" aria-label="Закрыть уведомление карты" onClick={()=>setFallback(false)}>×</button></div>}</>;
}
