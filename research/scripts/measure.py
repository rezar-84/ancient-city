"""Measure OSM features: centroid, min-area oriented rectangle (m), long-axis bearing, line length. python3 -I measure.py all_features.geojson id1 id2 ..."""
import json,sys,math
fs={f['id']:f for f in json.load(open(sys.argv[1]))['features']}
R=6371008.8
for fid in sys.argv[2:]:
    f=fs.get(fid)
    if not f: print(fid,'missing'); continue
    g=f['geometry']; t=g['type']
    if t=='Point': print(fid,'point',g['coordinates'][::-1]); continue
    cs=g['coordinates'] if t=='LineString' else (g['coordinates'][0] if t=='Polygon' else [p for poly in g['coordinates'] for p in poly[0]])
    lat0=sum(c[1] for c in cs)/len(cs); lon0=sum(c[0] for c in cs)/len(cs)
    xy=[((c[0]-lon0)*math.radians(1)*R*math.cos(math.radians(lat0)),(c[1]-lat0)*math.radians(1)*R) for c in cs]
    L=sum(math.dist(xy[i],xy[i+1]) for i in range(len(xy)-1))
    best=None
    for deg in range(0,180):
        a=math.radians(deg); u=[x*math.cos(a)+y*math.sin(a) for x,y in xy]; v=[-x*math.sin(a)+y*math.cos(a) for x,y in xy]
        w=max(u)-min(u); h=max(v)-min(v)
        if best is None or w*h<best[0]: best=(w*h,deg,w,h)
    _,deg,w,h=best
    # bearing of long axis, measured from north clockwise
    axis_deg = deg if w>=h else deg+90
    bearing=(90-axis_deg)%180
    nm=f['properties'].get('name:en') or f['properties'].get('name','')
    print(f"{fid}\t{nm}\t{t}\tcentroid {lat0:.6f},{lon0:.6f}\tlen/perim {L:.0f} m\trect {max(w,h):.0f} x {min(w,h):.0f} m\tlong-axis bearing {bearing:.0f}deg")
