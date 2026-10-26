import dns from 'node:dns/promises';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';

const fail = message => Object.assign(new Error(message), { code: 'MEDIA_URL' });
export function publicAddress(address) {
  if (net.isIP(address) === 4) {
    const [a,b] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254 ||
      a === 172 && b >= 16 && b <= 31 || a === 192 && [0,168].includes(b) ||
      a === 100 && b >= 64 && b <= 127 || a === 198 && [18,19].includes(b) ||
      a === 192 && b === 2 || a === 198 && b === 51 || a === 203 && b === 0);
  }
  // Only globally routed native IPv6; exclude mapped/NAT64/tunnel/private ranges.
  if (net.isIP(address) === 6) return /^[23][0-9a-f]{3}:/i.test(address) &&
    !/^200[12]:|^2001:(?:0:|db8:|10:|20:)/i.test(address);
  return false;
}
export function mediaUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) throw fail('Liên kết không hợp lệ.');
  let u; try { u = new URL(value); } catch { throw fail('Dán URL HTTP/HTTPS đầy đủ.'); }
  if (!['http:','https:'].includes(u.protocol) || u.username || u.password || u.hash ||
      u.port && !['80','443'].includes(u.port)) throw fail('Chỉ nhận HTTP/HTTPS công khai, không kèm mật khẩu/cổng tùy ý.');
  if (net.isIP(u.hostname.replace(/^\[|\]$/g,'')) && !publicAddress(u.hostname.replace(/^\[|\]$/g,'')))
    throw fail('Không tải từ địa chỉ nội bộ.');
  return u;
}
export async function publicHost(host) {
  host = host.replace(/^\[|\]$/g,'');
  const records = net.isIP(host) ? [{address:host,family:net.isIP(host)}] : await dns.lookup(host,{all:true});
  if (!records.length || records.some(r=>!publicAddress(r.address))) throw fail('Đích tải không phải máy chủ Internet công khai.');
  return records[0];
}
// Validate DNS and pin that exact address on the socket; redirects use a new call.
export async function publicRequest(value) {
  const u = mediaUrl(String(value)), record = await publicHost(u.hostname);
  return await new Promise((resolve,reject)=>{
    const req = (u.protocol==='https:'?https:http).get(u,{
      agent:false, headers:{'user-agent':'AI-Project-OS-Media/0.9.76','accept-encoding':'identity'},
      lookup:(_h,options,cb)=>cb(null,options?.all?[record]:record.address,record.family)
    },resolve);
    req.setTimeout(30000,()=>req.destroy(fail('Máy chủ tải quá thời gian chờ.')));
    req.once('error',reject);
  });
}
// yt-dlp must send every HTTP(S) request through this DNS-pinned outbound proxy.
// No browser cookies, ambient proxy credentials or local network targets.
export async function downloadProxy() {
  const sockets = new Set();
  const server = http.createServer(async(req,res)=>{
    try {
      if (req.method!=='GET' && req.method!=='HEAD') throw fail('Method blocked');
      const u=mediaUrl(req.url); if(u.protocol!=='http:')throw fail('Use CONNECT');
      const record=await publicHost(u.hostname);
      const out=http.request(u,{method:req.method,agent:false,headers:{host:u.host,'user-agent':req.headers['user-agent']||'yt-dlp'},
        lookup:(_h,o,cb)=>cb(null,o?.all?[record]:record.address,record.family)},up=>{res.writeHead(up.statusCode,up.headers);up.pipe(res);});
      out.setTimeout(30000,()=>out.destroy());out.on('error',()=>res.destroy());out.end();
      res.on('close',()=>out.destroy());
    } catch { res.writeHead(403);res.end('Destination blocked'); }
  });
  server.on('connection',s=>{sockets.add(s);s.on('error',()=>s.destroy());s.on('close',()=>sockets.delete(s));});
  server.on('connect',async(req,client,head)=>{
    let upstream;
    try {
      const u=mediaUrl('https://'+req.url); if(u.port && u.port!=='443')throw fail('Port blocked');
      const record=await publicHost(u.hostname);
      upstream=net.connect({host:record.address,port:443});sockets.add(upstream);
      upstream.on('close',()=>sockets.delete(upstream));upstream.setTimeout(30000,()=>upstream.destroy());
      upstream.once('connect',()=>{client.write('HTTP/1.1 200 Connection Established\r\n\r\n');if(head.length)upstream.write(head);client.pipe(upstream);upstream.pipe(client);});
      upstream.on('error',()=>client.destroy());client.on('close',()=>upstream.destroy());client.on('error',()=>upstream.destroy());
    } catch { client.end('HTTP/1.1 403 Forbidden\r\n\r\n');upstream?.destroy(); }
  });
  server.headersTimeout=10000;server.requestTimeout=30000;
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  return {url:`http://127.0.0.1:${server.address().port}`,close:()=>{for(const s of sockets)s.destroy();server.close();}};
}
