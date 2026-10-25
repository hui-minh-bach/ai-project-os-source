"""Offline, in-memory ESM loader for rendering the unmodified local scene.
No network requests. Only import URLs and the local GLB asset URL are relocated.
"""
from pathlib import Path
import re,base64
ROOT=Path(__file__).resolve().parents[2]
PUB=ROOT/'public'
PATTERN=re.compile(r"(\bfrom\s*|\bimport\s*)(['\"])([^'\"]+)\2")

def load_modules(entry='space-studio/viewer.mjs'):
    modules={}
    def visit(rel):
        rel=Path(rel).as_posix()
        if rel in modules:return
        path=(PUB/rel).resolve()
        if not path.is_relative_to(PUB.resolve()):raise ValueError('Path escapes public root')
        modules[rel]=''
        text=path.read_text(encoding='utf-8')
        def replace(m):
            spec=m[3]
            if spec.startswith('/'):
                resolved=spec[1:]
            elif spec.startswith('.'):
                resolved=(path.parent/spec).resolve().relative_to(PUB.resolve()).as_posix()
            else:return m[0]
            if not (PUB/resolved).is_file():return m[0]
            visit(resolved)
            return m[1]+m[2]+'app/'+resolved+m[2]
        text=PATTERN.sub(replace,text)
        modules[rel]=text
    visit(entry)
    return modules

def mount(page,*,clean=True,capture=True,manual=True,quality='high',geometry_only=False):
    css=(PUB/'space-studio/viewer.css').read_text()
    page.set_content('<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{height:100%;margin:0}'+css+'</style></head><body><main id="offlineRoot" style="width:100%;height:100%"></main><div id="spaceStatus" role="status">Đang tải phòng 3D…</div></body></html>')
    page.evaluate((PUB/'space-studio/standalone-status.js').read_text(encoding='utf-8'))
    modules=load_modules()
    page.evaluate('''async ({modules, options, model})=>{
      if(model){const bytes=Uint8Array.from(atob(model),c=>c.charCodeAt(0));options.modelBuffer=bytes.buffer;}
      const imports={},urls=[];
      for(const [name,code] of Object.entries(modules)){
        const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));imports['app/'+name]=url;urls.push(url);
      }
      const script=document.createElement('script');script.type='importmap';script.textContent=JSON.stringify({imports});document.head.appendChild(script);
      window.__offlineModuleURLs=urls;
      try{
        if(options.geometryOnly){const mod=await import('app/space-studio/scene.mjs');window.__spaceStudio=await mod.createSpaceStudio(document.getElementById('offlineRoot'),options);}
        else{const mod=await import('app/space-studio/viewer.mjs');window.__spaceStudio=await mod.mountSpaceViewer(document.getElementById('offlineRoot'),options);}
        window.__spaceReady=true;
      }catch(e){window.__spaceError=String(e?.message||e);throw e;}
    }''',{'modules':modules,'model':base64.b64encode((PUB/'assets/tam19.glb').read_bytes()).decode() if geometry_only else None,'options':{'clean':clean,'capture':capture,'manual':manual,'quality':quality,'geometryOnly':geometry_only}})
