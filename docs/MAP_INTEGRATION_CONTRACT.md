# Контракт интеграции карты — N4A, версия 1
Дата 2026-11-14. Сейчас работает только 2D и анализ одной серверной ячейки. Глобальная температура (N4B), глобальные тренды (N4C) и 3D не реализованы в N4A. Ответственный за следующие компоненты карты — другой участник; его файлы не перезаписывать.

## Действующий интерфейс
Единственная точка подключения — src/frontend/map/MapView.tsx, экспорт MapView. Тип PointMapProps — src/shared/types/map.ts. Компонент работает только в client boundary ClientApp (dynamic ssr:false), не импортирует backend.

```ts
type PointMapProps = {
  point: { latitude: number; longitude: number } | null;
  cell?: Result['actual_cell'];
  pick(point: { latitude: number; longitude: number }): void;
  focusKey?: number;
  labelsVisible?: boolean;
  command?: { id: number; type: 'in' | 'out' | 'world' };
  panelOpen?: boolean;
};
```

point — выбранная пользователем точка WGS84, градусы, отдельно от cell. Для MapLibre массив координат всегда [longitude, latitude]. pick вызывается только по пользовательскому выбору, не автоматически при pan/zoom; App валидирует координаты, отменяет прежнее ожидание и сбрасывает результат. Поиск/ручной ввод и API используют тот же Point контракт. Отмена и identity guard принадлежат App, не карте. Изменение камеры не запускает NASA.

cell передаётся только из проверенного успешного scientific Result. Поля latitude/longitude, latitude_index/longitude_index и latitude_spacing=.5, longitude_spacing=.625. Отрисовывается **вся реальная ячейка**, не произвольный полигон вокруг города: геометрия ± половины шага; dateline разделяется, широта ограничивается полюсами. cell-footprint.ts — только display geometry. Выбор nearest cell/units/statistics остаётся backend/science; карта не повторяет nearest-cell алгоритм и не усредняет территории. При новом выборе cell удаляется вместе с устаревшим результатом.

focusKey — возрастающая ревизия явного поиска/примера: центрировать point и увеличить масштаб. command.id — новая ревизия команды камеры; не повторять одну команду на каждом render. panelOpen позволяет сохранить выбранную точку в видимой области с учётом header/right/bottom panels. labelsVisible управляет реальными географическими подписями. Карта реагирует на ResizeObserver и не меняет document dimensions.

Текущий MapView сам показывает безопасный loading/error/retry и ограничение Mercator |lat|≤85.05112878. Координаты вне этой видимой широты сохраняются для анализа; карта их не заменяет. Ошибка подложки не означает ошибку научного API, не запускает demo fallback. data-map-ready используется только QA (idle + style/tiles loaded), это не производственный протокол другого участника.

## Будущий месячный температурный слой N4B
Тип FutureMonthlyTemperatureLayer документирован в shared/types/map.ts; status сейчас только planned/unavailable, renderer отсутствует. Точный источник подтверждён metadata: sourceId=nasa-gibs, layerId=MERRA2_2m_Air_Temperature_Monthly, T2M, sourceUnit=K/displayUnit=°C, EPSG:3857, GoogleMapsCompatible_Level6, PNG/256px, zoom0–6. Нужны year/month, canonical first-of-month Time, validTimes, capabilities/metadata/colormap URLs, legend stops, attribution и явная причина недоступности. Детали — GIBS_INTEGRATION_PLAN.md и N4A_GIBS_METADATA.json.

Год/месяц слоя и период научного анализа — разные состояния. Показ одного месяца не превращает его в тренд 1991–2025. Карта T2M не должна незаметно менять выбранный QV2M анализ. Численные ответы нельзя получать из RGB: точные значения и статистика только через научный API. GIBS изображения публичны технически, но это не разрешение anonymous Earthdata proxy N3.

Легенда строится по provider colormap, не произвольному градиенту. Исходные Kelvin scalar ticks переводятся в °C вычитанием 273.15; изображение и цветовые интервалы не выдаются за точные измерения пикселя. NoData/прозрачность отдельно, не как 0°C. Image tile resolution не равно разрешению данных MERRA-2 0.5°×0.625°.

## Будущий глобальный слой трендов N4C
FutureTrendLayer: planned/unavailable; sourceId=earth-detective-derived-merra2, layerId/tiles/metadataUrl/legend=null, пока реального продукта нет. Переменная T2M, единица °C/decade, 1991–2025, источник M2TMNXSLV5.12.4, метод OLS-HAC3-Bartlett-Student-t. Не придумывать NASA GIBS identifier для трендов. Потребуется отдельный предварительный расчёт, grid/mask/version/hash, science-method metadata, проверка полных рядов и опубликованный набор assets. Никакого расчёта всей Земли на каждый browser pan.

Легенда трендов — отдельная от температуры: знак, единицы за десятилетие, границы шкалы, NoData и (если есть) отдельная маска значимости. Отсутствие significant тренда не равно нулевому тренду. Множественные пространственные сравнения и их ограничения должны быть объявлены. Региональное среднее не получается из центральной точки и остаётся отдельной неразрешённой работой.

## Ошибки и ответственность
Metadata/date/layer unavailable — убрать незагруженный научный слой и показать его состояние, сохранить базовую 2D-карту и выбор точки. Не менять запрошенную дату на ближайшую молча. Никакого неявного выбора другой ячейки/города или готовых statistical answers. Legend/source labels привязаны к активному descriptor; при ошибке не оставлять старую легенду под видом новой.

frontend — camera, UI, geometry display, legend, renderer; shared — data contracts; backend — N3 NASA I/O, source validation и N2 science; app/API — тонкий HTTP. Переменные Earthdata только server env. Нет секретов в props, URLs, browser storage или renderer. Public local режим на Vercel остаётся blocked.

## Подключение компонента второго участника
1. Новый компонент принимает тот же PointMapProps через небольшой frontend adapter. В App меняется только импорт/композиция MapView, не запрос/Result и не scientific backend.
2. Для N4B/N4C отдельно согласовать расширение descriptor до available и реальные URLs, source metadata, legend и тесты ошибок. До этого строки слоёв информационные и не изображают готовую функцию.
3. Прогнать выбор/search/manual input, точки Павлодар/Берлин/Токио, реальные cell footprints, pan/zoom/resize, ошибки/NoData, три экрана, отсутствие scroll и сохранение научного результата.
4. Возможный будущий 3D renderer делает другой участник за этим же adapter. Координаты/события и backend остаются прежними; 2D остаётся доступным fallback. Это описание границы, **не реализация или интеграция 3D в N4A**. Библиотеки 3D не добавлены.
Camera/layout regression N4A: при раскрытии панели или реальном resize необходимо завершать старый easeTo до применения новых padding. Selected marker должен оставаться в видимой области над phone panel; N4A_FINAL_UI.json проверяет быстрый real cached response. Это правило renderer adapter, не изменение backend.
