"""Download selected Commons images (thumb 1600px) and write manifest rows. python3 -I download_images.py selection.tsv pooldir outdir manifest.csv"""
import json,sys,glob,os,csv,re,subprocess,time,html
sel,pool,outdir,man=sys.argv[1:5]
P={}
for fn in glob.glob(os.path.join(pool,'*.json')):
    for x in json.load(open(fn)): P.setdefault(x['title'],x)
def clean(s): return re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>','',s or ''))).strip()
rows=[]; os.makedirs(outdir,exist_ok=True)
for line in open(sel):
    if not line.strip(): continue
    out,lm,pat=line.rstrip('\n').split('\t')
    m=sorted([t for t in P if pat in t])
    if not m: print('NOMATCH',out,pat); continue
    x=P[m[0]]
    src=x['thumburl'] if x.get('thumburl') and x['w']>1600 else x['url']
    if x['mime']=='image/svg+xml': src=x['thumburl']  # rasterised PNG thumb
    ext='.png' if src.lower().endswith('.png') else '.jpg'
    dest=os.path.join(outdir,out+ext)
    if not os.path.exists(dest):
        for i in range(5):
            r=subprocess.run(['curl','-sfL','--max-time','120','-A','HierapolisResearch/1.0 (university presentation research)','-o',dest,src])
            if r.returncode==0: break
            time.sleep(10*(i+1))
        else: print('FAIL',out); continue
        time.sleep(1.5)
    notes=clean(x['desc'])[:250]
    if x['mime']=='image/svg+xml': notes='Rasterised PNG of SVG diagram. '+notes
    rows.append(dict(file='images/'+os.path.basename(dest),landmark_or_type=lm,title=x['title'][5:],author=clean(x['artist'])[:200],source_url=x['page'],license=x['license'],notes=(f"orig {x['w']}x{x['h']}; date {clean(x['date'])[:40]}; "+notes)))
    print('ok',out,x['title'][5:70])
new=not os.path.exists(man)
with open(man,'a',newline='') as f:
    w=csv.DictWriter(f,fieldnames=['file','landmark_or_type','title','author','source_url','license','notes'])
    if new: w.writeheader()
    w.writerows(rows)
