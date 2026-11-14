import 'server-only';
import {configFromEnv,PUBLIC_DYNAMIC_ACCESS_CONFIRMED} from '../nasa/config';
import {TokenProvider} from '../nasa/auth';
import {demoCells} from '../nasa/demo';
export function health() {
 const config=configFromEnv();if(config.mode==='power')return {status:'ok',stage:'P0',mode:'power',nasa_network:'checked_per_request',earthdata_auth:'not_required',dynamic_nasa_enabled:true,public_dynamic_access_confirmed:true,earthdata_public_access_confirmed:false,cache:'memory',analysis:'nasa_power_monthly_point'};let auth='not_required';
 if(config.mode==='local'){try{new TokenProvider().check();auth='configured_not_verified';}catch(error){auth=(error as {code?:string}).code||'not_configured';}}
 return {status:'ok',stage:'N3',mode:config.mode,nasa_network:'not_checked',earthdata_auth:auth,dynamic_nasa_enabled:config.mode==='local'&&auth==='configured_not_verified',public_dynamic_access_confirmed:PUBLIC_DYNAMIC_ACCESS_CONFIRMED,cache:config.cache,analysis:config.mode==='demo'?'two_cell_demonstration':config.mode==='local'?'local_authorized_adapter':'public_access_blocked'};
}
export function variables() {
 const config=configFromEnv();
 if(config.mode==='power')return {variables:[{id:'T2M',name:'Температура воздуха',source_unit:'C',unit:'°C',trend_unit:'°C/decade'},{id:'QV2M',name:'Удельная влажность',source_unit:'g/kg',unit:'g/kg',trend_unit:'(g/kg)/decade'}],supported_period:{start_year:1991,end_year:2025,minimum_complete_years:5},source_mode:'nasa_power',dynamic_nasa_enabled:true,available_cells:null,coverage:'NASA POWER global monthly point API; availability and completeness validated per request',coordinate_policy:'POWER native meteorology resolution 0.5 × 0.625 degrees; returned geometry is requested point, not verified grid centre',public_dynamic_access_confirmed:true,earthdata_public_access_confirmed:false};
 return {variables:[{id:'T2M',name:'Температура воздуха',source_unit:'K',unit:'°C',trend_unit:'°C/decade'},{id:'QV2M',name:'Удельная влажность',source_unit:'kg kg-1',unit:'g/kg',trend_unit:'(g/kg)/decade'}],supported_period:{start_year:1991,end_year:2025,minimum_complete_years:5},source_mode:config.mode==='demo'?'offline_verified_demo':config.mode==='local'?'nasa_opendap_local':'public_access_blocked',dynamic_nasa_enabled:config.mode==='local',available_cells:config.mode==='demo'?demoCells:null,coverage:config.mode==='demo'?'Two saved NASA grid cells only; not global dynamic analysis':config.mode==='local'?'MERRA-2 grid; availability and Earthdata authorization checked per request':'blocked',coordinate_policy:'Nearest MERRA-2 cell; ties choose smaller array index; longitude wraps at 180 degrees',public_dynamic_access_confirmed:PUBLIC_DYNAMIC_ACCESS_CONFIRMED};
}
