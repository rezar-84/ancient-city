# Hierapolis Reborn

A free, browser-based 3D journey through ancient Hierapolis, the Holy City above the travertines of Pamukkale. It is bilingual in English and Turkish. Live: <https://ar.ferially.com>

Modes:
- **Explore:** fly over the city on real terrain.
- **Guided tour:** 9 narrated stops.
- **Walk:** walk the streets as one of six characters.
- **Archaeological plan:** a top-down map with a timeline slider from 200 BC to AD 1400.
- **Ancient / Today:** switch to Google Photorealistic 3D Tiles of the site as it is now.
- **AR and print:** the theatre in AR, and a printable A4 guide (`/#/guide`).

The project description, sources and accuracy policy are in [`docs/proposal.md`](docs/proposal.md). Performance method and measurements are in [`docs/benchmarks/`](docs/benchmarks/).

## Stack

| Area | Tools |
|---|---|
| App | Vite 6, React 19, TypeScript, Tailwind 3, Zustand |
| 3D | three.js, React Three Fiber, drei, postprocessing + N8AO, three-mesh-bvh |
| Today view | `3d-tiles-renderer` |
| Camera | GSAP |
| AR | `@google/model-viewer` |
| Buildings | Procedural generators in `src/scene/generators` |
| Content | Typed bilingual modules in `src/content` |

## Develop

```bash
npm ci
npm run dev        # http://localhost:5173
npx tsc -b         # typecheck
npm run lint
node --test tests/*.test.cjs
npm run build && npm run preview
```

Optional `.env.local` (git-ignored):

```
VITE_GOOGLE_MAPS_KEY=...   # referrer-restricted key for the Today 3D view; without it, the app falls back to satellite imagery
ELEVENLABS_API_KEY=...     # only for the audio scripts below
ELEVENLABS_VOICE_ID=...    # narration voice
```

Useful URL flags:
- `?dpr=1`: fixed resolution.
- `?fx=0` / `?fx=1`: force post-processing off or on.
- `window.__benchmark()`: records a 20 s frame-timing sample (see `docs/benchmarks`).
- Shift+P: toggles the stats panel.

## Caching

In production, `public/sw.js` serves terrain, models, textures, images and audio cache-first:
- At build time, Vite writes a content-hash manifest into `dist/sw.js` (the `mediaManifest` plugin in `vite.config.ts`). A deploy therefore re-downloads only the files that changed.
- In dev, no service worker is registered.

Google 3D Tiles are never stored by the app; their terms allow only the browser's normal HTTP cache. Instead, a single tiles renderer and API session is kept alive for the whole page visit, so switching between Ancient and Today doesn't start a new session.

## Data and asset pipelines

Run the scripts from the project root. Python scripts run as `python3 -I`, TypeScript scripts with `npx -y tsx@4.19.2 --env-file=.env.local`.

| Script | Output |
|---|---|
| `scripts/bake_terrain.py` | `public/terrain/`: AWS Terrarium heights and Esri imagery |
| `scripts/build_ruins.py` | `src/content/ruins.ts`, from OpenStreetMap archaeological mapping |
| `scripts/bake_runtime_textures.ts`, `scripts/bake_ancient_texture.py` | Material and terrain textures |
| `scripts/ar/theatre_ar.ts` | `public/models/theatre.glb` and `.usdz` for AR |
| `scripts/tts_elevenlabs.ts [--only=id,…] [--force]` | Landmark and tour narration in `public/audio/{en,tr}`, and `src/content/audio.ts` |
| `scripts/characters_elevenlabs.ts` | Character intros and reflections in `public/audio/characters` |
| `scripts/barks_elevenlabs.ts` | Townspeople lines in `public/audio/barks` |

The research pack (sources, GeoJSON, DEM, image manifest) is in `research/`. See `research/SUMMARY.md`.

## Deploy

Docker multi-stage build (node 22 → nginx 1.27) on Dokploy, using `docker-compose.dokploy.yml`. Pass `VITE_GOOGLE_MAPS_KEY` as a build argument. The nginx config is in `nginx.conf`, with caching rules, security headers and the CSP.
