# EARTH DETECTIVE — отчёт N4A
Дата: 14 ноября 2026, Asia/Qyzylorda. Проект D:\Projects\Earth Detective. Исходный D:\Projects\NASA сохранён.

**Выполнен только N4A: новый интерфейс и настоящий анализ одной ячейки. N4B/N4C/3D/N5, git push и public deploy не выполнялись. Расходы 0 KZT. После отчёта остановлено до утверждения N4A.**

Важное ограничение оформления: оригинальный `public/brand/earth-detective-logo.png` отсутствует. Пользователь уведомлён; случайная эмблема и официальный NASA logo не подставлены. Сейчас header содержит текст Earth Detective. Подключение PNG в header/favicon подготовлено и сработает после добавления оригинального файла и пересборки.

## 1. Реализованные компоненты и отличие от старого UI
Новый референс N4A с Берлином принят за визуальную основу. Старый 4A.1 использован как источник работающей логики; случайный скриншот Windy не использован. В интерфейсе нет прогноза погоды, фиктивной Калифорнии или условных чисел из макета.

| Модуль | Реальная функция |
|---|---|
| frontend/components/App.tsx | новый header, T2M/QV2M, preset/custom period, реальный analysis, source/auth/demo status, job/cancel/identity protection |
| frontend/components/GeoSearch.tsx | настоящий manual Photon city search и локальный ввод координат, results/errors/cancel |
| frontend/components/Icon.tsx | единые SVG line icons интерфейса; не замена логотипу |
| frontend/analysis/Panel.tsx | Обзор, Графики, Методика; последняя разделена на Расчёт/Источник/Ограничения |
| frontend/map/MapView.tsx | существующий 2D renderer с point/cell integration, pan/zoom/world/labels/resize/errors |
| frontend/map/cell-footprint.ts | display polygon серверной ячейки, seam split/pole clip; не nearest-cell/science |
| shared/types/map.ts | контракт карты и planned/unavailable descriptors N4B/N4C |
| backend/geography/search.ts + app/api/places | bounded anonymous geocoding I/O и тонкий Next route |
| shared/schemas/geography.ts | общие географические DTO и валидация |
| app/page.tsx, layout.tsx, ClientApp.tsx | client-only map/chart boundary, обнаружение оригинального PNG при build и favicon |

Сохранено **одно Next.js приложение**. app — страницы/HTTP, frontend — UI/карта/графики, backend — NASA/core/cache/geography, shared — схемы/контракты. Нет второго frontend/backend. Существующие backend/science, nasa, cache, services и научные схемы не переписывались. Формулы остаются на сервере.

Вместо прежней палитры/длинной панели: #0B3D91, #071D49, #FC3D21, белый/сине-серый, полноэкранная карта, широкий компактный header и вкладки. Красный — действие/маркер/ячейка/тренд; синий годовой ряд и красная OLS. Header содержит поиск, показатель, период, «Анализ», «Слои». Слева только рабочие инструменты. NoData/future layers не замаскированы декоративными кнопками.

## 2. Работающий пользовательский сценарий
Выбор карты/поиска/примера → координаты → T2M или QV2M → период → POST /api/analysis → N3 NASA adapter → неизменённый N2 core → scientific Result → график/статистика. Выбранная точка и actual cell показаны раздельно; разрешение 0.5°×0.625°, предупреждение о реанализе/ячейке, не точном измерении города, сохранено. Регионального среднего нет; страна/область не анализируется по центроиду.

Настоящие GET /api/health и /api/variables задают доступность/режим. Без авторизации или при public blocked анализ disabled с объяснением, карта/координаты работают. Demo явно отмечен до анализа даже на телефоне; только реальные cells Павлодара/Берлина, другие cells404. Неявного fallback после NASA error нет.

Панель закрывается/открывается без удаления результата и без нового POST. Смена запроса отменяет ожидание/очищает предыдущий результат. Active ref до await предотвращает дубли; старый response не может заменить новый. Loading показывает реальное elapsed time, без процентов. Карта остаётся активной; cancel прекращает клиентское ожидание. Клиентская отмена не обещает мгновенного прекращения платформенного compute после disconnect.

## 3. Научная панель и графики
Обзор: место/переменная/период, slope за десятилетие, двусторонний p, 95%CI и корректная значимость; при p>.05 прямо сказано, что неустановленный тренд не доказывает отсутствие изменений. На desktop также компактный preview. Графики: полный annual series, server fitted OLS, годы/единицы/interactive tooltips. На телефоне график в отдельной вкладке, а не под длинной прокруткой.

Методика: годовые means с day weights/12 months, OLS, HAC/Newey–West Bartlett lag3, finite sample n/(n−2), Student t df=n−2, source/DOI/version/coordinates/cache и ограничения. Пропуски не интерполируются. QV2M — удельная влажность г/кг, не относительная/%; функциональность не удалена. Аномалии/total-change cards с неутверждёнными расчётами не добавлены.

## 4. Настоящий географический поиск
GET /api/places проксирует **фиксированный Photon/OpenStreetMap endpoint**, без NASA token/cookies/произвольных URLs. Запрос только Enter/кнопка, не autocomplete; source attribution видна. Защита: 10s timeout, no redirects, response≤512KiB, максимум5 объектов, schema/bounds checks, один upstream на процесс и interval≥1.2s, LRU64/24h. EARTH_GEOCODING=off выключает upstream без paid fallback. Координаты/проверенные примеры остаются доступны.

Реальный browser search Berlin вернул Berlin, Germany, 52.5173885°,13.3951309°; анализ выбрал 52.5°,13.125°. Не заранее выдуманный результат. Быстрые примеры Павлодар/Берлин/Токио используют сохранённые проверенные координаты. Поиск ограничен городами/населёнными пунктами на N4A; страны/области не выдаются за city analysis.

Photon допускает fair use, интенсивные запросы throttled и SLA нет ([условия сервиса](https://photon.komoot.io/)); данные с [OSM attribution/ODbL](https://www.openstreetmap.org/copyright). Это free interactive source, не неограниченный публичный geocoder. Перед публичным трафиком проверить провайдера/нагрузку; per-process limit не global cap serverless autoscaling.

## 5. Свежие реальные NASA результаты
Пять full analyses через production Next/NASA в этой N4A сессии, **пять HTTP200 с первой попытки, upstream failures0**. На каждый полный анализ420 месяцев/35 лет, данные из NASA CMR/OPeNDAP, не готовые ответы из макета. Полные ответы N4A_LIVE_*.json, история запросов N4A_LIVE.json.

| Анализ 1991–2025 | Тренд/десятилетие | p-value | 95%CI | Max abs Δ полных научных полей с Python |
|---|---:|---:|---|---:|
| Павлодар T2M | +0.09179457758 | 0.51295139906 | [-0.19057482338; +0.37416397854] | 1.78e-15 |
| Павлодар QV2M | +0.17981239344 | 0.0023834887902 | [+0.06864540028; +0.29097938661] | 1.78e-15 |
| Берлин T2M | +0.59097349277 | 1.1452797119e-06 | [+0.38861611010; +0.79333087545] | 3.55e-15 |
| Берлин QV2M | +0.21850268137 | 4.4961594104e-08 | [+0.15548691439; +0.28151844835] | 1.78e-15 |
| Токио T2M | +0.32345996704 | 0.0010755156509 | [+0.13986665377; +0.50705328032] | 3.55e-15 |

T2M — °C/десятилетие, QV2M — г/кг за десятилетие. Павлодар requested52.27601°,76.96881° → cell52.5°,76.875°; Берлин52.52°,13.405° →52.5°,13.125°; Токио35.68°,139.69° →35.5°,140°.

N4A_PARITY.json сравнивает полные monthly/annual/fitted/trend/SE/p/CI/R²/quality/method parameters/coordinates/source с неизменёнными Python oracle. Max Δ для четырёх обязательных анализов3.55e−15. Это сравнение полного содержания, не только округлённой таблицы; transport/cache/timings/hashes и runtime versions правдиво текущие, не подменяются историческими. Допуск |Δ|≤1e−12+1e−10·|Python| учитывает разный порядок Float64 операций и математические библиотеки, метод/параметры не менялись.

Tokyo дополнительно прошёл независимый Python replay свежего ряда, max Δ3.55e−15; это не отдельная Python-загрузка NASA. Смена периода в **настоящем UI**: Берлин T2M2000–2025,312 месяцев/26 лет, slope+0.662276203593, p0.000196312985423; Python из исходных raw records max Δ5.33e-15, PASS (N4A_PERIOD_UI.json / N4A_PERIOD_PARITY.json).

Холодные T2M запросы: Павлодар165.742s, Берлин147.462s, Токио157.316s, каждый0 cache hits/420 misses/network_used=true. QV2M использовал оба показателя уже полученных subsets:420 hits/network_used=false,39.3/30.7ms. Новый UI затем показал те же настоящие данные из локального RAM cache; эти повторы не названы новым скачиванием. Измеренный peak одного локального экземпляра Next188.16MiB — не cloud benchmark. После финальной правки камеры повторный cold Berlin успешно получен за175.699s; быстрый real cached повтор164.5ms. Все научные поля повторного ответа точно совпали с полностью Python-проверенным результатом (N4A_FINAL_SCIENCE_EQUAL.json).

## 6. Проверки и production build
| Проверка | Успешно | Ошибок финального прогона |
|---|---:|---:|
| Все TypeScript tests: прежние209 + новые7 geography/geometry | 216 | 0 |
| Browser demo/real search/errors/race/cancel/no-auth | 22 | 0 |
| Browser local NASA/graphs/все экраны | 10 | 0 |
| Browser смена real NASA периода | 1 | 0 |
| Финальный fresh Berlin/camera regression/screenshots | 2 | 0 |
| Full Python parity:4 + Tokyo replay + period | 6 | 0 |
| Isolated runtime smoke | 4 | 0 |
| Copied HDF5/WASM MEMFS | 1 | 0 |

Итого35 browser сценариев. N4A_HTTP.json — ещё13 групп production HTTP-контрактов: четыре real-data demo analyses и numerical parity, invalid/oversize/malformed requests, другой cell404, parallel demo, blocked503, local-no-token503, cross-origin403. N4A_UI.json/ N4A_LIVE_UI.json содержат проверенные сценарии/измерения, mock задержки и ошибки явно test-only и не считаются NASA data verification.

Все существующие научные tests N2/N3 включены; они покрывают units/calendar/leap/missing/constant/known trends/OLS/HAC sensitivity/CI/p/provenance/Python и реальные cases. Новые tests проверяют реальные Photon schema/extent order, invalid/country filtering, anonymous fixed upstream, cap/cache/throttle/abort и footprint seam/poles. Expected scientific numbers не изменялись.

Окончательные npm run typecheck, boundaries (обязателен в build), production npm run build PASS на Node24.22.1/Next16.4.6. / и /_not-found static; /api/health,/variables,/analysis,/places dynamic. Логи N4A_TYPECHECK.log,N4A_TESTS.log,N4A_BUILD.log. Unhandled browser/SSR errors0. Исправлены обнаруженные UI-дефекты: терявшийся focus/results после disabled search submit и недостающее accessible name мобильной кнопки слоёв. Также исправлена гонка камеры: при быстром открытии мобильной панели старый easeTo мог вернуть устаревшие padding и скрыть маркер. Теперь layout/resize останавливает прежнее движение и применяет camera/padding вместе. Добавлены demo и настоящий cached NASA regression checks; маркер остаётся над панелью. Измерения layout выполняются после штатной анимации/viewport stabilization.

## 7. Отсутствие прокрутки и скриншоты
1440×900,768×1024,390×844: html/body scrollWidth/scrollHeight равны viewport, panel bounds внутри окна. У **всех научных вкладок и трёх страниц методики** scrollHeight≤clientHeight: содержимое не просто скрыто overflow. На телефоне до анализа панель collapsed, карта доступна; safe-area/visualViewport учтены. Смоделирован keyboard-size viewport390×544: поля доступны, панель временно скрывается при focus и результат возвращается при восстановлении. Это headless Edge/software WebGL, **не физическая iOS/Android клавиатура**.

Карта проверена по idle/isStyleLoaded/areTilesLoaded, source attribution видна, в том числе над нижней панелью. Скриншоты просмотрены:
- [Главная 1440×900](N4A-home-1440.png)
- [Настоящий анализ Берлина 1440×900](N4A-analysis-1440.png)
- [Главная 390×844, панель свёрнута](N4A-home-390.png)
- [Настоящий анализ 390×844](N4A-analysis-390.png)
- [Мобильная вкладка графиков](N4A-graphs-390.png)
- [Результат 768×1024](N4A-analysis-768.png)

## 8. GIBS и контракт карты
Созданы MAP_INTEGRATION_CONTRACT.md и GIBS_INTEGRATION_PLAN.md, typed PointMapProps/future descriptors. В текущей базе не было отдельных файлов второго участника; перед изменением существующей MapView проверен baseline hash. Дальнейшая карта/пространственные layers/3D — другой участник, его код не создавался и не перезаписывался. Через frontend adapter можно заменить renderer с теми же point/cell/pick/commands, без изменения научного backend. Будущее подключение 3D описано только как граница, не реализовано.

Проверенные metadata200: **MERRA2_2m_Air_Temperature_Monthly**, M2TMNXSLV5.12.4, EPSG3857, GoogleMapsCompatible_Level6, PNG256px/zoom0–6. Source colormap **K**, не °C. Времена имеют пропуски и отдельные non-first-of-month записи. Нужен union валидных canonical month dates, не утверждение непрерывного охвата. N4A_GIBS_METADATA.json, extracted layer XML и colormap сохранены с SHA.

Никаких глобальных temperature tiles в приложении сейчас нет. Интеграционный tile/CORS/browser test **не выполнен и не заявлен**; только metadata compatibility. Для N4B потребуется loader/time validation/NoData/managed raster/legend°C/actual tiles test. Числа не извлекать из RGB. Глобальные trends требуют самостоятельного scientific precompute на N4C, layerId/tiles/legend пока null, не фиктивный NASA ID. QV2M point analysis сохраняется.

## 9. Runtime/Vercel и безопасность
N4A .next без build cache: 56,639,383 bytes. Analysis route NFT dependencies 117 файлов/6,785,443 bytes; places 111 файлов/1,823,777 bytes. Изолированный общий Windows runtime из9 traces+bootstrap: 2720 traced файлов/148,233,757 bytes. Это **не финальный Vercel Function bundle/layers и не Linux verification**. Supplemental bootstrap trace содержит135 static warnings; проверенные старт/page/API/worker проходят, все необязательные ветви не сертифицированы.

Пакет работает без .env/reference/source TS/постоянного кэша, modules вне пакета запрещены resolver guard. Raw demo JSON включён как bounded asset, core рассчитывает его заново. Проверены demo API/worker/новый geography route, VERCEL=1+local→blocked, file→memory. HDF5/MEMFS из скопированных assets декодировал43092 bytes stdin, обе raw величины точно совпали с Python fixture. N4A_PACKAGE.json/N4A_WASM_PACKAGE.json.

Node24.x закреплён ранее и сохранён. Route runtime Node/maxDuration300, source deadline270s, no durable storage. Account Fluid/квоты/финальные Linux bundles/CPU/RAM и реальный deployment **не проверены**. GIBS capabilities5.84MB нельзя просто отдавать через Function с response limit4.5MB; план N4B требует narrow parsed metadata либо browser CORS route. VERCEL_LIMITATIONS.md обновлён.

Earthdata token остаётся только server/private root .env. Он ignored/untracked, audit содержимое не читал; client chunks проверены — private server config отсутствует. Git candidates без high-confidence JWT/private keys; trace всех четырёх API без .env/reference/tests/.cache. Source geo headers анонимны, NASA Authorization не пересылается Photon. Public personal-account proxy не подтверждён и по-прежнему blocked даже при токене на Vercel; не обойдён новым геопоиском/GIBS metadata.

## 10. Сохранность, ограничения и бюджет
Все514 manifest source/copy SHA-256 совпали, исходник и научные данные сохранены. Из 345 файлов текущего before snapshot защищённые 135 существующих backend/reference/fixtures/history/old reports/package/config не изменены. Добавлен только geography namespace, N2/N3 backend не переписан. Packages/lock/versions неизменны на N4A. N4A_INTEGRITY.json/N4A_SECURITY.json. Тестовые servers остановлены, root .env сохранён.

Нерешённое/не реализованное:
1. Оригинальный logo PNG нужен от пользователя; пока текстовый brand, favicon подготовлен условно.
2. N4B global temperature и N4C global trends только спроектированы; 3D вне нашей реализации. Региональное среднее недоступно.
3. Anonymous public Earthdata mechanism не подтверждён; local mode работает, public dynamic blocked. Реальный Vercel/Linux deploy и account/quota eligibility не проверены.
4. Photon/OSM и OpenFreeMap зависят от внешнего сервиса; fair-use/SLA/global traffic нужно повторно проверить перед публикацией. Реальные physical mobile keyboards не тестировались.
5. GIBS Time anomalies/gaps и units K требуют корректного N4B loader/legend; metadata не заменяет tiles test.

Расходы **0 KZT**. Нет новых npm libraries/versions, платных APIs/БД/storage, billing/card/trials/подписок. Использованы существующий бесплатный стек и moderate public Photon/NASA metadata. В поддержку NASA сообщения не отправлялись. Официальный NASA logo/endorsement не использованы. Помощь OpenAI Codex применена к коду/тестам/docs, научные измерения не сгенерированы ИИ.

## 11. Что нужно для N4B
После отдельного утверждения N4A: согласовать с участником карты typed adapter и source metadata; разобрать актуальные GIBS valid month dates; получить raster tiles в реальном браузере; добавить month/year state отдельно от analysis period, source/status/NoData и provider legend с Kelvin→°C scalar labels; проверить CORS/projections/cleanup/stale requests/атрибуцию/три экрана. Не выводить точные numeric values по RGB и не ломать QV2M/point API. Global trends остаются отдельным N4C; N5/push/deploy требуют отдельного разрешения.

**N4A остановлен для утверждения. N4B, N4C и N5 не начаты.**
