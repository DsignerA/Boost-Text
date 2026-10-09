// Development-only, local transcription relay. No audio or transcript persistence.
// Node 20+, OPENAI_API_KEY and BOOST_SESSION_TOKEN environment variables required.
import http from 'node:http';
const key=process.env.OPENAI_API_KEY,token=process.env.BOOST_SESSION_TOKEN;
if(!key||!token||token.length<24)throw Error('Set OPENAI_API_KEY and a random BOOST_SESSION_TOKEN (24+ chars)');
const server=http.createServer(async(req,res)=>{
 const json=(code,obj)=>{res.writeHead(code,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(obj));};
 if(req.method!=='POST'||req.url!=='/transcribe')return json(404,{error:'Not found'});
 if(req.headers['x-boost-session-token']!==token)return json(401,{error:'Unauthorized'});
 const chunks=[];let n=0;
 try{
  for await(const chunk of req){n+=chunk.length;if(n>3_000_000)throw Error('Audio segment too large');chunks.push(chunk);}
  const fd=new FormData();fd.set('file',new Blob(chunks,{type:'audio/webm'}),'segment.webm');fd.set('model','gpt-4o-mini-transcribe');
  const r=await fetch('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{Authorization:'Bearer '+key},body:fd});
  if(!r.ok)return json(502,{error:'Transcription provider failed',status:r.status});
  const out=await r.json();return json(200,{text:out.text||''});
 }catch(e){return json(400,{error:e.message});}
});
server.listen(8790,'127.0.0.1',()=>console.log('Local transcription relay on http://127.0.0.1:8790'));
