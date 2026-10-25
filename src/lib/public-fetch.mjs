/** Public, read-only network fetch. Resolve once and pin the address for the
 * request; revalidate each redirect. Never follow a feed into LAN/metadata. */
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns/promises';
import net from 'node:net';
export function publicAddress(ip){
  if(net.isIPv4(ip)){
    const [a,b]=ip.split('.').map(Number);
    return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&[0,168].includes(b)||a===100&&b>=64&&b<=127||a===198&&[18,19,51].includes(b)||a===203&&b===0);
  }
  if(net.isIPv6(ip)){const s=ip.toLowerCase();return /^[23][0-9a-f]{3}:/.test(s)&&!s.startsWith('2001:db8:')&&!s.startsWith('2001:0:')&&!s.startsWith('2002:');}
  return false;
}
export function publicUrl(value){
  let u;try{u=new URL(value);}catch{throw new Error('Invalid public URL');}
  const h=u.hostname.replace(/^\[|\]$/g,'').toLowerCase();
  if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.port&&!['80','443'].includes(u.port)||!h.includes('.')&&!net.isIP(h)||h==='localhost'||h.endsWith('.localhost')||h.endsWith('.local')||net.isIP(h)&&!publicAddress(h))throw new Error('Only public HTTP(S) news sources are allowed.');
  return u;
}
export async function fetchPublic(value,{headers={},signal,maxBytes=3_000_000,timeoutMs=15000}={}){
  let u=publicUrl(value);const started=Date.now();
  for(let redirects=0;redirects<=4;redirects++){
    if(signal?.aborted)throw signal.reason||new Error('Aborted');
    const h=u.hostname.replace(/^\[|\]$/g,''),remaining=timeoutMs-(Date.now()-started);
    if(remaining<=0)throw new Error('Public fetch timeout');
    let dnsTimer;const addresses=await Promise.race([dns.lookup(h,{all:true}),new Promise((_,reject)=>{dnsTimer=setTimeout(()=>reject(new Error('DNS timeout')),Math.min(remaining,5000));dnsTimer.unref();})]).finally(()=>clearTimeout(dnsTimer));
    if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))throw new Error('Private/reserved source address blocked');
    const pinned=addresses.find(a=>a.family===4)||addresses[0];
    const result=await new Promise((resolve,reject)=>{
      let deadline;const done=value=>{clearTimeout(deadline);resolve(value);},failure=error=>{clearTimeout(deadline);reject(error);};
      const request=(u.protocol==='https:'?https:http).request(u,{method:'GET',agent:false,headers:{accept:'*/*','user-agent':'AI-Project-OS-Local',...headers,'accept-encoding':'identity'},signal,
        lookup:(name,opts,cb)=>opts?.all?cb(null,[pinned]):cb(null,pinned.address,pinned.family)},res=>{
        const status=res.statusCode||500;
        if(status>=300&&status<400&&res.headers.location){res.resume();done({redirect:res.headers.location});return;}
        if(Number(res.headers['content-length']||0)>maxBytes){res.destroy();failure(new Error('Source exceeds size limit'));return;}
        const chunks=[];let size=0;res.on('data',chunk=>{size+=chunk.length;if(size>maxBytes){res.destroy();failure(new Error('Source exceeds size limit'));}else chunks.push(chunk);});
        res.once('error',failure);res.once('end',()=>done({status,headers:res.headers,bytes:Buffer.concat(chunks)}));
      });
      request.setTimeout(Math.max(1,timeoutMs-(Date.now()-started)),()=>request.destroy(new Error('Source timeout')));
      deadline=setTimeout(()=>request.destroy(new Error('Total source timeout')),Math.max(1,timeoutMs-(Date.now()-started)));deadline.unref();
      request.once('error',failure);request.end();
    });
    if(result.redirect){if(redirects===4)throw new Error('Too many redirects');u=publicUrl(new URL(result.redirect,u));continue;}
    const responseHeaders=new Headers();for(const [k,v]of Object.entries(result.headers))if(v!==undefined)responseHeaders.set(k,Array.isArray(v)?v.join(', '):String(v));
    return new Response([204,205,304].includes(result.status)?null:result.bytes,{status:result.status,headers:responseHeaders});
  }
  throw new Error('Source redirect failed');
}
