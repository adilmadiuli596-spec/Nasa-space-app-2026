import type { NextConfig } from 'next';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const config: NextConfig = { poweredByHeader: false, serverExternalPackages:['h5wasm'], outputFileTracingIncludes:{'/api/analysis':['./node_modules/h5wasm/LICENSE.txt']}, outputFileTracingExcludes:{'/api/analysis':['./reference/**/*','./tests/**/*','./.cache/**/*','./.env*']}, outputFileTracingRoot:root, turbopack:{root} };
export default config;
