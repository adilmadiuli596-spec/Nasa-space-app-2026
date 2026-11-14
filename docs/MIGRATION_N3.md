# EARTH DETECTIVE — MIGRATION N3

Дата: **14 ноября 2026, Asia/Qyzylorda**. N1/N2 приняты пользователем. **Выполнен только N3; отчёт ожидает утверждения. N4 не начат.**

Проект: `D:\Projects\Earth Detective`. Один Next.js App Router + TypeScript проект, один локальный Git-репозиторий. Python не используется приложением; сохранён только независимый oracle. Frontend, shared-контракты и научные формулы N2 не менялись. Расходы **0 KZT**. Git push, публикация и Vercel deployment не выполнялись.

## 1. Реализованные серверные модули

- `src/backend/nasa/auth.ts`
- `src/backend/nasa/cmr.ts`
- `src/backend/nasa/config.ts`
- `src/backend/nasa/decode.ts`
- `src/backend/nasa/demo.ts`
- `src/backend/nasa/http.ts`
- `src/backend/nasa/schemas.ts`
- `src/backend/nasa/source.ts`
- `src/backend/nasa/types.ts`
- `src/backend/cache/file.ts`
- `src/backend/cache/flight.ts`
- `src/backend/cache/memory.ts`
- `src/backend/services/analysis.ts`
- `src/backend/services/catalog.ts`
- `src/backend/services/http.ts`

NASA: config/mode policy, server token provider, bounded HTTPS transport, строгий CMR catalog, DAP4 subset URLs, HDF5 MEMFS decoder, revalidation schemas, source orchestration и отдельный demo provider. Cache: bounded RAM LRU, optional local atomic file cache, single-flight/coalescing/cancellation. Services: orchestration, health/catalog и bounded HTTP parsing/error mapping. `src/app/api/analysis/route.ts` остаётся тонким вызовом обработчика/сервиса, runtime nodejs, maxDuration=300.

Вход — прежняя строгая схема координат, T2M/QV2M и 1991–2025 с минимумом 5 лет; лишние поля/произвольный URL отклоняются. Все серверные TS-модули имеют server-only, проверка слоёв и typecheck прошли. Никакой статистики в React/Route Handlers, дублирования core или чтения ожидаемого ответа в production нет.

## 2. Доступ к NASA и фактический формат

CMR `https://cmr.earthdata.nasa.gov/search/granules.json`: M2TMNXSLV v5.12.4, полный ordered roster (до 420 месяцев), NASA GES DISC, granule IDs, filenames, timestamps и ограниченные collection URLs. Затем GES DISC Cloud OPeNDAP `.dap.nc4` с `dap4.ce`: **одна фактическая ячейка, T2M/QV2M, lat/lon/time**. Глобальные файлы не загружаются.

Node h5wasm 0.10.3 декодирует NetCDF4/HDF5 в **MEMFS**, закрывает файл и удаляет memory image. Проверяются magic, размер ≤2 MiB, product/version/DOI, полный monthly range, shape [1,1,1] и dimension scales time/lat/lon, реальные координаты, CF time/calendar, units, fill/missing/valid_range и scale_factor/add_offset. Данные передаются в неизменённый scientificResult. Поддержка подтверждена для фактического NASA NetCDF4/HDF5; произвольные NASA/NetCDF classic форматы не обещаются.

Token — Bearer только server environment, HTTPS host allowlist, redirect:manual (все redirects отвергаются), стандартная проверка TLS без отключений. JWT exp — только ранняя подсказка expiry, подпись/авторизацию проверяет NASA. 401/403 возвращают безопасную ошибку и блокируют повтор отвергнутого токена до замены; пароли, cookies/netrc и автоматический password refresh не используются. Изменение .env требует перезапуска сервера.

Пользователь сам сохранил токен в запрошенном `.env`; Next прочитал его только для локального сервера. Агент не выводил содержимое файла. `.env` ignored/untracked, исключён .vercelignore и server trace; в review archive его нет. Альтернативный `npm run nasa:local` поддерживает скрытый ввод без сохранения токена.

## 3. Фактические HTTP-ответы

Проверена **production Next-сборка на localhost**, не только прямые вызовы функций.

| Сценарий | HTTP / результат |
|---|---|
| GET /api/health, /api/variables | 200; режим, конфигурация и фактическое покрытие |
| local + реальный Earthdata token, Павлодар/Берлин/Токио | 200 с реальными NASA series и статистикой |
| blocked, в том числе public dynamic policy | 503 public_access_unconfirmed |
| local без токена | 503 nasa_auth_required |
| Неправильные координаты/переменная/период/лишний URL | 422 invalid_request |
| Повреждённый JSON / слишком большой body | 400 / 413 |
| Чужой Origin/Host в local | 403 local_only |
| Demo за пределами двух сохранённых ячеек | 404 demo_cell_unavailable |
| upstream 401/403/429 (контролируемые transport/HTTP тесты) | 503; auth/rate-limit error, без подмены данных |
| timeout / повреждённый HDF5 / пропущенные месяцы (тесты) | 504 / 502 / 502 |
| Локальная capacity занята | 429 analysis_busy; тест single-flight capacity |

Health намеренно сообщает `nasa_network:not_checked` и `configured_not_verified`: вызов health сам не делает NASA login/download и не доказывает доступность каждого granule. Подтверждение реального доступа — сохранённые успешные live-ответы, не health status. Ошибочные NASA 401/403/429/timeout проверялись симуляцией без намеренной отправки неверных credentials NASA; реальные позитивные загрузки проверены отдельно.

## 4. Полное научное сравнение

Свежие локальные HTTP-результаты сравнивались с полными неизменёнными Python-эталонами N2/3C: requested/actual cell, все 420 месячных значений, 35 годовых, fitted/slope/SE/p/CI/R², quality, настройки метода, warnings и научные source metadata. Во всех четырёх анализах **PASS**, допуск `abs(TS−Python) ≤ 1e−12 + 1e−10·abs(Python)`.

| Анализ | Python slope / декаду | TypeScript slope / декаду | TS p-value | TS 95% CI | max Δ всех numeric fields |
|---|---:|---:|---:|---|---:|
| PAVLODAR_T2M | 0.091794577579068434 | 0.091794577579068365 | 0.51295139905561948 | [-0.19057482338418938; 0.37416397854232608] | 1.776e-15 |
| PAVLODAR_QV2M | 0.17981239344380076 | 0.17981239344380087 | 0.002383488790211441 | [0.068645400282176736; 0.29097938660542499] | 1.776e-15 |
| BERLIN_T2M | 0.59097349277358546 | 0.59097349277358568 | 1.1452797118958437e-06 | [0.38861611009589037; 0.793330875451281] | 3.553e-15 |
| BERLIN_QV2M | 0.2185026813732438 | 0.21850268137324369 | 4.4961594103913597e-08 | [0.15548691439243942; 0.28151844835404793] | 1.776e-15 |

T2M — °C/десятилетие; QV2M — (g/kg)/десятилетие. Максимальное расхождение — **3.552713678800501e−15**. Core, lag 3 Bartlett, n/(n−2), Student t df=n−2, α=.05 и правила пропусков не изменялись.

Current network/cache flags, retrieval labels, response SHA, artifact SHA и timings описывают **текущую** загрузку; они не скопированы из исторического oracle ради равенства. Сравнены provider/dataset/version/DOI/source_id/mode и все month/granule ID/filename/URL. Хеши нового контейнера могут отличаться при одинаковых values; их реальные значения сохранены. Python library-version metadata не выдаются за версии JS. Политика различий и полные проверки — `N3_PARITY.json`; каждый live result — `N3_LIVE_*.json`.

## 5. Холодные, повторные и параллельные запросы

Замеры одного локального запуска, client HTTP duration; **не Vercel SLA**. Стартовый RAM cache был пуст. Первый Павлодар включает CMR+420 subsets; Берлин/Токио — 420 month misses, но CMR уже в кэше.

| Анализ | HTTP | Время | Month hits / misses | Network used | JSON bytes |
|---|---:|---:|---|---|---:|
| PAVLODAR_T2M | 200 | 151.879920 s | 0 / 420 | True | 173497 |
| PAVLODAR_QV2M | 200 | 0.080011 s | 420 / 0 | False | 172332 |
| BERLIN_T2M | 200 | 156.230957 s | 0 / 420 | True | 173363 |
| BERLIN_QV2M | 200 | 0.065298 s | 420 / 0 | False | 172164 |

- Токио cold: **157.654088 s**, 420 misses, HTTP 200.
- Точный повтор Павлодара T2M: **60.344 ms**, 420 hits, 0 misses, network_used=false.
- Два параллельных тёплых запроса T2M/QV2M: **76.581 ms** суммарно, оба 200 и 420 hits; холодный identical-job coalescing отдельно проверен mock transport (420 загрузок вместо 840).
- 419 **архивных** настоящих HDF5 subsets: decode/validation/cache-fill **2974.875 ms**, повторное чтение decoded RAM-cache **6.828 ms**. Это offline decoding/cache benchmark, не новая NASA сеть и не полный cold analysis.

Нельзя переносить эти числа на любую точку, нагрузку, NASA состояние или другой runtime. Удалённый NASA cache/CDN не контролировался.

## 6. Работа за пределами Павлодара/Берлина

**Подтверждена локально на свежих NASA данных**: запрос 35.68°,139.69°, фактическая ячейка **35.5°,140°**, indices 251/512, 1991–2025, 420 месяцев, HTTP 200. T2M slope **0.32345996704485114 °C/десятилетие**, p **0.0010755156508618358**, CI [0.13986665376776586; 0.50705328032193642].

Независимый сохранённый Python заново проверил свежий ряд: PASS, max Δ 3.553e-15. Это replay значений нового API, а не вымышленный исторический Tokyo oracle или отдельная Python NASA-загрузка. Формулы приложением выполнялись только на TypeScript.

Это три проверенные ячейки, не доказательство гарантированной доступности/производительности для всех глобальных точек. Фактическая ячейка всегда сверяется с nearestCell; другая география, плохие даты/units/fill отвергаются.

## 7. Память, сборка и Vercel

- Измеренный Windows peak working set локального Next.js после трёх NASA загрузок: **216592384 bytes = 206.56 MiB**. Это реальный серверный процесс, не client script RSS. Не выдаётся за замер serverless Linux/Vercel.
- Локальный NFT trace `/api/analysis`: **117 файлов, 6784011 bytes (~6.47 MiB)** dependencies, включая HDF5 JS и NIST/HDF5 LICENSE.txt. Это trace, **не окончательный Vercel function bundle**. reference/tests/cache/.env отсутствуют в trace; raw HDF5 global files не ship.
- Проверены production build, запуск, runtime HDF5/WASM в Next и API body ≤173497 bytes в четырёх эталонах. Python runtime в приложении отсутствует.
- По [официальным Function Limits](https://vercel.com/docs/functions/limitations), Fluid Compute Hobby — 300 s maximum, 2 GB / 1 vCPU, 250 MB uncompressed function bundle и 4.5 MB обычный request/response. Код задаёт source budget 270 s, request 20 s, до 3 попыток, maxDuration=300. Четыре общих сетевых слота/процесс и два distinct analysis jobs ограничивают параллелизм.
- Длинный Retry-After не сокращается до раннего повторного запроса: сервер немедленно возвращает контролируемый 503 с исходной задержкой; короткие retry остаются bounded. При ошибке/отмене sibling workers останавливаются.

**Vercel deployment НЕ проверен и НЕ объявляется готовым.** Account quotas, cold start/CPU, финальная упаковка, RAM и публичная нагрузка на Vercel не измерялись. Локальные ~152–158 s оставляют запас до 300 s, но не гарантируют его на Hobby. При превышении source budget — 504, не скрытая подмена snapshot.

Cache strategy: RAM LRU 16 MiB encoded payloads (это не предел всего RSS), catalog TTL 6 h, decoded months TTL 30 d, строгие keys/validators; кэш disposable/per-instance. Optional local file cache 64 MiB хранит только научные records в `.cache/nasa-n3`; он исключён Git/Vercel и выключен в Vercel. Постоянство /tmp/локального диска и shared cache между функциями не предполагается. SHA cache envelope ловит случайное повреждение, не является подписанным storage.

Бесплатная альтернатива публичной dynamic версии уже реализована отдельно: явный `EARTH_MODE=demo`, bundled raw настоящие данные двух ячеек, вычисление статистики на каждом запросе, `offline_verified_demo`, network_used=false и явный warning. Это **не полноценный глобальный анализ**, чужая ячейка 404, автоматического fallback после NASA error нет.

## 8. Публичная Earthdata-авторизация

**Не решена в смысле подтверждённого разрешения общего personal-account proxy. Публичный dynamic режим заблокирован.** Официальные [user tokens](https://urs.earthdata.nasa.gov/documentation/for_users/user_token), [EDL documentation](https://urs.earthdata.nasa.gov/documentation) и [welcome](https://urs.earthdata.nasa.gov/documentation/for_users/welcome) подтверждают user-level автоматизированный доступ и совместимые приложения; это не специальное разрешение раздавать один личный аккаунт всем посетителям.

На Vercel local принудительно blocked даже при наличии токена; обходного public-approval env switch нет. Локальная авторизованная интеграция подтверждена реальными успешными загрузками пользователя. Для public dynamic нужен подтверждённый допустимый механизм GES DISC/EDL и отдельное решение пользователя. Письма/заявки не отправлялись автоматически. Demo не использует личный Earthdata account.

## 9. Тесты

**205 TypeScript tests passed, 0 failed, 0 skipped**: все прежние 176 N2 + 29 новых NASA/cache/HTTP тестов. Проверены 401/403, token absence/expiry/rotation, redirects/foreign hosts, 429/Retry-After, timeout/cancellation, size cap, corrupted/truncated HDF5, product/cell/units/time/calendar/fill/range/dimensions, scale/offset, missing catalog months, corrupt cache, repeated/parallel/capacity, modes, safe errors и bounded streaming JSON.

Дополнительно: production Next HTTP script (four full demo comparisons + policy/errors/parallel), 419 реальных архивных HDF5 samples, пять свежих scientific results в трёх ячейках (четыре исторических + Tokyo), Python replay, desktop/mobile UI с графиком и явным demo-warning. UI page errors=0, frontend source unchanged. Внешние tiles не считаются полной гарантированной визуальной приёмкой. Логи и доказательства имеют префикс N3; N1/N2 не переписаны.

Typecheck, boundary guard и финальная production-сборка — **PASS**. Набор Python 107 тестов не перезапускался на N3 как отдельный pytest suite: он прошёл на N2, а на N3 Python использовался для независимого replay свежих результатов. Старые отчёты не названы новым запуском.

## 10. Ошибки, риски и сохранность

Реальных неуспешных NASA анализов в финальном live прогоне не было. При разработке typecheck обнаружил, что Next расширяет ProcessEnv обязательным NODE_ENV; тестируемый reader исправлен на readonly key/value environment. Финальный review исправил слишком ранний retry при длинном Retry-After. Научные алгоритмы/ожидаемые значения не менялись.

Остаются: public access permission; serverless/Cloud deployment validation; rate limits, transient NASA/TLS/network failure и повторные cold starts; неизвестная производительность любой глобальной точки; ephemeral RAM и отсутствие распределённого cache; строгие прежние physical-screening bounds; ограниченность поддержанного Gregorian/NetCDF4 формата. Нет frontend redesign, 3D, ML/Groq, регионального polygon averaging или изменения inference policy.

`N3_INTEGRITY.json`: **514 original/source-copy manifest entries checked, 0 изменённых исходников NASA, 0 изменённых сохранённых копий**. Core N2, frontend/CSS, shared schemas, reference/history и прежние evidence files совпали с before snapshot. `.env` проверен только как ignored/untracked; содержимое аудитором не открывалось. Эвристический Git scan не нашёл запрещённых файлов/JWT/private key patterns среди Git-кандидатов; это не обещание обнаружить все форматы секретов.

## 11. Бюджет и запуск

**Расходы 0 KZT.** Новых package names/versions нет; h5wasm 0.10.3 только переведён в runtime. NIST/HDF5 notice сохранён и добавлен в trace. Нет paid API/storage/DB, банковской карты, billing, подписок или второго сервиса. Использованы имеющиеся локальные Node/Python и бесплатный NASA access. Применимость Hobby personal non-commercial use и лицензия авторского проекта остаются проверкой перед будущей публикацией, а не автоматическим разрешением.

Для локального запуска с уже подготовленным .env: `npm start -- --port 3010`, адрес http://127.0.0.1:3010 . После live-проверок тестовый сервер остановлен. Токен остался в пользовательском приватном .env, файл не удалялся/не перезаписывался. Для demo нужно явно установить EARTH_MODE=demo; это не скрытая замена NASA local mode.

## 12. Готовность к N4

Серверная база готова к проверке N3: локальная dynamic NASA интеграция реально работает, scientific equivalence и третья ячейка подтверждены, API и bounded cache протестированы. Можно обсуждать scope N4 **после утверждения N3**. Public dynamic permission и Vercel deployment не готовы/не подтверждены; публикация требует отдельной проверки и разрешения.

**После отчёта остановлено. N4 не выполнялся. Git push и deploy не выполнялись.**
