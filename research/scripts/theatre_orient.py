"""Estimate which way a theatre polygon's cavea opens: find longest edge (stage line), direction from centroid to edge midpoint = view direction of audience."""
import json,sys,math
fs={f['id']:f for f in json.load(open(sys.argv[1]))['features']}
f=fs[sys.argv[2]]; cs=f['geometry']['coordinates'][0]
lat0=sum(c[1] for c in cs)/len(cs); lon0=sum(c[0] for c in cs)/len(cs); R=6371008.8
xy=[((c[0]-lon0)*math.radians(1)*R*math.cos(math.radians(lat0)),(c[1]-lat0)*math.radians(1)*R) for c in cs]
segs=sorted(((math.dist(xy[i],xy[i+1]),i) for i in range(len(xy)-1)),reverse=True)[:3]
for L,i in segs:
    mx=(xy[i][0]+xy[i+1][0])/2; my=(xy[i][1]+xy[i+1][1])/2
    b=math.degrees(math.atan2(mx,my))%360
    print(f'edge {i} len {L:.1f} m, bearing centroid->edge midpoint {b:.0f} deg, edge mid offset {math.hypot(mx,my):.1f} m')
print('nverts',len(cs))
