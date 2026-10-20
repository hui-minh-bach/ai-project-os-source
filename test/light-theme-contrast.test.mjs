import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/light-theme.css',import.meta.url),'utf8');
const base=readFileSync(new URL('../public/experience.css',import.meta.url),'utf8');
const script=readFileSync(new URL('../public/theme.js',import.meta.url),'utf8');

function rgb(value) {
  assert.match(value,/^#[0-9a-f]{6}$/i);
  return [1,3,5].map(i=>parseInt(value.slice(i,i+2),16)/255);
}
function luminance(value) {
  return rgb(value).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((acc,v,i)=>acc+v*[.2126,.7152,.0722][i],0);
}
function ratio(a,b) {const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
const palette={text:'#132941',muted:'#4a6176',soft:'#f0f6fc',button:'#0865a9',buttonText:'#ffffff',warning:'#795000',danger:'#a82736'};

test('saved Arctic skin applies before CSS paints, with dark themes still selectable',()=>{
  assert.ok(html.indexOf('/theme.js')<html.indexOf('/styles.css'),'Theme script must run before CSS parse to avoid dark flash');
  assert.ok(html.indexOf('/light-theme.css')>html.indexOf('/experience.css'),'Light palette must follow all dark-skin styles');
  assert.match(base,/:root\[data-theme="ocean"\]/);assert.match(base,/:root\[data-theme="arctic"\]/);
  assert.match(script,/localStorage\.getItem\('ai-project-os-theme'\)/);
  assert.match(script,/names\.includes\(select\.value\)/);
  for(const key of ['ocean','emerald','aurora','arctic','amber'])assert.ok(script.includes(`'${key}'`));
});

test('body, muted text, warnings, and white-label controls exceed AA contrast in Arctic',()=>{
  for(const [foreground,background] of [
    [palette.text,palette.soft], [palette.muted,palette.soft],
    [palette.buttonText,palette.button], [palette.warning,palette.soft],
    [palette.danger,palette.soft]
  ])assert.ok(ratio(foreground,background)>=4.5,`${foreground} on ${background} is not WCAG AA`);
  assert.match(css,/:root\[data-theme="arctic"\]\{\s*--arctic-text:#132941/);
  assert.match(css,/--ux-button:#0865a9/);
});

test('Arctic repair does not paint over any of four dark theme settings',()=>{
  // The overlay is a light-only stylesheet; it must not contain bare global selectors.
  for(const line of css.split(/\r?\n/)){
    const fragment=line.trim();
    if(!fragment||fragment.startsWith('/*')||fragment.startsWith('*')||fragment.startsWith('--')||fragment.startsWith('}'))continue;
    if(fragment.startsWith('color:')||fragment.startsWith('background:'))continue;
    if(fragment.startsWith('html[data-theme="arctic"]')||fragment.startsWith(':root[data-theme="arctic"]'))continue;
    assert.fail(`Unexpected unscoped Arctic CSS: ${fragment.slice(0,100)}`);
  }
});

test('hard-to-read controls and runtime states have dedicated light-theme fixes',()=>{
  const targets=['#page-idea .idea-field label span','#page-idea .idea-feature[aria-pressed="true"]',
    '#page-idea .idea-message-body','#page-connections .cc-card', '#page-connections button.cc-button.connect',
    '#page-idea .team-run-button','#page-idea .team-status-pill.running',
    '#page-skills .skills-categories button[aria-pressed="true"]',
    '#page-engines .engineBadge.safe','#page-map .map-status.done',
    '#page-council .council-vote.consider','.modalCard', '.customer-steps>div'];
  for(const selector of targets)assert.ok(css.includes(selector),`Missing Arctic override: ${selector}`);
});
