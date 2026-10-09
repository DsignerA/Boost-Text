'use strict';
const DEFAULT_TEMPLATES = [
  {id:'welcome',name:'Welcome',body:'Hi {name}, thanks for reaching out! How can we help you today?'},
  {id:'followup',name:'Follow-up',body:'Hi {name}, just following up on our conversation. Is there a good time to connect?'},
  {id:'appointment',name:'Appointment reminder',body:'Hi {name}, this is a reminder about your upcoming appointment. Please let us know if you have any questions.'}
];
let state = {contacts:[],templates:DEFAULT_TEMPLATES,drafts:{}};
let selectedId = '';
const $ = id => document.getElementById(id);
const clean = value => String(value ?? '').trim();
function phoneValid(v){const digits=v.replace(/\D/g,'');return digits.length>=10&&digits.length<=15;}
function esc(text){return String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function toast(msg){$('toast').textContent=msg;$('toast').style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').style.display='none',2700);}
async function persist(){await chrome.storage.local.set({boostMessaging:state});}
function contact(){return state.contacts.find(c=>c.id===selectedId);}
function templateText(t,c){return t.body.replace(/\{name\}/g,c?.name?.split(/\s+/)[0]||'there');}
function updateStats(){$('count').textContent=state.contacts.length;$('draftCount').textContent=Object.keys(state.drafts).length;}
function renderContactOptions(){const current=selectedId;$('contactSelect').replaceChildren();for(const c of state.contacts){const opt=new Option(`${c.name} · ${c.phone}`,c.id);$('contactSelect').add(opt);}selectedId=state.contacts.some(c=>c.id===current)?current:(state.contacts[0]?.id||'');$('contactSelect').value=selectedId;$('contactSelect').disabled=!selectedId;renderContactDetails();}
function renderContactDetails(){const c=contact();$('contactContext').hidden=!c;if(c){$('contactContext').textContent=`${c.name} · ${c.phone}${c.tag?'\n'+c.tag:''}`;}$('notes').value=c?.notes||'';$('notes').disabled=!c;$('saveNotes').disabled=!c;$('lastDraft').textContent=(c&&state.drafts[c.id])||'No saved draft for this customer.';}
function renderTemplates(){const sel=$('templateSelect');sel.replaceChildren();sel.add(new Option('Blank message',''));state.templates.forEach(t=>sel.add(new Option(t.name,t.id)));const root=$('templateList');root.replaceChildren();for(const t of state.templates){const box=document.createElement('div');box.className='list-item';box.innerHTML=`<div><b>${esc(t.name)}</b><small>${esc(t.body)}</small></div>`;const del=document.createElement('button');del.className='del';del.textContent='Delete';del.addEventListener('click',async()=>{state.templates=state.templates.filter(x=>x.id!==t.id);await persist();renderTemplates();toast('Template deleted');});box.append(del);root.append(box);}}
function renderContacts(){const q=clean($('search').value).toLowerCase();const root=$('contactList');root.replaceChildren();for(const c of state.contacts.filter(x=>[x.name,x.phone,x.tag].join(' ').toLowerCase().includes(q))){const box=document.createElement('div');box.className='list-item';const info=document.createElement('div');info.innerHTML=`<b>${esc(c.name)}</b><small>${esc(c.phone)} · ${esc(c.tag||'No tag')}</small>`;const actions=document.createElement('div');const choose=document.createElement('button');choose.textContent='Select';choose.addEventListener('click',()=>{selectedId=c.id;renderContactOptions();showView('compose');});const del=document.createElement('button');del.textContent='Delete';del.className='del';del.addEventListener('click',async()=>{if(!confirm(`Delete ${c.name} and their saved draft?`))return;state.contacts=state.contacts.filter(x=>x.id!==c.id);delete state.drafts[c.id];await persist();renderAll();});actions.append(choose,del);box.append(info,actions);root.append(box);}}
function renderAll(){renderContactOptions();renderContacts();renderTemplates();updateStats();}
function showView(id){document.querySelectorAll('.view').forEach(el=>el.hidden=el.id!==id);document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('active',b.dataset.view===id));}
document.querySelectorAll('.tabs button').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
$('contactSelect').addEventListener('change',e=>{selectedId=e.target.value;renderContactDetails();});
$('templateSelect').addEventListener('change',e=>{const t=state.templates.find(x=>x.id===e.target.value);if(t)$('message').value=templateText(t,contact());$('charCount').textContent=$('message').value.length;});
$('message').addEventListener('input',()=>{$('charCount').textContent=$('message').value.length;});
$('contactForm').addEventListener('submit',async e=>{e.preventDefault();const name=clean($('name').value),phone=clean($('phone').value),tag=clean($('tag').value);if(!phoneValid(phone)){toast('Enter a valid international or US phone number');return;}const digits=phone.replace(/\D/g,'');if(state.contacts.some(c=>c.phone.replace(/\D/g,'')===digits)){toast('Phone number already exists');return;}const c={id:crypto.randomUUID(),name,phone,tag,notes:''};state.contacts.unshift(c);selectedId=c.id;await persist();e.target.reset();renderAll();showView('compose');toast('Customer added');});
$('templateForm').addEventListener('submit',async e=>{e.preventDefault();state.templates.push({id:crypto.randomUUID(),name:clean($('templateName').value),body:clean($('templateBody').value)});await persist();e.target.reset();renderTemplates();toast('Template saved');});
$('search').addEventListener('input',renderContacts);
$('saveDraft').addEventListener('click',async()=>{if(!contact()){toast('Add a customer first');return;}state.drafts[selectedId]=$('message').value;await persist();renderContactDetails();updateStats();toast('Draft saved locally');});
$('copyMessage').addEventListener('click',async()=>{const txt=$('message').value.trim();if(!txt){toast('Write a message first');return;}try{await navigator.clipboard.writeText(txt);toast('Message copied — paste into Google Voice');}catch{toast('Copy failed; select the text to copy');}});
$('saveNotes').addEventListener('click',async()=>{const c=contact();if(!c)return;c.notes=$('notes').value;await persist();toast('Notes saved locally');});
$('openVoice').addEventListener('click',()=>{chrome.tabs.create({url:'https://voice.google.com/u/0/messages'});toast('Open customer conversation and send manually');});
(async()=>{const data=await chrome.storage.local.get('boostMessaging');if(data.boostMessaging&&Array.isArray(data.boostMessaging.contacts)){state={contacts:data.boostMessaging.contacts,templates:Array.isArray(data.boostMessaging.templates)?data.boostMessaging.templates:DEFAULT_TEMPLATES,drafts:data.boostMessaging.drafts||{}};}renderAll();})();