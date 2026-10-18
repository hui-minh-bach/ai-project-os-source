"""Offline screenshot/interaction fixture for actual v0.8.0 HTML, JS and CSS.
Screenshots are labelled FIXTURE, not live backend, real-provider or Windows proof.
Run: python qa/worker-c/ui-fixture-matrix.py --output /safe/output/directory
Requires Playwright Python and available Chromium; source itself has no new deps.
"""
import argparse, json, re
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
TABS=['home','connections','idea','council','team','skills','engines','map','publish','guide']
THEMES=['ocean','emerald','aurora','arctic','amber']
VIEWPORTS=[(1366,768),(1920,1080)]
MOCK="""<script>
const mockVault={unlocked:false,exists:false};
window.fetch=async function(path){
 const key=String(path);
 const m=key.includes('/api/system/prerequisites')?{}:
 key.includes('/api/system/prerequisite-versions')?{}:
 key.includes('/api/system/sandbox')?{}:
 key.includes('/api/projects')?[]:
 key.includes('/api/connections')?[]:
 key.includes('/api/skills')?[]:
 key.includes('/api/engines')?[]:
 key.includes('/api/vault')?mockVault:
 key.includes('/api/integrations/status')?{core:{status:'offline',mode:'local-only',modelVerified:false},media:{status:'missing'}}:
 key.includes('/api/system/backups')?[]:
 key.includes('/api/system/readiness')?{installed:{},version:'0.8.0',node:'v22',dataDir:'FIXTURE',backupDir:'FIXTURE/backups'}:
 key.includes('/api/system/tts/config')?{configured:false,vault:false}:{};
 return {ok:true,status:200,json:async()=>m};
};
window.__fixtureFetch=window.fetch;</script>"""
def assemble():
    html=(ROOT/'public/index.html').read_text()
    html=re.sub(r'<!-- TAB:([a-z]+) -->',lambda m:(ROOT/'public/tabs'/f'{m.group(1)}.html').read_text().replace('<!-- TAB:media-studio -->',(ROOT/'public/tabs/media-studio.html').read_text()),html)
    html=re.sub(r'<link rel="stylesheet" href="/([\w/.-]+)">',lambda m:'<style>'+ (ROOT/'public'/m.group(1)).read_text()+'</style>',html)
    html=re.sub(r'<script src="/([\w/.-]+)"></script>',lambda m:'<script>'+ (ROOT/'public'/m.group(1)).read_text().replace('</script','<\\/script')+'</script>',html)
    return html.replace('</head>',MOCK+'</head>')
def run(out,executable='/usr/bin/chromium'):
    out.mkdir(parents=True,exist_ok=True)
    summary={'kind':'OFFLINE_FIXTURE_NOT_WINDOWS_OR_REAL_BACKEND','screenshots':0,'navigations':0,'errors':[],'viewports':[]}
    html=assemble()
    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(executable_path=executable,headless=True,args=['--no-sandbox'])
        try:
            for width,height in VIEWPORTS:
                page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
                errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
                page.set_content(html,wait_until='domcontentloaded',timeout=25000)
                page.wait_for_timeout(550)
                assert page.locator('.nav').count()==10,'Expected exactly ten navigation tabs'
                assert page.locator('.page').count()==10,'Expected exactly ten page sections'
                assert page.locator('#homeCurrentProject').is_visible()
                page.locator('#homeCreateProject').click()
                assert not page.locator('#modal').evaluate('(x)=>x.classList.contains("hidden")')
                page.keyboard.press('Escape')
                assert page.locator('#modal').evaluate('(x)=>x.classList.contains("hidden")')
                assert page.locator('#homeCreateProject').evaluate('(x)=>document.activeElement===x'),'Focus not restored after Escape'
                for theme in THEMES:
                    page.locator('#themeSelect').select_option(theme)
                    assert page.locator('html').get_attribute('data-theme')==theme
                    for tab in TABS:
                        page.locator(f'.nav[data-page="{tab}"]').click()
                        assert page.locator('.page.active').get_attribute('id')=='page-'+tab
                        assert len(page.locator('.page.active').inner_text().strip())>15
                        page.screenshot(path=str(out/f'{tab}-{theme}-{width}x{height}-FIXTURE.jpg'),type='jpeg',quality=63,animations='disabled')
                        summary['screenshots']+=1;summary['navigations']+=1
                # Check offline failure path at each viewport: see an actionable banner and retry.
                page.evaluate('() => { window.fetch=async function(){throw Error("synthetic offline")}; return true }')
                page.evaluate('customerBootstrap()')
                page.wait_for_timeout(500)
                assert page.locator('#customerErrorBanner').is_visible(),'No visible offline recovery banner'
                page.evaluate('window.fetch=window.__fixtureFetch')
                page.locator('#customerRetry').click()
                page.wait_for_timeout(500)
                assert not page.locator('#customerErrorBanner').is_visible(),'Retry did not clear banner'
                summary['errors'] += [f'{width}x{height}: {e}' for e in errors]
                summary['viewports'].append(f'{width}x{height}')
                page.close()
        finally: browser.close()
    (out/'FIXTURE_QA_RESULTS.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
    if summary['errors']: raise AssertionError(summary['errors'])
    return summary
if __name__=='__main__':
    cli=argparse.ArgumentParser();cli.add_argument('--output',default='/mnt/data/worker_c_workspace/ui_fixture_screenshots');cli.add_argument('--chromium',default='/usr/bin/chromium');args=cli.parse_args()
    print(json.dumps(run(Path(args.output),args.chromium),ensure_ascii=False))
