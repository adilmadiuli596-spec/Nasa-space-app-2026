# Team globe module — origin and licensing

Origin: D:\Downloads\earth detective\earth detective\src\components\earth-map. Contributing author: **Earth Detective team member (name not supplied)**. Initial team-use permission was confirmed by the owner on 14 November 2026; original source hashes remain in [N4G_ORIGIN.json](../../../../docs/N4G_ORIGIN.json).

## Apache code permission

On **15 November 2026**, the project owner confirmed the author explicitly permits publication and distribution of their code under **[Apache License 2.0](../../../../LICENSE)**. The owner retains the correspondence privately. This document records that owner confirmation; it does not claim independent inspection of the messages or disclose private correspondence. No individual name or legal entity is invented.

The previous team-use-only code exclusion is removed for the consenting author’s original contributions in these files, together with project-owned adaptations:

- [SpaceBackdrop.tsx](SpaceBackdrop.tsx)
- [earth-map.module.css](earth-map.module.css)
- [hooks/useEarthMap.ts](hooks/useEarthMap.ts)
- [lib/geo-utils.ts](lib/geo-utils.ts)
- [lib/gibs.ts](lib/gibs.ts)
- [lib/map-config.ts](lib/map-config.ts)
- [lib/map-layers.ts](lib/map-layers.ts)
- [lib/render-performance.ts](lib/render-performance.ts)
- [lib/space-camera.ts](lib/space-camera.ts)
- [lib/space-renderer.ts](lib/space-renderer.ts)
- [types/map.types.ts](types/map.types.ts)

The permission also covers that author’s projection, point-selection and camera code reused in the host [GlobeMapView](../GlobeMapView.tsx), as recorded in the original provenance. It does not relicense third-party components merely imported or used by these files. The existing host adaptations and original hashes remain documented; no implementation changed in this licensing update.

## Separate resources and attribution

- MapLibre GL JS remains BSD-3-Clause; React and GeoJSON type definitions remain MIT. Their original notices are retained in [docs/licenses](../../../../docs/licenses/).
- OpenFreeMap / OpenMapTiles / OpenStreetMap basemap content and NASA GIBS layers retain provider terms and attribution. Legacy EOX/demo providers from the standalone prototype are not active host sources.
- **assets/earth-detective-sky.webp is a new owner-supplied AI-created background, not code covered by the author’s Apache permission.** It replaces the removed cosmic-sky.webp; project use/publication were requested without asserting copyright eligibility or exclusive ownership or supplying a broader image sublicence. Retain the [current image provenance](assets/README.md). It is not NASA imagery, an observation layer or a star catalogue.
- Names, logos and other provider resources are not relicensed. See [NOTICE](../../../../NOTICE) and [release attribution](../../../../docs/RELEASE_ATTRIBUTION.md).

The scope update concerns licensing only; no UI, camera, map renderer or scientific behaviour has changed.
