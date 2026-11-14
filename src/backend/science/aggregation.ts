import 'server-only';
import {ScienceError} from './errors';
import {daysInMonth,parseMonth} from './calendar';
import {sum} from './numeric';
import type {MonthlyValue} from './series';
export function annualMeans(monthly:readonly MonthlyValue[]) {
  if(!monthly.length) throw new ScienceError('invalid_series','A nonempty monthly series is required');
  const groups=new Map<number,MonthlyValue[]>();let previous='';
  for(const row of monthly) {
    const {year}=parseMonth(row.month);
    if(row.month<=previous) throw new ScienceError('invalid_series','Monthly timestamps must be unique and ordered');
    previous=row.month;const group=groups.get(year)||[];group.push(row);groups.set(year,group);
  }
  return [...groups].map(([year,group])=>{
    if(group.length!==12||group.some((r,i)=>r.month!==`${year}-${String(i+1).padStart(2,'0')}`||typeof r.value!=='number'||!Number.isFinite(r.value))) throw new ScienceError('incomplete_year','Annual aggregation requires all 12 finite calendar months');
    const weights=group.map((_,i)=>daysInMonth(year,i+1)),days=sum(weights);
    return {year,value:sum(group.map((r,i)=>r.value*weights[i]))/days,months:12 as const,days};
  });
}
