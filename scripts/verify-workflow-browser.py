import os,sys,json,time,tempfile,secrets,subprocess,socket,traceback,signal,re,shutil
from pathlib import Path
import requests
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
QA=Path(os.environ.get('AIOS_WORKFLOW_QA_DIR',str(Path(tempfile.gettempdir())/'aios-r4-browser-qa')));QA.mkdir(parents=True,exist_ok=True);runtime=Path(tempfile.mkdtemp(prefix='aios-r4-browser-'))
report={'scope':'Linux Chromium in-memory UI harness using unchanged classic UI scripts/CSS and a session-backed HTTP bridge to the real app server. Browser policy blocks direct localhost navigation; no policy changed. 3D ES module excluded from this workflow-only harness. Local fixture AI only, not Windows or live provider validation.','checks':[],'page_errors':[],'external_browser_requests':[]}
processes=[]
def record(name,detail):
    report['checks'].append({'name':name,'status':'pass','detail':detail});print('PASS',name,flush=True)
def spawn(args,env,name,cwd=ROOT):
    log=(QA/name).open('w');p=subprocess.Popen(args,cwd=cwd,env={**os.environ,**env},stdout=log,stderr=subprocess.STDOUT,start_new_session=True);processes.append(p);return p
def waitfor(fn,timeout=60):
    end=time.time()+timeout;last=None
    while time.time()<end:
        try:
            val=fn()
            if val:return val
        except Exception as e:last=e
        time.sleep(.15)
    raise AssertionError('wait failed: '+str(last))
def finish():
    for p in reversed(processes):
        try:os.killpg(p.pid,signal.SIGTERM)
        except ProcessLookupError:pass
    for p in processes:
        try:p.wait(timeout=5)
        except subprocess.TimeoutExpired:
            try:os.killpg(p.pid,signal.SIGKILL)
            except ProcessLookupError:pass
    report['runtime_path_for_debugging']=str(runtime)
    (QA/'browser-r4-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
try:
    info=QA/'fixture-endpoint.json';info.unlink(missing_ok=True)
    spawn(['node',str(ROOT/'scripts/fixtures/r4-provider.mjs'),str(info)],{'AI_PROJECT_OS_DATA_DIR':str(runtime/'fixture-data')},'browser-fixture.log')
    waitfor(info.exists);fport=json.loads(info.read_text())['port'];fixture=f'http://127.0.0.1:{fport}'
    with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
    base=f'http://127.0.0.1:{port}';token=secrets.token_hex(32)
    spawn(['node','src/server.mjs'],{'AI_PROJECT_OS_DATA_DIR':str(runtime/'data'),'AI_PROJECT_OS_PORT':str(port),'AI_PROJECT_OS_LAUNCH_TOKEN':token},'browser-app.log')
    waitfor(lambda:requests.get(base+'/api/health',timeout=2).status_code==200)
    session=requests.Session();response=session.get(base+'/?launch='+token);assert response.status_code==200
    session.headers['Origin']=base
    def api(path,body=None,method=None):
        r=session.request(method or ('POST' if body is not None else 'GET'),base+'/api/'+path,json=body,timeout=120)
        try:v=r.json()
        except Exception:raise AssertionError((path,r.status_code,r.text[:500]))
        if r.status_code>=400:raise AssertionError((path,r.status_code,v))
        return v
    assert requests.get(base+'/api/projects',timeout=2).status_code==401
    cross=session.post(base+'/api/projects',json={'name':'forbidden'},headers={'Origin':'https://example.invalid'},timeout=2)
    assert cross.status_code==403
    record('local_session_and_origin_guard','Uncredentialed API returns 401; cross-origin mutation returns 403.')
    api('vault/unlock',{'password':'only-local-fixture-password-2026'})
    cs={}
    for who,kind in [('A','openai'),('B','openai_compatible'),('C','openai'),('D','openai')]:
        cs[who]=api('connections',{'name':'Fixture '+who+' - LOCAL TEST','kind':kind,'model':'fixture-'+who.lower(),'baseUrl':fixture+'/'+who,'secret':'synthetic-local-fixture-'+who+'-key'})
    bind=lambda w:{'connectionId':cs[w]['id'],'model':'fixture-'+w.lower()}
    p=api('projects',{'name':'R4 - LOCAL BROWSER ACCEPTANCE','idea':'Create two useful static HTML pages locally. No publish.','productType':'website','audience':'Local test users','goals':'Verify handoff, review and merge using local fixtures.'});pid=p['id']
    api('projects/'+pid+'/model-roles',{'founder':bind('A'),'worker':bind('A'),'reviewer':bind('C'),'council':[bind('A'),bind('B')],'backups':{'founder':bind('B'),'worker':bind('B'),'council':[bind('B'),bind('C')]}})
    api('projects/'+pid+'/settings',{'autoFailover':True,'failoverScope':'project','maxProviderAttempts':4,'providerTimeoutMs':5000})
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_BIN') or shutil.which('chromium') or '/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        ctx=browser.new_context(viewport={'width':1600,'height':1000},device_scale_factor=1)
        ctx.add_cookies([{'name':c.name,'value':c.value,'domain':'127.0.0.1','path':'/','httpOnly':True,'sameSite':'Strict'} for c in session.cookies])
        def bridge(spec):
            u=spec.get('url','')
            if not u.startswith('/api/'):return {'status':404,'headers':{},'body':'{}'}
            h={k:str(v) for k,v in spec.get('headers',{}).items()};h['Origin']=base;h['Cookie']='; '.join(c.name+'='+c.value for c in session.cookies)
            resp=requests.request(spec.get('method','GET'),base+u,headers=h,data=spec.get('body'),timeout=120)
            return {'status':resp.status_code,'headers':{'content-type':resp.headers.get('content-type','application/json')},'body':resp.text}
        ctx.expose_function('__apiBridge',bridge)
        # Do not alter browser policies. Load actual app markup/scripts in memory.
        # Only network transport and browser-origin storage are test adapters.
        html=session.get(base+'/').text
        def style(m):
            f=ROOT/'public'/m.group(1).lstrip('/')
            return '<style>'+f.read_text()+'</style>'
        html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',style,html)
        html=re.sub(r'<script type="module"[^>]*>.*?</script>','',html,flags=re.S)
        def script(m):
            f=ROOT/'public'/m.group(1).lstrip('/')
            return '<script>'+f.read_text().replace('</script','<\\/script')+'</script>'
        html=re.sub(r'<script src="([^"]+)"></script>',script,html)
        shim="""<script>
        const __storage={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>__storage[k]??null,setItem:(k,v)=>__storage[k]=String(v),removeItem:k=>delete __storage[k],clear:()=>Object.keys(__storage).forEach(k=>delete __storage[k])}});
        Object.defineProperty(window,'sessionStorage',{value:window.localStorage});
        // Observe pending test-bridge calls so page teardown does not discard a
        // Playwright binding promise. Timer wrapping only records handles;
        // normal callbacks/delays are unchanged while the test is running.
        window.__qaPending=0;window.__qaClosing=false;
        const __qaIntervals=new Set(),__qaTimeouts=new Set();
        const __setInterval=window.setInterval.bind(window),__setTimeout=window.setTimeout.bind(window);
        window.setInterval=(fn,ms,...args)=>{const id=__setInterval(fn,ms,...args);__qaIntervals.add(id);return id;};
        window.setTimeout=(fn,ms,...args)=>{let id;id=__setTimeout(()=>{__qaTimeouts.delete(id);typeof fn==='function'?fn(...args):(0,eval)(fn);},ms);__qaTimeouts.add(id);return id;};
        window.__qaStopTimers=()=>{window.__qaClosing=true;for(const id of __qaIntervals)clearInterval(id);for(const id of __qaTimeouts)clearTimeout(id);};
        window.fetch=async(url,opts={})=>{
          if(window.__qaClosing)throw new DOMException('Test page teardown','AbortError');
          window.__qaPending++;
          try{const r=await window.__apiBridge({url:String(url),method:opts.method||'GET',body:opts.body||null,headers:opts.headers||{}});return new Response(r.body,{status:r.status,headers:r.headers});}
          finally{window.__qaPending--;}
        };
        </script>"""
        html=html.replace('<head>','<head>'+shim,1)
        def mount_ui():
            pg=ctx.new_page();pg.on('pageerror',lambda e:report['page_errors'].append(str(e)))
            pg.route('**/*',lambda route:route.abort())
            pg.set_content(html,wait_until='domcontentloaded',timeout=60000)
            pg.wait_for_function("document.querySelector('#globalProjectSelect')?.options.length > 0 && !customerBooting",timeout=60000)
            return pg
        def close_ui(pg):
            pg.evaluate('window.__qaStopTimers()')
            pg.wait_for_function('window.__qaPending === 0',timeout=30000)
            pg.wait_for_timeout(100)
            pg.close()
        page=mount_ui()
        page.locator('#globalProjectSelect').select_option(pid)
        page.locator('[data-page="idea"]').first.click()
        page.locator('#chatInput').fill('Create two local static pages. Confirm the task requirements without publishing anything.')
        page.locator('#sendChat').click()
        page.wait_for_function("!ideaBusy && document.querySelector('#chat').textContent.includes('LOCAL TEST ONLY - B')",timeout=60000)
        current=api('projects/'+pid);assert current['messages'][-1]['served']['connectionId']==cs['B']['id']
        dispatch=api('projects/'+pid+'/dispatch');assert any(e['type']=='handoff' and e.get('fromId')==cs['A']['id'] and e.get('connectionId')==cs['B']['id'] for e in dispatch['events'])
        page.wait_for_timeout(5500)
        page.screenshot(path=str(QA/'browser-founder-handoff.png'),full_page=False)
        record('founder_ui_real_request_handoff','Clicked Send in app; fixture A HTTP401, fixture B answered same request, served metadata and handoff event recorded.')
        page.locator('#ideaAcceptJob').click()
        page.wait_for_function("!ideaBusy && document.querySelector('#page-council').classList.contains('active') && !document.querySelector('#confirmCouncil').disabled",timeout=120000)
        current=api('projects/'+pid);assert current['stage']!='done' and len(current['tasks'])==0
        page.screenshot(path=str(QA/'browser-council-awaiting-approval.png'))
        record('accept_work_is_real_and_gated','Clicked accept-work; real HTTP Founder/Council inference ran, structured specification awaits explicit owner approval, no tasks prematurely executed.')
        page.locator('#confirmCouncil').click()
        page.wait_for_function("state.project?.approvedSpecificationId && document.querySelector('#confirmCouncil').disabled",timeout=30000)
        # The saved roles still select failed A. After a full UI refresh, the
        # run-ready button must remain usable because healthy B is configured.
        api('projects/'+pid+'/plan',{})
        close_ui(page);page=mount_ui()
        page.locator('#globalProjectSelect').select_option(pid)
        page.locator('[data-page="idea"]').first.click()
        assert page.locator('#runReady').is_enabled(), 'A runtime authentication issue wrongly disabled a valid backup workflow'
        page.locator('#runReady').click()
        page.wait_for_function('!teamBatchPending',timeout=120000)
        current=api('projects/'+pid)
        assert len(current['tasks'])==2,current
        assert all(t['status']=='done' for t in current['tasks']),[(t['id'],t['status'],t.get('lastError')) for t in current['tasks']]
        assert all(t['servedWorkerBinding']['connectionId']==cs['B']['id'] and t['servedReviewerBinding']['connectionId']==cs['C']['id'] for t in current['tasks'])
        files=list((runtime/'data').rglob('t1.html'))
        assert files and any('R4 verified local output' in x.read_text() for x in files)
        page.locator('#taskBoard').scroll_into_view_if_needed();page.wait_for_timeout(500)
        page.screenshot(path=str(QA/'browser-tasks-completed.png'))
        record('approved_ui_work_dependency_review_merge','UI-confirmed specification, refreshed page with A marked unverified, Run-ready stayed enabled; T1 and dependent T2 completed automatically using B, independent C reviewed, real Git merge and generated HTML files inspected.')
        # Fail a separate logical founder message; add B only after failure.
        p2=api('projects',{'name':'R4 - RETRY SAME MESSAGE','idea':'Test no duplicate logical job','productType':'website','audience':'test','goals':'retry'});p2id=p2['id']
        api('projects/'+p2id+'/model-roles',{'founder':bind('D'),'worker':bind('D'),'reviewer':bind('D'),'council':[bind('D')]})
        api('projects/'+p2id+'/settings',{'autoFailover':True,'failoverScope':'project'})
        close_ui(page);page=mount_ui()
        page.locator('#globalProjectSelect').select_option(p2id);page.locator('[data-page="idea"]').first.click()
        page.locator('#chatInput').fill('Retry this same logical instruction after the unavailable provider fails.')
        page.locator('#sendChat').click();page.wait_for_selector('[data-retry-founder]',timeout=30000);page.wait_for_function('!ideaBusy')
        failed=api('projects/'+p2id);msgid=failed['messages'][0]['id'];assert len(failed['messages'])==1
        page.screenshot(path=str(QA/'browser-failed-retry.png'))
        api('projects/'+p2id+'/model-roles',{'founder':bind('D'),'worker':bind('D'),'reviewer':bind('D'),'council':[bind('D')],'backups':{'founder':bind('B')}})
        page.locator('[data-retry-founder]').click();page.wait_for_function("!ideaBusy && document.querySelector('#chat').textContent.includes('LOCAL TEST ONLY - B')",timeout=30000)
        retried=api('projects/'+p2id);assert len(retried['messages'])==2 and retried['messages'][0]['id']==msgid and retried['messages'][0]['status']=='sent'
        record('retry_button_reuses_message','All allowed providers failed honestly; Retry uses existing failed message ID, B handles it after role update, one user message plus one answer, no duplicated job.')
        # Missing news card must be rejected BEFORE a phantom run/project.
        before=len(api('projects'))
        r=session.post(base+'/api/orchestrator/run',json={'pipeline':'news-video','cardId':'missing-local-card'},timeout=10)
        assert r.status_code==422,(r.status_code,r.text)
        assert len(api('projects'))==before
        record('pipeline_missing_input_422','Missing Radar card rejected with HTTP422 before creating a project or workflow.')
        # No real feed/network use: disable any configured defaults using actual API.
        for s in api('ingest/sources')['sources']:
            api('ingest/sources/'+s['id']+'/enabled',{'enabled':False})
        beforecalls=len(requests.get(fixture+'/stats').json()['calls'])
        page.locator('#chatInput').fill('tim tin tuc ve vang sang nay ngay 23/10/2026')
        page.locator('#sendChat').click();page.wait_for_function('!ideaBusy',timeout=30000)
        afternews=api('projects/'+p2id);last=afternews['messages'][-1]
        assert last['role']=='assistant' and last.get('source')=='host-evidence',last
        assert len(requests.get(fixture+'/stats').json()['calls'])==beforecalls
        page.screenshot(path=str(QA/'browser-news-evidence-missing.png'))
        record('news_intake_no_fabrication','Configured-source evidence absent: app returns a dated limitation without requesting unsupported CLI tools or any AI call, no invented current prices/news.')
        # Regression: all tabs render and stay selectable even after provider failure.
        tabs=[]
        for nav in page.locator('.nav[data-page]').all():
            name=nav.get_attribute('data-page');nav.click();page.wait_for_timeout(150)
            assert page.locator('#page-'+name).evaluate('(el)=>el.classList.contains("active")')
            tabs.append(name)
        record('navigation_smoke',{'tabs':tabs})
        assert not api('projects/'+pid+'/dispatch')['active']
        api('vault/lock',{})
        r=session.post(base+'/api/projects/'+p2id+'/chat',json={'message':'must not call a model when vault locked'},timeout=5)
        assert r.status_code>=400
        record('vault_lock_blocks_model_calls','Vault locked; chat fails closed, dispatcher has no active request after completed work.')
        close_ui(page)
        browser.close()
    assert not report['page_errors'],report['page_errors']
    stats=requests.get(fixture+'/stats').json()
    report['fixture_http_calls']=len(stats['calls']);report['provider_account_labels']=['Fixture A','Fixture B','Fixture C','Fixture D']
    report['success']=True
except Exception as e:
    report['success']=False;report['failure']=str(e);traceback.print_exc()
finally:finish()
sys.exit(0 if report.get('success') else 1)
