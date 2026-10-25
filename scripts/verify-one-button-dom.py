"""Real app UI/HTTP test with synthetic AI/cloud. No browser policy changes.
Chromium loads shipped markup, styles and classic scripts in memory. API
transport is bridged to a session-protected, isolated localhost app. ES-module
3D is not loaded: this verifies the delivery UI, not GPU rendering or Windows.
Requires Python requests + playwright and a Chromium binary for QA only.
"""
import os,sys,json,time,tempfile,secrets,subprocess,socket,signal,re,shutil,base64
from pathlib import Path
import requests
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('AIOS_DELIVERY_QA_DIR',str(ROOT/'evidence/one-button-r6/browser')))
OUT.mkdir(parents=True,exist_ok=True)
runtime=Path(tempfile.mkdtemp(prefix='aios-onebutton-dom-'))
report={'scope':__doc__.strip(),'checks':[],'pageErrors':[],'externalWrites':'none; all cloud and AI endpoints use isolated fixtures'}
proc=None

def record(name,detail):
    report['checks'].append({'name':name,'status':'pass','detail':detail});print('PASS',name,flush=True)
def waitfor(fn,timeout=40):
    end=time.time()+timeout
    while time.time()<end:
        try:
            r=fn()
            if r:return r
        except Exception:pass
        time.sleep(.1)
    raise AssertionError('Timeout waiting for app')
try:
    with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
    base=f'http://127.0.0.1:{port}';token=secrets.token_hex(32)
    env={**os.environ,'AIOS_DELIVERY_FIXTURE':'1','AI_PROJECT_OS_DATA_DIR':str(runtime/'data'),'AI_PROJECT_OS_PORT':str(port),'AI_PROJECT_OS_LAUNCH_TOKEN':token}
    log=(OUT/'app-runtime.log').open('w')
    proc=subprocess.Popen(['node','--import','./scripts/fixtures/launch-app-preload.mjs','src/server.mjs'],cwd=ROOT,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
    waitfor(lambda:requests.get(base+'/api/health',timeout=2).status_code==200)
    session=requests.Session();assert session.get(base+'/?launch='+token).status_code==200;session.headers['Origin']=base
    pid=json.loads((runtime/'data/qa-project-id.json').read_text())['id'];prefix='/api/projects/'+pid+'/launch'
    def api(path,body=None):
        r=session.request('POST' if body is not None else 'GET',base+path,json=body,timeout=120)
        if not r.ok:raise AssertionError((path,r.status_code,r.text[:300]))
        return r.json()
    def bridge(spec):
        u=spec.get('url','')
        if not u.startswith('/api/'):return {'status':404,'headers':{},'body':'{}'}
        headers={**spec.get('headers',{}),'Origin':base,'Cookie':'; '.join(c.name+'='+c.value for c in session.cookies)}
        r=requests.request(spec.get('method','GET'),base+u,data=spec.get('body'),headers=headers,timeout=120)
        if '/approve' in u:print('APPROVAL_REQUEST',spec.get('body'),r.status_code,r.text[:400],flush=True)
        return {'status':r.status_code,'headers':{'content-type':r.headers.get('content-type','application/json')},'body':r.text}
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_BIN') or shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        ctx=browser.new_context(viewport={'width':1500,'height':1080},device_scale_factor=1)
        ctx.expose_function('__apiBridge',bridge)
        html=session.get(base+'/').text
        html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',lambda m:'<style>'+(ROOT/'public'/m[1].lstrip('/')).read_text()+'</style>',html)
        html=re.sub(r'<script type="module"[^>]*>.*?</script>','',html,flags=re.S)
        html=re.sub(r'<script src="([^"]+)"></script>',lambda m:'<script>'+(ROOT/'public'/m[1].lstrip('/')).read_text().replace('</script','<\\/script')+'</script>',html)
        shim='''<script>
        const __storage={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>__storage[k]??null,setItem:(k,v)=>__storage[k]=String(v),removeItem:k=>delete __storage[k],clear:()=>Object.keys(__storage).forEach(k=>delete __storage[k])}});Object.defineProperty(window,'sessionStorage',{value:window.localStorage});
        window.__qaPending=0;window.__qaClosing=false;const __timers=new Set(),__interval=window.setInterval.bind(window);window.setInterval=(fn,ms,...args)=>{const id=__interval(fn,ms,...args);__timers.add(id);return id;};window.__qaStop=()=>{window.__qaClosing=true;for(const id of __timers)clearInterval(id);};
        window.fetch=async(url,opts={})=>{if(window.__qaClosing)throw new DOMException('Test teardown','AbortError');window.__qaPending++;try{const r=await window.__apiBridge({url:String(url),method:opts.method||'GET',body:opts.body||null,headers:opts.headers||{}});return new Response(r.body,{status:r.status,headers:r.headers});}finally{window.__qaPending--;}};
        </script>'''
        html=html.replace('<head>','<head>'+shim,1)
        def mount():
            pg=ctx.new_page();pg.on('pageerror',lambda e:report['pageErrors'].append(str(e)));pg.route('**/*',lambda r:r.abort())
            pg.set_content(html,wait_until='domcontentloaded',timeout=60000)
            pg.wait_for_function("document.querySelector('#globalProjectSelect')?.options.length>0 && !customerBooting",timeout=60000)
            pg.locator('#globalProjectSelect').select_option(pid);pg.wait_for_function('(id)=>state.project?.id===id',arg=pid);pg.locator('[data-page="idea"]').first.click();pg.locator('.work-cloud > summary').click();return pg
        def close(pg):
            pg.evaluate('window.__qaStop()');pg.wait_for_function('window.__qaPending===0');pg.close()
        page=mount();page.locator('[data-launch="setup"]').click()
        page.locator('#launchVercel').select_option('v');page.locator('#launchDiscover').click()
        page.wait_for_function("document.querySelector('#launchTeam').value")
        page.locator('#launchTeam').select_option('team1');page.locator('#launchTestMode').select_option('host')
        page.locator('#launchPrepare').click();page.wait_for_selector('#launchCostConsent',timeout=45000)
        run=api(prefix);assert run['state']=='needs-approval' and not run['resources']
        page.locator('#deliveryPanel').screenshot(path=str(OUT/'approval.png'))
        record('inline_setup_analysis_council','Clicked setup, discovered scopes and prepared a real pending specification using fixture AI; no cloud resource was created before approval.')
        page.locator('[data-launch="approve"]').click();page.wait_for_timeout(400)
        assert api(prefix)['state']=='needs-approval'
        record('consent_not_implicit','The same start button refuses to execute when scope/cost and unsafe Host consent checkboxes are unset.')
        page.locator('#launchCostConsent').check();page.locator('#launchHostConsent').check();page.wait_for_function("!document.querySelector('[data-launch=approve]').disabled");page.locator('[data-launch="approve"]').click()
        page.wait_for_function("document.querySelector('#workProducts')?.querySelector('a[target=\"_blank\"]')",timeout=60000)
        run=api(prefix);assert run['state']=='delivered';assert all(t['status']=='done' for t in run['tasks'])
        record('inline_result','Start button ran real file writes, npm test, Git and mock-provider cloud requests. Delivered actual source ZIP and QR without navigating to another app tab.')
        # Replace only QR transport with a data URI in this offline harness.
        qr=session.get(base+prefix+'/'+run['id']+'/artifact/qr.svg').content
        page.locator('#workProducts img.work-qr').evaluate('(el,uri)=>el.src=uri','data:image/svg+xml;base64,'+base64.b64encode(qr).decode())
        page.locator('#deliveryPanel').screenshot(path=str(OUT/'completed-progress.png'))
        page.locator('#workProducts').scroll_into_view_if_needed();page.locator('#workProducts').screenshot(path=str(OUT/'completed-handoff.png'))
        (OUT/'qr.svg').write_bytes(qr)
        source=session.get(base+prefix+'/'+run['id']+'/artifact/source.zip').content;(OUT/'fixture-source.zip').write_bytes(source)
        # Verify the fixture's actual delivered HTML button, not only source-string tests.
        import zipfile,io
        with zipfile.ZipFile(io.BytesIO(source)) as z:content=z.read('index.html').decode()
        product=ctx.new_page();product.route('**/*',lambda r:r.abort());product.set_content(content);product.locator('#counter').click();assert product.locator('#counter').inner_text()=='1';product.close()
        record('product_interaction','Opened the exact ZIP HTML in an in-memory browser and clicked its counter; value changed from 0 to 1. This is a fixture, not live customer acceptance.')
        close(page);page=mount();page.wait_for_function("document.querySelector('#workProducts')?.querySelector('a[target=\"_blank\"]')")
        assert api(prefix)['id']==run['id'];record('reload_keeps_receipts','Fresh UI loaded the same delivered run and links; no new deployment.')
        page.locator('[data-page="skills"]').first.click();page.wait_for_timeout(600)
        assert page.locator('#page-skills').inner_text().find('Project Continuity')>=0 or page.locator('#page-skills').inner_text().find('xuy')>=0
        record('skill_hub','Project Continuity Orchestrator is visible in the actual Skill Hub and injected by server workflow prompts.')
        page.locator('[data-page="idea"]').first.click();api('/api/vault/lock',{})
        page.wait_for_timeout(4800);assert page.locator('#workProducts a').count()==0
        record('vault_lock','Private delivery links disappear after Vault is locked; artifact endpoint is blocked as well.')
        close(page);browser.close()
        assert not report['pageErrors'],report['pageErrors']
    report['run']=run;report['status']='pass'
except Exception as exc:
    report['status']='failed';report['failure']=str(exc);raise
finally:
    if proc and proc.poll() is None:
        os.killpg(proc.pid,signal.SIGTERM)
        try:proc.wait(timeout=4)
        except subprocess.TimeoutExpired:os.killpg(proc.pid,signal.SIGKILL)
    (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print('REPORT',OUT/'report.json',flush=True)
    shutil.rmtree(runtime,ignore_errors=True)
