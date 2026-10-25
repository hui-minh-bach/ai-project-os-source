/** Read-only live polling with cancellation, freshness checks and no hidden retries. */
import {normalizeFleetSnapshot} from './fleet-contract.mjs';
export function createFleetFeed({fetchImpl=globalThis.fetch,onData=()=>{},onStatus=()=>{},now=()=>Date.now(),intervalMs=2500,timeoutMs=6500,setTimer=setTimeout,clearTimer=clearTimeout}={}){
 let active=false,disposed=false,generation=0,timer=null,pending=null,lastReceived=0;
 const notify=(state,detail={})=>{if(!disposed)onStatus(state,{...detail,lastReceived});};
 function cancel(){generation++;if(timer!==null)clearTimer(timer);timer=null;pending?.abort();pending=null;}
 async function poll(){
  if(!active||disposed||pending)return;const token=generation,abort=new AbortController();pending=abort;
  const timeout=setTimer(()=>abort.abort(),timeoutMs);
  try{
   const response=await fetchImpl('/api/office/space-fleet',{method:'GET',credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'},signal:abort.signal});
   if(token!==generation||!active||disposed)return;
   if(!response.ok){const error=new Error('Fleet HTTP '+response.status);error.status=response.status;throw error;}
   const data=normalizeFleetSnapshot(await response.json());
   if(token!==generation||!active||disposed)return;
   const at=Date.parse(data.generatedAt),age=now()-at;
   if(!Number.isFinite(at)||age>15000||age< -120000)throw new Error('Stale fleet snapshot');
   lastReceived=now();onData(data);notify('live',{count:data.bots.length});
  }catch(error){if(token===generation&&active&&!disposed)notify(error?.status===423?'locked':error?.status===401?'unauthorized':'stale',{message:String(error?.message||error)});}
  finally{clearTimer(timeout);if(pending===abort)pending=null;if(token===generation&&active&&!disposed)timer=setTimer(poll,intervalMs);}
 }
 return {
  start(){if(disposed||active)return;active=true;notify('loading');void poll();},
  stop(){if(!active)return;active=false;cancel();},
  refresh(){if(disposed)return;cancel();active=true;notify('loading');void poll();},
  dispose(){active=false;disposed=true;cancel();},
  status:()=>({active,pending:!!pending,lastReceived,generation})
 };
}
