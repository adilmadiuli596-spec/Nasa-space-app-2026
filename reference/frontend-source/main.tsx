import {useEffect,useRef,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {api,names,type Catalog,type Point,type Query,type Result} from './api'
import {MapView} from './MapView'
import {Findings} from './Panel'
import './style.css'

function App(){
 const [lat,setLat]=useState('52.27601'),[lon,setLon]=useState('76.96881')
 const [variable,setVariable]=useState('T2M'),[start,setStart]=useState('1991'),[end,setEnd]=useState('2025')
 const [catalog,setCatalog]=useState<Catalog|null>(null),[setupError,setSetupError]=useState(''),[attempt,retry]=useState(0)
 const [result,setResult]=useState<Result|null>(null),[status,setStatus]=useState(''),[busy,setBusy]=useState(false)
 const [mobile,setMobile]=useState(()=>window.matchMedia('(max-width:600px)').matches)
 const [panelChoice,setOpen]=useState<boolean|null>(null)
 const open=panelChoice??(!mobile||Boolean(setupError))
 useEffect(()=>{
  const query=window.matchMedia('(max-width:600px)')
  const resize=()=>setMobile(query.matches)
  query.addEventListener('change',resize)
  return ()=>query.removeEventListener('change',resize)
 },[])
 const active=useRef<AbortController|null>(null)
 useEffect(()=>{
  const ctl=new AbortController()
  setSetupError('')
  Promise.all([api('health',{signal:ctl.signal}),api<Catalog>('variables',{signal:ctl.signal})]).then(([,c])=>setCatalog(c)).catch(e=>{if(!ctl.signal.aborted)setSetupError(e.message)})
  return ()=>ctl.abort()
 },[attempt])
 useEffect(()=>()=>active.current?.abort(),[])
 function cancel(){active.current?.abort();active.current=null;setBusy(false)}
 function change(fn:()=>void){cancel();setStatus('');setResult(null);fn()}
 function select(p:Point){change(()=>{setLat(String(p.latitude));setLon(String(p.longitude))})}
 const point=lat.trim()&&lon.trim()&&Number.isFinite(+lat)&&Number.isFinite(+lon)&&Math.abs(+lat)<=90&&Math.abs(+lon)<=180?{latitude:+lat,longitude:+lon}:null
 async function analyze(e:React.FormEvent){
  e.preventDefault()
  if(active.current||!catalog)return
  setOpen(true)
  if(!point){setStatus('Проверьте широту и долготу.');return}
  const period=catalog.supported_period
  if(!Number.isInteger(+start)||!Number.isInteger(+end)||+start<period.start_year||+end>period.end_year||+end-+start+1<period.minimum_complete_years){setStatus('Проверьте период: требуется минимум '+period.minimum_complete_years+' полных лет.');return}
  const body:Query={...point,variable,start_year:+start,end_year:+end}
  const ctl=new AbortController();active.current=ctl;setBusy(true);setStatus('');setResult(null)
  try{const data=await api<Result>('analysis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:ctl.signal})
   if(active.current===ctl)setResult(data)
  }catch(e){if(active.current===ctl)setStatus(e instanceof Error?e.message:'Ошибка запроса')}
  finally{if(active.current===ctl){active.current=null;setBusy(false)}}
 }
 return <main>
 <form className="header" onSubmit={analyze}><div className="brand"><b className="logo" aria-hidden="true">◎</b> Earth Detective</div>
 <div className="fields">{[['Широта',lat,setLat,-90,90],['Долгота',lon,setLon,-180,180]].map(([label,v,set,min,max])=><label key={String(label)}>{String(label)}<input required type="number" step="any" min={Number(min)} max={Number(max)} value={String(v)} onChange={e=>change(()=>(set as typeof setLat)(e.target.value))}/></label>)}
 <label>Показатель<select value={variable} onChange={e=>change(()=>setVariable(e.target.value))}>{(catalog?.variables||[{id:'T2M'}]).map(v=><option key={v.id}>{v.id}</option>)}</select></label>
 <label>С года<input type="number" required min={catalog?.supported_period.start_year} max={catalog?.supported_period.end_year} value={start} onChange={e=>change(()=>setStart(e.target.value))}/></label>
 <label>По год<input type="number" required min={catalog?.supported_period.start_year} max={catalog?.supported_period.end_year} value={end} onChange={e=>change(()=>setEnd(e.target.value))}/></label></div>
 <button className="primary" disabled={busy||!catalog}>Анализ</button></form>
 <div className="workspace"><div className="mapwrap"><MapView point={point} cell={result?.actual_cell} pick={select}/>
 <div className="presets"><button onClick={()=>select({latitude:52.27601,longitude:76.96881})}>Павлодар</button><button onClick={()=>select({latitude:52.52,longitude:13.405})}>Берлин</button></div>
 {!open&&<button className="reopen" aria-label="Открыть панель анализа" onClick={()=>setOpen(true)}>≋</button>}</div>
 {open&&<aside className={result?'results':'compact'}><div className="panelhead"><b>Научный анализ</b><button aria-label="Закрыть панель" onClick={()=>setOpen(false)}>×</button></div><div className="inside">
 {setupError?<div role="alert"><p>{setupError}</p><button onClick={()=>retry(attempt+1)}>Повторить подключение</button></div>:busy?<div role="status"><h2>Получаем ряд MERRA-2</h2><p>Первое обращение к NASA может занять несколько минут.</p><button onClick={()=>{cancel();setStatus('Ожидание отменено. Backend может завершить загрузку в кэш.')}}>Отменить ожидание</button></div>:status?<p role="alert">{status}</p>:result?<Findings result={result}/>:<><p className="kicker">{variable} · {start}–{end}</p><h1>{names[variable]}</h1><p>Выберите точку на карте или введите координаты. Нажмите «Анализ», чтобы увидеть годовой ряд и тренд по ячейке MERRA-2.</p></>}
 </div></aside>}</div></main>
}
createRoot(document.getElementById('root')!).render(<App/>)
