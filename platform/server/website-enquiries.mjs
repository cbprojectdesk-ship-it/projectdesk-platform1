// CCS contact mail is isolated from customer invoices, workspaces and billing.
const ORIGINS=new Set(['https://ccscreativetech.co.uk','https://www.ccscreativetech.co.uk','https://ccs-creative-technologies.sprogg1973.chatgpt.site']);
const RECIPIENT='ccscreativetech@gmail.com';
const SERVICES=new Set(['Website design','Website repair or review','App creation','Staff and shift management','Customer and job scheduling','Website maintenance','Industry-specific software','Quenvira enquiry','Kivza Care enquiry','Kivza Employee enquiry','Kivza enquiry','Garage Manager enquiry','Something else']);
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');
class ContactProblem extends Error{constructor(status,message){super(message);this.status=status}}
const fail=(status,message)=>{throw new ContactProblem(status,message)};
const str=(v,max,required=false)=>{if(v===undefined&&!required)return '';if(typeof v!=='string'||v.length>max||required&&!v.trim())fail(400,'Please check the enquiry fields.');return v.trim()};
async function readBody(request){
 if(!request.headers.get('content-type')?.startsWith('application/json'))fail(415,'Use JSON.');
 const reader=request.body?.getReader();if(!reader)fail(400,'Enquiry required.');let size=0,chunks=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>12000){await reader.cancel();fail(413,'Enquiry too large.')}chunks.push(value)}
 const bytes=new Uint8Array(size);let n=0;for(const c of chunks){bytes.set(c,n);n+=c.length}
 let body;try{body=JSON.parse(new TextDecoder().decode(bytes))}catch{fail(400,'Invalid enquiry.')}
 if(!body||typeof body!=='object'||Array.isArray(body))fail(400,'Invalid enquiry.');return body;
}
function clean(body){
 if(str(body._honey,1000))fail(400,'Please check the enquiry.');
 const name=str(body.name,100,true),email=str(body.email,200,true),service=str(body.service,100,true),message=str(body.message,5000,true),business=str(body.business,150),website=str(body.website,500);
 if(/[\r\n]/.test(name)||!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email)||!SERVICES.has(service)||message.length<10)fail(400,'Please check the enquiry fields.');
 if(website){let url;try{url=new URL(website)}catch{fail(400,'Check the website address.')}if(!['http:','https:'].includes(url.protocol))fail(400,'Check the website address.')}
 const tag=v=>str(v,100).replace(/[^a-zA-Z0-9 _.-]/g,'');
 return {name,email,service,message,business,website,source:tag(body.enquiry_source),medium:tag(body.enquiry_medium),campaign:tag(body.enquiry_campaign)};
}
async function reserveQuota(bucket,day,ip,units=1){
 const key='ccs-contact/quota/'+day+'.json';const ipHash=await digest(day+':'+ip);
 for(let attempt=0;attempt<5;attempt++){
  const prior=await bucket.get(key);const state=prior?await prior.json():{version:1,total:0,ips:{}};
  if(state.version!==1||!Number.isInteger(state.total)||!state.ips||typeof state.ips!=='object')fail(503,'Enquiry service needs attention. Please email us.');
  if(state.total+units>5||(state.ips[ipHash]||0)>=2)fail(429,'Our form limit has been reached. Please use Email us instead.');
  state.total+=units;state.ips[ipHash]=(state.ips[ipHash]||0)+1;
  const saved=await bucket.put(key,JSON.stringify(state),{onlyIf:prior?{etagMatches:prior.etag}:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}});
  if(saved)return;
 }
 fail(503,'The enquiry service is busy. Please email us.');
}
async function prune(bucket,timestamp){
 // Only this isolated prefix contains non-content contact metadata; never list app files.
 const cutoff=new Date(timestamp-7*86400000).toISOString().slice(0,10);
 for(const prefix of ['ccs-contact/requests/','ccs-contact/quota/']){
  const page=await bucket.list({prefix,limit:20});const old=page.objects.filter(o=>o.key.slice(prefix.length,prefix.length+10)<cutoff).map(o=>o.key);
  if(old.length)await bucket.delete(old);
 }
}
export async function websiteEnquiry(request,env,{fetcher=fetch,now=()=>new Date()}={}){
 const origin=request.headers.get('origin');const allowed=ORIGINS.has(origin||'');
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'};
 if(allowed){headers['Access-Control-Allow-Origin']=origin;headers['Access-Control-Allow-Methods']='POST, OPTIONS';headers['Access-Control-Allow-Headers']='Content-Type';headers['Access-Control-Max-Age']='600'}
 const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
 const receipt=(reference,record)=>reply({success:true,reference,...(record.confirmation?{confirmation:record.confirmation}:{})});
 try{
  if(!allowed)fail(403,'This enquiry must come from the CCS website.');
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')fail(405,'Method not allowed.');
  const allowlist=(env.QUENVIRA_EMAIL_TEST_RECIPIENTS||'').split(',').map(s=>s.trim().toLowerCase());
  if(env.CCS_WEBSITE_ENQUIRIES!=='yes'||!env.RESEND_API_KEY||env.QUENVIRA_EMAIL_FROM!=='invoices@mail.ccscreativetech.co.uk'||!allowlist.includes(RECIPIENT)||!env.BUCKET)fail(503,'Enquiry sending is not configured. Please email us.');
  const body=await readBody(request),fields=clean(body),requestId=str(body.requestId,70,true),timestamp=now().getTime(),day=new Date(timestamp).toISOString().slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}_[a-f0-9-]{36}$/.test(requestId))fail(400,'Please refresh the page before sending.');
  const createdDay=requestId.slice(0,10),createdTime=Date.parse(createdDay+'T00:00:00Z');
  if(!Number.isFinite(createdTime)||createdTime>timestamp||timestamp-createdTime>7*86400000)fail(400,'Please refresh the page before sending.');
  const key='ccs-contact/requests/'+requestId+'.json',bodyHash=await digest(JSON.stringify(fields)),prior=await env.BUCKET.get(key);
  if(prior){const existing=await prior.json();if(existing.hash!==bodyHash)fail(409,'This enquiry reference was already used. Please refresh before sending a new enquiry.');if(existing.state==='accepted')return receipt(requestId,existing);fail(409,'The earlier delivery is not confirmed. Please email us and mention the enquiry reference.');}
  if(createdDay!==day)fail(400,'Please refresh the page before sending.');
  await prune(env.BUCKET,timestamp);
  // Confirmations are staged only for the existing owner-approved test allowlist.
  // Reserve both attempts up front: contact mail stays within five provider
  // attempts per UTC day, including confirmations and uncertain responses.
  const confirm=env.CCS_WEBSITE_CONFIRMATIONS==='test'&&allowlist.includes(fields.email.toLowerCase());
  await reserveQuota(env.BUCKET,day,request.headers.get('cf-connecting-ip')||'unknown',confirm?2:1);
  const record={version:1,hash:bodyHash,state:'pending',createdAt:new Date(timestamp).toISOString()};
  const claimed=await env.BUCKET.put(key,JSON.stringify(record),{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}});
  if(!claimed)fail(409,'This enquiry is already being processed. Please wait.');
  const text=`CCS website enquiry\nReference: ${requestId}\nName: ${fields.name}\nEmail: ${fields.email}\nBusiness: ${fields.business}\nService: ${fields.service}\nWebsite: ${fields.website}\nSource: ${fields.source}\nMedium: ${fields.medium}\nCampaign: ${fields.campaign}\n\n${fields.message}`;
  const payload={from:env.QUENVIRA_EMAIL_FROM,to:[RECIPIENT],reply_to:fields.email,subject:'CCS website enquiry: '+fields.service,text,tags:[{name:'source',value:'ccs-enquiry'}]};
  let result;
  try{const response=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'ccs-contact/'+requestId},body:JSON.stringify(payload),signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error('Provider unavailable');result=await response.json();if(typeof result.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(result.id))throw Error('Ambiguous response');}
  catch{record.state='unconfirmed';await env.BUCKET.put(key,JSON.stringify(record));fail(503,'Delivery could not be confirmed. Please email us and mention the enquiry reference.');}
  record.state='accepted';record.providerId=result.id;
  if(confirm)record.confirmation='pending';
  // Persist business acceptance before the separate acknowledgement. A crash or
  // repeated submit must never resend either message or claim inbox delivery.
  await env.BUCKET.put(key,JSON.stringify(record));
  if(confirm){
   const acknowledgement={from:env.QUENVIRA_EMAIL_FROM,to:[fields.email],reply_to:RECIPIENT,subject:'[CCS test] Enquiry received',text:`CCS Creative Technologies has received your enquiry.\nReference: ${requestId}\n\nThis confirms submission, not a quotation, contract or paid subscription. If you did not send an enquiry, you can ignore this message. Contact: ${RECIPIENT}`,tags:[{name:'source',value:'ccs-enquiry'}]};
   try{
    const response=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'ccs-contact-confirmation/'+requestId},body:JSON.stringify(acknowledgement),signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw Error();const accepted=await response.json();
    if(typeof accepted.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(accepted.id))throw Error();
    record.confirmation='accepted';record.confirmationProviderId=accepted.id;
   }catch{record.confirmation='unconfirmed'}
   await env.BUCKET.put(key,JSON.stringify(record));
  }
  return receipt(requestId,record);
 }catch(error){if(error instanceof ContactProblem)return reply({success:false,message:error.message},error.status);return reply({success:false,message:'Delivery could not be confirmed. Please use Email us instead.'},503)}
}
