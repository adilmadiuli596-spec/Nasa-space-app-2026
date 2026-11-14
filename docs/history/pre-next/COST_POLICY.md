# Политика бюджета 0 KZT

Обязательное ограничение пользователя: **общий бюджет Earth Detective — 0 KZT**. Проверка источников: 14 ноября 2026. Эта политика не является разрешением устанавливать, регистрировать или подключать перечисленные сервисы.

## Что запрещено

Без отдельного согласования нельзя расходовать деньги, подключать платные API/библиотеки/хостинг/хранилища/геокодеры/карты/ИИ, активировать биллинг, привязывать карту, оформлять обязательный платный тариф или автоматически переходить на оплату после лимита. Бесплатный trial с последующим списанием не подходит. При исчерпании бесплатного ресурса функция должна останавливаться с понятным сообщением, а не включать оплату.

Приоритет — существующий компьютер, локальные процессы и локальный Docker Compose при подходящих условиях лицензии. Новое оборудование, платный интернет-тариф, домен и облачная машина не планируются. Использование уже имеющихся электричества, интернета и диска не означает, что они физически бесплатны; политика запрещает новые расходы проекта и не обещает отсутствие эксплуатационных затрат в любом окружении. Если имеющихся ресурсов недостаточно, сначала сообщить пользователю.

## Библиотеки и локальные инструменты

| Компонент | Лицензия / денежные условия | Условия и риски |
|---|---|---|
| React | MIT; лицензионная плата не требуется | Сохранять уведомления лицензии; [официальный LICENSE](https://github.com/react/react/blob/main/LICENSE) |
| TypeScript | Apache-2.0; лицензионная плата не требуется | Соблюдать лицензию и уведомления; [LICENSE](https://github.com/microsoft/TypeScript/blob/main/LICENSE.txt) |
| MapLibre GL JS | BSD-3-Clause; лицензионная плата не требуется | Это движок, не тариф поставщика карты; [LICENSE](https://github.com/maplibre/maplibre-gl-js/blob/main/LICENSE.txt) |
| Recharts | MIT; лицензионная плата не требуется | Сохранять уведомления; [LICENSE](https://github.com/recharts/recharts/blob/main/LICENSE) |
| FastAPI | MIT; лицензионная плата не требуется | Платные облачные продукты не входят в библиотеку; [LICENSE](https://github.com/fastapi/fastapi/blob/master/LICENSE) |
| Python | PSF License Agreement и включённые уведомления | Локальная среда, без покупки managed runtime; [лицензия](https://docs.python.org/3/license.html) |
| Docker Compose | Apache-2.0; сам исходный инструмент не требует лицензионной платы | Не переносить этот вывод на Docker Desktop/Hub; [LICENSE](https://github.com/docker/compose/blob/main/LICENSE) |
| NumPy, pandas, SciPy, statsmodels, netCDF4, earthaccess и транзитивные пакеты | Для зафиксированных этапов 3B/3C выполнен аудит exact-version PyPI metadata и notice-файлов; 65 пакетов перечислены в `3C_LICENSES.json` | При обновлении lockfile повторить аудит; для распространения сохранять все уведомления, включая MPL-компоненты |

Open-source-лицензии допускают использование кода с их условиями, но не оплачивают сервер и не предоставляют автоматически права на внешние данные, шрифты, изображения, тайлы или сервисы. При фиксации версий повторить проверку, сохранить необходимые уведомления. Лицензия самого Earth Detective ещё не выбрана; не назначать её от имени пользователя автоматически.

## Планируемые внешние обращения и бесплатные альтернативы

| Источник / сервис | Стоимость и подтверждённые условия | Лимиты / публичная эксплуатация | Вариант без платежей |
|---|---|---|---|
| NASA Earthdata, GES DISC, CMR, OPeNDAP | NASA предоставляет открытый доступ к Earth science data; скачивание требует бесплатной учётной записи Earthdata для защищённого архива. Это не платная облачная подписка | Возможны 401/403, таймауты, технические ограничения; гарантированной скорости/SLA не подтверждено. Указывать продукт, DOI и происхождение; не выдавать проект за NASA. Облачные S3-вычисления/egress отдельно не подключены и не разрешены | HTTPS-выборки и локальный проверенный кэш; эталон использовать только для своей ячейки |
| Docker Desktop, если будет выбран | Бесплатен для personal, education, non-commercial open source; для small business нужны одновременно <250 сотрудников и <$10 млн годовой выручки | Для крупных организаций и government entities требуется платная подписка. Категория пользователя формально не подтверждена; перед установкой проверить применимость | Docker Engine + Compose на подходящем локальном Linux либо прямой локальный запуск Python/Node; никаких платных облаков |
| Docker Hub, только для базовых образов | Бесплатный доступ имеет ограничения; paid plan не разрешён | Численные квоты зависят от типа доступа и могут изменяться; не зафиксированы как гарантия. При 429 остановить pull/использовать локальный кэш. Перед реализацией проверить актуальные квоты | Локальные образы/кэш, прямой запуск без Docker; не обходить rate limits |
| npm/PyPI, для загрузки пакетов | Отдельные платные package/registry-продукты не планируются | Лицензии проверяются по пакетам; не обещать доступность реестра. Автоматические платные сборки/CI не подключать | Локальная среда и кэш уже полученных разрешённых пакетов |
| Подложка карты | Провайдер пока не выбран и не подключён | Бесплатность MapLibre не доказывает бесплатность внешних тайлов. Публичную нагрузку нельзя объявлять безлимитной | Рассмотреть локальный GeoJSON Natural Earth; это предложение, ещё не реализация |
| Natural Earth, кандидат локальной подложки | Данные public domain, допускаются personal/educational/commercial use | Это набор геоданных, не сервис геокодирования и не SLA. Источник и версию фиксировать; детальность ограничена масштабом | Хранить выбранные разрешённые данные локально и отдавать тем же приложением |
| `tile.openstreetmap.org`, только возможный вариант | OSM data открыты, но публичный tile-server — ограниченный ресурс, не бесплатный CDN без условий | Видимая атрибуция, корректные Referer/User-Agent и кэширование по политике; без массового скачивания/prefetch/offline-заготовок; возможна блокировка, нет SLA. Не выбран как production-гарантия | Локальная подложка из отдельно разрешённых данных; нельзя предварительно скачать тайлы с этого сервера для обхода политики |
| Геокодирование | В MVP не планируется: точка выбирается координатами на карте | Ни платный геокодер, ни публичный Nominatim не подключены; их бесплатность/лимиты не утверждаются | Выбор точки/ввод координат без внешнего API |
| Хостинг, домен, CDN, объектное хранилище, БД, managed CI, аналитика, runtime AI | Не выбраны, не подключены; обещание бесплатного публичного размещения отсутствует | Бесплатные тарифы не оценены и не разрешены автоматически; billing/card/overage запрещены | Локальный запуск, локальное хранение и тесты; для core-MVP AI и облачная БД не нужны |

Источники условий: [NASA Earth science data](https://science.nasa.gov/earth/data/), [руководство Earthdata Search с бесплатной учётной записью](https://earthdata.nasa.gov/s3fs-public/2024-08/Getting_Started_with_Earthdata_Search.pdf), [Docker Desktop](https://docs.docker.com/subscription-billing/desktop-license/), [Docker Hub limits](https://docs.docker.com/docker-hub/usage/), [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/), [OSM tile usage](https://operations.osmfoundation.org/policies/tiles/).

## Потенциально платные зависимости

Docker Desktop при неподходящем сценарии — реальный лицензионный риск. Docker Hub paid plans, Mapbox, Google Maps, коммерческие тарифы MapTiler, hosted geocoding, облачный хостинг/хранилище и платные AI API не подключены. Их тарифы здесь не исследованы; считать их допустимыми бесплатными зависимостями нельзя. Использование текущего ИИ-инструмента не разрешает покупать подписки или оплачивать токены из бюджета проекта; условия существующего аккаунта пользователя документами проекта не меняются.

## Контроль перед подключением

Для каждой новой услуги документировать название, выбранный тариф/лицензию, дату и официальный URL, возможность без карты, численные лимиты, право публичной эксплуатации, последствия превышения и бесплатную альтернативу. Неизвестное помечать как неизвестное. Если нулевые расходы невозможно гарантировать в выбранном сценарии — остановиться до отдельного согласования. Публикация требует отдельного разрешения независимо от стоимости.

Сейчас проект рассчитан на локальную работу за 0 KZT; публичная эксплуатация не утверждена. Следующий обязательный шаг — проверка пользователя, а не регистрация сервиса.

## Проверка установленных зависимостей этапа 3B

14 ноября 2026 создано отдельное локальное окружение `backend/.venv`: Python 3.13.18, 34 закреплённых дистрибутива из публичного PyPI. Точные версии — `../backend/requirements.lock`; первичные PyPI metadata и найденные notice-файлы — [3B_LICENSES.json](3B_LICENSES.json). Версии сверены с фактически установленными пакетами, у всех 34 имеются отдельные license/notice-файлы; они не удалялись из окружения.

Основные пакеты: FastAPI 0.162.7 (MIT), Pydantic 2.14.3 (MIT), NumPy 2.5.4 (BSD-3-Clause и включённые permissive-лицензии), pandas 3.1.1 (BSD-3-Clause), SciPy 1.18.1 (BSD), statsmodels 0.15.0 (BSD-3-Clause), Uvicorn 0.54.0 (BSD-3-Clause), pytest 9.2.0 (MIT), httpx2 2.16.0 (BSD-3-Clause). Транзитивные пакеты используют MIT, BSD, Apache-2.0, PSF и иные указанные permissive-условия; уведомления о включённом коде сохраняются. Лицензионная плата, банковская карта и SaaS-подписка для их локального использования не требуются. При распространении соблюдать соответствующие уведомления/условия, а не удалять их вместе с metadata.

Первоначальный httpx заменён на совместимый со Starlette httpx2 после предупреждения deprecation; lock и лицензионная ведомость отражают итоговое окружение. OpenTelemetry API — транзитивная зависимость FastAPI; SDK, exporter, hosted collector и платная телеметрия не подключены. Swagger/ReDoc CDN-интерфейс отключён, OpenAPI доступен локально. Существующий локальный uv 0.13.8 — инструмент установки, не платный registry; его лицензия Apache-2.0 OR MIT проверяется по [официальному LICENSE](https://github.com/astral-sh/uv/blob/0.13.8/LICENSE-MIT).

Денежные расходы этапа 3B: **0 KZT**. Работали локальные тесты и кратковременный loopback-сервер. Примечание о будущем netCDF4/earthaccess относится только к историческому состоянию до разрешения 3C.

## Проверка динамического источника 3C

14 ноября 2026 установлены закреплённые `earthaccess==0.19.0`, `netCDF4==1.7.5.1.post1`, `requests==2.34.2` и `filelock==3.32.7`; полный lock содержит 65 дистрибутивов. Все точные версии и данные лицензий из PyPI metadata зафиксированы в [3C_LICENSES.json](3C_LICENSES.json). Проверено наличие license/notice-файла у каждого из 65 установленных дистрибутивов; GPL/AGPL-пакетов в этой ведомости нет. В наборе есть MPL-2.0 компоненты (в частности certifi и tqdm); их файлы/уведомления сохранены, условия соблюдать при распространении. Лицензии пакетов не требуют лицензионного платежа за этот локальный сценарий; это не отменяет обязанность сохранять notices и проверять условия перед распространением.

NASA access: CMR metadata search is anonymous; GES DISC OPeNDAP download requires Earthdata Login. Earthdata Login account is provided without charge, and earthaccess's supported interactive mode keeps credentials in the local process for this run, with `persist=False`; the application neither writes `.netrc` nor stores credentials in the repository. Product use constraints point to the NASA [data-use guidance](https://www.earthdata.nasa.gov/engage/open-data-services-software-policies/data-use-guidance) and [GES DISC citation guidance](https://disc.gsfc.nasa.gov/data-guidelines); the exact M2TMNXSLV collection metadata and citation are preserved in `3C_NASA_POLICY.json`. NASA's general [Earth science data policy](https://science.nasa.gov/earth/data/) supports open data access, but this does not establish an unlimited request rate or public-service SLA.

The implementation and integration checks are local/single-user. No public deployment or use of one operator's Earthdata session to serve the public has been approved or validated. Do not expose the current authenticated backend publicly; a future public service needs an appropriate per-user NASA authorization flow or explicit guidance from GES DISC. No AWS/S3 data path, cloud compute, hosted storage, paid API, Docker service, card or billing was used. Network requests were HTTPS to NASA CMR/OPeNDAP and public package metadata; no payment was triggered. Recorded 3C expenses: **0 KZT**.
