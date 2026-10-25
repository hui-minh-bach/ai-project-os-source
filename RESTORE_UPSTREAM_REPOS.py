"""Restore complete upstream file payloads in a new folder; never install or execute them."""
from pathlib import Path
import sys,json,zipfile,hashlib,copy
root=Path(__file__).resolve().parent
if len(sys.argv)!=2:raise SystemExit('Usage: python RESTORE_UPSTREAM_REPOS.py AI_Project_OS_v0.9.70_UPSTREAM_ASSETS.zip')
assetfile=Path(sys.argv[1]);manifest=json.loads((root/'RESTORE_UPSTREAM_MANIFEST.json').read_text());output=root/'restored-upstream-repos';output.mkdir(exist_ok=True)
with zipfile.ZipFile(assetfile) as supplement:
 for id,item in manifest['repositories'].items():
  dest=output/(id+'.zip')
  if dest.exists():raise SystemExit('Output exists; preserve it: '+str(dest))
  source=(root/item['archivePath']).resolve();source.relative_to(root)
  with zipfile.ZipFile(source) as code,zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED) as full:
   for name in item['orderedFiles']:
    if name in item['omitted']:
     data=supplement.read(id+'/'+name)
     if hashlib.sha256(data).hexdigest()!=item['omitted'][name]['sha256']:raise SystemExit('Asset integrity mismatch: '+id+'/'+name)
     info=copy.copy(supplement.getinfo(id+'/'+name));info.filename=name
    else:data=code.read(name);info=code.getinfo(name)
    full.writestr(info,data)
  with zipfile.ZipFile(dest) as z:
   if z.testzip() is not None:raise SystemExit('Archive integrity mismatch: '+id)
  print(id+': restored '+str(len(item['orderedFiles']))+' upstream files')
