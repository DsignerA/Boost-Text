import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import twilio from 'twilio';
import {initialState,makeEngine,normalizePhone} from './core.js';
const env=process.env;const port=Number(env.PORT||8787);const dataPath=path.resolve(env.DATA_PATH||'./data/state.json');
let state;try{state=JSON.parse(fs.readFileSync(dataPath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;state=initialState();}
function persist(){fs.mkdirSync(path.dirname(dataPath),{recursive:true});const tmp=dataPath+'.tmp';fs.writeFileSync(tmp,JSON.stringify(state,null,2),{mode:0o600});fs.renameSync(tmp,dataPath);}
const allowSend=env.ENABLE_SMS_SEND==='true';
if(allowSend&&(!env.TWILIO_ACCOUNT_SID||!env.TWILIO_AUTH_TOKEN||!env.TWILIO_PHONE_NUMBER))throw Error('Twilio credentials required to enable sending');
const client=allowSend?twilio(env.TWILIO_ACCOUNT_SID,env.TWILIO_AUTH_TOKEN):null;
const engine=makeEngine(state,{adminPhone:env.ADMIN_PHONE,onboardingBaseUrl:env.ONBOARDING_BASE_URL,sendEnabled:allowSend,send:async(to,body)=>client.messages.create({to,from:env.TWILIO_PHONE_NUMBER,body})});
const sendJson=(res,code,data)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
const replyXml=(res,txt)=>{res.writeHead(200,{'Content-Type':'text/xml'});res.end(new twilio.twiml.MessagingResponse().message(txt).toString());};
const read=async req=>{let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>16384)throw Error('Request too large');}return raw;};
const requireAdmin=req=>{const provided=req.headers['x-api-key'];const expected=env.ADMIN_API_KEY;if(!expected||expected.length<24||typeof provided!=='string'||provided!==expected)throw Object.assign(Error('Unauthorized'),{status:401});};
const server=http.createServer(async(req,res)=>{try{
const u=new URL(req.url,'http://localhost');if(req.method==='GET'&&u.pathname==='/health')return sendJson(res,200,{ok:true,sendEnabled:allowSend});
if(req.method==='POST'&&u.pathname==='/twilio/inbound'){
 const raw=await read(req);const signature=req.headers['x-twilio-signature'];const publicUrl=(env.PUBLIC_BASE_URL||'').replace(/\/$/,'')+u.pathname;
 if(!env.TWILIO_AUTH_TOKEN||!signature||!twilio.validateRequest(env.TWILIO_AUTH_TOKEN,signature,publicUrl,Object.fromEntries(new URLSearchParams(raw))))return sendJson(res,403,{error:'Invalid Twilio signature'});
 const params=new URLSearchParams(raw);const result=engine.inbound(params.get('From'),params.get('Body'));persist();
 if(result.action){engine.log('sms_command_requires_dashboard_approval',{command:result.action,approvalId:result.id});persist();return replyXml(res,'Command received. For security, confirm this action in the authenticated dashboard/API; SMS alone cannot authorize it.');}
 return replyXml(res,result.reply);
}
requireAdmin(req);
if(req.method==='GET'&&u.pathname==='/api/status')return sendJson(res,200,{customers:Object.keys(state.customers).length,events:Object.values(state.events),approvals:Object.values(state.approvals).map(({token,...a})=>a),outbox:Object.values(state.outbox),audit:state.audit.slice(-100)});
if(req.method!=='POST')return sendJson(res,404,{error:'Not found'});
const body=JSON.parse(await read(req)||'{}');let result;
if(u.pathname==='/api/customers')result=engine.saveCustomer(body);
else if(u.pathname==='/api/onboarding')result=engine.createOnboarding(body);
else if(u.pathname==='/api/approve')result=await engine.approve(body.approvalId);
else if(u.pathname==='/api/cancel')result=engine.cancel(body.approvalId);
else if(u.pathname==='/api/deliver')result=await engine.deliver(body.outboxId);
else return sendJson(res,404,{error:'Not found'});
persist();return sendJson(res,200,{result});
}catch(e){persist();return sendJson(res,e.status||400,{error:e.message});}});
server.listen(port,()=>console.log(`Boost Text server listening on ${port}; sending ${allowSend?'enabled':'disabled'}`));
