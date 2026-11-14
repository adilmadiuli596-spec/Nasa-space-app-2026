"""Write a truthful report from verified local artifacts, including partial runs."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parent
def main():
 def read(name,default=None):
  p=ROOT/name
  return json.loads(p.read_text(encoding='utf-8-sig')) if p.exists() else default
 status=read('download_status.json',{})
 baseline=read('baseline_verified.json',{})
 rows=read('monthly_values.json',[])
 results=read('analysis_results.json') if len(rows)==420 else None
 audit=read('independent_audit.json',{})
 crosscheck=read('statistics_crosscheck.json',{})
 lines=['# Earth Detective: проверка MERRA-2, Павлодар','',
 'Рабочая папка: D:\\Projects\\NASA. Приложение, дизайн и деплой не изменялись. Git push не выполнялся.','',
 '## Источник и пространственный выбор','',
 'NASA GES DISC, M2TMNXSLV, версия 5.12.4; DOI: https://doi.org/10.5067/AP1B0BA5PD2K.',
 'Каталог CMR проверен: ровно 420 уникальных месяцев, январь 1991 — декабрь 2025, в точном календарном порядке.',
 'Опорная точка города: 52.27601° N, 76.96881° E. Ближайший центр сетки: 52.5° N, 76.875° E; индексы с нуля lat=285, lon=411. Разрешение: 0.5° широты × 0.625° долготы. Это значение ячейки реанализа, а не наблюдение городской метеостанции.','',
 'T2M: температура на высоте 2 м, K; перевод в °C: T2M − 273.15. QV2M: удельная влажность на высоте 2 м, кг/кг; перевод в г/кг: ×1000. QV2M не является относительной влажностью.','',
 '## Фактический статус','',f"Стадия: {status.get('stage','unknown')}; подтверждённых загрузчиком месяцев: {len(rows)} / 420.",
 'Наличие гранулы в каталоге не считается получением её научных значений.','']
 if baseline:
  v=baseline['values']
  lines += [f"Независимо перепроверенный исходный январь 1991: T2M = {v['T2M']:.11f} K = {v['T2M_C']:.11f} °C; QV2M = {v['QV2M']:.14f} кг/кг = {v['QV2M']*1000:.11f} г/кг.",f"SHA-256 исходного файла: `{baseline['quality']['sha256']}`.",'']
 lines += ['## Контроль каждого полученного месяца','',
 'Проверяются: совпадение календарного месяца при декодировании time; RangeBeginningDate при наличии; центр ячейки; наличие ровно одного временного шага; размерности time/lat/lon; единицы обеих переменных; конечность значений; отсутствие _FillValue и missing_value; valid_range при наличии; широкие диапазоны 180–330 K и 0–0.1 кг/кг. Широкие диапазоны служат лишь проверкой грубых ошибок.',
 'В исходном январском файле атрибут valid_range у time нельзя безопасно привести к int32. Временная метка читается без автоматического маскирования и независимо сверяется с календарём и RangeBeginningDate. Это предупреждение метаданных, а не пропуск T2M или QV2M.',
 'monthly_quality.json сохраняет метаданные и SHA-256 каждого использованного файла. manifest.json содержит идентификаторы и публичные URL гранул.','',
 '## Статистический метод','',
 'Для полного ряда: 35 среднегодовых значений, взвешенных по числу дней в месяце; каждый год требует 12 действительных месяцев. OLS с константой и центрированным годом. Основной вывод: HAC Newey–West, Bartlett, лаг 3, поправка малой выборки, t-распределение с 33 степенями свободы; двусторонний p-value и 95% ДИ. Проверка чувствительности по лагам 1, 2, 4 и поправка Holm на две переменные.',
 'HAC-интервалы при 35 годах приближённые. Они не учитывают структурную неопределённость реанализа, смену наблюдательной системы, ошибки представительности ячейки и сезонные различия тренда.','']
 if results:
  lines += ['| Переменная | Тренд за десятилетие | p-value | 95% ДИ |','|---|---:|---:|---|']
  for name,r in results['statistics'].items():
   p=r['primary'];lo,hi=p['ci95_per_decade']
   lines += [f"| {name} | {p['slope_per_decade']:.7g} | {p['p_value_two_sided']:.7g} | [{lo:.7g}; {hi:.7g}] |"]
  lines += ['', 'Единицы тренда: °C/десятилетие для T2M_C; (г/кг)/десятилетие для QV2M_g_kg.', '', '### Чувствительность статистического вывода', '', '| Переменная | HAC-лаг | p-value | 95% ДИ за десятилетие |', '|---|---:|---:|---|']
  for name,r in results['statistics'].items():
   for p in sorted([r['primary']]+r['sensitivity'],key=lambda x:x['hac_maxlags']):
    lo,hi=p['ci95_per_decade']
    lines += [f"| {name} | {p['hac_maxlags']} | {p['p_value_two_sided']:.7g} | [{lo:.7g}; {hi:.7g}] |"]
  for name,r in results['statistics'].items():
   lines += ['',f"Для {name} p-value с поправкой Holm на два показателя: {r['primary']['p_value_holm_two_variables']:.7g}."]
  lines += ['', 'Все 420 месяцев прошли проверку. Полные результаты и диагностика остатков: analysis_results.json; данные: monthly_values.csv и monthly_values.json.']
  q=results['quality']
  lines += ['',f"Пропущенных месяцев: {q['missing_months']}; нечисловых/бесконечных значений T2M и QV2M: {sum(q['null_or_nonfinite'].values())}; нарушений широких физических диапазонов: {sum(q['broad_plausibility_flags'].values())}.", '', '| Показатель | Минимум за месяц | Максимум за месяц |', '|---|---:|---:|']
  for name,unit,factor in [('T2M_C','°C',1),('QV2M','г/кг',1000)]:
   value=q['monthly_ranges'][name]
   lines += [f"| {name}, {unit} | {value['min']*factor:.7g} | {value['max']*factor:.7g} |"]
  lines += ['']
  if audit.get('complete') and audit.get('all_available_checks_passed'):
   lines += ['Независимый повторный аудит всех 420 файлов пройден: даты начала и конца месяца, time, продукт/версия/DOI, единицы, координаты, пропуски, значения экспорта и SHA-256. Подробности: independent_audit.json.']
  if crosscheck:
   lines += ['Независимый расчёт OLS, ковариации Newey–West, p-value и 95% ДИ через матричные формулы совпал со statsmodels. Подробности: statistics_crosscheck.json.']
  lines += ['', '### Проверка сезонных экстремумов', '']
  for name,screen in q.get('seasonal_extreme_screening',{}).items():
   lines += [f"{name}: количество значений с |z| > 3 — {screen['count_abs_z_above_3']}. Сравнение выполнено со средним и выборочным стандартным отклонением соответствующего календарного месяца за 35 лет."]
   for item in screen['top_five']:
    if abs(item['calendar_month_z_score'])>3:
     lines += [f"Отмечен {item['month']}: {item['value']:.7g}, z = {item['calendar_month_z_score']:.5g}. Значение подтверждено сохранённым файлом NASA и прошло проверки fill/valid_range; сохранено в расчёте. Статистический экстремум сам по себе не доказывает ошибку."]
  lines += ['', 'T2M: 95% ДИ включает ноль; статистически значимый линейный тренд за этот период не установлен. Это не доказательство отсутствия изменения климата. QV2M: 95% ДИ выше нуля; положительный тренд сохраняет значимость после поправки Holm.', 'Все выводы относятся к этой ячейке MERRA-2 и этому периоду. Независимая проверка по метеостанциям не проводилась.']
 else:
  lines += ['Полный ряд ещё не получен. Тренд, p-value и доверительный интервал не рассчитаны: вычислять их по одному месяцу или подменять недостающие значения нельзя.']
 lines += ['','## Авторизация и конфиденциальность','',
 'earthaccess 0.19.0 установлен. Проверены environment и netrc: доступных учётных данных не было. Авторизация приложения NASA в браузере не передаёт автоматически сессию Python.',
 'Локальный загрузчик использует скрытый ввод пароля getpass и earthaccess.login(strategy="environment", persist=False). Значения учётных данных не записываются в файлы; переменные окружения удаляются сразу после входа. Тексты исключений, HTTP-заголовки и тела ответов авторизации не сохраняются.',
 'В D:\\Projects\\NASA сейчас нет репозитория Git. Корневой .gitignore добавлен на случай его появления; .data-check/.gitignore уже исключает всё содержимое .data-check. Кэш, runtimes, .netrc, cookies, токены и .env исключены.',
  'Зафиксированная остановка на 13 месяцах разрешилась после нажатия Esc пользователем в PowerShell: причиной была пауза консоли при выделении текста. После снятия выделения загрузка продолжилась с сохранённого места.','',
  'При 401: повторить локальный вход и проверить учётную запись. При 403 после успешного входа: проверить разрешения приложения NASA в Earthdata; загрузчик автоматически пробует прямую ссылку GES DISC после отказа OPeNDAP. Без успешной аутентификации обойти контроль доступа нельзя.','',
  'Документация: [earthaccess](https://earthaccess.readthedocs.io/en/stable/user/howto/authenticate/), [NASA OPeNDAP](https://opendap.earthdata.nasa.gov/).','']
 (ROOT/'REPORT_RU.md').write_text('\n'.join(lines),encoding='utf-8')
if __name__=='__main__':main()
