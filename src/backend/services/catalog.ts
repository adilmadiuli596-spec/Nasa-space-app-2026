import 'server-only';
import {configFromEnv,PUBLIC_DYNAMIC_ACCESS_CONFIRMED} from '../nasa/config';
import {TokenProvider} from '../nasa/auth';
import {demoCells} from '../nasa/demo';
export function health() {
 const config=configFromEnv();let auth='not_required';
 if(config.mode==='local'){try{new TokenProvider().check();auth='configured_not_verified';}catch(error){auth=(error as {code?:string}).code||'not_configured';}}
 return {status:'ok',stage:'N3',mode:config.mode,nasa_network:'not_checked',earthdata_auth:auth,dynamic_nasa_enabled:config.mode==='local'&&auth==='configured_not_verified',public_dynamic_access_confirmed:PUBLIC_DYNAMIC_ACCESS_CONFIRMED,cache:config.cache,analysis:config.mode==='demo'?'two_cell_demonstration':config.mode==='local'?'local_authorized_adapter':'public_access_blocked'};
}
export function variables() {
 const config=configFromEnv();
 return {variables:[{id:'T2M',name:'Температура воздуха',source_unit:'K',unit:'°C',trend_unit:'°C/decade'},{id:'QV2M',name:'Удельная влажность',source_unit:'kg kg-1',unit:'g/kg',trend_unit:'(g/kg)/decade'}],supported_period:{start_year:1991,end_year:2025,minimum_complete_years:5},source_mode:config.mode==='demo'?'offline_verified_demo':config.mode==='local'?'nasa_opendap_local':'public_access_blocked',dynamic_nasa_enabled:config.mode==='local',available_cells:config.mode==='demo'?demoCells:null,coverage:config.mode==='demo'?'Two saved NASA grid cells only; not global dynamic analysis':config.mode==='local'?'MERRA-2 grid; availability and Earthdata authorization checked per request':'blocked',coordinate_policy:'Nearest MERRA-2 cell; ties choose smaller array index; longitude wraps at 180 degrees',public_dynamic_access_confirmed:PUBLIC_DYNAMIC_ACCESS_CONFIRMED};
}
