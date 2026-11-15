"""Paint modern features (houses, hotels, roads, parking, pools, residential areas) out of the satellite texture
for the 'Ancient' view. Mask from research/geo/all_features.geojson (OSM, ODbL); fill = multi-scale pyramid inpaint
plus a little texture noise. Output public/terrain/sat_ancient.jpg (+ _2k). Run: python3 -I scripts/bake_ancient_texture.py"""
import json, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
meta = json.load(open(os.path.join(ROOT, 'public/terrain/meta.json')))
B = meta['bbox']; N = 4096
pxm = N / meta['widthM']  # pixels per metre
sat = Image.open(os.path.join(ROOT, 'public/terrain/sat.jpg')).convert('RGB')
feats = json.load(open(os.path.join(ROOT, 'research/geo/all_features.geojson')))['features']
trav = [f for f in feats if f['properties'].get('name') == 'Pamukkale Travertenleri']

def P(lon, lat): return ((lon - B['w']) / (B['e'] - B['w']) * N, (B['n'] - lat) / (B['n'] - B['s']) * N)
def rings(g):
    if g['type'] == 'Polygon': return [g['coordinates'][0]]
    if g['type'] == 'MultiPolygon': return [p[0] for p in g['coordinates']]
    return []
def inside_trav(lon, lat):
    from matplotlib.path import Path  # noqa
    return False

mask = Image.new('L', (N, N), 0); d = ImageDraw.Draw(mask)
ROAD_W = {'primary': 14, 'secondary': 12, 'tertiary': 9, 'unclassified': 7, 'residential': 7, 'service': 5, 'pedestrian': 6, 'living_street': 6}
# travertine polygon (keep its natural pools)
tpoly = None
if trav:
    tpoly = Image.new('L', (N, N), 0); ImageDraw.Draw(tpoly).polygon([P(*c) for c in rings(trav[0]['geometry'])[0]], fill=255)
    tpoly = np.asarray(tpoly) > 0
n = 0
for f in feats:
    p, g = f['properties'], f['geometry']
    name = (p.get('name') or '')
    if p.get('historic') or p.get('ruins') or p.get('building') == 'ruins' or 'Antik' in name or 'Antique' in name: continue
    poly = False; width = 0
    if p.get('building'): poly = True
    elif p.get('landuse') in ('residential', 'commercial', 'retail', 'industrial', 'construction'): poly = True
    elif p.get('amenity') == 'parking': poly = True
    elif p.get('leisure') in ('swimming_pool', 'park', 'pitch', 'sports_centre', 'water_park'): poly = True
    elif p.get('tourism') in ('hotel', 'motel', 'guest_house', 'camp_site'): poly = True
    elif p.get('natural') == 'water': poly = True
    elif p.get('highway') in ROAD_W: width = ROAD_W[p['highway']]
    else: continue
    if poly:
        for r in rings(g):
            pts = [P(*c) for c in r]
            if len(pts) < 3: continue
            if tpoly is not None and p.get('natural') == 'water':
                cx, cy = np.mean([q[0] for q in pts]), np.mean([q[1] for q in pts])
                if 0 <= int(cy) < N and 0 <= int(cx) < N and tpoly[int(cy), int(cx)]: continue  # travertine basin: keep
            d.polygon(pts, fill=255); n += 1
    elif width and g['type'] == 'LineString':
        d.line([P(*c) for c in g['coordinates']], fill=255, width=max(3, int(width * pxm)), joint='curve'); n += 1
mask = mask.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(2))
M = np.asarray(mask).astype(np.float32) / 255.0
img = np.asarray(sat).astype(np.float32) / 255.0

# pyramid inpaint: average known pixels at coarser scales, fill holes coarse-to-fine
def down(a, w):
    h2, w2 = a.shape[0] // 2, a.shape[1] // 2
    a = a[:h2 * 2, :w2 * 2]; w = w[:h2 * 2, :w2 * 2]
    aw = (a * w[..., None]).reshape(h2, 2, w2, 2, 3).sum((1, 3)); ws = w.reshape(h2, 2, w2, 2).sum((1, 3))
    return aw / np.maximum(ws, 1e-6)[..., None], np.minimum(ws, 1)
levels = []; a, w = img, 1 - M
while a.shape[0] > 8:
    levels.append((a, w)); a, w = down(a, w)
fill = a
for a, w in reversed(levels):
    up = np.asarray(Image.fromarray((np.clip(fill, 0, 1) * 255).astype(np.uint8)).resize((a.shape[1], a.shape[0]), Image.BILINEAR)).astype(np.float32) / 255
    fill = a * w[..., None] + up * (1 - w[..., None])
# add fine texture (grain borrowed from a high-pass of the original, shifted) so fills are not flat
hp = img - np.asarray(sat.filter(ImageFilter.GaussianBlur(3))).astype(np.float32) / 255
# organic multi-octave noise grain + nudge fill toward dry scrub / grass tones
rng = np.random.default_rng(7)
grain = np.zeros((N, N), np.float32)
for cell, amp in ((3, 0.035), (12, 0.04), (48, 0.05), (192, 0.04)):
    small = rng.standard_normal((N // cell + 1, N // cell + 1)).astype(np.float32)
    grain += np.asarray(Image.fromarray(small).resize((N, N), Image.BICUBIC))[:N, :N] * amp
scrub = np.array([0.52, 0.49, 0.38], np.float32)
fill = fill * 0.65 + scrub * 0.35
grain = grain[..., None] * np.array([1.0, 0.95, 0.8], np.float32)
out = img * (1 - M[..., None]) + np.clip(fill + grain, 0, 1) * M[..., None]
res = Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8))
res.save(os.path.join(ROOT, 'public/terrain/sat_ancient.jpg'), quality=82)
res.resize((2048, 2048), Image.LANCZOS).save(os.path.join(ROOT, 'public/terrain/sat_ancient_2k.jpg'), quality=82)
Image.fromarray((M * 255).astype(np.uint8)).resize((1024, 1024)).save(os.path.join(ROOT, 'scripts/.ancient_mask_preview.png'))
print('masked features', n, 'coverage %.1f%%' % (M.mean() * 100))
