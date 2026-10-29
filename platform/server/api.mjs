import {publicPlans,selectPlan,fitsPlan} from './plans.mjs';
import * as F from './team-features.mjs';
import {websiteEnquiry} from './website-enquiries.mjs';
import {jobPhotoKey,decodeJobPhoto,prepareJobPhoto} from './job-photos.mjs';
import {EmailProblem,assertRecipientAvailable,authoriseDispatcher,emailConfig,prepareDelivery,enqueueStatement,deliveryHistory,dispatchEmails,emailWebhook} from './invoice-delivery.mjs';
import {health} from './health.mjs';
import {billingConfig,liveVerificationConfig,stripeClient,startTrial,entitlement,checkout,portal,webhook,assertDeletable,SubscriptionProblem,TERMS_VERSION,assertServiceTerms,serviceTermsAccepted,acceptServiceTerms} from './subscriptions.mjs';
import {createBusinessBackup,prepareBusinessRestore,BACKUP_LIMIT} from './business-backup.mjs';
import {photoKey,decodePhoto,setStaffPhoto} from './staff-photos.mjs';
import {saveSupplier,issueInvoice,creditInvoice,assertFinancialRestore} from './billing.mjs';
import * as D from './domain.mjs';
import {mayCreateWorkspace} from './enrollment.mjs';
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
class Problem extends Error{constructor(status,message){super(message);this.status=status}}
const problem=(status,message)=>{throw new Problem(status,message)};
const empty=()=>({version:1,customers:[],staff:[],jobs:[],invoices:[],audit:[]});
const id=()=>crypto.randomUUID();
const today=now=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
const hashToken=async token=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(b=>b.toString(16).padStart(2,'0')).join('');
const validId=v=>typeof v==='string'&&/^[\w-]{1,100}$/.test(v);
const manager=m=>{if(m.role!=='manager')problem(403,'Manager access required.')};
function project(state,m){
 if(m.role==='manager')return state;
 const jobs=state.jobs.filter(j=>j.staffId===m.staff_id).map(({price,invoiceId,quoteId,...j})=>j);
 const customerIds=new Set(jobs.map(j=>j.customerId));
 return {version:1,jobs,customers:state.customers.filter(c=>customerIds.has(c.id)).map(({email,active,checklistTemplate,...c})=>c),staff:state.staff.filter(s=>s.id===m.staff_id),invoices:[],audit:[],availability:(state.availability||[]).filter(r=>r.staffId===m.staff_id),leaveRequests:(state.leaveRequests||[]).filter(r=>r.staffId===m.staff_id),notifications:F.notificationsFor(state,{role:m.role,staffId:m.staff_id})};
}
async function readBody(request,maximum=16384){
 if(!request.headers.get('content-type')?.startsWith('application/json'))problem(415,'Use JSON requests.');
 if(Number(request.headers.get('content-length')||0)>maximum)problem(413,'Request too large.');
 const reader=request.body?.getReader();if(!reader)problem(400,'JSON body required.');let size=0,chunks=[];
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>maximum){await reader.cancel();problem(413,'Request too large.')}chunks.push(value)}
 try{const bytes=new Uint8Array(size);let n=0;for(const c of chunks){bytes.set(c,n);n+=c.length}const value=JSON.parse(new TextDecoder().decode(bytes));if(!value||typeof value!=='object'||Array.isArray(value))problem(400,'JSON object required.');return value}catch(e){if(e instanceof Problem)throw e;problem(400,'Invalid JSON.');}
}
async function membership(db,workspace,user){
 if(!validId(workspace))problem(404,'Workspace not found.');
 const m=await db.prepare('SELECT * FROM memberships WHERE workspace_id = ? AND user_id = ?').bind(workspace,user).first();
 if(!m||!['manager','staff'].includes(m.role))problem(404,'Workspace not found.');return m;
}
async function load(db,workspace){const row=await db.prepare('SELECT * FROM workspaces WHERE id = ?').bind(workspace).first();if(!row)problem(404,'Workspace not found.');let state;try{state=JSON.parse(row.document)}catch{problem(503,'Workspace data needs recovery.')}if(!D.validateState(state))problem(503,'Workspace data needs recovery.');return {row,state}}
/** @param {Request} request @param {D1Database | undefined} db @param {{now?: () => Date, bucket?: R2Bucket, pilotEmails?: string, billingEnv?: Cloudflare.Env, billingClient?: any, emailDispatchLimit?: number}} [options] */
export async function handle(request,db,{now=()=>new Date(),bucket,pilotEmails,billingEnv={},billingClient,emailDispatchLimit=5}={}){
 try{
  if(new URL(request.url).pathname==='/api/quenvira/website-enquiry')return websiteEnquiry(request,{...billingEnv,BUCKET:bucket});
  if(new URL(request.url).pathname==='/api/quenvira/health')return health(request,db,{bucket,billingEnv});
  const requestPath=new URL(request.url).pathname;
  const billingPath=requestPath==='/api/quenvira/subscription-webhook';
  if(requestPath==='/api/quenvira/subscription-webhook/live'){
   const config=liveVerificationConfig(billingEnv);
   return json(await webhook(request,undefined,config,config?(billingClient||await stripeClient(config)):null));
  }
  // Webhooks authenticate their raw body independently of browser identity/CSRF.
  if(requestPath==='/api/quenvira/email-dispatch'){await authoriseDispatcher(request,billingEnv);return json(await dispatchEmails(db,emailConfig(billingEnv),{now}))}
  if(requestPath==='/api/quenvira/email-webhook')return json(await emailWebhook(request,db,billingEnv,{now}));
  if(billingPath){const config=billingConfig(billingEnv);return json(await webhook(request,db,config,config?(billingClient||await stripeClient(config)):null))}
  // Sites dispatch must overwrite identity headers and keep the Worker origin private.
  const user=request.headers.get('oai-authenticated-user-id');
  const email=request.headers.get('oai-authenticated-user-email');
  if(!user||!email)problem(401,'Sign in with ChatGPT to continue.');
  if(!db)problem(503,'Persistent storage is not configured.');
  const url=new URL(request.url),path=url.pathname.replace(/^\/api\/quenvira\/?/,'').split('/').filter(Boolean);
  const timestamp=now().toISOString(),asOf=today(new Date(timestamp));
  const config=billingConfig(billingEnv);let client=billingClient;
  const getClient=async()=>client||(client=await stripeClient(config));
  if(!['GET','POST'].includes(request.method))problem(405,'Method not allowed.');
  if(request.method==='POST'){
   if(request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site')problem(403,'Same-origin request required.');
  }
  if(path.length===1&&path[0]==='session'&&request.method==='GET'){
   const result=await db.prepare('SELECT w.id, w.name, m.role FROM workspaces w JOIN memberships m ON m.workspace_id = w.id WHERE m.user_id = ? ORDER BY w.created_at').bind(user).all();
   return json({user:{id:user,email},workspaces:result.results,today:asOf,documentMode:config?.mode==='live'?'live':'test',canCreateWorkspace:mayCreateWorkspace(email,pilotEmails)||!!config?.selfServe});
  }
  if(path.join('/')==='invitations/accept'&&request.method==='POST'){
   const body=await readBody(request);if(typeof body.token!=='string'||!/^[a-f0-9-]{72}$/.test(body.token))problem(400,'Invalid invitation.');
   const hash=await hashToken(body.token);
   const invitation=await db.prepare('SELECT * FROM invitations WHERE hash = ?').bind(hash).first();
   if(!invitation||invitation.email!==email.toLowerCase()||invitation.expires_at<=timestamp||(invitation.accepted_by&&invitation.accepted_by!==user))problem(403,'Invitation is unavailable for this account.');
   if(config?.plans){const access=await entitlement(db,invitation.workspace_id,config,await getClient(),Date.parse(timestamp));if(!access.canWrite||!access.staffAccess)problem(403,'This plan does not allow staff sign-in. Ask the manager to review the subscription.');}
   const {state}=await load(db,invitation.workspace_id);if(!state.staff.some(s=>s.id===invitation.staff_id))problem(409,'This staff record is no longer available.');
   const existing=await db.prepare('SELECT * FROM memberships WHERE workspace_id = ? AND user_id = ?').bind(invitation.workspace_id,user).first();
   if(existing&&(existing.role!=='staff'||existing.staff_id!==invitation.staff_id))problem(409,'This account already has a different membership.');
   await db.batch([
    db.prepare("INSERT OR IGNORE INTO memberships (workspace_id,user_id,role,staff_id) SELECT workspace_id,?,'staff',staff_id FROM invitations WHERE hash = ? AND email = ? AND expires_at > ? AND (accepted_by IS NULL OR accepted_by = ?)").bind(user,hash,email.toLowerCase(),timestamp,user),
    db.prepare('UPDATE invitations SET accepted_by = ? WHERE hash = ? AND accepted_by IS NULL AND EXISTS (SELECT 1 FROM memberships WHERE workspace_id = ? AND user_id = ? AND staff_id = ?)').bind(user,hash,invitation.workspace_id,user,invitation.staff_id)
   ]);
   await membership(db,invitation.workspace_id,user);return json({workspaceId:invitation.workspace_id});
  }
  if(path.length===1&&path[0]==='workspaces'&&request.method==='POST'){
   const body=await readBody(request);if(typeof body.name!=='string'||!body.name.trim()||body.name.length>100)problem(400,'Business name must be 1–100 characters.');
   if(!mayCreateWorkspace(email,pilotEmails)&&!config?.selfServe)problem(403,'New business workspaces are currently invitation-only. Explore the public demo or contact ccscreativetech@gmail.com to request pilot access.');
   if(config?.mode==='live')assertServiceTerms(body,config.termsVersion);
   // Stable per-user creation ID makes retries create at most one initial workspace.
   const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(user));
   const workspace='w-'+Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
   await db.batch([
    db.prepare('INSERT OR IGNORE INTO workspaces (id,name,revision,document,created_at,updated_at) VALUES (?,?,0,?,?,?)').bind(workspace,body.name.trim(),JSON.stringify(empty()),timestamp,timestamp),
    db.prepare("INSERT OR IGNORE INTO memberships (workspace_id,user_id,role,staff_id) VALUES (?,?,'manager',NULL)").bind(workspace,user)
   ]);if(config)await startTrial(db,workspace,timestamp);if(config?.mode==='live')await acceptServiceTerms(db,workspace,user,body,timestamp,config.termsVersion);return json({workspaceId:workspace},201);
  }
  if(path.length<2||path[0]!=='workspaces')problem(404,'Route not found.');
  const workspace=path[1],m=await membership(db,workspace,user);
  const {row,state}=await load(db,workspace);
  let planAccess;
  const access=async()=>planAccess||(planAccess=await entitlement(db,workspace,config,await getClient(),Date.parse(timestamp)));
  if(config?.plans&&m.role==='staff'&&!(await access()).staffAccess)problem(403,'Staff access is unavailable on this plan. Ask your manager to review the subscription.');
  if(path.length===3&&path[2]==='subscription'){
   manager(m);
   if(request.method==='GET')return json(config?{enabled:true,mode:config.mode,...(config.plans?{plans:publicPlans(config)}:{}),termsVersion:config.termsVersion||TERMS_VERSION,termsAccepted:await serviceTermsAccepted(db,workspace,config.termsVersion),...await entitlement(db,workspace,config,await getClient(),Date.parse(timestamp))}:{enabled:false,status:'pilot',canWrite:true});
   const body=await readBody(request);
   if(!config)problem(503,'Subscriptions are not activated.');
   if(body.action==='accept-terms'){assertServiceTerms(body,config.termsVersion);await startTrial(db,workspace,timestamp);return json(await acceptServiceTerms(db,workspace,user,body,timestamp,config.termsVersion))}
   if(body.action==='checkout')return json(await checkout(db,workspace,email,body,config,await getClient(),timestamp));
   if(body.action==='portal')return json(await portal(db,workspace,config,await getClient()));
   problem(400,'Unknown subscription action.');
  }
  // An expired subscription keeps read/export, revocation and deletion paths.
  // Paid workflow mutations require a fresh authoritative provider check.
  const needsEntitlement=request.method==='POST'&&(path[2]==='commands'||path[2]==='invitations'||path[2]==='email-dispatch');
  if(config&&needsEntitlement){
   const permittedMaintenance=path[2]==='invitations'&&(await readBody(request.clone())).revoke;
   const recovery=path[2]==='commands'&&path[3]==='backup';
   if(config.mode==='live'&&!permittedMaintenance&&!recovery&&!await serviceTermsAccepted(db,workspace,config.termsVersion))problem(403,'A manager must accept the current business terms in Settings before editing. Viewing and exports remain available.');
   if(!permittedMaintenance&&!recovery&&!(await access()).canWrite)problem(402,planAccess.overLimit?'Existing staff records or access exceed the current plan. Records and exports remain available; contact support before changing the plan.':'Your trial or subscription has ended. A manager can manage the subscription in Settings. Records and exports remain available.');
  }
  if(path.length===3&&path[2]==='email-history'&&request.method==='GET'){manager(m);return json({configured:!!emailConfig(billingEnv),deliveries:await deliveryHistory(db,workspace)})}
  if(path.length===3&&path[2]==='email-dispatch'&&request.method==='POST'){manager(m);return json(await dispatchEmails(db,emailConfig(billingEnv),{now,workspace,limit:emailDispatchLimit}))}
  if(path.length===2&&request.method==='GET')return json({workspaceId:workspace,name:row.name,revision:row.revision,actor:{role:m.role,staffId:m.staff_id},today:asOf,documentMode:config?.mode==='live'?'live':'test',state:project(state,m)});
  if(path.length===3&&path[2]==='backup-file'&&request.method==='GET'){manager(m);try{return json(await createBusinessBackup(state,row.name,workspace,bucket,timestamp))}catch(e){const safe=['Photo storage is unavailable. A complete backup could not be created.','A staff photo is unavailable. A complete backup could not be created.','A job photo is unavailable. A complete backup could not be created.','Backup exceeds the 20 MB limit.'];problem(503,safe.includes(e.message)?e.message:'A complete business backup could not be created. Try again or contact support.')}}
  if(path.length===6&&path[2]==='jobs'&&path[4]==='photos'&&request.method==='GET'){
   const j=state.jobs.find(j=>j.id===path[3]&&(m.role==='manager'||j.staffId===m.staff_id));
   if(!j?.photos?.some(p=>p.id===path[5]))problem(404,'Job photo not found.');if(!bucket)problem(503,'Photo storage is unavailable.');
   const photo=await bucket.get(jobPhotoKey(workspace,j.id,path[5]));if(!photo)problem(404,'Job photo not found.');
   return new Response(photo.body,{headers:{'Content-Type':'image/jpeg','Cross-Origin-Resource-Policy':'same-origin','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'",'Referrer-Policy':'no-referrer'}});
  }
  if(path.length===5&&path[2]==='staff'&&path[4]==='photo'&&request.method==='GET'){
   const staff=state.staff.find(s=>s.id===path[3]);if(!staff||m.role!=='manager'&&m.staff_id!==staff.id)problem(404,'Staff photo not found.');
   if(!staff.photoId)problem(404,'Staff photo not found.');if(!bucket)problem(503,'Photo storage is unavailable.');
   const photo=await bucket.get(photoKey(workspace,staff.id,staff.photoId));if(!photo)problem(404,'Staff photo not found.');
   return new Response(photo.body,{headers:{'Content-Type':'image/jpeg','Cross-Origin-Resource-Policy':'same-origin','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'",'Referrer-Policy':'no-referrer'}});
  }
  if(path.length===3&&path[2]==='delete'&&request.method==='POST'){
   manager(m);if(config)await assertDeletable(db,workspace,await getClient());const body=await readBody(request);if(body.confirmName!==row.name)problem(400,'Business name does not match.');
   const removed=await db.batch([db.prepare("DELETE FROM workspaces WHERE id = ? AND EXISTS (SELECT 1 FROM memberships WHERE workspace_id = workspaces.id AND user_id = ? AND role = 'manager') RETURNING id").bind(workspace,user)]);if(!removed[0].results?.length)problem(403,'Manager access changed. Reload before editing.');
   let photoCleanupPending=false;
   if(bucket){try{let cursor;do{const page=await bucket.list({prefix:workspace+'/',limit:1000,...(cursor?{cursor}:{})});if(page.objects.length)await bucket.delete(page.objects.map(o=>o.key));cursor=page.truncated?page.cursor:undefined;}while(cursor)}catch{photoCleanupPending=true;console.error('Quenvira photo cleanup requires operator attention.');}}
   return json({deleted:true,photoCleanupPending});
  }
  if(path.length===3&&path[2]==='invitations'){
   manager(m);
   if(request.method==='GET'){
    const rows=await db.prepare('SELECT hash, email, staff_id, expires_at, accepted_by FROM invitations WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 50').bind(workspace).all();
    return json({invitations:rows.results});
   }
   const body=await readBody(request);
   if(body.revoke){
    const invite=await db.prepare('SELECT * FROM invitations WHERE workspace_id = ? AND hash = ?').bind(workspace,body.revoke).first();if(!invite)problem(404,'Invitation not found.');
    const revoked=await db.batch([
     db.prepare("DELETE FROM memberships WHERE workspace_id = ? AND role = 'staff' AND staff_id = ? AND user_id IN (SELECT accepted_by FROM invitations WHERE workspace_id = ? AND staff_id = ? AND email = ?) AND EXISTS (SELECT 1 FROM memberships AS authority WHERE authority.workspace_id = ? AND authority.user_id = ? AND authority.role = 'manager')").bind(workspace,invite.staff_id,workspace,invite.staff_id,invite.email,workspace,user),
     db.prepare("DELETE FROM invitations WHERE workspace_id = ? AND staff_id = ? AND email = ? AND EXISTS (SELECT 1 FROM memberships WHERE workspace_id = ? AND user_id = ? AND role = 'manager')").bind(workspace,invite.staff_id,invite.email,workspace,user),
     db.prepare("INSERT INTO events (workspace_id,id,user_id,action,created_at) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM memberships WHERE workspace_id = ? AND user_id = ? AND role = 'manager') RETURNING id").bind(workspace,id(),user,'member.revoke',timestamp,workspace,user)
    ]);if(!revoked[2].results?.length)problem(403,'Manager access changed. Reload before editing.');return json({revoked:true});
   }
   if(config?.plans&&!(await access()).staffAccess)problem(403,'Solo is for the owner only. Choose Team before inviting staff.');
   if(typeof body.email!=='string'||body.email.length>150||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)||!state.staff.some(s=>s.id===body.staffId))problem(400,'Choose a staff member and valid account email.');
   const pending=await db.prepare('SELECT COUNT(*) AS n FROM invitations WHERE workspace_id = ? AND expires_at > ? AND accepted_by IS NULL').bind(workspace,timestamp).first();if(pending.n>=20)problem(429,'Revoke unused invitations before creating more.');
   const token=id()+id(),hash=await hashToken(token),expiresAt=new Date(new Date(timestamp).getTime()+7*86400000).toISOString();
   const invited=await db.batch([
    db.prepare("INSERT INTO invitations (hash,workspace_id,email,staff_id,expires_at,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM memberships WHERE workspace_id = ? AND user_id = ? AND role = 'manager') AND (SELECT COUNT(*) FROM invitations WHERE workspace_id = ? AND expires_at > ? AND accepted_by IS NULL) < 20 RETURNING hash").bind(hash,workspace,body.email.toLowerCase(),body.staffId,expiresAt,timestamp,workspace,user,workspace,timestamp),
    db.prepare('INSERT INTO events (workspace_id,id,user_id,action,created_at) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM invitations WHERE workspace_id = ? AND hash = ?)').bind(workspace,id(),user,'member.invite',timestamp,workspace,hash)
   ]);if(!invited[0].results?.length){manager(await membership(db,workspace,user));problem(429,'Revoke unused invitations before creating more.');}return json({token,expiresAt},201);
  }
  if(path.length===3&&path[2]==='backups'&&request.method==='GET'){
   manager(m);const result=await db.prepare('SELECT revision, created_at FROM history WHERE workspace_id = ? ORDER BY revision DESC LIMIT 20').bind(workspace).all();return json({backups:result.results});
  }
  const importCommand=path.length===4&&path[2]==='commands'&&path[3]==='backup';
  const photoCommand=path.length===4&&path[2]==='commands'&&path[3]==='photo';
  if(!(path.length===3&&path[2]==='commands'||photoCommand||importCommand)||request.method!=='POST')problem(404,'Route not found.');
  if(importCommand)manager(m);
  const body=await readBody(request,importCommand?BACKUP_LIMIT+1024:photoCommand?360000:16384);
  if(photoCommand!==(['staff.photo','job.photo'].includes(body.action))||importCommand!==(body.action==='backup.import'))problem(400,'Use the correct command endpoint.');
  if(!validId(body.requestId)||!Number.isSafeInteger(body.revision)||body.revision<0||typeof body.action!=='string'||!body.data||typeof body.data!=='object'||Array.isArray(body.data))problem(400,'Invalid command.');
  const requestHash=await hashToken(JSON.stringify({revision:body.revision,action:body.action,data:body.data}));
  const prior=await db.prepare('SELECT user_id, response FROM operations WHERE workspace_id = ? AND id = ?').bind(workspace,body.requestId).first();
  if(prior){if(prior.user_id!==user)problem(409,'Request ID already used.');const {_requestHash,...replay}=JSON.parse(prior.response);if(_requestHash&&_requestHash!==requestHash)problem(409,'Request ID was already used for a different command.');return json({...replay,result:m.role==='manager'?replay.result:null,replayed:true})}
  const recent=await db.prepare('SELECT COUNT(*) AS n FROM operations WHERE workspace_id = ? AND user_id = ? AND created_at >= ?').bind(workspace,user,new Date(new Date(timestamp).getTime()-60000).toISOString()).first();if(recent.n>=120)problem(429,'Too many updates. Wait a minute and try again.');
  if(body.revision!==row.revision)problem(409,'Workspace changed. Reload and try again.');
  const before=structuredClone(state);const data=body.data,actor={role:m.role,staffId:m.staff_id};let result=null,emailDelivery=null,emailInvoiceId=null;
  try{
   switch(body.action){
    case 'availability.save':result=F.saveAvailability(state,actor,data,asOf);break;
    case 'leave.request':result=F.requestLeave(state,actor,data,asOf);break;
    case 'leave.decide':result=F.decideLeave(state,actor,data);break;
    case 'notification.read':result=F.readNotification(state,actor,data.id,timestamp);break;
    case 'quote.save':result=F.saveQuote(state,actor,data,asOf);break;
    case 'quote.action':result=F.quoteAction(state,actor,data,asOf,config?.mode);break;
    case 'job.photo':{
     const upload=prepareJobPhoto(state,actor,data,timestamp);
     if(upload){if(!bucket)problem(503,'Photo storage is unavailable.');const bytes=decodeJobPhoto(data.jpegBase64),photoId=await hashToken(data.jpegBase64);
      upload.id=photoId;if(state.jobs.find(j=>j.id===data.id).photos.some(p=>p!==upload&&p.id===photoId))problem(400,'This photo is already attached.');
      try{await bucket.put(jobPhotoKey(workspace,data.id,photoId),bytes,{httpMetadata:{contentType:'image/jpeg'}})}catch{problem(503,'Photo could not be saved. Try again.');}
     }result={saved:true};break;
    }
    case 'customer.save':result=D.saveCustomer(state,actor,data,data.id);break;
    case 'customer.archive':D.archiveCustomer(state,actor,data.id);break;
    case 'staff.photo':{
     manager(m);if(!state.staff.some(s=>s.id===data.id))problem(404,'Staff member not found.');
     if(data.jpegBase64===null){result=setStaffPhoto(state,actor,data.id,null);break}
     if(!bucket)problem(503,'Photo storage is unavailable.');
     const bytes=decodePhoto(data.jpegBase64),photoId=await hashToken(data.jpegBase64);
     try{await bucket.put(photoKey(workspace,data.id,photoId),bytes,{httpMetadata:{contentType:'image/jpeg'}})}catch{problem(503,'Photo could not be saved. Try again.');}
     result=setStaffPhoto(state,actor,data.id,photoId);break;
    }
    case 'staff.add':result=D.addStaff(state,actor,data);break;
    case 'staff.update':result=D.updateStaff(state,actor,data,asOf);break;
    case 'job.save':result=D.saveJob(state,actor,data,data.id);break;
    case 'job.series':result=D.updateSeries(state,actor,data,asOf);break;
    case 'job.update':{
     const job=D.getJob(state,actor,data.id);
     if(data.action==='start'&&job.date>asOf)problem(400,'Future visits cannot be started.');
     D.updateJob(state,actor,data.id,data.action,data.value);
     if(data.action==='complete'&&state.supplier?.autoDraftInvoices&&!job.invoiceId){
      // Manager opt-in authorises this server-owned draft operation, including
      // visits completed by assigned staff. Commit it atomically with the visit;
      // never return financial details to staff. A separate manager email
      // policy may issue and queue; provider dispatch is always separate.
      const invoice=D.createInvoice(state,{role:'manager'},job.id,state.supplier.autoDraftVat,asOf);
      if(state.supplier.autoEmailInvoices){
       const beforeIssue=structuredClone(invoice),beforeAudit=structuredClone(state.audit);
       try{issueInvoice(state,{role:'manager'},invoice.id,asOf,config?.mode==='live'?'live':'test');emailDelivery=prepareDelivery(state,invoice.id,emailConfig(billingEnv));await assertRecipientAvailable(db,workspace,emailDelivery);emailInvoiceId=invoice.id}
       catch{emailDelivery=null;emailInvoiceId=null;for(const key of Object.keys(invoice))delete invoice[key];Object.assign(invoice,beforeIssue);state.audit=beforeAudit;state.audit.unshift({at:timestamp,actor:'System',message:'Automatic invoice email needs manager attention. Check recipient and email configuration.'});state.audit=state.audit.slice(0,200)}
      }
     }
     break;
    }
    case 'supplier.save':result=saveSupplier(state,actor,data);break;
    case 'invoice.email.queue':manager(m);emailDelivery=prepareDelivery(state,data.id,emailConfig(billingEnv));await assertRecipientAvailable(db,workspace,emailDelivery);emailInvoiceId=data.id;state.audit.unshift({at:timestamp,actor:'Manager',message:'Queued invoice email for '+state.invoices.find(i=>i.id===data.id).number});state.audit=state.audit.slice(0,200);break;
    case 'invoice.issue':result=issueInvoice(state,actor,data.id,asOf,config?.mode==='live'?'live':'test');break;
    case 'invoice.credit':result=creditInvoice(state,actor,data.id,data.reason,asOf);break;
    case 'invoice.create':result=D.createInvoice(state,actor,data.jobId,Number(data.vat||0),asOf);break;
    case 'invoice.paid':D.markPaid(state,actor,data.id,asOf);break;
    case 'backup.import':{manager(m);const restored=await prepareBusinessRestore(state,actor,data.backup,workspace,bucket,hashToken);Object.assign(state,restored);result={restored:true,photos:data.backup.photos.length};break;}
    case 'backup.restore':{
     manager(m);if(!Number.isSafeInteger(data.revision)||data.revision<0)problem(400,'Choose a backup revision.');
     const backup=await db.prepare('SELECT document FROM history WHERE workspace_id = ? AND revision = ?').bind(workspace,data.revision).first();
     if(!backup)problem(404,'Backup not found.');const restored=JSON.parse(backup.document);
     if(!D.validateState(restored))problem(400,'Backup is invalid.');assertFinancialRestore(state,restored);F.assertFeatureRestore(state,restored);
     for(const key of ['supplier','quotes','availability','leaveRequests','notifications'])if(restored[key]===undefined)delete state[key];Object.assign(state,restored);
     state.audit.unshift({at:timestamp,actor:'Manager',message:'Restored revision '+data.revision});state.audit=state.audit.slice(0,200);break;
    }
    default:problem(400,'Unknown command.');
   }
  }catch(e){if(e instanceof Problem||e instanceof EmailProblem)throw e;if(e.backupStorage)problem(503,e.message);problem(/Manager|not assigned/.test(e.message)?403:400,e.message)}
  if(['job.save','job.series','job.update','quote.action'].includes(body.action))F.assignmentNotifications(state,before);
  if(config?.plans){const a=await access(),plan=selectPlan(config,a.plan);const members=await db.prepare("SELECT COUNT(*) AS n FROM memberships WHERE workspace_id=? AND role='staff'").bind(workspace).first();if(!plan||!fitsPlan(state,members.n,plan))problem(409,'This update exceeds the current plan allowance. No records were changed.');}
  if(!D.validateState(state))problem(400,'Operation would create invalid records.');
  const document=JSON.stringify(state);if(new TextEncoder().encode(document).byteLength>524288)problem(413,'Workspace storage limit reached. Export your records and contact support.');
  const reply={revision:row.revision+1,result};
  const statements=[
   db.prepare("INSERT INTO history (workspace_id,revision,document,created_at) SELECT id,revision,document,? FROM workspaces WHERE id = ? AND revision = ? AND EXISTS (SELECT 1 FROM memberships WHERE workspace_id = ? AND user_id = ? AND role = ? AND COALESCE(staff_id,'') = ?)").bind(timestamp,workspace,row.revision,workspace,user,m.role,m.staff_id||''),
   db.prepare("UPDATE workspaces SET document = ?, revision = revision + 1, last_operation = ?, updated_at = ? WHERE id = ? AND revision = ? AND EXISTS (SELECT 1 FROM memberships WHERE workspace_id = ? AND user_id = ? AND role = ? AND COALESCE(staff_id,'') = ?) RETURNING revision").bind(document,body.requestId,timestamp,workspace,row.revision,workspace,user,m.role,m.staff_id||''),
   db.prepare('INSERT INTO operations (workspace_id,id,user_id,response,created_at) SELECT id,?,?,?,? FROM workspaces WHERE id = ? AND last_operation = ?').bind(body.requestId,user,JSON.stringify({...reply,_requestHash:requestHash}),timestamp,workspace,body.requestId),
   db.prepare('INSERT INTO events (workspace_id,id,user_id,action,created_at) SELECT id,?,?,?,? FROM workspaces WHERE id = ? AND last_operation = ?').bind(body.requestId,user,body.action,timestamp,workspace,body.requestId),
   db.prepare('DELETE FROM history WHERE workspace_id = ? AND revision < ?').bind(workspace,Math.max(0,row.revision-19))
  ];
  if(emailDelivery)statements.push(enqueueStatement(db,workspace,body.requestId,emailInvoiceId,emailDelivery,timestamp));
  const committed=await db.batch(statements);
  if(!committed[1].results?.length){const current=await membership(db,workspace,user);if(current.role!==m.role||current.staff_id!==m.staff_id)problem(403,'Your access changed. Reload before editing.');problem(409,'Workspace changed. Reload and try again.');}
  return json(reply);
 }catch(e){
  // Record bounded provider diagnostics, never the request, headers or key.
  if(typeof e.type==='string'&&/^Stripe[A-Za-z]+Error$/.test(e.type)){
   // Provider messages/parameters can echo customer input, signing secrets or
   // payment tokens. Log only bounded diagnostic fields, never free-form text.
   const requestId=typeof e.requestId==='string'&&/^req_[A-Za-z0-9]{1,100}$/.test(e.requestId)?e.requestId:undefined;
   const status=Number.isInteger(e.statusCode)&&e.statusCode>=400&&e.statusCode<=599?e.statusCode:undefined;
   console.error('Quenvira Stripe request failed',JSON.stringify({type:e.type.slice(0,80),requestId,status}));
  }
  return json({error:e instanceof Problem||e instanceof SubscriptionProblem||e instanceof EmailProblem?e.message:'Service temporarily unavailable.',code:e instanceof Problem||e instanceof SubscriptionProblem||e instanceof EmailProblem?e.status:503},e instanceof Problem||e instanceof SubscriptionProblem||e instanceof EmailProblem?e.status:503)
 }
}
