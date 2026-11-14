import type {AnalysisPair,Query} from '../api';
const key=(q:Query,source:string)=>JSON.stringify([source,q.latitude,q.longitude,q.start_year,q.end_year]);
// A small session-local cache. Variables share a pair; different coordinates/periods/sources never do.
export class PairCache{
 private entries=new Map<string,AnalysisPair>();
 constructor(private readonly capacity=8){}
 get(q:Query,source:string){const k=key(q,source),p=this.entries.get(k);if(p){this.entries.delete(k);this.entries.set(k,p);}return p;}
 set(q:Query,source:string,p:AnalysisPair){const k=key(q,source);this.entries.delete(k);this.entries.set(k,p);while(this.entries.size>this.capacity)this.entries.delete(this.entries.keys().next().value!);}
}
