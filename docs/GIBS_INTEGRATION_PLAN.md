# NASA GIBS — план N4B после утверждения N4A
Дата проверки 2026-11-14. **В N4A проверены metadata, слой не интегрирован; tiles в приложении не запрашиваются. Нельзя объявлять глобальную температурную карту работающей.**

## Проверенный кандидат
| Поле | Проверенное значение |
|---|---|
| Источник | NASA GIBS / NASA GMAO / GES DISC MERRA-2 |
| Layer ID | MERRA2_2m_Air_Temperature_Monthly |
| Переменная | T2M, среднемесячная температура воздуха на 2 м |
| Numeric/source unit легенды | K |
| Display unit N4B | °C, перевод только scalar legend labels K−273.15 |
| Коллекция | M2TMNXSLV V5.12.4, C1276812859-GES_DISC |
| DOI научных данных | 10.5067/AP1B0BA5PD2K |
| CRS | EPSG:3857, доступен в WMTS capabilities |
| TileMatrixSet | GoogleMapsCompatible_Level6 |
| Матрицы | zoom 0–6; width/height 1,2,4,8,16,32,64 |
| Формат | PNG, tile 256×256 |
| Time | ISO YYYY-MM-DD, для месячного UI canonical YYYY-MM-01 |
| Default в текущем ответе | 2026-08-01; не hardcode в продукте |

Фактически получены HTTP200: WMTS capabilities (5842283 bytes), layer metadata JSON, colormap v1.3 XML. N4A_GIBS_METADATA.json содержит извлечённые поля/матрицы/Time Values/SHA-256; N4A_GIBS_LAYER.xml — проверенный слой; N4A_GIBS_COLORMAP.xml — источник легенды. Это подтверждает существование и структурную совместимость с MapLibre raster source, **не CORS/tile/browser integration test**.

## Официальные endpoints
- [GIBS access / WMTS / projections / time](https://nasa-gibs.github.io/gibs-api-docs/access-basics/)
- [Available visualizations / metadata concepts](https://nasa-gibs.github.io/gibs-api-docs/available-visualizations/)
- [Проверенные EPSG:3857 capabilities](https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml)
- [Layer metadata](https://gibs.earthdata.nasa.gov/layer-metadata/v1.0/MERRA2_2m_Air_Temperature_Monthly.json)
- [Colormap / units K](https://gibs.earthdata.nasa.gov/colormaps/v1.3/MERRA2_2m_Air_Temperature_Monthly.xml)
- [Provider horizontal legend](https://gibs.earthdata.nasa.gov/legends/MERRA2_2m_Air_Temperature_Monthly_H.svg)

REST template из capabilities:
```
https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MERRA2_2m_Air_Temperature_Monthly/default/{Time}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png
```
WMTS Row/Col = y/x, схема XYZ, CRS3857; проверить на N4B browser tiles/no-data/CORS, не применять TMS flip по догадке. Перепроецированное изображение визуально более детальное, чем scientific grid; не обещать температуру в точной точке по одному raster pixel.

## Даты и недоступность
Time Values **не непрерывны**. В текущем ответе есть диапазон 1980-01–2023-11, отдельные интервалы 2024-02–04, 2024-06–2025-04 и 2025-07–2026-08; кроме того, есть отдельные даты апреля–июня2025, включая первые числа мая/июня и аномальные для monthly слоя не-первые числа. Доступность нужно строить по объединению всех записей, а не только крупных интервалов. Подтверждённые пропуски календарных месяцев: 2023-12, 2024-01 и 2024-05. Их нельзя автоматически считать месячным рядом. На N4B согласовать политику: загружать актуальные capabilities/DescribeDomains, выбирать только подтверждённые canonical first-of-month dates, подозрительные записи исключать и явно сообщать об ограничении metadata. Период 1991–2025 API не доказывает такой же полный охват GIBS.

До загрузки metadata controls disabled/not-ready. При недоступной дате/тайлах — явное сообщение, сохранить выбранную дату и базовую карту, не подставлять соседний месяц/старый слой. Abort и generation id защищают от устаревших слоёв при смене месяца; bounded retries/cache, без бесконечного фонового polling. Capabilities сейчас 5.84MB: не пересылать весь XML через Vercel Function с лимитом response4.5MB; на N4B выбрать direct browser access после CORS-теста либо bounded server parsing и маленький нормализованный JSON выбранного слоя. Источник, дата, units и легенда синхронизированы с активным descriptor.

## Палитра и единицы
Официальная colormap содержит температурные цветовые интервалы в K и отдельный transparent NoData. UI NASA-like palette и научная palette слоя — разные вещи: нельзя перекрасить RGB так, будто получены новые numeric values. Сохранить mapping provider, а scalar ticks/подписи пересчитать в °C по metadata; раскрыть sourceUnit=K/displayUnit=°C. Не извлекать точную температуру по цвету. Точные ряды/температура/тренды — существующий научный API с raw NASA данными, не WMTS PNG.

## Что реализуется только на N4B
После отдельного утверждения и согласования с участником карты: metadata loader и валидатор времён; managed MapLibre raster source/layer; month/year picker; source/status/NoData; правильная легенда; отмена и cleanup; тест реальных tiles и трёх экранов. Поддержка QV2M point analysis сохраняется. Глобальные тренды — **N4C**, не цветовая вариация месячной температуры, и требуют отдельного предварительного научного продукта.

## Атрибуция и доступ
GIBS описан NASA как публичная visualization service. Anonymous metadata200 не решает разрешение public Earthdata proxy для N3 scientific downloads. Перед N4B release проверить dataset use constraints и актуальные service terms, сохранить NASA GIBS/GMAO/GES DISC attribution, collection/version/DOI, layer ID/date и colormap source. Не использовать официальный NASA logo и не заявлять endorsement. Контроль расходов 0 KZT: без paid tile providers, billing или автоматических платных fallback. Доступность/квоты стороннего NASA сервиса не гарантируются.

