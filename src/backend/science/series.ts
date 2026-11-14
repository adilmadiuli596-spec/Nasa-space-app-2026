import 'server-only';
import {ScienceError} from './errors';
import {parseMonth} from './calendar';
export type MonthlyValue={month:string;value:number};
export function readMonthlyRecords(records:unknown,startYear:number,endYear:number,fillValues:readonly number[]=[]):MonthlyValue[] {
  if(!Number.isInteger(startYear)||!Number.isInteger(endYear)||startYear<1||endYear>9999||endYear<startYear) throw new ScienceError('invalid_period','Invalid calendar period');
  if(!Array.isArray(records)||records.length===0) throw new ScienceError('missing_months','No monthly observations are available');
  const rows:MonthlyValue[]=records.map(row=>{
    if(!row||typeof row!=='object'||!('month' in row)||!('value' in row)) throw new ScienceError('invalid_series','Malformed monthly observations');
    parseMonth(row.month);
    if(row.value===null||row.value===undefined||(typeof row.value==='number'&&!Number.isFinite(row.value))) throw new ScienceError('missing_values','Missing or non-finite monthly values; no imputation is allowed');
    if(typeof row.value!=='number') throw new ScienceError('invalid_values','Monthly values must be real numbers');
    if(fillValues.includes(row.value)) throw new ScienceError('fill_values','NASA fill values are not observations');
    return {month:row.month as string,value:row.value};
  });
  if(new Set(rows.map(r=>r.month)).size!==rows.length) throw new ScienceError('duplicate_months','Duplicate monthly observations are not allowed');
  if(rows.some((r,i)=>i>0&&r.month<rows[i-1].month)) throw new ScienceError('unordered_months','Monthly observations must be ordered');
  const expected=(endYear-startYear+1)*12;
  if(rows.length!==expected||rows.some((r,i)=>r.month!==`${startYear+Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')}`)) throw new ScienceError('missing_months','The period requires exactly 12 valid months per calendar year');
  return rows;
}
