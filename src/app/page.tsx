import {existsSync} from 'node:fs';
import path from 'node:path';
import ClientApp from '@/frontend/components/ClientApp';
export default function Page(){return <ClientApp logoAvailable={existsSync(path.join(process.cwd(),'public/brand/earth-detective-logo.png'))}/>;}
