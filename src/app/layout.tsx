import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@/frontend/styles/style.css';
import '@/frontend/styles/n4a1.css';
import '@/frontend/styles/n4g.css';
import '@/frontend/styles/n4b.css';
import '@/frontend/styles/n4b2.css';
import '@/frontend/styles/n4c1.css';
export const metadata: Metadata = { title: 'Earth Detective', other:{'earth-detective-comparison':'N4C.1','earth-detective-ui':'N4G','earth-detective-design':'N4G.1','earth-detective-gibs':'N4B','earth-detective-layer-ux':'N4B.1','earth-detective-layout':'N4B.2'}, description: 'Исследование исторических изменений по NASA MERRA-2. Независимый проект.', icons:{icon:[{url:'/favicon.ico',sizes:'32x32'},{url:'/brand/favicon-32.png',type:'image/png',sizes:'32x32'}],apple:'/brand/apple-touch-icon.png'} };
export default function Layout({children}:{children:ReactNode}) { return <html lang="ru"><body>{children}</body></html>; }


