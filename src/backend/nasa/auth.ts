import 'server-only';
import {createHash} from 'node:crypto';
import {ScienceError} from '../science/errors';
export function assertNASAUrl(url:URL,authenticated=false) {
 const allowed=authenticated?url.hostname==='opendap.earthdata.nasa.gov'&&url.pathname.startsWith('/collections/C1276812859-GES_DISC/granules/'):url.hostname==='cmr.earthdata.nasa.gov'&&url.pathname==='/search/granules.json';
 if(url.protocol!=='https:'||url.port||url.username||url.password||url.hash||!allowed) throw new ScienceError('nasa_invalid_url','NASA endpoint is outside the allowed HTTPS service',502);
}
export class TokenProvider {
 private rejected='';
 constructor(private readonly read:()=>string|undefined=()=>process.env.EARTHDATA_TOKEN) {}
 private token():string {
  const token=this.read();
  if(!token) throw new ScienceError('nasa_auth_required','Configure an Earthdata token in the local server process',503);
  if(token.length>8192||/[\s\r\n]/.test(token)) throw new ScienceError('nasa_auth_required','Invalid Earthdata token configuration',503);
  const hash=createHash('sha256').update(token).digest('hex');
  if(this.rejected===hash) throw new ScienceError('nasa_auth_rejected','Earthdata rejected this token; configure a new token and retry',503);
  // JWT exp is only an early expiry hint. NASA validates authenticity, never this parser.
  try {const payload=JSON.parse(Buffer.from(token.split('.')[1]||'','base64url').toString());if(typeof payload.exp==='number'&&payload.exp*1000<=Date.now()+30000) throw new ScienceError('nasa_token_expired','Earthdata token expired or expires too soon; replace it locally',503);} catch(error) {if(error instanceof ScienceError)throw error;}
  return token;
 }
 check() {this.token();}
 fingerprint() {return createHash('sha256').update(this.token()).digest('hex');}
 headers(url:URL):HeadersInit {assertNASAUrl(url,true);return {Authorization:`Bearer ${this.token()}`};}
 invalidate() {const token=this.read();if(token)this.rejected=createHash('sha256').update(token).digest('hex');}
}
export function earthdataHeaders(url:URL):HeadersInit {return new TokenProvider().headers(url);}
