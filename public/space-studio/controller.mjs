/** Own exactly one scene, including cancellation during asynchronous GLB loading. */
export function createSceneController({mount,onState=()=>{}}){
 if(typeof mount!=='function')throw new TypeError('mount must be a function');
 let generation=0,instance=null,pending=null,wanted=false;
 function open(host,options={}){
  wanted=true;if(instance)return Promise.resolve(instance);
  if(pending)return pending.then(()=>wanted?(instance||open(host,options)):null);
  const token=++generation;onState('loading');
  // Deferring mount also catches synchronous throws after pending is assigned.
  const task=Promise.resolve().then(()=>mount(host,options)).then(next=>{
   if(token!==generation||!wanted){next?.dispose?.();return null;}
   instance=next;onState('ready',instance);return instance;
  },error=>{if(token===generation&&wanted)onState('error',error);throw error;});
  const owned=task.finally(()=>{if(pending===owned)pending=null;});pending=owned;return owned;
 }
 function close(){wanted=false;generation++;if(instance){instance.dispose();instance=null;}onState('closed');}
 return {open,close,get:()=>instance,isPending:()=>!!pending,setActive(value){instance?.setActive?.(!!value);}};
}
