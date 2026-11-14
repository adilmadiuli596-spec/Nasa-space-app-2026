# Vercel — подготовка N4 и оставшиеся ограничения
Дата проверки официальных материалов: 2026-11-14. **Deployment не выполнялся. Готовность локальной сборки и реального облачного приложения — разные статусы.** 3D вне нашей ответственности, не blocker 2D.

## Подтверждено локально
Один Next.js 16.4.6 / React 19.3.1 проект. Node закреплён 24.x в package и lock: диапазон >=22 мог выбрать другую major; локальные проверки на 24.22.1. [Vercel Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions) подтверждает поддержку 24.x и приоритет engines. Пакеты/версии/лицензии N4 не менялись. h5wasm runtime использует ESM+MEMFS, не native HDF5 addon или постоянный /tmp; его assets и notice входят в trace. MapLibre/Recharts только client boundary ssr:false.

| Измерение окончательной локальной сборки | Значение |
|---|---:|
| .next без build cache | 55,351,378 bytes |
| analysis route NFT dependencies | 117 файлов / 6,784,007 bytes |
| Изолированный общий runtime из 8 traces + bootstrap trace | 2710 traced файлов / 148,158,498 bytes |
| Наибольший проверенный HTTP scientific response | 179805 bytes |

NFT dependency size не включает автоматически все платформенные обёртки/слои и не является финальным Vercel Function bundle. Общий runtime — тестовый Windows build artifact, а не второй проект или будущий Vercel upload. В supplemental bootstrap trace 135 предупреждений статического анализатора; локальные старт/страница/API работают, но все опциональные ветви и Linux assets этим не доказаны.

Изолированный smoke: root package, compiled .next/server, .next/static, public assets, traced dependencies и bounded src/backend/nasa/demo-data.json. Исходные TS, reference/, tests/, проектные docs/, .env и .cache не копировались. CommonJS resolver отвергает модули вне пакета. Health/variables/real two-cell demo 200, другая ячейка 404, worker asset 200; VERCEL=1 + local принудительно blocked, file cache превращается в memory. Это проверка без внешних файлов приложения, не полный OS sandbox. Отдельный процесс из этого пакета декодировал 43092 input bytes HDF5 из stdin в MEMFS, оба значения побитово совпали с Python raw fixture. N4_PACKAGE.json, N4_WASM_PACKAGE.json.

## Время, квоты, параллельность
Для Fluid Hobby документация указывает 300 s, 2 GB/1 vCPU, стандартный bundle 250 MB и payload 4.5 MB. Конфигурация текущего Route Handler: Node runtime, maxDuration=300; NASA deadline=270 s, client=290 s. [Function limits](https://vercel.com/docs/functions/limitations). Настройки конкретного аккаунта/Fluid и реальные Linux memory/CPU/timeout ещё не проверены.

N4 локальная cold загрузка Павлодара 163.759 s. Берлин/Токио после сетевых сбоев завершились с частично тёплым кэшем за 87.254/145.478 s; это не чистый cold benchmark Vercel. Отмена браузера не обещает нулевой compute после disconnect. Без durable cache каждый новый instance может заново загружать 420 месяцев.

NASA local: максимум 2 distinct jobs, 4 network slots на процесс, coalescing одинаковых запросов, bounded RAM16 MiB; это не глобальный лимит при autoscaling. Demo считает bounded 5–35-летний ряд синхронно и не обращается к NASA; локальная защита от двойного submit не является публичной anti-abuse системой. Не включать global dynamic пока нет разрешённого auth/abuse/quota решения без платного storage.

Hobby имеет ограниченные CPU/memory/invocation/traffic ресурсы; превышение может приостановить сервис. Применимость тарифа к этому проекту и доступные квоты аккаунта необходимо проверить на N5. Не активировать Pro/trial/billing/card, при ограничениях остановиться. [Hobby limits](https://vercel.com/docs/plans/hobby). Расходы N4 0 KZT; аккаунт/проект Vercel не создавался.

## Earthdata и безопасный публичный вариант
User token — персональный механизм; срок 60 дней и максимум два токена описаны [EDL user-token docs](https://urs.earthdata.nasa.gov/documentation/for_users/user_token). Это не подтверждает право anonymous proxy через один personal account. Такое разрешение/официальная схема приложения не получены; local на Vercel заблокирован кодом даже при токене. В поддержку сообщения автоматически не отправлялись. Challenge brief, авторская лицензия и условия распространения производных данных остаются отдельной проверкой команды (NASA_COMPLIANCE.md).

Подготовленный кандидат для N5: **явное demo двух реальных ячеек**, EARTH_MODE=demo и EARTH_CACHE=memory; Earthdata token в Vercel не нужен. .env игнорируется Git/trace/.vercelignore, secrets не NEXT_PUBLIC. Токио и произвольные другие ячейки в demo 404 с объяснением, никаких подмен Павлодаром/Берлином. Глобальный выбор карты не означает глобальное покрытие demo. Raw snapshot содержит измерения, расчёт выполняется scientific core при запросе.

## Действия N5 после отдельного разрешения
1. Утвердить публичный режим/лицензию/допустимость Hobby. При отсутствии подтверждённого public Earthdata механизма выбрать двухъячеечный demo и явно принять его охват.
2. Создать **один** Next.js Vercel Hobby project из корня репозитория; Node 24.x, npm ci, npm run build, стандартный .next output, без второго backend. Убедиться, что Fluid включён, max duration допустим; без paid add-ons и карты.
3. Задать demo/memory для нужных окружений, не загружать личный токен/.env/reference/сырые глобальные NetCDF. Проверить remote/Git на секреты до отдельно разрешённого push или выбранного upload.
4. Выполнить фактический deployment только в N5. На платформе измерить финальные Linux function bundles/layers, время/RAM/CPU, проверить h5wasm trace и notices. Успех Windows package smoke не заменяет это.
5. На public URL проверить health/catalog/demo Pav/Ber обе переменные, другой cell 404, отсутствие credentials, три экрана, tiles/worker/графики, смену периода/отмену/старая response protection. Проверить отсутствие env/source files по публичным путям и логам.
6. Зафиксировать расход/квоты и rollback (отключение deployment/blocked), без upgrade. Только после этих проверок объявлять публичное приложение готовым. Public dynamic требует отдельного согласованного auth/abuse решения; текущая конфигурация его намеренно не включает.


## Актуализация N4A — 2026-11-14
Предыдущие N4 измерения выше исторические. Новый UI/geo route: final analysis NFT6,785,443 bytes, places NFT1,823,777 bytes; .next без cache56,639,383 bytes; общий local traced runtime148,233,757 bytes. Четыре isolated smoke и MEMFS/WASM checks прошли; это по-прежнему Windows proof, не Vercel/Linux bundle или account verification. Final build Node24.x прошёл, новых пакетов нет. Private .env не копируется, Vercel local mode blocked, file cache disabled.

Photon новый manual city search: fair use/no SLA, 1 upstream/процесс, ≥1.2s, RAM64/24h, off switch EARTH_GEOCODING=off; глобального агрегированного cap между serverless instances нет. Перед публичным трафиком проверить допустимую нагрузку; без paid fallback. EARTH_GEOCODING не даёт public Earthdata access. Будущий GIBS public visualization — отдельный N4B с technical metadata proof, но не готовым raster integration. Capabilities5.84MB требуют narrow metadata response или direct CORS, а не полного XML через Function response4.5MB. Cloud deployment/N5 на N4A не выполнялись.

