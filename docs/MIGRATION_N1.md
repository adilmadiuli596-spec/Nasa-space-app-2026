# EARTH DETECTIVE — MIGRATION N1

Дата: 14 ноября 2026, Asia/Qyzylorda. **N1 выполнен в разрешённых границах и передан на проверку; пользователь его ещё не утвердил. N2 не начат.**

Рабочий проект: `D:\Projects\Earth Detective`. Исходный `D:\Projects\NASA` сохранён. Целевая папка до работы существовала и была пуста; перезаписи чужих файлов не было. Запись вне sandbox выполнялась через стандартные разрешения, без изменения ACL.

Создано одно активное Next.js-приложение и один локальный Git-репозиторий, ветка main, без remote и без коммитов. git push, публичная публикация и Vercel deploy не выполнялись. Расходы **0 KZT**.

## 1. Фактическая структура

Next.js 16.4.6, TypeScript 5.9.3, React 19.3.1, Node v24.22.1. Прямые версии закреплены, package-lock.json сохранён. Корень Next явно задан в next.config.ts: посторонний родительский lockfile не включается в workspace/tracing.

```text
AGENTS.md
README.md
package.json / package-lock.json / tsconfig.json / next.config.ts
.git/                     один локальный репозиторий
.env.example              только пустой образец
  src/app/api/analysis/route.ts
  src/app/api/health/route.ts
  src/app/api/variables/route.ts
  src/app/layout.tsx
  src/app/page.tsx
  src/backend/cache/README.md
  src/backend/nasa/auth.ts
  src/backend/nasa/cmr.ts
  src/backend/science/README.md
  src/backend/services/analysis.ts
  src/backend/services/catalog.ts
  src/frontend/analysis/Panel.tsx
  src/frontend/api.ts
  src/frontend/components/App.tsx
  src/frontend/components/ClientApp.tsx
  src/frontend/map/MapView.tsx
  src/frontend/styles/style.css
  src/shared/schemas/analysis.ts
  src/shared/schemas/coordinates.ts
  src/shared/schemas/result.ts
  src/shared/types/api.ts
scripts/                  проверка границ, NASA/HDF5 probes, Python oracle, UI и worker assets
tests/                    контракты, границы, изолированные OLS/HAC/Student t spikes
reference/backend/        неизменённый Python и его тесты
reference/frontend-source/ неизменённый исходник утверждённого UI
reference/.data-check/    исходные ряды, результаты, отчёты
reference/.data-check/granules/ 419 сохранённых научных выборок .nc4
reference/data/           исходный январский NetCDF4 (54 323 822 bytes)
docs/history/pre-next/    исторические отчёты, документы и screenshots
docs/licenses/            сохранённые найденные license notices
public/vendor/maplibre-6.18.0/  worker/shared/license, генерируются predev/prebuild
```

`reference/` — архив и научный oracle, не npm workspace и не второй сервис. Его Vite/FastAPI-конфигурации сохранены как история. `.next`, node_modules и локальные служебные кэши создаются заново и не входят в Git. Большой исходный NetCDF и granules сохранены локально, но исключены Git; для воспроизведения из будущего clone их нужно восстановить по manifest. `.vercelignore` исключает reference, docs, tests, scripts и .env* из будущей загрузки; исходный код не импортирует reference. Деплой пока не проверялся.

## 2. Что перенесено

Всего **514 файлов**, 75 884 227 bytes при копировании. Полный поимённый список с исходным и целевым путём, размером и SHA-256: `docs/MIGRATION_FILES.json`.

- Все 420 NetCDF-файлов: исходный глобальный январь и 419 реальных месячных выборок. Старый `.data-check/cache` перенесён как научные артефакты `reference/.data-check/granules`, а не runtime cache; исторические extraction scripts сохранены побайтово и могут требовать исходного layout для повторного запуска.
- monthly_values.json/csv, annual_values.csv, analysis_results.json, quality/manifest, независимые аудиты, отчёты и Python science scripts.
- Python backend, тесты, requirements и контракты; исходный React UI, карта, график, CSS и конфигурации как архив.
- 32 исторических файла документации/отчётов/screenshots, включая старый AGENTS.md; прежние отчёты 3B/3C/4A не переписаны.

Не копировались credentials, .env/.netrc/cookies, virtualenv, Python distribution, bootstrap, node_modules, dist, __pycache__, uv/npm caches и backend runtime cache. Копирование шло по положительному списку исходников и научных артефактов. Эвристическая проверка Git-кандидатов не обнаружила секретных файлов, JWT или private keys (`N1_GIT_SCAN.json`); она не является доказательством обнаружения любого возможного секрета.

## 3. Сохранность научных данных

`N1_INTEGRITY.json`: **0 изменённых исходников, 0 несовпадающих копий** во всём manifest. В наборе 445 научных файлов, 420 NetCDF; защищённый исходный проект только читался. Суммы сравнивались при копировании и повторно по завершении проверок.

Эталон содержит **420 из 420 месяцев**, пропусков 0, ячейка 52.5°, 76.875°, 1991–2025. SHA-256 monthly_values.json: `df88b6f8cdffe9794568ddab1bce4e680af41cfd1cf4bff846b4808be0b495ea`. CSS нового UI побайтово совпадает с прежним. Научные результаты не пересчитывались поверх исходных файлов; свежие ответы Python сохранены отдельно как N1_ORACLE_T2M/QV2M.json.

## 4. Разделение frontend/backend и контракты

- frontend содержит только UI и клиентский HTTP. Научных формул в React нет.
- backend содержит server-only модули; api routes только HTTP parsing/validation и вызов services. Никакого proxy на второй FastAPI-процесс.
- shared содержит единые координаты, строгую схему запроса и полный result schema. UI Result выводится из Zod schema. Свежие ответы обеих переменных из текущего Python прошли общую схему.
- Проверка импортов запрещает frontend -> backend/app, shared -> другие слои и backend -> frontend/app; покрыты alias, relative paths, re-export, literal dynamic import/require и обход через shared. Проверка включена в build.
- Реальный отрицательный Next build отверг импорт backend из Client Component; временный probe удалён (`N1_SERVER_ONLY.json`).

Исторические JSON 3B/3C не содержат добавленных позднее fitted_values и некоторых полей кэша. Они сохранены как история; актуальный oracle получен из неизменённого текущего Python, без выдумывания недостающих полей.

## 5. Технические проверки NASA и науки

| Проверка | Результат | Доказательство / граница |
|---|---|---|
| NASA CMR через Node/TypeScript | PASS | M2TMNXSLV 5.12.4, G1278026149-GES_DISC, январь 1991; N1_NASA_NODE.json |
| Реальное значение MERRA-2 в TypeScript | PASS локальное чтение NASA-файла | h5wasm/Node, N1_HDF5.json; это не свежая authenticated загрузка |
| Формат фактического NASA-файла | PASS для проверенного файла | NetCDF4/HDF5 magic 894844460d0a1a0a, T2M/QV2M shape [1,361,576] |
| Earthdata авторизация через новый TS | НЕ ПРОВЕРЕНА в сети | EARTHDATA_TOKEN отсутствует; серверный env/allowlist/redirect:manual подготовлены и unit-tested |
| Новый TS scientific pipeline целиком | НЕ РЕАЛИЗОВАН | Python остаётся эталоном; production API явно 503 |
| OLS/HAC/Student t реализуемость | PASS для двух полных реальных рядов | rtol=1e-10, atol=1e-12; N1_SCIENCE.json |
| Public shared Earthdata access | НЕ ПОДТВЕРЖДЁН | Общий аккаунт для анонимного proxy не обещается; нужно подтверждение GES DISC/EDL |

Прочитаны **T2M = 259.11444091796875 K**, **QV2M = 0.0012164824875071645 kg kg-1**; оба значения точно равны Python-эталону января. h5wasm реально декодировал HDF5, а не читал готовый JSON. Поддержка всех NASA вариантов/календарей/fill/scale metadata и serverless packaging ещё требует отдельного adapter и тестов. NetCDF classic parser не выдан за поддержку .nc4.

Изолированный TypeScript spike воспроизвёл OLS, Bartlett HAC lag 3, correction n/(n−2), Student t df=n−2 и 95% CI. T2M slope/decade = 0.09179457757906842, p = 0.5129513990556179; QV2M slope = 0.17981239344380084, p = 0.002383488790211419. Точные ошибки SE/CI приведены в N1_SCIENCE.json. Тесты также проверили constant/exact-fit и некорректные годы/NaN. Это доказательство реализуемости, не полная эквивалентность всего backend.

Первый jstat spike не выдержал исходные допуски p-value (~8.64e-10 абсолютной ошибки T2M); допуски не ослаблены. jstat удалён; отдельный numerical spike использует regularized incomplete beta continued fraction, Lanczos log-gamma и bisection quantile (математическая справка https://dlmf.nist.gov/8.17). До production нужны более широкие независимые numerical cases; spike не импортируется приложением.

## 6. Запуск и фактические тесты

- **107/107 Python-тестов прошли** на сохранённой копии; N1_PYTHON_TESTS.xml. Использован существующий Python environment исходного проекта без копирования/изменения; PYTHONDONTWRITEBYTECODE=1. Первые попытки имели ошибки настройки pytest cache и запрещённого расположения временного NASA cache; исправлена только команда запуска, Python-код/ожидания не менялись.
- **8/8 TypeScript-тестов прошли**, typecheck и boundary guard — PASS. Логи N1_TESTS.log, N1_TYPECHECK.log, N1_BUILD.log.
- Production `npm run build` завершился успешно: /, /api/health, /api/variables, /api/analysis. `npm start -- --port 3010` реально запущен на **127.0.0.1**, Ready ~517 ms в последней проверке, затем остановлен. Это локальное измерение, не Vercel SLA.
- HTTP health/variables — 200; invalid coordinates — 422; malformed JSON — 400; unit test также проверяет oversized request — 413; valid analysis — явный 503 migration_pending. Никаких фиктивных результатов.
- Edge desktop 1440×900 и mobile 390×844: header, размеры карты, положение инструментов, panel open/close, отсутствие горизонтального overflow, обработка migration error и отсутствие pageerror проверены. Реальные OpenFreeMap tile responses наблюдались; worker обслуживается локально.
- **Полная стабильная отрисовка подложки НЕ подтверждена**: часть тайлов успевала отрисоваться, поздняя проверка networkidle завершилась timeout 60 s; отдельный диагностический запуск показал зависший внешний запрос `https://tiles.openfreemap.org/styles/positron`. N1-map-diagnostic.png / N1-map-ready.png — диагностические снимки, не утверждённый новый дизайн. Screenshots и layout-tests не объявляются полной визуальной приёмкой. Требуется повторить при стабильной сети; подложка не заменялась.

MapLibre обновлён с уязвимой v5 до **6.18.0** по https://github.com/advisories/GHSA-jrc7-96c5-q579 . Нужны namespace import, явный same-origin versioned worker и перенос library CSS перед исходным CSS в layout. Это техническая совместимость, не редизайн; исходный stylesheet не изменён. Default Next dynamic client boundary предотвращает server evaluation window/MapLibre.

## 7. Vercel, NASA compliance и бюджет

Проверенные первоисточники и даты — COST_POLICY.md, VERCEL_LIMITATIONS.md, NASA_COMPLIANCE.md. По https://vercel.com/docs/functions/limitations Fluid Compute Hobby: 300 s default/max, 2 GB / 1 vCPU, bundle 250 MB uncompressed, request/response 4.5 MB. https://vercel.com/docs/plans/hobby описывает остановку возможностей при превышении бесплатных квот; https://vercel.com/docs/limits/fair-use-guidelines — правила использования. Применимость personal non-commercial Hobby к командному сценарию перед деплоем ещё надо подтвердить. Платные услуги, карта и billing не подключены.

Исторический Python cold benchmark 420 месяцев Берлина ~194.8 s, **не** новый Node/Vercel benchmark. Cold start, retries, WASM и отсутствие общего постоянного кэша могут исчерпать лимит. Ни Vercel bundle, ни runtime auth, ни публичная нагрузка фактически не проверялись: деплой запрещён. RAM и /tmp не считаются durable/shared storage. Один деплой не гарантирует укладывание в бесплатные квоты.

Установлено 99 пакетов с license metadata; найденные notices сохранены. У шести пакетов отдельный root notice не поставляется: @esbuild/win32-x64, @next/env, @next/swc-win32-x64-msvc, client-only, murmurhash-js, server-only. Перед распространением проверить соответствующие upstream notices, а не считать metadata полным юридическим аудитом. h5wasm — собственный NIST notice + HDF5 notices, не MIT. Финальный npm audit: **0 известных уязвимостей**, N1_AUDIT.json.

Официальная страница задания https://www.spaceappschallenge.org/2026/challenges/be-an-earth-system-trend-detective/ и альтернативный production slug в web tool вернули 502; прямой Node fetch также не выполнился. **Полная сверка официального brief 2026 и списка Resources не завершена.** Staging с противоречивым текстом исключён как нормативный источник. Требования команды не выданы за цитаты NASA. Архитектура допускает выбор переменной/точки, NASA series, статистику и объяснение; произвольное усреднение региона пока отсутствует.

Цитирование NASA GMAO/GES DISC, M2TMNXSLV v5.12.4 и DOI 10.5067/AP1B0BA5PD2K, provenance/units/actual cell/hashes закреплены. Лицензию авторского проекта команда ещё не выбрала; перед public submission нужны open-source/legal и AI disclosure checks. Общие indexed legal terms https://www.spaceappschallenge.org/legal/ и NASA discussion https://github.com/nasa/spaceapps/discussions/1849 разобраны с оговорками в NASA_COMPLIANCE.md. Помощь **OpenAI Codex** в миграции, тестах и документации раскрыта; научные измерения не сгенерированы ИИ.

## 8. Что сделано и что осталось

Сделано: один новый репозиторий/Next app, перенос UI, архив науки и истории, SHA-256 manifest, server boundaries, единые схемы, thin API, CMR/HDF5/science probes, запуск, Python/TS tests, обновление девяти обязательных документов, AGENTS.md, этот отчёт и PROGRESS.md.

Осталось: полное scientific ядро TypeScript и all-period/edge-case equivalence; production NASA adapter и runtime schema output validation; authenticated fresh NASA download с безопасно предоставленным локальным токеном; public shared-account permission; подтверждение brief 2026/Resources/licensing/disclosure; стабильная визуальная проверка всей карты и будущий Vercel runtime/bundle/limits test. Credentials не запрашивались в чате и не извлекались из netrc/cookies.

## 9. Предложение N2 — только после утверждения

Предлагается сначала перенести scientific core: nearest-cell/ties/dateline, units, complete-month quality, days-weighted annual aggregation, OLS/HAC/Student t, полную provenance/result validation. Доказать эквивалентность Python на T2M/QV2M, пятилетних/полных периодах, пропусках и вырожденных случаях. NASA I/O и публичный доступ утвердить отдельным scope с нулевым бюджетом. Не начинать глобус или менять дизайн.

**Остановка после N1. Этот отчёт не является разрешением на N2, git push или деплой.**
