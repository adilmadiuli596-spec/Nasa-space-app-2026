# Зависимости N1
Точные версии закреплены в package.json и package-lock.json. Установленное дерево и license metadata: N1_DEPENDENCIES.json; копии найденных LICENSE/NOTICE/COPYING — docs/licenses/. Проверка npm audit — N1_AUDIT.json (0 известных уязвимостей на дату проверки; не гарантия отсутствия всех дефектов).

h5wasm распространяется по собственному NIST notice и включает HDF5 notices; это не следует называть MIT. Сохранён полный LICENSE.txt, включая разрешения, атрибуцию и disclaimers. NIST и HDF Group не одобряли этот проект. N3 использует h5wasm как runtime-зависимость в MEMFS decoder; N4 не меняет её версию и notice. MapLibre 6.18.0 BSD-3-Clause заменяет уязвимую ветку v5; worker assets содержат исходный license header и сопровождаются LICENSE.txt.

Прямые библиотеки бесплатны для локального использования по их условиям; лицензии библиотек не дают право скрывать атрибуцию подложки или раскрывать Earthdata credentials. Перед публичной публикацией проверить способ распространения и полные обязательства всех notices. Авторская лицензия самого Earth Detective командой пока не назначена; публичная подача не выполнена.

Отдельные root notice-файлы не поставлялись для: @esbuild/win32-x64, @next/env, @next/swc-win32-x64-msvc, client-only, murmurhash-js, server-only. License metadata зафиксирована; перед распространением проверить upstream notices этих пакетов.

N4: список и версии установленных библиотек сохранены, новых лицензий/пакетов нет; изменены только root engines Node → 24.x. Атрибуция карты и все сохранённые notices остаются.

N4A: npm packages/versions и notices неизменны. Новый внешний источник geocoding — Photon/OSM (fair use/no SLA, ODbL attribution), не новая JS-зависимость. Базовые tiles — прежний OpenFreeMap; вода стилизована светло-голубым, attribution сохранена. GIBS metadata изучены для будущего N4B, provider legend/units сохранены отдельно.
