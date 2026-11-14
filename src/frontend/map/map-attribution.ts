import type {Map} from 'maplibre-gl';
import {AttributionControl} from 'maplibre-gl';
export function addMapAttribution(map:Map){
 map.addControl(new AttributionControl({compact:true,customAttribution:'<a href="https://maplibre.org/" target="_blank" rel="noreferrer">MapLibre</a>'}),'bottom-left');
 const credits=map.getContainer().querySelector<HTMLDetailsElement>('.maplibregl-ctrl-attrib');
 const close=()=>{credits?.classList.remove('maplibregl-compact-show');credits?.removeAttribute('open');};
 map.once('load',close);credits?.addEventListener('keydown',e=>{if(e.key==='Escape'){close();credits.querySelector<HTMLElement>('summary')?.focus();}});
}
