import {resultSchema} from '@/shared/schemas/result';
import {catalogSchema,healthSchema} from '@/shared/schemas/catalog';
import type {Query,Result} from '@/shared/types/api';
export type {Point,Query,Result} from '@/shared/types/api';
export type {Catalog,Health} from '@/shared/schemas/catalog';
const messages:Record<string,string>={
 nasa_auth_required:'Сервер не авторизован в NASA. Сообщите администратору; карту и координаты можно использовать.',
 nasa_auth_rejected:'NASA отклонила авторизацию сервера. Требуется обновить доступ на сервере.',
 nasa_token_expired:'Срок доступа сервера к NASA истёк. Сообщите администратору.',
 nasa_forbidden:'NASA не разрешила серверу получить эти данные. Проверьте доступ через администратора.',
 public_access_unconfirmed:'Публичный доступ Earthdata пока не разрешён. Анализ доступен в локальном режиме или в явно выбранном демо.',
 local_only:'Этот сервер разрешает динамический анализ только при локальном подключении.',
 demo_cell_unavailable:'В демо доступны только ячейки Павлодара и Берлина. Эта точка не анализировалась; выберите одну из доступных ячеек.',
 nasa_rate_limited:'NASA временно ограничила запросы. Попробуйте позже.',
 analysis_busy:'Сервер уже выполняет другие анализы. Повторите запрос позже.',
 nasa_timeout:'NASA не ответила за отведённое время. Попробуйте ещё раз; уже полученные месяцы могут быть в кэше.',
 nasa_transport_error:'Не удалось подключиться к NASA. Проверьте сеть и повторите запрос.',
 nasa_unavailable:'NASA временно недоступна. Попробуйте позже.',
 nasa_invalid_format:'Данные NASA не прошли проверку формата. Результат не рассчитан.',
 nasa_invalid_data:'Данные NASA не прошли научную проверку. Результат не рассчитан.',
 nasa_missing_data:'В данных NASA есть пропуски. Они не заменены вымышленными значениями.',
 nasa_incomplete_series:'NASA вернула неполный временной ряд. Анализ не выполнен.',
 nasa_invalid_catalog:'Каталог NASA не прошёл проверку. Повторите запрос позже.',
 nasa_granule_unavailable:'Один из файлов NASA недоступен. Полный анализ не выполнен.',
 nasa_redirect_error:'NASA запросила другой способ авторизации. Сообщите администратору.',
 nasa_response_too_large:'NASA вернула слишком большой файл вместо ограниченной выборки. Анализ остановлен.',
 invalid_request:'Проверьте координаты, показатель и период анализа.',
 inference_failed:'Не удалось получить достоверную статистику. Результат не подменён.',
 invalid_result:'Сервер вернул некорректный результат. Повторите запрос позже.'
};
export class ApiError extends Error {
 constructor(public readonly code:string,public readonly status:number,public readonly retryAfterSeconds?:number){super(messages[code]||`Сервер вернул ошибку (HTTP ${status}). Повторите запрос позже.`);this.name='ApiError';}
}
export async function api<T>(path:string,options?:RequestInit):Promise<T>{
 let response:Response;
 try{response=await fetch('/api/'+path,{...options,cache:'no-store'});}catch(error){if(options?.signal?.aborted)throw error;throw new Error('Нет связи с сервером. Проверьте подключение и повторите запрос.');}
 if(!response.ok){const body=await response.json().catch(()=>null),retry=Number(response.headers.get('retry-after'));throw new ApiError(typeof body?.error?.code==='string'?body.error.code:'http_error',response.status,Number.isFinite(retry)&&retry>0?retry:undefined);}
 try{return await response.json();}catch{throw new ApiError('invalid_result',502);}
}
export async function connection(signal:AbortSignal){
 const [health,catalog]=await Promise.all([api<unknown>('health',{signal}),api<unknown>('variables',{signal})]);
 const h=healthSchema.safeParse(health),c=catalogSchema.safeParse(catalog);if(!h.success||!c.success)throw new ApiError('invalid_result',502);return {health:h.data,catalog:c.data};
}
export function checkedResult(input:unknown,query:Query,mode?:string):Result {
 const result=resultSchema.safeParse(input);if(!result.success)throw new ApiError('invalid_result',502);
 const years=query.end_year-query.start_year+1;
 if(result.data.monthly_series.length!==years*12||result.data.annual_series.length!==years||result.data.trend.fitted_values.length!==years)throw new ApiError('invalid_result',502);
 if(Object.entries(query).some(([k,v])=>result.data.requested[k as keyof Query]!==v))throw new Error('Ответ относится к другому запросу. Выберите точку и запустите анализ снова.');
 if(mode&&(mode==='offline_verified_demo'?result.data.provenance.mode!=='offline_verified_demo':mode==='nasa_opendap_local'?result.data.provenance.mode!=='nasa_opendap':mode==='nasa_power'?result.data.provenance.mode!=='nasa_power':true))throw new Error('Источник результата не совпадает с режимом подключения. Повторите подключение к серверу.');
 return result.data;
}
export async function requestAnalysis(query:Query,signal:AbortSignal,mode?:string){return checkedResult(await api<unknown>('analysis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(query),signal}),query,mode);}
export const names:Record<string,string>={T2M:'Температура воздуха',QV2M:'Удельная влажность'};
