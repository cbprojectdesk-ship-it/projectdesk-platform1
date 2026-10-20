import * as D from './domain.mjs';
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
 const jobs=state.jobs.filter(j=>j.staffId===m.staff_id).map(({price,invoiceId,...j})=>j);
 const customerIds=new Set(jobs.map(j=>j.customerId));
 return {version:1,jobs,customers:state.customers.filter(c=>customerIds.has(c.id)).map(({email,active,...c})=>c),staff:state.staff.filter(s=>s.id===m.staff_id),invoices:[],audit:[]};
}
async function readBody(request){
 if(!request.headers.get('content-type')?.startsWith('application/json'))problem(415,'Use JSON requests.');
 if(Number(request.headers.get('content-length')||0)>16384)problem(413,'Request too large.');
 const reader=request.body?.getReader();if(!reader)problem(400,'JSON body required.');let size=0,chunks=[];
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>16384){await reader.cancel();problem(413,'Request too large.')}chunks.push(value)}
 try{const bytes=new Uint8Array(size);let n=0;for(const c of chunks){bytes.set(c,n);n+=c.length}const value=JSON.parse(new TextDecoder().decode(bytes));if(!value||typeof value!=='object'||Array.isArray(value))problem(400,'JSON object required.');return value}catch(e){if(e instanceof Problem)throw e;problem(400,'Invalid JSON.');}
}
async function membership(db,workspace,user){
 if(!validId(workspace))problem(404,'Workspace not found.');
 const m=await db.prepare('SELECT * FROM memberships WHERE workspace_id = ? AND user_id = ?').bind(workspace,user).first();
 if(!m||!['manager','staff'].includes(m.role))problem(404,'Workspace not found.');return m;
}
async function load(db,workspace){const row=await db.prepare('SELECT * FROM workspaces WHERE id = ?').bind(workspace).first();if(!row)problem(404,'Workspace not found.');let state;try{state=JSON.parse(row.document)}catch{problem(503,'Workspace data needs recovery.')}if(!D.validateState(state))problem(503,'Workspace data needs recovery.');return {row,state}}
export async function handle(request,db,{now=()=>new Date()}={}){
 try{
  // Sites dispatch must overwrite identity headers and keep the Worker origin private.
  const user=request.headers.get('oai-authenticated-user-id');
  const email=request.headers.get('oai-authenticated-user-email');
  if(!user||!email)problem(401,'Sign in with ChatGPT to continue.');
  if(!db)problem(503,'Persistent storage is not configured.');
  const url=new URL(request.url),path=url.pathname.replace(/^\/api\/quenvira\/?/,'').split('/').filter(Boolean);
  const timestamp=now().toISOString(),asOf=today(new Date(timestamp));
  if(!['GET','POST'].includes(request.method))problem(405,'Method not allowed.');
  if(request.method==='POST'){
   if(request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site')problem(403,'Same-origin request required.');
  }
  if(path.length===1&&path[0]==='session'&&request.method==='GET'){
   const result=await db.prepare('SELECT w.id, w.name, m.role FROM workspaces w JOIN memberships m ON m.workspace_id = w.id WHERE m.user_id = ? ORDER BY w.created_at').bind(user).all();
   return json({user:{id:user,email},workspaces:result.results,today:asOf});
  }
  if(path.join('/')==='invitations/accept'&&request.method==='POST'){
   const body=await readBody(request);if(typeof body.token!=='string'||!/^[a-f0-9-]{72}$/.test(body.token))problem(400,'Invalid invitation.');
   const hash=await hashToken(body.token);
   const invitation=await db.prepare('SELECT * FROM invitations WHERE hash = ?').bind(hash).first();
   if(!invitation||invitation.email!==email.toLowerCase()||invitation.expires_at<=timestamp||(invitation.accepted_by&&invitation.accepted_by!==user))problem(403,'Invitation is unavailable for this account.');
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
   // Stable per-user creation ID makes retries create at most one initial workspace.
   const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(user));
   const workspace='w-'+Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
   await db.batch([
    db.prepare('INSERT OR IGNORE INTO workspaces (id,name,revision,document,created_at,updated_at) VALUES (?,?,0,?,?,?)').bind(workspace,body.name.trim(),JSON.stringify(empty()),timestamp,timestamp),
    db.prepare("INSERT OR IGNORE INTO memberships (workspace_id,user_id,role,staff_id) VALUES (?,?,'manager',NULL)").bind(workspace,user)
   ]);return json({workspaceId:workspace},201);
  }
  if(path.length<2||path[0]!=='workspaces')problem(404,'Route not found.');
  const workspace=path[1],m=await membership(db,workspace,user);
  const {row,state}=await load(db,workspace);
  if(path.length===2&&request.method==='GET')return json({workspaceId:workspace,name:row.name,revision:row.revision,actor:{role:m.role,staffId:m.staff_id},today:asOf,state:project(state,m)});
  if(path.length===3&&path[2]==='delete'&&request.method==='POST'){
   manager(m);const body=await readBody(request);if(body.confirmName!==row.name)problem(400,'Business name does not match.');
   const removed=await db.batch([db.prepare("DELETE FROM workspaces WHERE id = ? AND EXISTS (SELECT 1 FROM memberships WHERE workspace_id = workspaces.id AND user_id = ? AND role = 'manager') RETURNING id").bind(workspace,user)]);if(!removed[0].results?.length)problem(403,'Manager access changed. Reload before editing.');return json({deleted:true});
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
  if(path.length!==3||path[2]!=='commands'||request.method!=='POST')problem(404,'Route not found.');
  const body=await readBody(request);
  if(!validId(body.requestId)||!Number.isSafeInteger(body.revision)||body.revision<0||typeof body.action!=='string'||!body.data||typeof body.data!=='object'||Array.isArray(body.data))problem(400,'Invalid command.');
  const requestHash=await hashToken(JSON.stringify({revision:body.revision,action:body.action,data:body.data}));
  const prior=await db.prepare('SELECT user_id, response FROM operations WHERE workspace_id = ? AND id = ?').bind(workspace,body.requestId).first();
  if(prior){if(prior.user_id!==user)problem(409,'Request ID already used.');const {_requestHash,...replay}=JSON.parse(prior.response);if(_requestHash&&_requestHash!==requestHash)problem(409,'Request ID was already used for a different command.');return json({...replay,result:m.role==='manager'?replay.result:null,replayed:true})}
  const recent=await db.prepare('SELECT COUNT(*) AS n FROM operations WHERE workspace_id = ? AND user_id = ? AND created_at >= ?').bind(workspace,user,new Date(new Date(timestamp).getTime()-60000).toISOString()).first();if(recent.n>=120)problem(429,'Too many updates. Wait a minute and try again.');
  if(body.revision!==row.revision)problem(409,'Workspace changed. Reload and try again.');
  const data=body.data,actor={role:m.role,staffId:m.staff_id};let result=null;
  try{
   switch(body.action){
    case 'customer.save':result=D.saveCustomer(state,actor,data,data.id);break;
    case 'customer.archive':D.archiveCustomer(state,actor,data.id);break;
    case 'staff.add':result=D.addStaff(state,actor,data);break;
    case 'job.save':result=D.saveJob(state,actor,data,data.id);break;
    case 'job.series':result=D.updateSeries(state,actor,data,asOf);break;
    case 'job.update':{
     const job=D.getJob(state,actor,data.id);
     if(data.action==='start'&&job.date>asOf)problem(400,'Future visits cannot be started.');
     D.updateJob(state,actor,data.id,data.action,data.value);break;
    }
    case 'invoice.create':result=D.createInvoice(state,actor,data.jobId,Number(data.vat||0),asOf);break;
    case 'invoice.paid':D.markPaid(state,actor,data.id,asOf);break;
    case 'backup.restore':{
     manager(m);if(!Number.isSafeInteger(data.revision)||data.revision<0)problem(400,'Choose a backup revision.');
     const backup=await db.prepare('SELECT document FROM history WHERE workspace_id = ? AND revision = ?').bind(workspace,data.revision).first();
     if(!backup)problem(404,'Backup not found.');const restored=JSON.parse(backup.document);
     if(!D.validateState(restored))problem(400,'Backup is invalid.');Object.assign(state,restored);
     state.audit.unshift({at:timestamp,actor:'Manager',message:'Restored revision '+data.revision});state.audit=state.audit.slice(0,200);break;
    }
    default:problem(400,'Unknown command.');
   }
  }catch(e){if(e instanceof Problem)throw e;problem(/Manager|not assigned/.test(e.message)?403:400,e.message)}
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
  const committed=await db.batch(statements);
  if(!committed[1].results?.length){const current=await membership(db,workspace,user);if(current.role!==m.role||current.staff_id!==m.staff_id)problem(403,'Your access changed. Reload before editing.');problem(409,'Workspace changed. Reload and try again.');}
  return json(reply);
 }catch(e){return json({error:e instanceof Problem?e.message:'Service temporarily unavailable.',code:e instanceof Problem?e.status:503},e instanceof Problem?e.status:503)}
}
