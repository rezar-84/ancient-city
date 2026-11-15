"""Convert Overpass JSON (out body; >; out skel) to GeoJSON layers. Usage: python3 -I osm_to_geojson.py in.json outdir"""
import json,sys,os
d=json.load(open(sys.argv[1])); out=sys.argv[2]
nodes={}; ways={}; rels=[]
for e in d['elements']:
    tgt=nodes if e['type']=='node' else ways if e['type']=='way' else None
    if tgt is None:
        if not any(r['id']==e['id'] for r in rels): rels.append(e)
        continue
    if e['id'] in tgt and 'tags' in tgt[e['id']] and 'tags' not in e: continue  # skel duplicate
    tgt[e['id']]=e
AREA_KEYS={'building','landuse','leisure','natural','amenity','tourism','historic','area','archaeological_site','water','place'}
def coords(w): return [[nodes[n]['lon'],nodes[n]['lat']] for n in w['nodes'] if n in nodes]
def is_area(t,c):
    if len(c)<4 or c[0]!=c[-1]: return False
    if t.get('area')=='no': return False
    if 'highway' in t and t.get('area')!='yes': return False
    if t.get('historic') in ('citywalls','street') or t.get('barrier') in ('wall','fence','city_wall'): return False
    return any(k in t for k in AREA_KEYS)
def join_rings(segs):
    rings=[]; segs=[list(s) for s in segs if s]
    while segs:
        r=segs.pop(0)
        changed=True
        while r[0]!=r[-1] and changed:
            changed=False
            for i,s in enumerate(segs):
                if s[0]==r[-1]: r+=s[1:]
                elif s[-1]==r[-1]: r+=s[::-1][1:]
                elif s[-1]==r[0]: r=s+r[1:]
                elif s[0]==r[0]: r=s[::-1]+r[1:]
                else: continue
                segs.pop(i); changed=True; break
        rings.append(r)
    return rings
feats=[]
used_in_rel=set()
for r in rels:
    t=r.get('tags',{})
    if t.get('type') not in ('multipolygon','boundary'):
        continue
    outer=[coords(ways[m['ref']]) for m in r['members'] if m['type']=='way' and m['ref'] in ways and m.get('role')!='inner']
    inner=[coords(ways[m['ref']]) for m in r['members'] if m['type']=='way' and m['ref'] in ways and m.get('role')=='inner']
    if not outer: continue
    polys=[[o]+[] for o in join_rings(outer) if len(o)>=4]
    ir=join_rings(inner)
    if polys and ir: polys[0]+=ir
    feats.append({'type':'Feature','id':'relation/%d'%r['id'],'properties':dict(t,osm_id='relation/%d'%r['id']),'geometry':{'type':'MultiPolygon','coordinates':polys}})
for w in ways.values():
    t=w.get('tags')
    if not t: continue
    c=coords(w)
    if len(c)<2: continue
    g={'type':'Polygon','coordinates':[c]} if is_area(t,c) else {'type':'LineString','coordinates':c}
    feats.append({'type':'Feature','id':'way/%d'%w['id'],'properties':dict(t,osm_id='way/%d'%w['id']),'geometry':g})
for n in nodes.values():
    t=n.get('tags')
    if not t: continue
    feats.append({'type':'Feature','id':'node/%d'%n['id'],'properties':dict(t,osm_id='node/%d'%n['id']),'geometry':{'type':'Point','coordinates':[n['lon'],n['lat']]}})
def P(f): return f['properties']
layers={
 'archaeology':lambda p:any(k in p for k in ('historic','archaeological_site','ruins')) and p.get('historic') not in ('citywalls',),
 'city_walls':lambda p:p.get('historic')=='citywalls' or p.get('barrier')=='city_wall' or p.get('historic')=='city_gate' or (p.get('historic')=='tower'),
 'ancient_streets':lambda p:p.get('historic')=='street' or (p.get('name','')+p.get('name:en','')).lower().find('colonnaded')>=0 or 'frontinus street' in p.get('name','').lower(),
 'footpaths':lambda p:p.get('highway') in ('footway','path','pedestrian','steps','track','cycleway','bridleway'),
 'modern_roads':lambda p:'highway' in p and p.get('highway') not in ('footway','path','pedestrian','steps','track','cycleway','bridleway'),
 'travertines_natural':lambda p:'natural' in p or 'Travert' in json.dumps(p,ensure_ascii=False) or p.get('leisure')=='park',
 'necropolis':lambda p:'necropol' in json.dumps(p,ensure_ascii=False).lower() or p.get('historic')=='tomb' or p.get('archaeological_site') in ('necropolis','tumulus'),
 'water_pools':lambda p:p.get('leisure')=='swimming_pool' or p.get('natural') in ('water','spring') or 'waterway' in p or p.get('water') is not None,
 'buildings_modern':lambda p:'building' in p and not any(k in p for k in ('historic','archaeological_site','ruins')),
 'tourism_poi':lambda p:'tourism' in p or 'amenity' in p,
}
os.makedirs(out,exist_ok=True)
meta={'source':'OpenStreetMap via Overpass API (overpass-api.de)','license':'ODbL 1.0, (c) OpenStreetMap contributors','timestamp_osm_base':d.get('osm3s',{}).get('timestamp_osm_base'),'bbox_s_w_n_e':[37.905,29.105,37.945,29.145],'counts':{}}
for name,fn in layers.items():
    fs=[f for f in feats if fn(P(f))]
    json.dump({'type':'FeatureCollection','features':fs},open(os.path.join(out,name+'.geojson'),'w'),ensure_ascii=False)
    meta['counts'][name]=len(fs)
json.dump({'type':'FeatureCollection','features':feats},open(os.path.join(out,'all_features.geojson'),'w'),ensure_ascii=False)
meta['counts']['all_features']=len(feats)
json.dump(meta,open(os.path.join(out,'README_bbox.json'),'w'),indent=1)
print(json.dumps(meta,indent=1))
