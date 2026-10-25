import fs from 'node:fs';
export function byteRange(raw,size){
 if(!raw)return null;const m=/^bytes=(\d*)-(\d*)$/.exec(String(raw));if(!m||(!m[1]&&!m[2])||size<=0)throw new Error('Invalid range');
 let start=m[1]?Number(m[1]):Math.max(0,size-Number(m[2])),end=m[1]&&m[2]?Number(m[2]):size-1;
 if(!m[1]&&Number(m[2])<=0)throw new Error('Invalid suffix');
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<start||start>=size)throw new Error('Range out of bounds');
 return {start,end:Math.min(end,size-1)};
}
export function sendArtifact(req,res,{metadata,bytes,filePath},type='application/octet-stream'){
 const size=filePath?fs.statSync(filePath).size:bytes.length;
 let range;try{range=byteRange(req.headers.range,size);}catch{res.writeHead(416,{'content-range':`bytes */${size}`,'cache-control':'no-store','content-length':'0'});res.end();return;}
 const start=range?.start??0,end=range?.end??size-1;
 const name=String(metadata.name||'download').replace(/[^a-zA-Z0-9._-]/g,'_');
 res.writeHead(range?206:200,{'content-type':type,'content-length':Math.max(0,end-start+1),'accept-ranges':'bytes',...(range?{'content-range':`bytes ${start}-${end}/${size}`}:{}) ,'cache-control':'no-store','x-content-type-options':'nosniff','content-disposition':`inline; filename="${name}"`,...(metadata.sha256?{'x-artifact-sha256':metadata.sha256}:{})});
 if(req.method==='HEAD'){res.end();return;}
 if(filePath&&size)fs.createReadStream(filePath,{start,end}).on('error',()=>res.destroy()).pipe(res);else res.end(bytes?.subarray(start,end+1)||Buffer.alloc(0));
}
