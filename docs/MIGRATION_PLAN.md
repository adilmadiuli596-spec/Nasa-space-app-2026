# План этапов — N4A
N1–N3 приняты. N1 сохранил исходники/историю и один Next; N2 перенёс научный core с Python parity; N3 дал local-only NASA adapter, thin API, bounded cache и honest real-data demo. Python/reference/history защищены, не второе приложение.

Актуальный N4A по новому заданию заменяет предыдущую визуальную итерацию N4: новый референс, header/search/variable/period/analysis/layers, 2D point/cell integration, tabs без scroll, mobile, NASA проверки, map/GIBS contracts. Отчёт MIGRATION_N4A.md. N4A завершается остановкой до утверждения; оригинальный logo PNG ещё требуется.

N4B: отдельно утверждённая глобальная среднемесячная температура NASA GIBS, точные даты/legend°C/NoData/tiles tests. N4C: отдельно предварительно рассчитанные глобальные тренды; не monthly layer и не запрос всей Земли на каждый browser pan. Другой участник отвечает за дальнейшую карту/пространственные layers/3D; MAP_INTEGRATION_CONTRACT.md задаёт границу. Ничего из этого не реализуется автоматически на N4A.

N5: только после отдельного разрешения фактический public deployment и Linux/platform/quota/browser checks. Public dynamic shared personal-account Earthdata не подтверждён и blocked; safe candidate — явно ограниченный two-cell demo. 3D не blocker нашей 2D UI/science части. Budget0, никаких paid integrations, push/deploy на N4A запрещены. Исходный D:\Projects\NASA read-only, manifest SHA-256 сохранён.
