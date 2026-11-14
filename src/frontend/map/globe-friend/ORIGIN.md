# Team globe module

Origin: D:\Downloads\earth detective\earth detective\src\components\earth-map. Author: teammate of the project owner, name not supplied. On 2026-11-14 the owner confirmed: author allowed this use; they work as a team. Integration authorized by N4G. This notice records team permission, does not assign an invented MIT licence to the teammate code. Original hashes: docs/N4G_ORIGIN.json.

MapLibre GL JS 6.18.0: BSD-3-Clause (existing dependency). No new runtime dependencies. Only the existing OpenFreeMap/OSM basemap is used; EOX, OSM public raster and demo tile/font servers from the standalone app are not used. Decorative sky is original AI-generated artwork as documented in assets/README.md; not NASA imagery or calibrated star data.

useEarthMap is adapted for the host worker, compact attribution, generic basemap loading and error fallback. SpaceBackdrop uses only two scoped CSS classes. Geographic utilities, renderer and future layer helpers retain the teammate implementation. EarthMap projection/selection logic is reused by the host adapter without its demo panels. N4B is not implemented.
