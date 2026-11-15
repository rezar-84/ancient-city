"""Bake terrain heightmap (AWS Terrarium) + satellite texture (Esri World Imagery) for the Hierapolis bbox.
Outputs public/terrain/{height.bin (Float32, row-major N->S), meta.json, sat.jpg, sat_2k.jpg}."""
import io, json, math, os, sys, time, urllib.request
import numpy as np
from PIL import Image

OUT = sys.argv[1] if len(sys.argv) > 1 else "public/terrain"
CACHE = os.path.join(os.path.dirname(__file__), ".tilecache")
S, N = 37.9100, 37.9400
W, E = 29.1050, 29.1430
LAT0, LON0 = (S + N) / 2, (W + E) / 2
GRID = 256  # height samples per side

def tile_xy(lat, lon, z):
    n = 2 ** z
    x = (lon + 180) / 360 * n
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    return x, y

def fetch(url, key):
    os.makedirs(CACHE, exist_ok=True)
    p = os.path.join(CACHE, key)
    if not os.path.exists(p):
        req = urllib.request.Request(url, headers={"User-Agent": "heritage-viz-bake/1.0"})
        for i in range(4):
            try:
                data = urllib.request.urlopen(req, timeout=30).read(); break
            except Exception as e:
                print("retry", url, e); time.sleep(1 + i)
        else:
            raise SystemExit("failed " + url)
        open(p, "wb").write(data)
    return Image.open(p).convert("RGB")

def mosaic(z, url_fmt, prefix, tile=256):
    x0, y0 = tile_xy(N, W, z); x1, y1 = tile_xy(S, E, z)
    tx0, ty0, tx1, ty1 = int(x0), int(y0), int(x1), int(y1)
    img = Image.new("RGB", ((tx1 - tx0 + 1) * tile, (ty1 - ty0 + 1) * tile))
    for ty in range(ty0, ty1 + 1):
        for tx in range(tx0, tx1 + 1):
            t = fetch(url_fmt.format(z=z, x=tx, y=ty), f"{prefix}_{z}_{tx}_{ty}.png")
            if t.size != (tile, tile): t = t.resize((tile, tile))
            img.paste(t, ((tx - tx0) * tile, (ty - ty0) * tile))
    box = ((x0 - tx0) * tile, (y0 - ty0) * tile, (x1 - tx0) * tile, (y1 - ty0) * tile)
    return img, box

os.makedirs(OUT, exist_ok=True)
# --- heights
dem, box = mosaic(15, "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png", "dem")
a = np.asarray(dem).astype(np.float64)
h = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
hi = Image.fromarray(h.astype(np.float32), mode="F").crop(tuple(int(round(v)) for v in box)).resize((GRID, GRID), Image.BILINEAR)
H = np.asarray(hi, dtype=np.float32)
H.tofile(os.path.join(OUT, "height.bin"))
# --- satellite
sat, sbox = mosaic(17, "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", "sat")
sat = sat.crop(tuple(int(round(v)) for v in sbox))
sat.resize((4096, 4096), Image.LANCZOS).save(os.path.join(OUT, "sat.jpg"), quality=82)
sat.resize((2048, 2048), Image.LANCZOS).save(os.path.join(OUT, "sat_2k.jpg"), quality=82)
mx = 111320 * math.cos(math.radians(LAT0)); my = 110574
meta = dict(bbox=dict(s=S, n=N, w=W, e=E), lat0=LAT0, lon0=LON0, grid=GRID,
            widthM=(E - W) * mx, depthM=(N - S) * my, minH=float(H.min()), maxH=float(H.max()),
            mPerDegLon=mx, mPerDegLat=my,
            credits="Elevation: Mapzen/AWS Terrain Tiles (SRTM, etc.). Imagery: Esri World Imagery (Esri, Maxar, Earthstar Geographics).")
json.dump(meta, open(os.path.join(OUT, "meta.json"), "w"), indent=2)
print(json.dumps(meta, indent=2))
