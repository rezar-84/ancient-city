import json,sys
d=json.load(open(sys.argv[1]))
nodes={e['id']:(e['lat'],e['lon']) for e in d['elements'] if e['type']=='node' and 'lat' in e}
ways={e['id']:e for e in d['elements'] if e['type']=='way'}
keys=('historic','tourism','archaeological_site','ruins','name','amenity','natural','leisure','building','wikidata','wikipedia')
for e in d['elements']:
    t=e.get('tags')
    if not t: continue
    if not any(k in t for k in ('historic','tourism','archaeological_site','ruins','wikidata','wikipedia')) and not ('name' in t and 'highway' not in t): continue
    if e['type']=='node': c=(e['lat'],e['lon'])
    elif e['type']=='way':
        pts=[nodes[n] for n in e.get('nodes',[]) if n in nodes]
        c=(sum(p[0] for p in pts)/len(pts),sum(p[1] for p in pts)/len(pts)) if pts else None
    else: c=None
    print(e['type'][0],e['id'],'%.6f,%.6f'%c if c else '-', {k:v for k,v in t.items() if k in keys or k.startswith('name:')})
