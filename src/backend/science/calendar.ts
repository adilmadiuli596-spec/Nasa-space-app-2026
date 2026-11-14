import 'server-only';
import {ScienceError} from './errors';
export function daysInMonth(year:number,month:number):number {
  if(!Number.isInteger(year)||year<1||year>9999||!Number.isInteger(month)||month<1||month>12) throw new ScienceError('invalid_month','Invalid Gregorian month');
  return month===2?((year%4===0&&year%100!==0)||year%400===0?29:28):[4,6,9,11].includes(month)?30:31;
}
export function parseMonth(month:unknown):{year:number;month:number} {
  if(typeof month!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||+month.slice(0,4)<1) throw new ScienceError('invalid_month','Monthly dates must use YYYY-MM');
  return {year:+month.slice(0,4),month:+month.slice(5)};
}
