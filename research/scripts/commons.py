"""Commons helper. python3 -I commons.py tree CAT DEPTH | files CAT [limit] | info FILE..."""
import json,sys,time,urllib.parse,subprocess
UA="HierapolisResearch/1.0 (university presentation research)"
API="https://commons.wikimedia.org/w/api.php"
def get(params):
    params=dict(params,format='json',formatversion=2)
    url=API+'?'+urllib.parse.urlencode(params)
    time.sleep(1.0)
    for i in range(8):
        try:
            out=subprocess.run(['curl','-sf','--max-time','60','-A',UA,url],capture_output=True,check=True).stdout
            return json.loads(out)
        except Exception as e:
            sys.stderr.write(f"retry {i} {e}\n"); time.sleep(5*(i+1))
    raise SystemExit('fail '+url)
def members(cat,typ):
    out=[];cont={}
    while True:
        r=get(dict(action='query',list='categorymembers',cmtitle=cat,cmtype=typ,cmlimit=500,**cont))
        out+=[m['title'] for m in r['query']['categorymembers']]
        if 'continue' in r: cont={'cmcontinue':r['continue']['cmcontinue']}
        else: return out
def tree(cat,d,ind=''):
    n=len(members(cat,'file')); print(f'{ind}{cat} [{n}]'); time.sleep(0.2)
    if d>0:
        for s in members(cat,'subcat'): tree(s,d-1,ind+'  ')
def info(titles,width=1600):
    res=[]
    for i in range(0,len(titles),40):
        r=get(dict(action='query',prop='imageinfo',titles='|'.join(titles[i:i+40]),iiprop='url|size|extmetadata|mime',iiurlwidth=width))
        for p in r['query']['pages']:
            if 'imageinfo' not in p: continue
            ii=p['imageinfo'][0]; m=ii.get('extmetadata',{})
            g=lambda k:(m.get(k,{}) or {}).get('value','')
            res.append(dict(title=p['title'],w=ii['width'],h=ii['height'],mime=ii['mime'],url=ii['url'],thumburl=ii.get('thumburl'),page=ii['descriptionurl'],
              license=g('LicenseShortName'),artist=g('Artist'),credit=g('Credit'),desc=g('ImageDescription')[:300],date=g('DateTimeOriginal')))
    return res
cmd=sys.argv[1]
if cmd=='tree': tree(sys.argv[2],int(sys.argv[3]))
elif cmd=='files':
    fs=members(sys.argv[2],'file'); print(json.dumps(info(fs),ensure_ascii=False))
elif cmd=='info': print(json.dumps(info(sys.argv[2:]),ensure_ascii=False))
def catinfo(cat,width=1600,limit=200):
    res=[];cont={}
    while len(res)<limit:
        r=get(dict(action='query',generator='categorymembers',gcmtitle=cat,gcmtype='file',gcmlimit=50,prop='imageinfo',iiprop='url|size|extmetadata|mime',iiurlwidth=width,iiextmetadatafilter='LicenseShortName|Artist|Credit|ImageDescription|DateTimeOriginal|LicenseUrl',**cont))
        for p in r.get('query',{}).get('pages',[]):
            if 'imageinfo' not in p: continue
            ii=p['imageinfo'][0]; m=ii.get('extmetadata',{})
            g=lambda k:(m.get(k,{}) or {}).get('value','')
            res.append(dict(title=p['title'],w=ii['width'],h=ii['height'],mime=ii['mime'],url=ii['url'],thumburl=ii.get('thumburl'),page=ii['descriptionurl'],
              license=g('LicenseShortName'),licenseurl=g('LicenseUrl'),artist=g('Artist'),credit=g('Credit'),desc=g('ImageDescription')[:300],date=g('DateTimeOriginal'),category=cat))
        if 'continue' in r: cont={k:v for k,v in r['continue'].items()}; time.sleep(2)
        else: break
    return res
if cmd=='cats':
    import os
    os.makedirs(sys.argv[2],exist_ok=True)
    for c in sys.argv[3:]:
        fn=os.path.join(sys.argv[2],c.replace('Category:','').replace(' ','_').replace('/','_')+'.json')
        if os.path.exists(fn): continue
        r=catinfo(c); json.dump(r,open(fn,'w'),ensure_ascii=False,indent=0); print(c,len(r),flush=True); time.sleep(2)
if cmd=='search':
    import os
    os.makedirs(sys.argv[2],exist_ok=True)
    for q in sys.argv[3:]:
        fn=os.path.join(sys.argv[2],'search_'+''.join(ch if ch.isalnum() else '_' for ch in q)[:60]+'.json')
        if os.path.exists(fn): continue
        r=get(dict(action='query',generator='search',gsrsearch=q,gsrnamespace=6,gsrlimit=50,prop='imageinfo',iiprop='url|size|extmetadata|mime',iiurlwidth=1600,iiextmetadatafilter='LicenseShortName|Artist|Credit|ImageDescription|DateTimeOriginal|LicenseUrl'))
        res=[]
        for p in r.get('query',{}).get('pages',[]):
            if 'imageinfo' not in p: continue
            ii=p['imageinfo'][0]; m=ii.get('extmetadata',{})
            g=lambda k:(m.get(k,{}) or {}).get('value','')
            res.append(dict(title=p['title'],w=ii['width'],h=ii['height'],mime=ii['mime'],url=ii['url'],thumburl=ii.get('thumburl'),page=ii['descriptionurl'],license=g('LicenseShortName'),licenseurl=g('LicenseUrl'),artist=g('Artist'),credit=g('Credit'),desc=g('ImageDescription')[:300],date=g('DateTimeOriginal'),category='search:'+q))
        json.dump(res,open(fn,'w'),ensure_ascii=False,indent=0); print(q,len(res),flush=True); time.sleep(2)
