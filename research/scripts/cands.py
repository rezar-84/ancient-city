import json,sys,glob,os
for fn in sys.argv[1:]:
    d=json.load(open(fn)); print('==',os.path.basename(fn),len(d))
    d=[x for x in d if x['mime'] in('image/jpeg','image/png','image/tiff') and x['w']>=1600]
    for x in sorted(d,key=lambda x:-x['w']*x['h'])[:int(os.environ.get("N","15"))]:
        print(f"  {x['w']}x{x['h']} {x['license'][:14]:14} {x['title'][5:90]}")
