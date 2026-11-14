# EARTH DETECTIVE — отчёт N4
Дата: 14 ноября 2026. Рабочая папка D:\Projects\Earth Detective; оригинал D:\Projects\NASA сохранён. N1–N3 приняты пользователем. **N4 выполнен локально и представлен на утверждение. N5 не начат, git push и deployment не выполнялись. Расходы 0 KZT.**

## 1. Что перенесено и завершено
N1 уже перенёс утверждённый React 4A.1 в один Next App Router; N4 завершил его работу, сохранив карту, floating header, левые инструменты/масштаб, правую панель, нижнюю панель телефона и #102744. Исправлены default body margin/overflow и адаптация header/панели. Нового дизайна, assets, шрифтов или библиотек нет.

| Модуль | Результат N4 |
|---|---|
| frontend/components/App.tsx | подключение health/catalog/analysis, поля/период, job lifecycle, elapsed/cancel, source status, сохранение панели |
| frontend/location.ts | локальный поиск Павлодар/Берлин/Токио (RU/EN) и координат; bounds через shared schema |
| frontend/map/MapView.tsx | 2D MapLibre, click/pan/zoom, selected/cell markers, focus/resize, loading/error/retry, Mercator latitude warning |
| frontend/analysis/Panel.tsx | годовой ряд + серверная OLS, slope/p/CI/значимость, actual/requested cell, DOI/provenance/cache/ограничения |
| frontend/api.ts | runtime result/connection validation, соответствие запросу/режиму, безопасные русские HTTP errors |
| shared/schemas/catalog.ts, shared/types/api.ts | общие health/catalog DTO; прежний научный result schema неизменён |
| ClientApp.tsx, styles/style.css | browser-only boundary и адаптивная композиция без document scroll |
| tests/frontend-n4.test.ts, scripts/verify-n4-* | unit/contract, browser, live NASA, HTTP, parity и isolated package проверки |

src/app остаётся тонким Next слоем; backend/nasa, backend/science, cache и services N3 не изменялись. Формулы не перенесены в компоненты/API. **3D полностью вне нашей ответственности, другой участник делает его самостоятельно; 3D не блокирует готовность 2D. Его код не создавался, не изменялся и не интегрировался.**

## 2. Работа интерфейса
Same-origin GET /api/health, GET /api/variables и POST /api/analysis подключены. Двойной submit не создаёт второй POST; изменение координат/переменной/периода отменяет ожидание и удаляет прежний результат. Только текущий job может записать ответ. Закрытие/открытие панели сохраняет результат и не выполняет POST; скрытый job продолжает ожидание. Карта двигается во время анализа. Пользователь может отменить ожидание; показывается фактическое время, без вымышленных процентов и автоматических browser retries.

На телефоне до анализа панель свёрнута. Результат открывается снизу, статистика/источник доступны внутренней прокруткой. Нет Earthdata credentials — анализ disabled с объяснением, карта/координаты доступны. Network/timeout/auth/rate/capacity ошибки имеют безопасный текст; произвольный server message не выводится. Тесты задержек/ошибок используют явно mock HTTP и не считаются живыми NASA-проверками.

Режим виден до запроса и в результате. В demo честно указаны только 2 реальные ячейки Павлодара/Берлина, новое обращение NASA не заявляется. Другая ячейка, включая Токио, возвращает 404; произвольная точка никогда не подменяется сохранённой. В local анализированы все три реальные ячейки. Поиск — **3 города плюс координаты**, не всемирный геокодер; произвольные координаты выбираются картой или вручную. Никакого дополнительного сервиса геокодинга не подключено.

## 3. Настоящие NASA результаты
Браузер → Next production server → CMR/OPeNDAP → MEMFS/HDF5 → неизменённый core. 1991–2025, 420 месячных/35 годовых значений на анализ. Фактические ячейки: Павлодар request 52.27601°,76.96881° → 52.5°,76.875°; Берлин 52.52°,13.405° → 52.5°,13.125°; Токио 35.68°,139.69° → 35.5°,140°. Клик карты возле Токио отдельно подтвердил координаты 35.68°,139.69° без автозапроса.

T2M: °C/десятилетие; QV2M: г/кг за десятилетие. Полные числа и ряды сохранены в N4_LIVE_*.json; ниже числа показаны с округлением.

| Анализ | Тренд/десятилетие | Двусторонний p-value | 95% ДИ | Max abs Δ всех численных полей с Python |
|---|---:|---:|---|---:|
| Павлодар T2M | +0.09179457758 | 0.51295139906 | [-0.19057482338; +0.37416397854] | 1.78e-15 |
| Павлодар QV2M | +0.17981239344 | 0.0023834887902 | [+0.06864540028; +0.29097938661] | 1.78e-15 |
| Берлин T2M | +0.59097349277 | 1.1452797119e-06 | [+0.38861611010; +0.79333087545] | 3.55e-15 |
| Берлин QV2M | +0.21850268137 | 4.4961594104e-08 | [+0.15548691439; +0.28151844835] | 1.78e-15 |
| Токио T2M | +0.32345996704 | 0.0010755156509 | [+0.13986665377; +0.50705328032] | 3.55e-15 |

N4_PARITY.json сравнивает полные месячные/годовые/fitted ряды, slope, SE, p, CI, R², quality, requested/actual, method settings и научный provenance с неизменёнными полными Python oracle, не только округлениями. Основной метод: OLS + Bartlett HAC lag3, n/(n−2), Student t df=n−2, α=.05. Версии библиотек/timing/cache/transport metadata правдиво текущие, не копируются из истории. Допуск |Δ| ≤ 1e−12 + 1e−10·|Python|; небольшие различия порядка операций и t/CDF библиотек объясняют Δ~1e−15. Метод ради совпадения не менялся.

Для Токио выполнен независимый Python replay свежего API-ряда (не отдельная Python-загрузка NASA и не прежний исторический oracle); max Δ3.55e−15. Для смены периода Берлина на 2000–2025: 312/26 значений, тренд +0.662276203593, p=0.000196312985423; независимый Python из оригинальных raw records, max Δ5.33e-15, PASS (N4_PERIOD_PARITY.json).

### Сеть и кэш — фактическая история
Первый Павлодар T2M: 163.759 s, 0 hits/420 misses, network_used=true. QV2M использовал оба показателя уже полученных месячных subsets. Первая попытка Берлина завершилась 502 nasa_transport_error за 113.730 s; повтор успешно догрузил 178 месяцев, использовал 242 из RAM и завершился за 87.254 s. Первая попытка Токио также 502 за 52.024 s; повтор успешно догрузил 341 месяц, использовал 79 и завершился за 145.478 s. TLS не отключался, ошибок готовым ответом не заменяли.

Ошибки сохранены в N4_LIVE_ATTEMPT1/2.json и *_ERROR.json. Финальный live прогон 12/12 PASS. В его повторных Pav/Ber ответах network_used=false, 420 hits — это честно RAM reuse данных, полученных из NASA в этой сессии; не ещё одна свежая загрузка. Изменение периода вызвало проверку CMR, месяцы остались в RAM. Не выдаём частично тёплые повторы за cold Vercel benchmark.

## 4. Проверки
| Проверка | Успешно | Ошибок финального прогона |
|---|---:|---:|
| TypeScript tests, включая прежние 205 | 209 | 0 |
| Demo/error/race browser сценарии | 18 | 0 |
| Live NASA browser сценарии | 12 | 0 |
| Полная карта/три экрана/выбор/retry подложки | 6 | 0 |
| Phone UI без credentials и blocked | 2 | 0 |
| Isolated runtime smoke | 3 | 0 |
| HDF5/MEMFS assets из пакета | 1 | 0 |
| Полные Python-сравнения: 4 исторических + Tokyo + period | 6 | 0 |

Всего 38 финальных browser сценариев. Отдельно N4_HTTP.json: 13 групп проверенных ответов, в том числе обе переменные двух ячеек, malformed/oversize/invalid requests, другой cell 404, parallel demo, public blocked 503, local-no-token 503 и cross-origin 403; повторные запросы сравниваются с полными oracle. Две реальные временные upstream ошибки выше не скрыты и не включаются в «0 ошибок финального прогона». Автоматические TS тесты включают математические/scientific/HAC/units/calendar/missing/provenance проверки N2/N3 и 4 новых frontend contract tests.

npm run typecheck PASS; npm run boundaries PASS (также обязателен в build). Финальная npm run build -- webpack production PASS на Node24.22.1 / Next16.4.6: / и /_not-found static, /api/health, /api/variables, /api/analysis dynamic. Логи N4_TESTS.log, N4_TYPECHECK.log, N4_BUILD.log. Ошибок SSR/unhandled pageerror в проверенных сценариях нет. Отрицательный server-only build заново не запускался: backend/import boundaries не менялись, сохранены прежние доказательства N1 и актуальный boundaries check; намеренно ломать итоговый production build не требовалось.

## 5. Адаптивность и скриншоты
1440×900, 768×1024, 390×844: html/body scrollWidth и scrollHeight равны viewport; bounds header/panel внутри окна. Карта проверена через areTilesLoaded + isStyleLoaded + idle, не по наличию canvas. Внутренняя прокрутка панели и доступность coordinates/source проверены. N4_MAP.json содержит измерения; скриншоты сделаны после полной загрузки tiles и просмотрены вручную.

- [Компьютер 1440×900](N4-1440.png)
- [Планшет 768×1024](N4-768.png)
- [Телефон 390×844](N4-390.png)
- [Телефон без авторизации](N4-noauth-local.png)

## 6. Подготовка к Vercel
Проверен локальный runtime из build traces без reference/, исходных TS, .env и постоянного кэша, с запретом CommonJS module resolution вне пакета. Health/catalog/demo/worker работают; VERCEL=1 принудительно блокирует local и использует memory вместо file. В пакет включён ограниченный raw demo JSON, из него научные ответы вычисляются, готовые slope/p/CI не подставляются. HDF5 input bytes через stdin декодированы исключительно скопированными ESM/MEMFS assets, значения обоих показателей совпали точно.

Окончательный NFT analysis dependencies: 117 файлов, 6,784,007 bytes; .next без cache 55,351,378 bytes; общий тестовый runtime 2710 traced файлов / 148,158,498 bytes. Это **не окончательный Vercel Function bundle** и не проверка Linux. Подробности и 135 warnings supplemental bootstrap trace — VERCEL_LIMITATIONS.md, N4_PACKAGE.json. Node engines закреплены24.x; no package/version additions. Стандартные Node dependencies/ESM/WASM не требуют второго сервера.

Route maxDuration=300, NASA deadline270s; account Fluid/квоты/фактические облачные CPU/RAM и bundle предстоит измерить. Постоянный локальный кэш не нужен: default bounded RAM, Vercel file cache выключен, h5wasm MEMFS. Per-process лимиты не глобальная защита autoscaling. [Официальные Function limits](https://vercel.com/docs/functions/limitations), [Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

## 7. Earthdata и ограничения
Локальная индивидуальная авторизация реальными запросами подтверждена. Разрешение personal account для anonymous public proxy **не получено**; найденная [EDL token documentation](https://urs.earthdata.nasa.gov/documentation/for_users/user_token) не доказывает такое право. Shared-account public dynamic остаётся заблокирован даже при наличии токена на Vercel. Пользовательские Earthdata credentials в браузер/архив/Git не передавались.

Безопасный подготовленный публичный вариант — честное двухъячеечное demo из настоящих данных NASA без токена. Для Токио/произвольных ячеек в публичном режиме полноценный dynamic access пока недоступен; нельзя объявлять его готовым. Всемирный поиск названий не реализован (3 города + координаты). OpenFreeMap/NASA зависят от внешней сети; два upstream сбоя фактически наблюдались. Mercator не отображает полюса; научный ввод остаётся допустим. Браузерные проверки — headless Edge/Playwright с software WebGL, не физические iOS/Android. Предъявленных невоспроизведённых ошибок UI/численных расхождений вне допуска нет; это не гарантия отсутствия всех дефектов.

До публичной/конкурсной подачи остаются применимость Hobby/квоты, выбор авторской лицензии, окончательные challenge rules/условия производных данных и реальная Linux-проверка. В поддержку NASA сообщений не отправлялось. 3D не является нерешённым пунктом нашей работы.

## 8. Сохранность и бюджет
SHA-256: все 514 source/copy файлов manifest неизменны, включая научные данные. Все 521 защищённых backend/reference/fixtures файлов snapshot сохранены; история и N1–N3 evidence не изменены. Научное ядро, исходный Python, NASA adapter не менялись. Package/lock отличаются только Node engines; исходные CRLF сохранены. N4_INTEGRITY.json.

Root .env остаётся ignored/untracked; аудит его содержимое не читал. Git candidates проверены на высокоуверенные JWT/private-key patterns, forbidden files отсутствуют; client chunks не содержат серверной конфигурации EARTHDATA_TOKEN. N4_SECURITY.json. В отчётный архив не включены .env, caches, node_modules или глобальные NetCDF; включены только разрешённые исходники изменений, docs/evidence и screenshots. Проверочные серверы остановлены после работы; пользовательский .env сохранён.

Расходы **0 KZT**. Новых библиотек, paid API, БД, billing/card, подписок и trials нет. Поиск офлайн, подложка прежняя, авторизация только локальная. Авторские/third-party notices сохранены. Использована помощь OpenAI Codex для кода/тестов/документации; научные измерения получены NASA, не сгенерированы ИИ.

## 9. N5 — конкретные следующие действия
1. Получить отдельное утверждение N4 и разрешение N5. Утвердить public demo и его двухъячеечный охват либо предварительно подтверждённый NASA public auth механизм; личный токен не публиковать.
2. Проверить применимость бесплатного Hobby, квоты и лицензию проекта/данных. Подготовить один Next/Vercel project, Node24.x, npm ci/build, Fluid/maxDuration; без дополнительных серверов, storage, карты/Pro/trial.
3. В demo задать EARTH_MODE=demo, EARTH_CACHE=memory, не передавать EARTHDATA_TOKEN. Проверить Git/upload exclusions; push/deploy выполнить только в отдельно разрешённом N5.
4. На реальном Linux/Vercel проверить platform bundle/layers, h5wasm assets/notices, время/CPU/RAM, env/публичные пути. Зафиксировать фактическую конфигурацию аккаунта и отсутствие расходов.
5. Проверить публичный URL: Pav/Ber оба показателя/период, честный 404 Tokyo/других ячеек, health/catalog/ошибки, карта/worker/графики/три экрана/сохранение/отмена. Затем зафиксировать rollback и решение о готовности. Public dynamic не включать без отдельного согласованного решения.

**N4 остановлен для утверждения. N5, git push и публичный деплой не выполнялись.**
