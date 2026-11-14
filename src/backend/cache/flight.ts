import 'server-only';
import {ScienceError} from '../science/errors';
type Flight<T>={controller:AbortController;promise:Promise<T>;users:number};
export class SingleFlight<T> {
 private entries=new Map<string,Flight<T>>();
 constructor(private readonly maxJobs=2) {}
 run(key:string,produce:(signal:AbortSignal)=>Promise<T>,signal:AbortSignal):Promise<T> {
  if(signal.aborted)return Promise.reject(new ScienceError('nasa_timeout','Analysis cancelled',504));
  let item=this.entries.get(key);
  if(!item){if(this.entries.size>=this.maxJobs)return Promise.reject(new ScienceError('analysis_busy','Local analysis capacity reached; retry later',429));const controller=new AbortController();item={controller,promise:Promise.resolve().then(()=>produce(controller.signal)),users:0};this.entries.set(key,item);const flight=item;void item.promise.then(()=>{if(this.entries.get(key)===flight)this.entries.delete(key);},()=>{if(this.entries.get(key)===flight)this.entries.delete(key);});}
  const flight=item;flight.users++;
  return new Promise<T>((resolve,reject)=>{
   let ended=false;
   const finish=()=>{if(ended)return false;ended=true;signal.removeEventListener('abort',cancel);if(--flight.users===0)flight.controller.abort();return true;};
   const cancel=()=>{if(finish())reject(new ScienceError('nasa_timeout','Analysis cancelled',504));};
   signal.addEventListener('abort',cancel,{once:true});if(signal.aborted)cancel();
   void flight.promise.then(v=>{if(finish())resolve(v);},e=>{if(finish())reject(e);});
  });
 }
}
