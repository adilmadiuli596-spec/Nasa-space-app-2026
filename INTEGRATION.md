# Интеграция EarthMap

## Подключение

Скопируйте папку `src/components/earth-map` целиком, включая assets/: панорама импортируется как локальный статический ресурс Next.js. Внутри нет зависимости от app/, API routes, алиасов проекта, Tailwind или бэкенда. Установите `maplibre-gl@6.18.0 lucide-react@1.73.0`; среда — React 19, Next.js App Router, TypeScript strict. Для TypeScript также нужен `@types/geojson`.

Импортируйте из `components/earth-map/index.ts`. Он экспортирует компонент, все интеграционные типы, createGIBSLayer, GIBSLayerOptions, localGeocoder и функции нормализации/геометрии.

```tsx
"use client";
import { useRef, useState } from "react";
import {
  EarthMap, type EarthMapHandle, type MapMode, type MapBasemap,
  type MapPoint, type RegionBounds, type MapLayerConfig,
} from "@/components/earth-map";

export default function Explorer() {
  const map = useRef<EarthMapHandle>(null);
  const [mode, setMode] = useState<MapMode>("globe");
  const [basemap, setBasemap] = useState<MapBasemap>("satellite");
  const [point, setPoint] = useState<MapPoint | null>(null);
  const [region, setRegion] = useState<RegionBounds | null>(null);
  const [layers, setLayers] = useState<MapLayerConfig[]>([]);
  const [date, setDate] = useState("2026-11-14");

  return <div style={{ height: 700 }}>
    <EarthMap ref={map} mode={mode} onModeChange={setMode}
      basemap={basemap} onBasemapChange={setBasemap}
      selectedDate={date} activeLayers={layers} onLayersChange={setLayers}
      selectedLocation={point} onLocationSelect={setPoint}
      selectedRegion={region} onRegionSelect={setRegion}
    />
    <button onClick={() => map.current?.flyTo({ lat: 43.24, lng: 76.89 }, { zoom: 7 })}>
      Алматы
    </button>
    <input type="date" value={date} onChange={e => setDate(e.target.value)} />
  </div>;
}
```

Импорт из серверного page.tsx допускается, но callbacks и изменяемое состояние должны находиться в клиентском компоненте. SSR выдаёт контейнер и интерфейс; MapLibre загружается в useEffect. Стиль подложки и initialView читаются только при монтировании.

## Props

| Prop | Тип / значение по умолчанию | Назначение |
| --- | --- | --- |
| selectedDate | string, обязателен | Календарная дата YYYY-MM-DD. Неверная дата отключает overlays и показывает ошибку. |
| mode | globe / mercator, не задан | Управляемая проекция. Если задана без onModeChange, переключатель только отображает режим. |
| defaultMode | globe | Начальный режим без управляемого mode. |
| onModeChange | (mode) => void | Запрос смены проекции. |
| basemap | satellite / map, не задан | Управляемая подложка: спутниковая EOX либо обычная OpenStreetMap. Не связана с mode. Без onBasemapChange переключатель только отображает выбор. |
| defaultBasemap | satellite | Начальная подложка без управляемого basemap. |
| onBasemapChange | (basemap: MapBasemap) => void | Запрос смены типа подложки. |
| activeLayers | readonly MapLayerConfig[], [] | Каталог и конфигурация слоёв; enabled:false отключает слой. |
| onLayersChange | (layers) => void | Новый массив после изменения переключателя/прозрачности. Без callback панель слоёв работает только для чтения. |
| selectedLocation | MapPoint / null / undefined | Управляемый выбор. undefined включает внутреннее состояние, null сбрасывает выбор. |
| selectedRegion | RegionBounds / null / undefined | Аналогичное управление областью. |
| onLocationSelect | (point или null) => void | Клик/выбор результата поиска; null при очистке. |
| onRegionSelect | (bounds или null) => void | Завершение области; null при очистке. |
| markers | readonly MapMarkerData[], [] | Дополнительные точки с id, point, необязательными label и color. label — метаданные; текстовые подписи маркеров сейчас не рисуются. |
| geocoder | GeocodingAdapter, localGeocoder | Асинхронный поиск с AbortSignal. |
| initialView | Partial<CameraState> | По умолчанию lng:35, lat:15, zoom:0.9, bearing:0, pitch:0. Используется также Reset view. |
| baseStyle | StyleSpecification или URL | Полный пользовательский стиль вместо встроенных подложек, применяется при монтировании. Меню «Спутник / Карта» в этом случае скрыто; basemap/defaultBasemap не применяются. Не используйте ID с префиксом earth-overlay-, earth-region, earth-markers. |
| maxActiveLayers | number, 6 | Одновременный лимит enabled overlays (1–12); остальные получают limited. |
| showSpaceBackground | boolean, true | Декоративная небесная сфера вокруг глобуса. В Mercator скрыт и не рисуется, ранее созданные ресурсы кешируются до размонтирования. Включает локальную панораму и отдельный небольшой WebGL2-контекст; в iframe/Electron и при недоступности GPU используется CSS-панорама без второго WebGL-контекста. |
| showSearch | boolean, true | Показывать поиск. |
| showLayerManager | boolean, true | Показывать каталог слоёв. |
| showControls | boolean, true | Показывать инструменты, переключатель 3D/2D и меню типа подложки. Переключатели видны до загрузки тайлов; навигационные инструменты активируются после style.load без ожидания тайлов. |
| className / style | string / CSSProperties | Стили внешнего контейнера. Задайте реальную высоту родителя. Минимальная высота карты: 520px, на телефоне 620px. |
| ref | Ref<EarthMapHandle> | Программное управление. |
| onReady | (map: MapLibreMap) => void | После style.load, когда безопасны изменение стиля и выбор координат; один вызов на реально созданную карту. Не означает окончания загрузки тайлов. |
| onCameraChange | (camera: CameraState) => void | После moveend; нормализованный центр, zoom, bearing, pitch. |
| onLayerStatusChange | (states: LayerState[]) => void | Изменение набора/статусов активных слоёв. Статусы loading, ready, error, unavailable, limited. |
| onError | (error: Error) => void | Ошибки инициализации/MapLibre; слой дополнительно сообщает статус через onLayerStatusChange. |

Изменяйте массивы/объекты слоёв иммутабельно, сохраняйте id. Не мутируйте данные на месте: передайте новый data либо увеличьте revision. Удаление из массива удаляет source/layer и отменяет fetch. Проекция/дата/подложка не пересоздают карту. Смена подложки переключает visibility существующих слоёв без setStyle: сохраняются камера, дата, выбранные точка/область и источники overlays. В режиме «Карта» географические подписи уже встроены в OSM-тайлы, поэтому спутниковые подписи скрываются. Изменение opacity не перезагружает данные.

## Ref API

- flyTo(point, options?) — стандартные FlyToOptions без center; координаты передаются первым аргументом.
- resetView(), zoomIn(), zoomOut(), resize(), clearSelection().
- getCamera(): CameraState | null.
- getMap(): MapLibreMap | null — доступ к низкоуровневому API. Не удаляйте карту и внутренние источники. Замена стиля через setStyle не поддерживается менеджером; используйте baseStyle при монтировании.

До инициализации команды камеры ничего не делают. Автоповорота и постоянного requestAnimationFrame-цикла нет. Космический фон подписывается на move/resize, объединяет события в один кадр, учитывает prefers-reduced-motion и видимость вкладки. Его текстуры, shader program, обработчики, ResizeObserver и WebGL-контекст освобождаются при выключении/размонтировании. Фон не меняет состояние камеры или научных overlays. ResizeObserver вызывает resize только при изменениях контейнера. При размонтировании отключаются observer, события, WebGL-карта и незавершённые запросы.

## Координаты и области

MapPoint: `{ lat: 43.24, lng: 76.89 }`, WGS84, градусы; долгота нормализуется в [-180, 180).

GeoJSON: стандарт RFC 7946, координаты **[longitude, latitude]**, Feature или FeatureCollection. Встроенный renderer поддерживает fill/line/circle/heatmap; подавайте совместимые геометрии (линии для line, полигоны для fill, точки для circle/heatmap).

RegionBounds:

```json
{
  "west": 170, "south": -20, "east": -175, "north": 10,
  "crossesAntimeridian": true,
  "bbox": [170, -20, -175, 10]
}
```

Порядок bbox: [west,south,east,north]. **west > east означает пересечение антимеридиана.** Не сортируйте долготы повторно. Для отрисовки regionToGeoJSON делит такой bbox на два полигона с границей ±180°. Выбор всегда берёт кратчайший интервал долгот (не более 180°), поэтому этим инструментом нельзя выделить область шире полмира. Область географическая: её контур на глобусе выглядит криволинейным. В Mercator полюса ограничены сеткой подложки.

## Слои

Общие поля: id (уникальные латинские буквы, цифры, _ и -), title, description, category, enabled, opacity (0–1), color, demo, attribution, supportedModes, availability, legend. ID определяет владение MapLibre source и layer.

availability содержит start/end включительно, dates (точный список дат) и/или isAvailable({date,mode}). Укажите разрывы и фактическую частоту продукта через dates/предикат. Проверка выполняется до запроса. Отсутствие availability не означает, что продукт существует для всех дат: за полноту метаданных отвечает host.

### GeoJSON, точки, полигоны и heatmap

```tsx
const layer: MapLayerConfig = {
  id: "host-observations",
  title: "Наблюдения",
  type: "points", // geojson | polygon | points | heatmap
  opacity: 0.8,
  color: "#91d8bc",
  data: { type: "FeatureCollection", features: [] },
};
```

data: объект GeoJSON, URL (включая {date}) либо асинхронный resolver:

```tsx
const layer: MapLayerConfig = {
  id: "host-polygons", title: "Регионы", type: "polygon",
  availability: { dates: ["2026-11-14", "2026-11-15"] },
  data: async ({ date }, signal) => {
    // Запрос к существующему API основного приложения, который задаёт разработчик.
    const response = await fetch("/api/earth-regions?date=" + date, { signal });
    if (!response.ok) throw new Error("Нет данных: " + response.status);
    return await response.json();
  },
};
```

Этот API не создаётся модулем. Стабилизируйте функцию через useMemo/useCallback; при изменении date/mode resolver вызывается повторно, прошлый AbortSignal отменяется. Старые данные очищаются сразу. Для ручного обновления используйте revision. URL с {date} также обновляется; статический GeoJSON не зависит от даты.

renderAs переопределяет тип renderer (fill/line/circle/heatmap). paint задаёт нативные MapLibre paint properties соответствующего renderer. opacity остаётся главным регулятором прозрачности. Heatmap показывает плотность входных точек; научная интерпретация остаётся у поставщика данных.

### Raster XYZ / TMS

```tsx
const raster: MapLayerConfig = {
  id: "host-raster", title: "Raster overlay", type: "raster",
  tiles: ["https://your-provider.example/{date}/{z}/{x}/{y}.png"],
  tileSize: 256, maxzoom: 8, scheme: "xyz", opacity: 0.7,
  availability: { start: "2026-01-01", end: "2026-11-13" },
};
```

tiles также может быть функцией от LayerContext. Растровые тайлы должны быть совместимы с Web Mercator XYZ (EPSG:3857); globe перепроецирует их на клиенте. Произвольные EPSG:4326/полярные WMTS нельзя передать без адаптации. Указывайте tileSize, maxzoom, bounds и attribution по метаданным источника. Прозрачные/пустые тайлы не считаются доказательством наблюдений; HTTP-ошибка отображается как error.

## NASA GIBS

Модуль не запрашивает научный бэкенд самостоятельно и не хранит секреты. Host выбирает продукт по GetCapabilities/DescribeDomains, проверяет сетку, формат, размер тайла, уровни и даты, затем передаёт конфигурацию:

```tsx
import { createGIBSLayer } from "@/components/earth-map";

// Официальный исторический пример из GIBS Access Basics.
const aerosol = createGIBSLayer({
  id: "terra-aerosol", title: "MODIS Terra Aerosol",
  product: "MODIS_Terra_Aerosol",
  matrixSet: "GoogleMapsCompatible_Level6", maxzoom: 6,
  tileSize: 256, format: "png",
  availability: { dates: ["2014-04-09"] },
});
// Передайте selectedDate="2014-04-09" и activeLayers={[aerosol]}.
```

Это конфигурационный пример, не проверка текущего состояния сервиса. Для других дат подайте подтверждённые метаданные. createGIBSLayer поддерживает best/std/nrt и timeDependent:false для статических продуктов. Матрицы ограничены GoogleMapsCompatible_LevelN; EPSG:4326 и полярные сетки отклоняются. Доступность обязательна. Повторного автоматического выбора ближайшей даты нет.

Ссылки: [официальный доступ и временное измерение GIBS](https://nasa-gibs.github.io/gibs-api-docs/access-basics/), [WMTS EPSG:3857 GetCapabilities](https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml), [MapLibre projection/atmosphere](https://maplibre.org/maplibre-gl-js/docs/examples/display-a-globe-with-an-atmosphere/).

## Геокодинг и ограничения

GeocodingAdapter: label и search(query, signal): Promise<GeocodingResult[]>. Результат: id, name, point, description?, zoom?. Поиск дебаунсится, устаревшие результаты игнорируются, AbortSignal передаётся адаптеру. Соблюдение лимитов, CORS и правил внешнего сервиса — ответственность host. Ключевые сервисы и публичный Nominatim не вызываются по умолчанию.

Не передавайте непроверенную HTML-разметку в attribution: MapLibre обрабатывает её как HTML. Внешние URL запрашиваются непосредственно из браузера и должны поддерживать CORS. Для собственного CSP разрешите источники тайлов/шрифтов и worker blob:, требуемый сборкой MapLibre. Без сети подложка не гарантируется.
