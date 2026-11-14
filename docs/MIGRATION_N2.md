# EARTH DETECTIVE — MIGRATION N2

Дата: 14 ноября 2026, Asia/Qyzylorda. **N1 принят пользователем; выполнен только N2. Отчёт N2 ожидает проверки. N3 не начат.**

Рабочий проект `D:\Projects\Earth Detective`; исходный `D:\Projects\NASA` только читался. Один Next.js App Router + TypeScript проект, один локальный Git-репозиторий. API, frontend, NASA adapter, 3D и зависимости не изменялись. Расходы **0 KZT**. Git push/деплоя нет.

## 1. Реализованные модули

- `src/backend/science/aggregation.ts`
- `src/backend/science/calendar.ts`
- `src/backend/science/coordinates.ts`
- `src/backend/science/errors.ts`
- `src/backend/science/hac.ts`
- `src/backend/science/index.ts`
- `src/backend/science/inference.ts`
- `src/backend/science/interpretation.ts`
- `src/backend/science/numeric.ts`
- `src/backend/science/ols.ts`
- `src/backend/science/result.ts`
- `src/backend/science/series.ts`
- `src/backend/science/student.ts`
- `src/backend/science/units.ts`

- calendar: строгий YYYY-MM и Gregorian days, включая столетние правила leap year.
- series: полный упорядоченный период, уникальность/пропуски, finite numeric values и fill; никакой интерполяции или silent dropping.
- units: K→°C, kg kg−1→g/kg; точное совпадение source units и исходные широкие physical screening bounds.
- aggregation: среднегодовые по дням месяца, 12 полных месяцев; не среднее из 12 равных весов.
- coordinates: ближайшая ячейка, lower-index ties, dateline wrap, исходная сетка 0.5°×0.625°.
- ols/numeric: intercept и центрированный год, binary64 и Neumaier summation, fitted/residual/SSE/SST/R².
- hac/student/inference: полноценная covariance sandwich 2×2, Bartlett/Newey–West, SE, Student t tail и 95% quantile, p/CI/significance и корректные degenerate cases.
- interpretation: significant / not_significant / undefined, направление и предостережение о причинности.
- result/index/errors: единый чистый pipeline `scientificResult(request, loadedSeries)`, качество, provenance, warnings, безопасные ошибки и валидация результата.

Общие схемы `src/shared/schemas/science.ts` и `result.ts` задают входной LoadedSeries, cell/provenance и полный результат; UI Result продолжает выводиться из этой же схемы. Все серверные модули импортируют server-only. Математики в React или Route Handlers нет. В ядре нет filesystem/network, чтения fixture/эталонного ответа или hardcoded slope/p/CI. Старые N1 spike-файлы только делегируют ядру, дублирующие алгоритмы убраны.

## 2. Методика и соответствие Python

Основной результат всегда использует **HAC lag 3**, Bartlett weights `1−lag/(3+1)`, finite-sample correction `n/(n−2)`, OLS с intercept и центрированным годом, Student t `df=n−2`, двухсторонний p, CI 95%, α=.05. Никакой замены на обычную OLS covariance, Gaussian/z inference или другого лага ради численного совпадения нет. Отдельный hacCovariance допускает sensitivity lags; основной hacTrend не имеет переключателя лага.

Постоянный ряд: slope=0, p/CI/SE/significance=null, R²=null. Точный линейный ряд: реальный slope, R²=1, inference=null. Порог вырожденности тот же: `64·eps·max(1,max|y|)`. Минимум пять полных последовательных лет. Quality содержит expected/actual months, missing counts, complete years и physical screening. Объявления provenance проверяются и сохраняются; URL с credentials/query/fragment и отрицательные cache counts отклоняются безопасно.

## 3. Полные эталоны и таблица Python ↔ TypeScript

Павлодар — ячейка 52.5°,76.875°; Берлин — 52.5°,13.125°. Для каждой переменной 420 реальных месячных значений 1991–2025. Павлодар взят из сохранённого monthly_values.json. Берлин — из 420 сохранённых scientific payloads прежней NASA-проверки: проверены envelope SHA-256, продукт/версия/DOI/units/cell/date и совпадение всех converted monthly values с исходными 3C JSON. Служебные cache envelopes не копировались в Git.

`scripts/generate-n2-oracle.py` воспроизводит текущий неизменённый Python офлайн; `tests/fixtures/n2/real-cases.json` сохраняет raw input, свежий oracle и **полные оригинальные 3C JSON**. `extraction.json` содержит происхождение и hashes. Никакой новой NASA загрузки не было. Исторические source network/cache flags в replay — metadata сохранённого 3C snapshot, а не утверждение, что N2 делал запрос в сеть.

| Анализ | Реализация | Тренд / десятилетие | p-value | 95% CI |
|---|---|---:|---:|---|
| PAVLODAR_T2M | Python | 0.091794577579068434 | 0.51295139905561815 | [-0.19057482338418921; 0.37416397854232608] |
| PAVLODAR_T2M | TypeScript | 0.091794577579068365 | 0.51295139905561948 | [-0.19057482338418938; 0.37416397854232608] |
| PAVLODAR_QV2M | Python | 0.17981239344380076 | 0.0023834887902114427 | [0.068645400282176514; 0.29097938660542499] |
| PAVLODAR_QV2M | TypeScript | 0.17981239344380087 | 0.002383488790211441 | [0.068645400282176736; 0.29097938660542499] |
| BERLIN_T2M | Python | 0.59097349277358546 | 1.1452797118958998e-06 | [0.38861611009588959; 0.79333087545128134] |
| BERLIN_T2M | TypeScript | 0.59097349277358568 | 1.1452797118958437e-06 | [0.38861611009589037; 0.793330875451281] |
| BERLIN_QV2M | Python | 0.2185026813732438 | 4.4961594103913643e-08 | [0.1554869143924395; 0.2815184483540481] |
| BERLIN_QV2M | TypeScript | 0.21850268137324369 | 4.4961594103913597e-08 | [0.15548691439243942; 0.28151844835404793] |

T2M — °C/десятилетие; QV2M — (g/kg)/десятилетие. Ни один из четырёх эталонов не сравнивался только с округлёнными числами пользовательского задания.

## 4. Численные расхождения

Абсолютные ошибки относительно свежего Python на тех же raw monthly observations:

| Анализ | Δ slope | Δ SE | Δ p | Δ CI lower | Δ CI upper | Δ R² | max Δ fitted |
|---|---:|---:|---:|---:|---:|---:|---:|
| PAVLODAR_T2M | 6.9389e-17 | 5.5511e-17 | 1.3323e-15 | 1.6653e-16 | 0.0000e+00 | 2.2204e-16 | 4.4409e-16 |
| PAVLODAR_QV2M | 1.1102e-16 | 4.1633e-17 | 1.7347e-18 | 2.2204e-16 | 0.0000e+00 | 2.2204e-16 | 1.7764e-15 |
| BERLIN_T2M | 2.2204e-16 | 2.6368e-16 | 5.6116e-20 | 7.7716e-16 | 3.3307e-16 | 2.2204e-16 | 1.7764e-15 |
| BERLIN_QV2M | 1.1102e-16 | 1.3878e-17 | 4.6322e-23 | 8.3267e-17 | 1.6653e-16 | 0.0000e+00 | 1.7764e-15 |

Максимальная абсолютная ошибка среди всех сравниваемых числовых полей четырёх результатов — **3.552713678800501e−15**. Отдельно сравниваются все monthly/annual values, fitted, slope/SE/p/CI/R², requested/actual cell, quality, method settings, provenance и warnings с **двумя** источниками: свежим Python и оригинальными 3C JSON (`docs/N2_PARITY.json`). Все сравнения прошли.

Допуск не менялся: `abs(TS−Python) ≤ 1e−12 + 1e−10·abs(Python)`. Разные порядок суммирования, NumPy/BLAS/SVD и JS binary64/Lanczos/continued fraction объясняют последние разряды. Python-library-version fields намеренно не скопированы в TS: output честно указывает TypeScript implementation/arithmetic. Measured timings тоже не должны совпадать. Эти runtime поля — явные исключения сравнения; научные и source metadata поля не исключались. Исторические JSON без fitted values проверяются по всем имеющимся полям, а fitted дополнительно сверяются с актуальным Python.

## 5. Автоматические проверки

- **176 TypeScript tests passed, 0 failed, 0 skipped**; 168 новых параметризованных/групповых тестов N2 и 8 прежних N1.
- В четырёх группах проверены **1984 полных pipeline расчёта**: все 496 непрерывных интервалов 5–35 лет для каждой пары ячейка/переменная. Это не 1984 копии готового ответа: TS заново валидирует месяцы, конвертирует, агрегирует и вычисляет тренд.
- 48 независимых statsmodels covariance cases: n=5/6/10/20/35, оба направления наклона, sensitivity lag 0…4 в допустимом диапазоне; сравнение intercept, slope, полной covariance matrix и trend.
- 80 Student t cases: малые/большие tails, симметрия, CI critical; SciPy и независимая аналитическая проверка df=1.
- Полные ряды, неполные годы, отсутствующие/дублированные/переставленные/лишние месяцы, неправильная дата/day, null/NaN/Infinity/string/bool/object, fill, неверные units и physical bounds, leap/century years, constant/exact positive/exact negative trend, noisy trends/CI/HAC sensitivity, coordinate ties/dateline/poles, source mismatch и испорченная provenance.
- **107 Python tests passed, 0 failed**, повторный запуск неизменённой сохранённой реализации; `N2_PYTHON_TESTS.xml`. Существующее environment исходного проекта использовалось read-only с PYTHONDONTWRITEBYTECODE=1; временные файлы только внутри нового проекта.
- Typecheck, import boundary guard и отрицательный server-only Next build — PASS. Логи `N2_TESTS.log`, `N2_TYPECHECK.log`, `N2_SERVER_ONLY.log`, `N2_BUILD.log`. Предыдущие N1 reports сохранены.

## 6. Production-сборка и регрессия приложения

`npm run build` **PASS** (Next.js 16.4.6). Маршруты /, /api/health, /api/variables, /api/analysis собраны. Next локально запущен на 127.0.0.1:3010 (Ready 239 ms в проверенном запуске), затем остановлен. Это локальное измерение, не обещание скорости NASA/Vercel.

HTTP health/variables=200, invalid request=422, malformed JSON=400, valid analysis=**503 migration_pending**. Ядро не подключено к публичному API. Отдельный `scripts/verify-n2-ui.mjs` проверил неизменённые desktop 1440×900/mobile 390×844, размеры/позиции, открытие/закрытие панели, overflow и обработку 503; page errors=0. Новые screenshots/JSON имеют префикс N2. Реальные OpenFreeMap tile responses наблюдались; полная стабильная отрисовка подложки, как и после N1, не объявляется подтверждённой. Frontend-код и исходный CSS побайтово не менялись.

## 7. Найденные ошибки и ограничения

1. Первый дополнительный Student test df=1,t=1e−8 показал SciPy `0.9999999905136262`, тогда как аналитическая формула Cauchy `1−2·atan(|t|)/π` и TS дают `0.9999999936338023`. Для df=1 используется независимый analytic oracle; исходное SciPy число сохранено. **df=1 не входит в рабочий scientific диапазон df=3…33**. Ни production расчёт, ни основные Python-эталоны/допуски не подгонялись.
2. Тест malformed provenance URL обнаружил, что refine Zod может выполняться после неудачного URL-check; незащищённый URL constructor бросал TypeError. Исправлено catch→validation failure; наружу выходит фиксированный ScienceError без исходного URL/секрета. Финальный запуск: 0 failed.
3. Ядро работает с decoded LoadedSeries. Оно проверяет декларации hash/provenance, но не доказывает подлинность NASA bytes и не декодирует NetCDF/HDF5, scale_factor/add_offset или произвольные NASA calendars. Это работа будущего adapter; текущий Gregorian contract не расширялся.
4. Исторические network/cache flags и response hashes в replay описывают происхождение snapshot. Они не доказывают свежий сетевой доступ, доступ Earthdata или права общего публичного аккаунта.
5. HAC/t остаются приближёнными для малых n, structural uncertainty реанализа не квантифицирована, p не означает причинность, отсутствие significance не доказывает отсутствие изменения. Нет регионального spatial averaging или multiple-testing correction (как у Python: none).
6. Новый HTTP scientific endpoint, public Earthdata auth, Vercel runtime/memory/bundle verification и 3D не реализованы. Старый Python сохранён; полная интеграция не объявляется готовой.

Математические первоисточники: [statsmodels robust covariance](https://www.statsmodels.org/stable/generated/statsmodels.regression.linear_model.RegressionResults.get_robustcov_results.html), [NIST incomplete beta](https://dlmf.nist.gov/8.17), [SciPy t](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.t.html), [SciPy Cauchy](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.cauchy.html). NASA source/citation policy предыдущего этапа сохранена.

## 8. Сохранность исходников и данных

`N2_INTEGRITY.json`: повторно проверены все **514** исходников/копий manifest N1; **0 изменённых в NASA, 0 изменённых сохранённых копий**. Отдельно проверены исходные 420 Berlin payload files, из которых подготовлен fixture: 0 изменённых. Зафиксирован before snapshot; frontend, API handlers, NASA adapter, reference/, history и N1 artifacts не менялись. Научные исходные файлы/эталонные числа не перезаписывались. Новые fixtures и результаты записаны отдельно.

## 9. Расходы и безопасность

**Расходы 0 KZT. Новых зависимостей 0.** package.json и package-lock.json идентичны N1. Использованы существующие бесплатные JS/TS-инструменты и локальный Python oracle. Новых платных API, БД, billing, subscriptions, дополнительных сервисов нет. Credentials не читались, не запрашивались в чате и не переносились из .env/netrc/cookies. Нет NASA network requests, Earthdata login или public auth. Обычная загрузка карты при регрессионном тесте использует прежний бесплатный OpenFreeMap.

## 10. Что остаётся следующему этапу — без разрешения не начинать

Нужно отдельно утвердить scope N3: production NASA decoding/metadata/fill/scale/calendar validation, bounded I/O/cache и привязку LoadedSeries к доказанному реальному источнику; интегрировать scientificResult с тонким API и end-to-end tests. Решить безопасную Earthdata авторизацию и правомерность public shared access, проверить Vercel Hobby budgets/limits без расходов. Пока не объявлять анализ доступным произвольной глобальной ячейке.

Обновлены AGENTS.md, ARCHITECTURE.md, SCIENCE.md, MIGRATION_PLAN.md, COST_POLICY.md и PROGRESS.md. N1 отчёт/история сохранены. **После этого отчёта работа остановлена. N3, git push и деплой не выполнялись и не разрешены.**
