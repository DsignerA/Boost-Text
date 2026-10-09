'use strict';
// Prototype: user-started capture, consent required, Chrome desktop only.
const $ = id => document.getElementById(id);
let tabStream, micStream, ctx, destination, recorder, timer, active=false, transcript=[];
function status(s){$('status').textContent=s;}
async function stop(){
 active=false;clearTimeout(timer);
 if(recorder&&recorder.state!=='inactive')recorder.stop();
 for(const s of [tabStream,micStream])s?.getTracks().forEach(t=>t.stop());
 await ctx?.close();tabStream=micStream=ctx=destination=recorder=null;
 $('start').disabled=false;$('stop').disabled=true;status('Stopped');
}
async function upload(blob){
 if(!active||!blob.size)return;
 const url=$('endpoint').value.trim().replace(/\/$/,'');
 if(!/^http:\/\/127\.0\.0\.1:8790$/.test(url)){status('Only local relay endpoint is allowed');await stop();return;}
 try{
  const response=await fetch(url+'/transcribe',{method:'POST',headers:{'x-boost-session-token':$('token').value},body:blob});
  if(!response.ok)throw Error('Transcription service returned '+response.status);
  const result=await response.json();
  if(result.text){transcript.push({time:new Date().toISOString(),text:result.text});$('transcript').value=transcript.map(x=>x.time+' '+x.text).join('\n');$('transcript').scrollTop=$('transcript').scrollHeight;}
  status('Listening • '+transcript.length+' transcript segments');
 }catch(e){status('Transcription unavailable: '+e.message);}
}
function nextChunk(){
 if(!active)return;
 recorder=new MediaRecorder(destination.stream,{mimeType:'audio/webm;codecs=opus'});
 const chunks=[];
 recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
 recorder.onstop=()=>{void upload(new Blob(chunks,{type:'audio/webm'})); if(active)nextChunk();};
 recorder.start();
 timer=setTimeout(()=>{if(recorder?.state==='recording')recorder.stop();},8000);
}
$('start').addEventListener('click',async()=>{
 if(active)return;
 if(!$('consent').checked){status('Confirm call participants have been informed and consented');return;}
 if(!$('token').value){status('Enter a local relay session token');return;}
 $('start').disabled=true;status('Requesting Google Voice tab and microphone...');
 try{
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  if(!tab||!/^https:\/\/voice\.google\.com\//.test(tab.url||''))throw Error('Select an active voice.google.com tab first');
  const streamId=await chrome.tabCapture.getMediaStreamId({targetTabId:tab.id});
  tabStream=await navigator.mediaDevices.getUserMedia({audio:{mandatory:{chromeMediaSource:'tab',chromeMediaSourceId:streamId}},video:false});
  micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
  ctx=new AudioContext();destination=ctx.createMediaStreamDestination();
  const remote=ctx.createMediaStreamSource(tabStream),mic=ctx.createMediaStreamSource(micStream);
  remote.connect(destination);mic.connect(destination);
  // Restore the tab audio to the speakers; otherwise capture may mute it.
  remote.connect(ctx.destination);
  active=true;$('stop').disabled=false;status('Listening • consented session');nextChunk();
  for(const s of [tabStream,micStream])s.getTracks().forEach(t=>t.addEventListener('ended',()=>void stop(),{once:true}));
 }catch(e){status('Capture failed: '+e.message);await stop();}
});
$('stop').addEventListener('click',()=>void stop());
$('export').addEventListener('click',()=>{
 const blob=new Blob([JSON.stringify({type:'boost.call.transcript.v1',segments:transcript},null,2)],{type:'application/json'});
 const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='boost-call-transcript.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);
});
window.addEventListener('pagehide',()=>{if(active)void stop();});
