'use client';
import {useEffect,useRef} from 'react';
import {Icon} from './Icon';
const options=[['1991-2025','1991 — 2025'],['2000-2025','2000 — 2025'],['2010-2025','2010 — 2025'],['custom','Свой период…']] as const;
// A single styled native disclosure, not an additional UI framework.
export function PeriodSelect({value,label,onChange}:{value:string;label:string;onChange:(value:string)=>void}){
 const root=useRef<HTMLDetailsElement>(null),trigger=useRef<HTMLElement>(null);
 function close(focus=false){if(root.current)root.current.open=false;if(focus)trigger.current?.focus();}
 useEffect(()=>{const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))close();};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);},[]);
 function navigate(e:React.KeyboardEvent){const buttons=Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role=option]')||[]),at=buttons.indexOf(document.activeElement as HTMLButtonElement);let next=at;if(e.key==='ArrowDown')next=(at+1)%buttons.length;else if(e.key==='ArrowUp')next=(at-1+buttons.length)%buttons.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=buttons.length-1;else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close(true);return;}else if(e.key==='Tab'){close();return;}else return;e.preventDefault();buttons[next]?.focus();}
 return <details className="period-select" ref={root} onToggle={e=>{if(e.currentTarget.open)requestAnimationFrame(()=>root.current?.querySelector<HTMLButtonElement>('[aria-selected=true]')?.focus());}} onKeyDown={navigate}>
  <summary ref={trigger} aria-label={'Период: '+label} aria-haspopup="listbox" onKeyDown={e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();e.stopPropagation();if(root.current)root.current.open=true;}}}><span><small>Период</small><b>{label}</b></span><Icon name="chevron" size={17}/></summary>
  <div className="period-options" role="listbox" aria-label="Период анализа">{options.map(([id,title])=><button type="button" role="option" tabIndex={value===id?0:-1} aria-selected={value===id} key={id} onClick={()=>{onChange(id);close(true);}}><span>{title}</span>{value===id&&<Icon name="check" size={16}/>}</button>)}</div>
 </details>;
}
