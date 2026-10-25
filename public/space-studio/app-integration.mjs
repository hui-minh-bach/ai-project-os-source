import {createSceneController} from './controller.mjs';
import {createFleetFeed} from './fleet-feed.mjs';
import {STATE_LABELS,ROLE_LABELS} from './fleet-contract.mjs';
const KEY='aios-space-studio-mode';
const text={open:'Ph\u00f2ng 3D R3',back:'V\u1ec1 ph\u00f2ng c\u0169',loading:'\u0110ang n\u1ea1p m\u00f4 h\u00ecnh 3D...',failed:'Kh\u00f4ng m\u1edf \u0111\u01b0\u1ee3c WebGL; ph\u00f2ng c\u0169 v\u1eabn ho\u1ea1t \u0111\u1ed9ng. ',empty:'Ch\u01b0a c\u00f3 t\u00e0i kho\u1ea3n AI. Th\u00eam k\u1ebft n\u1ed1i AI trong tab K\u1ebft n\u1ed1i.',label:'\u0110\u1ed9i AI t\u1eeb t\u00e0i kho\u1ea3n th\u1eadt',hint:'M\u1ed7i t\u00e0i kho\u1ea3n AI c\u00f3 m\u1ed9t robot. T\u00ean, vai tr\u00f2 v\u00e0 tr\u1ea1ng th\u00e1i l\u1ea5y t\u1eeb app; chuy\u1ec3n \u0111\u1ed9ng ch\u1ec9 di\u1ec5n h\u1ecda, kh\u00f4ng t\u1ef1 ch\u1ea1y t\u00e1c v\u1ee5 hay ti\u00eau h\u1ea1n m\u1ee9c.'};
const saved=()=>{try{return localStorage.getItem(KEY);}catch{return null;}};
const save=value=>{try{localStorage.setItem(KEY,value);}catch{}};
let initialized=false;
function initialize(){
 if(initialized)return;const room=document.getElementById('officeRoom'),head=room?.parentElement?.querySelector('.office-head');if(!room||!head)return;
 initialized=true;const button=document.createElement('button');button.id='officeSpaceToggle';button.type='button';button.className='ghost small';button.textContent=text.open;
 const toolbar=head.querySelector('span')||head;toolbar.prepend(button);toolbar.style.flexWrap='wrap';
 const section=document.createElement('section');section.id='officeSpaceSection';section.className='office-space-section';section.hidden=true;
 const stage=document.createElement('div');stage.className='office-space-mount';const status=document.createElement('div');status.className='office-space-roster';status.setAttribute('aria-label',text.label);
 const note=document.createElement('p');note.className='office-space-disclosure';note.textContent=text.hint;section.append(stage,note,status);room.before(section);
 const syncLine=document.createElement('div');syncLine.className='office-space-status';syncLine.setAttribute('aria-live','polite');
 const syncText=document.createElement('span');const retry=document.createElement('button');retry.type='button';retry.className='office-space-refresh';retry.textContent='L\u00e0m m\u1edbi';syncLine.append(syncText,retry);
 const agents=document.createElement('div');agents.className='office-space-roster';status.append(syncLine,agents);
 const error=document.createElement('p');error.className='office-space-failure';error.setAttribute('role','alert');error.hidden=true;room.before(error);
 let feed=null,lastSignature='';
 function renderRoster(data){const sig=JSON.stringify(data.bots);if(sig===lastSignature)return;lastSignature=sig;agents.replaceChildren();
  if(!data.bots.length){agents.textContent=text.empty;return;}
  for(const b of data.bots){const chip=document.createElement('button');chip.type='button';chip.className='office-space-agent';chip.dataset.state=b.state;
   chip.textContent=b.name+' / '+(ROLE_LABELS[b.role]||b.provider)+' / '+(STATE_LABELS[b.state]||b.state);chip.title=b.activityLabel;
   chip.addEventListener('click',()=>controller.get()?.selectAgent(b.connectionId));agents.append(chip);}
 }
 function startFeed(viewer){feed?.dispose();feed=createFleetFeed({onData:data=>{viewer.setFleetSnapshot(data);renderRoster(data);},onStatus:(state,detail)=>{
  syncLine.dataset.status=state;
  if(state==='live'){syncText.textContent=`${detail.count} AI - `+'\u0110\u00e3 \u0111\u1ed3ng b\u1ed9 '+new Date(detail.lastReceived).toLocaleTimeString('vi-VN');}
  else if(state==='loading'){syncText.textContent='\u0110ang \u0111\u1ecdc tr\u1ea1ng th\u00e1i t\u00e0i kho\u1ea3n...';}
  else{
   const clear=state==='locked'||state==='unauthorized';viewer.markFleetStale({clear});lastSignature='';
   if(clear)agents.replaceChildren();else for(const chip of agents.children){chip.dataset.state='unknown';chip.textContent=chip.textContent.split(' / ').slice(0,-1).join(' / ')+' / '+STATE_LABELS.unknown;}
   syncText.textContent=state==='locked'?'Vault \u0111ang kh\u00f3a. M\u1edf Vault \u0111\u1ec3 hi\u1ec7n \u0111\u1ed9i AI.':state==='unauthorized'?'Phi\u00ean \u0111\u0103ng nh\u1eadp h\u1ebft h\u1ea1n. M\u1edf l\u1ea1i \u1ee9ng d\u1ee5ng.':'M\u1ea5t \u0111\u1ed3ng b\u1ed9; \u0111\u00e3 d\u1eebng ho\u1ea1t c\u1ea3nh, kh\u00f4ng kh\u1eb3ng \u0111\u1ecbnh AI \u0111ang ch\u1ea1y.';
  }
 }});if(!document.hidden)feed.start();}
 const controller=createSceneController({mount:async(host,options)=>{const {mountSpaceViewer}=await import('./viewer.mjs');return mountSpaceViewer(host,options);},onState:(state,value)=>{
  button.disabled=state==='loading';button.dataset.state=state;
  if(state==='loading'){error.hidden=true;section.hidden=false;stage.replaceChildren();button.textContent=text.loading;}
  if(state==='ready'){window.__officeChairDemoActive?.stop();window.__office3DOff=true;room.hidden=true;button.textContent=text.back;window.__ideaSpaceViewer=value;startFeed(value);}
  if(state==='closed'){feed?.dispose();feed=null;lastSignature='';agents.replaceChildren();room.hidden=false;section.hidden=true;button.textContent=text.open;window.__ideaSpaceViewer=null;}
  if(state==='error'){feed?.dispose();feed=null;section.hidden=true;room.hidden=false;button.textContent=text.open;error.hidden=false;error.textContent=text.failed+String(value?.message||value).slice(0,180);window.__ideaSpaceViewer=null;}
 }});
 async function show(){save('space');window.__officeChairDemoActive?.stop();window.__office3DOff=true;try{await controller.open(stage,{quality:'high',live:true});}catch{/* Recoverable error rendered above. */}}
 function hide(persist=true){if(persist)save('legacy');controller.close();}
 retry.addEventListener('click',()=>feed?.refresh());
 button.addEventListener('click',()=>{if(controller.get()||controller.isPending())hide();else show();});
 for(const id of ['office3DToggle','officeChairPreview'])document.getElementById(id)?.addEventListener('click',()=>hide(true),{capture:true});
 document.addEventListener('page-change',event=>{if(event.detail?.page==='idea'){if(saved()!=='legacy')show();}else hide(false);});
 const visibility=()=>{controller.get()?.markFleetStale();controller.setActive(!document.hidden);if(document.hidden)feed?.stop();else feed?.start();};document.addEventListener('visibilitychange',visibility);
 window.addEventListener('pagehide',()=>{hide(false);document.removeEventListener('visibilitychange',visibility);},{once:true});
 window.__ideaSpaceController=controller;
 if(document.getElementById('page-idea')?.classList.contains('active')&&saved()!=='legacy')show();
}
initialize();if(!initialized)document.addEventListener('DOMContentLoaded',initialize,{once:true});
