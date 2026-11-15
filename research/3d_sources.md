# 3D models, scans, DEM and imagery for Hierapolis / Pamukkale

Collected 2026-11-15. The Sketchfab data comes from the public Sketchfab API (`api.sketchfab.com/v3/search` and `/v3/models/{uid}`); the raw JSON is in `raw/sketchfab/`.

**Download access:** every Sketchfab download, including CC-licensed models flagged *downloadable*, needs you to be signed in to a (free) Sketchfab account. So **no Sketchfab model can be downloaded without a login**, and all of them are "needs manual download". Nothing was downloaded from Sketchfab.

## Sketchfab models: Hierapolis / Pamukkale

| Model | Author | Licence | Downloadable (login) | Faces / vertices | Published | Notes |
|---|---|---|---|---|---|---|
| [Hierapolis Theatre - TURKEY](https://sketchfab.com/3d-models/hierapolis-theatre-turkey-98b7346d378e4bdf98309596dc7c4761) (uid 98b7346d378e4bdf98309596dc7c4761) | Arqueomodel3D (juanbrualla) | CC Attribution (CC BY 4.0) | yes | 1,678,983 / 841,647 | 2022-08-14 | **Best candidate.** Photogrammetric model of the Roman theatre. Credit is required. You will likely need to decimate it for the web. |
| [Pamukkale theater](https://sketchfab.com/3d-models/pamukkale-theater-be3721eb037c4639a635e9e0500b54a1) (uid be3721eb037c4639a635e9e0500b54a1) | albiwald | "Free Standard" (Sketchfab Store licence, not CC) | yes | 494,075 / 247,330 | 2025-09-10 | Lighter theatre model. Read the Standard licence terms before using it. |
| [Pamukkale - Denizli, Turkey](https://sketchfab.com/3d-models/pamukkale-denizli-turkey-85bc3f0ab54344eea9e6abf30038625e) (uid 85bc3f0ab54344eea9e6abf30038625e) | Sircher | CC Attribution | yes | 299,999 / 157,944 | 2020-05-04 | Travertine terraces, built in Agisoft from 93 frames of a YouTube video (the author says so). Accuracy is low, and the video source raises a rights question. |
| [Travertine, Turkey](https://sketchfab.com/3d-models/travertine-turkey-12a1930aae93428c8a106995e5fba34e) (uid 12a1930aae93428c8a106995e5fba34e) | Sara Carena (saracarena1) | CC BY-NC | yes | 4,488,063 / 2,233,878 | 2025-11-10 | High-detail scan of the Pamukkale travertine terraces. Non-commercial only, which suits a university project. |
| [AE_Pamukkale_Laid_Stone_Wall](https://sketchfab.com/3d-models/ae-pamukkale-laid-stone-wall-735454d17f4f411f91ccdcc5316672d9) (uid 735454d17f4f411f91ccdcc5316672d9) | NomadArch | CC Attribution | yes | 222,689 / 113,455 | 2023-09-08 | Inscribed reused block (Alpha and Epsilon) in a modern fence near the St Philip complex. Small prop. |
| [Roman Stone Sawmill (Hierapolis sawmill)](https://sketchfab.com/3d-models/roman-stone-sawmill-hierapolis-sawmill-99be58e35e3f4da9892e8231f780a301) (uid 99be58e35e3f4da9892e8231f780a301) | ingmarbrauns | none (all rights reserved) | no | 31,312 / 10,409 | 2023-03-19 | Reconstruction of the sawmill mechanism shown on the Ammianos relief. **Not downloadable**: ask the author for permission, or embed the Sketchfab viewer. |
| [hierapolis_acaba](https://sketchfab.com/3d-models/hierapolis-acaba-81487914812f4d878a6ada9ffe3d6200) | ulas | none | no | 135,921 / 77,579 | 2024-09-09 | No description. View only. |
| [pamukkale](https://sketchfab.com/3d-models/pamukkale-dfc67aeecc0043e7ab01e2d8f8e7179c) | bora.ercan | none | no | 1,522,200 / 1,529,973 | 2022-12-08 | View only. |
| [Hierapolis Sketchfab](https://sketchfab.com/3d-models/hierapolis-sketchfab-d05119b0f1954440a57cdd4229d40967) | enginehouse | none | no | 1,017 / 719 | 2022-11-18 | Trivial low-poly item. View only. |
| [Laodicea](https://sketchfab.com/3d-models/laodicea-46820e4ebaa94bbc91af0e8373d0064b) | slowpok3 | CC Attribution | yes | 132,793 / 66,757 | 2025-07-23 | Neighbouring city (Laodicea on the Lycus). Could serve as optional context. |
| [Roman Silver Denarius of Septimius Severus](https://sketchfab.com/3d-models/roman-silver-denarius-of-septimius-severus-8ea364975d664de9898e5564c7bdcb10) | Frank McMains | CC Attribution | yes | 300,000 / 150,004 | 2023-10-31 | Generic Severan coin. Could serve as a prop for the Severan theatre story. Not from Hierapolis. |

The search found nothing for the Ploutonion, the Martyrium, the Frontinus Gate or the museum sculptures (searches: hierapolis, pamukkale, ploutonion, "pluto gate hierapolis", "hierapolis sarcophagus", "denizli museum"). The "PAÜ" hits are drone models of the Pamukkale University campus in Denizli and are not relevant.

### Other 3D or reconstruction sources to check by hand (not downloaded)
- **The Italian mission (MAIER) and CNR digital reconstructions:** the Atlante di Hierapolis (2008) and the Nuovo Atlante (2015, Hierapolis di Frigia VII, Ege Yayınları) contain the authoritative archaeological maps (GIS), and the mission has produced 3D reconstructions of the theatre, the Ploutonion and the St Philip sanctuary. These come as **printed books or paywalled material, so they need manual download or purchase**. The mission's site `hierapolis.unisalento.it` refused connections on 2026-11-15.
- **On-site reconstruction panels** (example: `images/plan_5.jpg`, a photo of a panel). The underlying artwork is copyrighted, so ask the museum or MAIER for permission.
- **Google Earth photogrammetric 3D mesh:** useful as a visual reference only. You cannot download or redistribute it.

## Elevation (DEM) and imagery, freely downloadable

| Source | Resolution | Access | Licence | Status |
|---|---|---|---|---|
| **Copernicus DEM GLO-30**, tile N37 E029 | 30 m (DSM) | AWS Open Data, plain HTTPS, no login: `https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N37_00_E029_00_DEM/Copernicus_DSM_COG_10_N37_00_E029_00_DEM.tif` | Free including commercial use; attribution required (see `manifest.csv`) | **Downloaded** to `dem/` (40 MB, Float32 COG, EPSG:4326, covers 37-38 N, 29-30 E) |
| **AWS Terrain Tiles** (Mapzen/Tilezen, terrarium PNG) | z15 ≈ 4.8 m/px resampled (the actual source resolution here is about 30 m SRTM-class) | `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`, no login | Open, mixed sources; attribution per the tilezen/joerd attribution.md | **Downloaded**: 24 tiles, x 19033-19036, y 12645-12650, in `dem/terrarium_z15/`. Decode with elevation = R*256 + G + B/256 - 32768. Ready to use as a three.js heightmap. |
| Copernicus DEM GLO-90 | 90 m | same bucket (`copernicus-dem-90m`) | same | not needed |
| SRTM GL1 (NASA) | 30 m | NASA Earthdata (**login**) or OpenTopography (**free API key**) | public domain | needs manual download |
| ALOS AW3D30 (JAXA) | 30 m | JAXA EORC (**registration**) | free with attribution | needs manual download |
| Sentinel-2 L2A COGs | 10 m | Element84 Earth Search STAC (`https://earth-search.aws.element84.com/v1`), no login; or Copernicus Data Space (**login**) | Copernicus free licence | not downloaded. Pick a cloud-free summer scene for tile 35SNC/35SPC (Denizli area). Verify the tile ID. |
| EOX Sentinel-2 cloudless mosaic | 10 m | WMTS at `tiles.maps.eox.at` | 2016 edition CC BY 4.0; later editions CC BY-NC-SA 4.0 | streaming tiles. Fine for a non-commercial presentation with attribution. |
| Esri World Imagery / Google / Bing | sub-metre | tile services | Terms forbid bulk download and redistribution | reference only |
| Turkish national orthophotos / DEM (Harita Genel Müdürlüğü) | 30 cm - 5 m | paid or official request | restricted | needs manual request |

There is no openly published high-resolution LiDAR or drone DSM of Hierapolis. The Italian mission's photogrammetric and GIS data comes in its publications, so you would need to request it.

## Suggested approach for the 3D scene
1. Build the terrain from the **terrarium z15 tiles**, or clip the Copernicus GLO-30 tile, to the bbox in `geo/README_bbox.json`.
2. Drape the OSM vectors on top: `geo/archaeology.geojson`, `city_walls.geojson`, `ancient_streets.geojson`, `travertines_natural.geojson` and `footpaths.geojson`.
3. Use the CC BY **Arqueomodel3D theatre** (decimated) as the hero asset. Treat the other monuments as simple extrusions of their OSM footprints, using the dimensions in `landmarks.json`.
