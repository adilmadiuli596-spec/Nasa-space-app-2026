# Бюджет: 0 KZT
Дата проверки источников: 2026-11-14. Расходы на N1, N2, N3, предыдущую итерацию N4 и N4A: 0 KZT. Не подключены карта оплаты, подписки, платные API, БД или дополнительные сервисы.

Vercel Hobby планируется для личного некоммерческого сценария; применимость к командному проекту требует отдельной проверки перед публикацией. Бесплатный тариф не гарантирует непрерывную доступность. При исчерпании квот — остановка/ожидание, не автоматический переход на Pro. Не активировать trial или paid integration. Один деплой сам по себе не ограничивает число запросов NASA и объём вычислений.

Прямые пакеты и их лицензии зафиксировать из установленного дерева в N1_DEPENDENCIES.json; сохранить notices. Next.js/React/TypeScript/Zod и графики/карта — open source, без обязательного платного аккаунта. N3 переводит уже установленный h5wasm 0.10.3 из dev в runtime; версия и собственный NIST/HDF5 notice не менялись. Новых пакетов и paid services нет. Научное ядро N2 использует прежние собственные численные функции. Право распространять данные NASA, лицензия пакетов и правила сервиса — разные проверки.

OpenFreeMap используется как в старом UI; поставщик заявляет бесплатную публичную инфраструктуру без API key, но это сторонний сервис без обещанного SLA. Не заменять его платными тайлами. Сохранять OSM/OpenMapTiles attribution и лицензии стилей. Источники: https://openfreemap.org/ , https://openfreemap.org/quick_start/ .

Vercel: https://vercel.com/docs/plans/hobby , https://vercel.com/docs/limits/fair-use-guidelines , https://vercel.com/docs/functions/limitations . Перед будущим деплоем повторить проверку тарифов/лицензий и измерить bundle, CPU, memory, network. Никаких обещаний, что произвольная глобальная загрузка укладывается в бесплатные квоты.

N2 не подключает API, БД, billing или внешний compute. Oracle запускается локально существующим Python environment; оно не копируется в репозиторий. Программные зависимости и их notices остаются прежними.

N3: только локальные вычисления, RAM cache и optional локальный file cache. Никакой обязательной БД, хранилища или billing. Один Next app и один планируемый Vercel deploy остаются границей; фактического деплоя нет. Публичный Earthdata dynamic заблокирован. Demo не использует Earthdata account и не обозначается глобальным анализом. Затраты 0 KZT не означают неограниченный бесплатный compute или SLA сторонних NASA/OpenFreeMap/Vercel services.

Предыдущая итерация N4 не добавляла геокодинг-сервисов; актуальный N4A по новому поручению добавляет бесплатный interactive Photon/OpenStreetMap search через тот же Next.js, не отдельный сервер. Node engines закреплены 24.x, версии пакетов не менялись. Проверены локальная сборка и изолированный runtime; аккаунт/деплой Vercel не создавались, расходов 0 KZT.


## N4A
Бюджет 0 KZT. Новых библиотек/версий/ключей paid API нет. Photon допускает fair interactive use, интенсивное использование throttled, SLA нет: https://photon.komoot.io/ . В проекте только manual search, один upstream на процесс, ≥1.2s interval, cache64/24h, максимум5 результатов, никакого bulk/autocomplete. Данные OSM с attribution: https://www.openstreetmap.org/copyright . Поиск может быть отключён EARTH_GEOCODING=off; карта/ручные координаты/проверенные примеры остаются. Общего глобального rate cap при Vercel autoscaling пока нет — повторно проверить перед N5, не обещать unlimited free service.

GIBS на N4A — только три metadata-запроса без credentials и без интеграции raster tiles. Н4B/N4C требуют отдельного разрешения/контроля расходов. Не активировать платные tile services, billing, storage или upgrade. Private NASA token остаётся только локально, не публикуется. Vercel deployment/account settings не создавались.
