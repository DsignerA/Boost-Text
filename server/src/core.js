import {randomUUID,randomBytes,timingSafeEqual} from 'node:crypto';
const now=()=>Date.now();
export const normalizePhone=s=>{const d=String(s||'').replace(/[^\d]/g,'');return d.length===11&&d[0]==='1'?'+'.concat(d):d.length>=10&&d.length<=15?'+'.concat(d):null;};
export const initialState=()=>({customers:{},events:{},approvals:{},outbox:{},audit:[],optouts:{}});
export function redactPhone(p){return p?('*'.repeat(Math.max(0,p.length-4))+p.slice(-4)):'';}
export function makeEngine(store,{send=async()=>{throw Error('SMS provider not configured');},adminPhone,onboardingBaseUrl='https://bisonboost.com/onboarding',sendEnabled=false}={}){
 const log=(action,detail={})=>{store.audit.push({id:randomUUID(),at:new Date().toISOString(),action,...detail});};
 const saveCustomer=({id=randomUUID(),name,phone,consent=false,consentAt,consentSource})=>{
   const normalized=normalizePhone(phone);if(!normalized||!name?.trim())throw Error('Valid name and phone required');
   const old=store.customers[id];const item={id,name:name.trim(),phone:normalized,consent:!!consent,consentAt:consent?consentAt||new Date().toISOString():null,consentSource:consent?consentSource||'unspecified':null,createdAt:old?.createdAt||new Date().toISOString()};store.customers[id]=item;log('customer_saved',{customerId:id});return item;
 };
 const createOnboarding=({customerId})=>{
  const c=store.customers[customerId];if(!c)throw Error('Customer not found');
  const token=randomBytes(18).toString('hex');const url=new URL(onboardingBaseUrl);url.searchParams.set('token',token);
  const eventId=randomUUID(),approvalId=randomUUID();const body=`Hi ${c.name.split(' ')[0]}, welcome to Boost Bison. Start onboarding here: ${url.toString()} Reply STOP to opt out.`;
  store.events[eventId]={id:eventId,type:'customer.onboarding.ready',customerId,at:new Date().toISOString(),status:'pending_approval'};
  store.approvals[approvalId]={id:approvalId,eventId,customerId,body,token,status:'pending',expiresAt:now()+30*60*1000};
  log('approval_created',{eventId,approvalId,customerId});return {eventId,approvalId,expiresAt:store.approvals[approvalId].expiresAt,preview:body};
 };
 const approvedBy=id=>{const a=store.approvals[id];if(!a)throw Error('Unknown approval');if(a.status!=='pending')throw Error('Approval not pending');if(now()>a.expiresAt){a.status='expired';throw Error('Approval expired');}return a;};
 const approve=async(id)=>{
  const a=approvedBy(id),c=store.customers[a.customerId];
  if(!c?.consent||store.optouts[c.phone])throw Error('Customer does not have active SMS consent');
  a.status='approved';a.approvedAt=new Date().toISOString();
  const item={id:randomUUID(),approvalId:id,eventId:a.eventId,to:c.phone,body:a.body,status:'queued',createdAt:new Date().toISOString()};
  store.outbox[item.id]=item;store.events[a.eventId].status='queued';log('approved_and_queued',{approvalId:id,outboxId:item.id});return item;
 };
 const cancel=id=>{const a=approvedBy(id);a.status='cancelled';store.events[a.eventId].status='cancelled';log('approval_cancelled',{approvalId:id});return a;};
 const deliver=async(id)=>{const item=store.outbox[id];if(!item)throw Error('Outbox item not found');if(item.status!=='queued')throw Error('Item already processed');if(!sendEnabled)throw Error('SMS sending disabled');const c=Object.values(store.customers).find(c=>c.phone===item.to);if(!c?.consent||store.optouts[item.to]){item.status='blocked';log('delivery_blocked',{outboxId:id});return item;}item.status='sending';log('delivery_attempt',{outboxId:id});try{const result=await send(item.to,item.body);item.status='sent';item.providerId=result.sid||null;item.sentAt=new Date().toISOString();store.events[item.eventId].status='sent';log('delivery_accepted',{outboxId:id});}catch(e){item.status='uncertain';log('delivery_uncertain',{outboxId:id,error:String(e.message).slice(0,120)});throw e;}return item;};
 const inbound=(from,body)=>{const phone=normalizePhone(from);if(!phone)return {reply:'Invalid sender'};const input=String(body||'').trim().toUpperCase();if(['STOP','STOPALL','UNSUBSCRIBE','CANCEL','END','QUIT'].includes(input)){store.optouts[phone]=new Date().toISOString();log('opt_out',{phone:redactPhone(phone)});return {reply:'You are unsubscribed. Reply START to resubscribe.'};}if(['START','UNSTOP'].includes(input)){delete store.optouts[phone];log('opt_in_keyword',{phone:redactPhone(phone)});return {reply:'Opt-out removed. Contact support to confirm messaging consent.'};}if(phone!==normalizePhone(adminPhone))return {reply:'Message received. Please contact support for assistance.'};const [command,id]=input.split(/\s+/);if(command==='STATUS')return {reply:`Boost-Text: ${Object.values(store.approvals).filter(a=>a.status==='pending').length} pending approvals, ${Object.values(store.outbox).filter(x=>x.status==='queued').length} queued SMS.`};if(command==='DETAILS'){const a=store.approvals[id];return {reply:a?`Approval ${id}: ${a.status}. ${a.body.slice(0,500)}`:'Unknown approval ID'};}if(command==='APPROVE'||command==='CANCEL')return {action:command,id};return {reply:'Commands: STATUS, DETAILS <id>, APPROVE <id>, CANCEL <id>. Natural-language instructions are not executed.'};};
 return {saveCustomer,createOnboarding,approve,cancel,deliver,inbound,log};
}
