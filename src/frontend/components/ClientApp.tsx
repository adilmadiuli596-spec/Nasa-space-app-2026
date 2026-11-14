'use client';
import dynamic from 'next/dynamic';
const App=dynamic(()=>import('./App'),{ssr:false,loading:()=> <main className="boot" role="status">Загрузка Earth Detective…</main>});
export default function ClientApp({logoAvailable=false}:{logoAvailable?:boolean}){return <App logoAvailable={logoAvailable}/>;}
