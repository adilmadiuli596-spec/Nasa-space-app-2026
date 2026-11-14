import {readFile,mkdir,copyFile} from 'node:fs/promises';
const meta=JSON.parse(await readFile('node_modules/maplibre-gl/package.json','utf8'));
const dir=`public/vendor/maplibre-${meta.version}`;
await mkdir(dir,{recursive:true});
for(const file of ['maplibre-gl-worker.mjs','maplibre-gl-shared.mjs']) await copyFile('node_modules/maplibre-gl/dist/'+file,dir+'/'+file);
await copyFile('node_modules/maplibre-gl/LICENSE.txt',dir+'/LICENSE.txt');
console.log('Prepared versioned MapLibre worker assets');
