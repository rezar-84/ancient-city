# Benchmark asset provenance

This pass uses original procedural geometry and shaders in this repository; no external textures, models, or generated raster images were downloaded. New additions are theatre entablature/dentils and portal trims, street paving/kerbs/benches, and expanded procedural ground blending. There are no new third-party asset attribution requirements.

These additions are interpretive architectural detailing, not a claim of surveyed archaeological accuracy. Existing terrain and other assets retain their existing provenance and credits.

# Validation protocol

Compare the theatre's existing primary and secondary landmark views, then the colonnaded street at eye level. Use 1280 × 800, device scale 1, the same year/era and camera, and fixed effects settings for before/after comparisons. Sample a 20-second route after shader warmup; report median and p95 frame duration, renderer draw calls/triangles, and network transfer. Repeat with adaptive quality. Real device measurements are required before asserting 30/60 FPS or a percentage improvement.

The development capture helper retains its existing interface and output names; captures now use the active effects pipeline and restore state on failures. No 4K output added.

Use `?dpr=1&fx=1` for a fixed-resolution effects comparison or `?dpr=1&fx=0` for the direct renderer. `window.__benchmark()` records 20 seconds of frame timings and the latest renderer counters. Counter totals do not aggregate postprocessing passes. Without a fixed DPR, camera motion uses 80% of the current resolution budget; sharpness returns after 0.8 seconds at rest.

Validation status: production build passed during implementation; focused lint passed for rendering/capture/generator edits. Full lint reports a pre-existing explicit-any error in `src/scene/generators/index.ts`. Browser launch failed with a sandbox socket permission error, so live visual comparisons, route measurements, device targets, and historical-reference validation remain outstanding. Do not treat this initial implementation as a visually accepted benchmark.

Benchmark reliability: concurrent benchmark/capture runs are rejected. A tab hidden during sampling invalidates the run. Reports include the observed DPR range, effects states, and a `qualityChanged` flag; compare fixed-quality runs only when this flag is false. Forced `fx=1` now survives the performance monitor's fallback.
