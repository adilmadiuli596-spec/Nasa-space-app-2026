import {spawn} from 'node:child_process';
if(process.env.VERCEL){console.error('Authorized dynamic NASA launch is forbidden on Vercel until public access is confirmed.');process.exit(1);}
if(!process.stdin.isTTY){console.error('Run in your own local terminal for hidden token entry.');process.exit(1);}
console.log('Earth Detective N3: local-only server on 127.0.0.1:3010. No token file will be written.');
process.stdout.write('Paste Earthdata token (hidden), then Enter: ');
let secret='';process.stdin.setRawMode(true);process.stdin.resume();process.stdin.setEncoding('utf8');
const read=chunk=>{
 for(const char of chunk){
  if(char==='\u0003'){secret='';process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\nCancelled.\n');process.exit(130);}
  if(char==='\r'||char==='\n'){
   process.stdin.off('data',read);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');
   if(!secret||/\s/.test(secret)||secret.length>8192){secret='';console.error('Invalid token input.');process.exit(1);}
   const env={...process.env,EARTH_MODE:'local',EARTHDATA_TOKEN:secret,EARTH_CACHE:'memory',NEXT_TELEMETRY_DISABLED:'1'};
   const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3010'],{stdio:'inherit',env});
   secret='';delete env.EARTHDATA_TOKEN;
   child.on('exit',code=>process.exitCode=code||0);child.on('error',()=>{console.error('Local server could not start.');process.exitCode=1;});return;
  }
  if(char==='\u007f'||char==='\b')secret=secret.slice(0,-1);else if(char>=' '&&char<='~')secret+=char;
 }
};
process.stdin.on('data',read);
