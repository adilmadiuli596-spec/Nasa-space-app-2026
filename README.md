# Earth Detective — N4A
Одно Next.js App Router / React / TypeScript приложение. Node24.x; npm ci; npm run typecheck; npm test; npm run build; npm start. Только один сервер/репозиторий. NASA/science только backend; Python-код и Python-зависимости удалены по решению владельца. Научные расчёты выполняются на TypeScript; сохранённые JSON-эталоны используются в проверках.

N1–N3 приняты. Актуальная работа N4A: новый header/2D UI, Photon city/coordinates search, научные tabs и настоящий point analysis N3. Старый 4A.1 — источник логики, не актуальный дизайн. Отчёт docs/MIGRATION_N4A.md, статус docs/PROGRESS.md. N4B GIBS monthly temperature/N4C global trends/3D/N5 отдельно, не выполнялись. Актуальная публикация GitHub выполняется отдельно; Vercel deploy не проверен. Бюджет0 KZT.

EARTH_MODE=power default (NASA POWER, без токена); local — авторизованный loopback, никогда Vercel; demo — две реальные NASA cells Павлодара/Берлина с явной маркировкой, другие cells404. Токен только private root .env/server env, не NEXT_PUBLIC/Git/Vercel. После изменения .env restart. Пользователь уже сохраняет его локально; не отправлять в чат. Альтернатива npm run nasa:local. Для ограниченного публичного demo токен не нужен; global public Earthdata не подтверждён и blocked.

Настоящий поиск — manual Photon/OSM, не autocomplete; источник/лицензия отображаются. EARTH_GEOCODING=off отключает upstream; координаты/примеры остаются. Оригинальная эмблема подключена из public/brand/earth-detective-logo.png; favicon создан на её основе. MAP_INTEGRATION_CONTRACT.md и GIBS_INTEGRATION_PLAN.md разделяют работающий point analysis и будущие слои.

## GitHub → Vercel
Репозиторий: https://github.com/adilmadiuli596-spec/Nasa-space-app-2026, ветка main. Используйте Next.js preset, корень репозитория, npm ci и npm run build; Node 24.x задаётся package.json. .vercelignore сохраняет необходимые scripts и tests (TypeScript включает tests), исключая эталонный архив reference, документацию и секреты. Зависимости фиксируются package-lock.json, worker MapLibre создаётся prebuild.

Публичный Vercel использует NASA POWER Monthly Point API: T2M/QV2M, 1991–2025, произвольная точка, без EARTHDATA_TOKEN. Старые EARTH_MODE=blocked/local в Vercel не отключают POWER и не открывают Earthdata. Явный demo/blocked/local доступен вне Vercel. POWER не подменяет канонические данные GES DISC; исходные единицы C и g/kg и точность API указаны в происхождении. Фактическая связь с аккаунтом Vercel и cloud/Linux-сборка этим GitHub push не проверяются; новый Vercel-проект не создаётся.

P0: источник публичного анализа — NASA POWER Monthly Point API. Старый MERRA-2/Earthdata-адаптер сохранён для локального авторизованного режима. Полная методика/проверки/ограничения: docs/P0_POWER.md.
