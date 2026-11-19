# Hierapolis Reborn
### An interactive 3D web experience of the ancient Holy City above Pamukkale

**Author:** Ferial Ara — Master's programme, Yaşar University, İzmir · Fall 2026
**Live:** https://ar.ferially.com · **Languages:** English / Türkçe

---

## 1. Problem and aim

Hierapolis–Pamukkale (UNESCO World Heritage, 1988) is one of Türkiye's most-visited sites. Most visitors only experience the white travertines and a few scattered ruins. Without guidance it is hard to imagine the Roman spa city that stood on the plateau: its 1 km colonnaded street, theatre, sanctuary, baths and one of the largest necropoleis of the ancient world.

Existing digital material is fragmented. There are photos, a few 3D scans of single monuments, scholarly plans in Italian and German publications, and short tourist texts. Visitors and students have no single place that is free, bilingual, interactive and sourced.

**Aim:** build a free, browser-based, game-like 3D presentation of Hierapolis that:
- places every major monument in its real position on real terrain;
- lets the user switch between *ancient reconstruction*, *today*, and an *archaeological plan* with a timeline;
- tells the city's story through a narrated guided tour;
- offers AR ("put the theatre on your table") and a printable visitor guide;
- can be reused to promote other Turkish heritage sites.

## 2. Concept and features

| Mode | What the user does |
|---|---|
| **Title** | Slow orbit over the plateau; three entry points: Explore, Guided tour, Pamukkale view |
| **Explore (3D city)** | Orbit, zoom and pan over a diorama of the city on a real elevation model; 17 numbered monuments; click one to fly there and open its card (history, key facts, "did you know", disputed points, sources, narration) |
| **Gallery** | Every card has three tabs: *3D reconstruction* (renders from the model), *Today* (current photos), and *Archive & finds* (1838 and 1887 plans and drawings, museum reliefs and statues); fullscreen viewer with credits |
| **Viewpoints** | One-click cinematic views: City overview, Pamukkale terraces, Terraces from above, Down the main street, Sunset over the valley |
| **Archaeological plan** | Top-down parchment map with 5 m contours, numbered legend, north arrow, the street grid, walls and necropoleis drawn from OSM archaeological mapping; a **timeline slider** (200 BC – AD 1400) adds and removes monuments by period; **historic maps** viewer (Laborde 1838, Humann 1887, modern plans) |
| **Ancient / Today** | Crossfade between the reconstruction and today's site: Google Photorealistic 3D Tiles, or satellite imagery as a fallback |
| **Guided tour** | 9-stop narrated tour (~6 min) with scripted camera flights, subtitles and ElevenLabs voice in EN and TR; keyboard control (Space, ←/→) so the tour can be the presentation itself |
| **Walk the city** | Choose one of six characters (Hellenistic, Roman, Byzantine) and walk the streets in first or third person among townspeople, carts and animals, with greetings, voiced character reflections at monuments and a fast-travel map |
| **AR** | `<model-viewer>`: WebXR / Scene Viewer on Android, Quick Look (USDZ) on iPhone |
| **Print guide** | A4 booklet (`/#/guide`): cover, intro, timeline, plan with numbered monuments, one card per monument, sources and credits, QR back to the site |
| **Atmosphere** | Golden-hour lighting from the west (as at the real site), ambient soundscape, drifting CO₂ mist at the Ploutonion |

## 3. Research and sources

- **Positions and footprints:** OpenStreetMap archaeological mapping of the site (theatre, walls, gates, agora, necropoleis, travertine outline), cross-checked with published site plans. The Roman grid and Frontinus Street run about 30° east of south, and all reconstructions follow this axis.
- **Terrain:** AWS Terrain Tiles (SRTM), about 13 m grid over a 3.3 × 3.3 km area. **Imagery:** Esri World Imagery.
- **History:** UNESCO WHC 485; Wikipedia (Hierapolis, Ploutonion, Hierapolis sawmill, Hierapolis Archaeology Museum); Turkish Archaeological News; F. D'Andria's publications on the Ploutonion (2013–17); Italian Archaeological Mission (MAIER) material.
- **Archive:** L. de Laborde, *Voyage de l'Asie Mineure* (1838) plan and views; C. Humann et al., *Altertümer von Hierapolis* (1898; survey 1887) city, theatre, gate and bath plans.
- **Images:** 100+ photographs and artifact images, each recorded with author, license and URL in `research/manifest.csv` and credited in the app and the print guide.
- **Accuracy policy:** every card lists sources. Reconstructions are labelled as interpretation. Contested points are flagged ("Debated by scholars"), e.g. the Frontinus Gate date, the identification of St Philip's tomb, and the "Cleopatra's Pool" legend.

## 4. Technology

| Layer | Choice | Why |
|---|---|---|
| App | Vite + React 19 + TypeScript | Fast static build; hosts anywhere |
| 3D | three.js via React Three Fiber + drei | Mature WebGL stack, runs in every modern browser |
| Buildings | Procedural generators (theatre, gates, colonnaded street, agora, temple, martyrium, baths, nymphaeum, church, latrine, walls, necropolis) | Correct real-world dimensions, tiny downloads, one draw call per material |
| Today view | Google Photorealistic 3D Tiles (`3d-tiles-renderer`) | Real 3D photo mesh of the site |
| Camera | GSAP timelines | Smooth flights for the tour and the cards |
| Voice and sound | ElevenLabs multilingual TTS and sound generation | Natural EN/TR narration and ambience |
| AR | `@google/model-viewer` (GLB + USDZ) | Cross-platform AR from the browser |
| Hosting | Docker (nginx) on Dokploy, `ar.ferially.com` | One-command redeploy, HTTPS |

**Performance target:** MacBook Air M2 (fanless, integrated GPU) and mid-range phones. The DPR is capped at 1.75 and adapts down under load. One shadow-casting sun, merged and instanced geometry, and lazily loaded media are used throughout. Desktop adds post-processing (N8AO ambient occlusion, SMAA, tone mapping), which switches off automatically when the frame rate drops; phones get a lighter tier. Walk mode adds a few torch point lights and rigged citizens with a near/far LOD. Measured on the Roman walking route (headless Chrome, Intel HD 620, 1280 × 800, DPR 1): ~344 draw calls and ~1.09 M triangles; initial download ≈ 11.6 MB. A service worker caches terrain, models, textures and audio after the first visit. Method and results: `docs/benchmarks/`.

## 5. AI tools used, and a mini benchmark

The project was built with three AI coding assistants, each on tasks it was best at:

| Task | Tool | Result |
|---|---|---|
| Architecture, integration, content research and fact-checking, narration script, bilingual text | Claude (Claude Code) | Full app shell, content and data pipelines |
| Procedural building generators (12 monuments, materials, terrain snapping) | OpenAI Codex CLI | Strict-TypeScript, compiling generators on the first pass (~38k tokens); dimensions tuned afterwards |
| Narration (EN + TR) and ambient soundscape | ElevenLabs | 52 narration clips plus a soundscape loop |

Benchmark method and measurements are in `docs/benchmarks/`.

## 6. Evaluation plan

- **Technical:** frame rate on the M2 (target ≥ 50 fps) and on a phone (≥ 30 fps), Lighthouse performance, download size, AR on one Android phone and one iPhone.
- **Content accuracy:** every fact sourced; disputed claims flagged; plan positions checked against OSM and the historic plans.
- **Usability:** 5 participants, 3-minute task ("find the Ploutonion, start the tour, open the archaeological plan, switch to Today"), SUS questionnaire and comments.
- **Comparison with existing work:** Google Arts & Culture, Ubisoft *Discovery Tour*, Rome Reborn, and Sketchfab heritage models. Our contribution is the combination of free web access, bilingual narration, a sourced plan with a timeline, archive material, AR, and a printable guide.

## 7. Future work — promoting Turkish heritage

- Higher-detail photogrammetry for hero monuments (theatre, Frontinus Gate).
- The same pipeline (terrain, OSM footprints, generators, cards, tour, print guide) for Ephesus, Aphrodisias, Laodicea, Pergamon and Troy, in a "Turkish Heritage Atlas".
- On-site mode: geolocation with "you are here" on the plan, offline caching for visitors.
- Additional languages (DE, RU, AR, ZH) for international tourism.

## 8. Credits

Created by **Ferial Ara**, Master's programme, Yaşar University, İzmir, Fall 2026.
Third-party data, imagery and photographs are credited in the app, in the print guide, and in `research/manifest.csv`.
