# Cosmic sky panorama

Created with the built-in `image_gen.imagegen` tool on 2026-11-14 for Earth Detective. This is an original AI-generated decorative environment, not Google Earth imagery, NASA observation data, or a calibrated star catalogue.

- Runtime asset: [cosmic-sky.webp](cosmic-sky.webp), 1774 × 887 px, 197,862 bytes, quality 90 WebP conversion.
- Original generation filename: cosmic-sky-source.png (historical source PNG; not included in this repository).
- Mapping: equirectangular 360° × 180° celestial sphere, camera-driven WebGL2 pass.
- The renderer feathers the panorama seam and adds deterministic decorative point stars.
- No Three.js, paid API, runtime image generation or external space-image request.

## Licence scope

The author’s newly confirmed Apache-2.0 permission covers code only. This raster image is excluded from that grant and the root Apache code grant; no explicit image redistribution licence has been recorded. Keep this provenance and clarify image redistribution terms separately. It is not third-party NASA imagery. See [NOTICE](../../../../../NOTICE).

Final generation prompt, verbatim:

> Use case: stylized-concept. Asset type: a production equirectangular celestial sky panorama texture for an interactive Earth globe application. Create a stunning, refined, photorealistic all-sky deep-space starfield, 2:1 aspect ratio, ideally 2048 by 1024 pixels. Only the celestial background: NO Earth, NO planets, NO foreground spheres, NO UI, NO text, NO logos, NO watermark. A richly detailed but restrained Milky Way arc sweeps diagonally across a velvet near-black navy cosmos, with delicate silver-blue stellar clouds, complex dark interstellar dust lanes, subtle smoky indigo and muted violet nebula wisps, a small restrained warm amber emission region, and thousands of fine natural point stars. Cinematic NASA astrophotography mood, elegant realistic dynamic range; keep approximately 65 percent of the frame dark enough for a brightly lit Earth globe to be the focal point. Stars should be mostly tiny and naturally irregular, a few modest luminous stars, absolutely no giant lens flares, no rainbow colors, no saturated fantasy clouds. This is a full spherical 360 degree longitude by 180 degree latitude equirectangular sky map, horizontally seamless: left and right edge colors, stars, and dust structures must continue perfectly; low-detail dark celestial poles at top/bottom. Uniform crisp fine texture at high resolution. Distinctive gorgeous cosmic depth, beautiful but sophisticated, no cartoon look.

The generated art was copied from Codex generated_images into this module. Keep the asset folder when copying EarthMap to another Next.js project.
