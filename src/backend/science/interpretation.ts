import 'server-only';
import type {Result} from '@/shared/types/api';
export function interpretTrend(trend:Result['trend']) {
  if(trend.status!=='estimated') return {conclusion:'undefined' as const,direction:null,message:'Для вырожденного ряда значимость и доверительный интервал не определены.'};
  const direction=trend.slope_per_decade>0?'increase' as const:trend.slope_per_decade<0?'decrease' as const:'flat' as const;
  return {conclusion:trend.significant?'significant' as const:'not_significant' as const,direction,message:trend.significant?'Тренд статистически значим при α = 0.05; это не доказательство причинности.':'Статистически значимый тренд при α = 0.05 не установлен; это не доказательство отсутствия изменения.'};
}
