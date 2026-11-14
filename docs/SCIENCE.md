# Научный эталон
Эталон: reference/.data-check/analysis_results.json, monthly_values.json/csv, monthly_quality.json, manifest.json; историческая методика сохранена в docs/history/pre-next/SCIENCE.md. Контрольные суммы переноса — MIGRATION_FILES.json и N1_INTEGRITY.json.

Источник NASA GMAO / GES DISC: M2TMNXSLV v5.12.4, DOI https://doi.org/10.5067/AP1B0BA5PD2K . 420 месяцев 1991-01–2025-12, ячейка Павлодара 52.5°, 76.875°. T2M: K -> °C вычитанием 273.15; QV2M: kg kg-1 -> г/кг умножением 1000. QV2M не относительная влажность и не проценты.

Годовые значения взвешены по числу дней месяца, требуются 12 конечных допустимых месяцев. Не интерполировать пропуски; проверять fill/missing, valid_range, scale_factor/add_offset, календарь, единицы, размерности и идентичность продукта. OLS с intercept и центрированным годом; Newey–West Bartlett lag=3, finite sample n/(n−2), t reference df=n−2, alpha=.05; минимум пять полных последовательных лет. В продукте multiple_testing_correction=none; исторический отчёт отдельно содержит Holm по двум показателям, это не один и тот же p-value.

Python-эталон T2M: slope/decade 0.09179457757906843, SE 0.13878951970391315, p .5129513990556182. QV2M: slope .17981239344380076, SE .05464052951629007, p .0023834887902114427. CI и полные ряды — в исходном JSON, не переписываются.

N2: единственная реализация находится в src/backend/science/. Прежние tests/science-spike.ts и student-spike.ts стали compatibility adapters. Python сохранён как независимый oracle. Полный in-memory pipeline совпал с Python и исходными 3C JSON для обеих ячеек/переменных, а все 1984 допустимых непрерывных периода 5–35 лет проверены с rtol=1e-10, atol=1e-12. Это подтверждает вычислительное ядро, но не готовность NASA adapter/API.

Данные реанализа описывают ячейку, не наземную станцию. Значимость не причинность; HAC/t приближённы для 35 лет. Пространственные множественные сравнения и структурная неопределённость реанализа не квантифицированы.

Берлин: фактическая ячейка 52.5°, 13.125°, 1991–2025. Raw месячные значения извлечены read-only из ранее проверенных cell_month scientific payloads, проверены envelope SHA-256, продукт/версия/единицы/координаты и сопоставление всех месяцев с 3C_API_BERLIN_*.json. В fixtures перенесены научные записи и аудит, не служебные cache envelopes. extraction.json указывает источник каждого из 420 payloads и версии oracle.

Сравниваются все месячные/годовые значения, fitted values, slope, SE, p, CI, R², quality, requested/actual cell, method settings, provenance и warnings. Только machine/runtime-specific library versions и timings не считаются численным тождеством: в TS они заменены правдивыми metadata. При replay исторические network/cache flags сохранены для сравнения исходного source snapshot; N2 не обращается к NASA и не выдаёт эти flags за текущую сетевую загрузку.

Float64 summation отличается от NumPy/BLAS: в TS Neumaier, в Python свои summation/SVD/BLAS routines. Student t вычисляется через regularized incomplete beta/Lanczos/continued fraction и численное обращение. Порог сравнения abs(TS−Python) ≤ 1e−12 + 1e−10·abs(Python), без округления исходных эталонов. Точные результаты — N2_PARITY.json.

Дополнительный тест df=1,t=1e−8 обнаружил различие установленной SciPy со стандартной аналитической формулой Коши: 0.9999999905136262 против 0.9999999936338023. df=1 не входит в рабочий диапазон ядра (минимум 5 лет → df≥3). Для вспомогательных df=1 тестов использована независимая формула 1−2·atan(|t|)/π; исходный результат SciPy сохранён в fixture. Основные допуски и Python-эталоны не менялись.

Справки: https://www.statsmodels.org/stable/generated/statsmodels.regression.linear_model.RegressionResults.get_robustcov_results.html ; https://dlmf.nist.gov/8.17 ; https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.t.html ; https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.cauchy.html . Неподтверждённый p не трактуется как отсутствие изменения, significance не причинность. Региональные полигоны и пространственные множественные сравнения не добавлялись.

## N3 integration
Научное ядро и параметры N2 не менялись. Новый NASA adapter передаёт реально декодированные source units в тот же scientificResult. Demo также заново вычисляет результат по raw NASA observations; он не подменяет dynamic запросы. Контрольные сравнения N3 учитывают, что current transport/cache flags, response hashes и measured timings обязаны описывать текущую загрузку; их нельзя копировать из исторического oracle ради побайтового совпадения metadata.

419 сохранённых реальных NetCDF4/HDF5 monthly subsets проверены новым MEMFS decoder, оба raw значения в каждом точно совпали с исходной проверкой (N3_ARCHIVE.json). Это offline replay, не новое authenticated скачивание. January 1991 global file сознательно не принимается за bounded single-cell subset. Свежие local NASA проверки четырёх эталонов и третьей ячейки прошли; статус и полные сравнения — N3_LIVE.json, N3_PARITY.json, MIGRATION_N3.md. Формулы N2 неизменны.
