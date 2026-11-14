# Архитектура N4A
Одно активное Next.js App Router приложение. src/app — страницы/тонкие HTTP; src/frontend — React/MapLibre/Recharts, UI/job state; src/backend — NASA/science/cache/services и новый bounded geography I/O; src/shared — общие схемы/типы. reference/ и исходный D:\Projects\NASA — сохранённые эталоны, не второе приложение/сервис.

frontend импортирует frontend/shared, backend — backend/shared, shared — только shared. Backend modules import server-only. Boundary check обязателен в npm run build; ClientApp dynamic ssr:false защищает браузерные библиотеки от SSR. Root Node24.x, один package/lock, новых зависимостей N4A нет.

## Научный путь без изменений N2/N3
GET /api/health + /api/variables, POST /api/analysis используют прежние shared schemas. Backend NASA CMR/OPeNDAP → MEMFS h5wasm → LoadedSeries → единственный scientificResult. Gregorian/units/fill/range/calendar/provenance валидируются, 12 месяцев с весами по дням, OLS/HAC Bartlett lag3 + n/(n−2), Student t df=n−2, α=.05. Source/science/cache/services N3 не переписаны, Python/reference сохраняются. Browser получает готовые annual/fitted values; не считает регрессию/HAC или региональное среднее.

По умолчанию blocked; local — явно настроенный loopback с server-only token, на Vercel принудительно blocked. Demo — явно две сохранённые настоящие ячейки, raw данные заново рассчитываются core, другие cells404, без silent fallback. NASA source deadline270s, attempts20s/3, 4 network slots и 2 distinct jobs на процесс/coalescing. RAM bounded16MiB, optional local-only file64MiB выключен Vercel; нет зависимости от durable local storage. health.stage=N3 обозначает неизменённый серверный этап, не стадию редизайна UI.

## UI N4A
App управляет координатами/variable/period, source connection и результатом; header содержит форму анализа, GeoSearch — отдельную форму. Один active job ref до await; duplicate submit blocked, смена запроса abort/clear, identity check отклоняет старые ответы. Клиент без автоматических POST retries, ожидание290s, status15s; elapsed реальный. Закрытие панели не удаляет результат/не повторяет POST. Parsed result сверяется с query/source mode и длинами рядов; ошибки фиксированные русские, server arbitrary text не показывается.

Findings: Overview statistics/conclusion/preview; Charts annual/OLS/units/tooltips; Method с тремя небольшими страницами. Никакой длинной внутренней страницы со скрытыми полями. Main/body без scroll; panel body без overflow, tabs адаптируются. ResizeObserver/visualViewport учитывают header, высоту экрана/клавиатуры; phone изначально collapsed. При малом viewport и фокусе в поле панель временно скрывается, результат остаётся в state. Source/auth/demo badge виден даже при закрытой панели.

MapView расширен только для point integration, cell footprint, camera commands/labels и layout. Перед заменой проверен hash с baseline; отдельных файлов другого участника в каталоге не было/не перезаписывались. PointMapProps — shared/types/map.ts. Карта не имеет доступа к token/backend, не запускает analysis на pan/zoom; pick только координаты. Backend выбирает actual cell; cell-footprint.ts создаёт display polygon и seam split. Глобальные layer descriptors имеют только planned/unavailable. Контракт и будущие N4B/N4C в MAP_INTEGRATION_CONTRACT.md / GIBS_INTEGRATION_PLAN.md.

## Настоящий поиск
GeoSearch отправляет GET /api/places только по Enter/кнопке. Координаты распознаются локально; проверенные примеры Pav/Ber/Tokyo доступны отдельно. Тонкий route делегирует backend/geography/search.ts: фиксированный HTTPS Photon endpoint, city/locality filters, 10s timeout, no redirects, capped512KiB response, schema parsing, максимум5 results. Страны/области не анализируются по центроиду. Headers не содержат NASA Authorization/cookies; наружу передаётся только запрос поиска. Attribution Photon/OpenStreetMap видна в results.

На процесс: один upstream запрос, интервал≥1.2s, LRU64 queries/24h RAM; ошибки/429 безопасны, отмена освобождает слот. EARTH_GEOCODING=off отключает upstream без paid fallback. Это moderate interactive use, не гарантия общего global quota при serverless autoscaling; перед публичным трафиком условия Photon/нагрузку проверить. Никакого autocomplete, bulk download или дополнительного сервера/БД.

## Публикация и границы
N4A только UI + point API + проверенный metadata контракт GIBS. Н4B/Н4C/3D/N5/push/deploy не выполняются. Public Earthdata shared-account mechanism не подтверждён. Vercel подготовка/изолированный Windows smoke не доказывают реальный Linux deployment; см. VERCEL_LIMITATIONS.md. Logo PNG отсутствует, автоматически подключится в static Page/favicon после добавления файла и пересборки.
