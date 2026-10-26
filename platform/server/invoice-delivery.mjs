// Durable transactional outbox. Provider acceptance is never called delivery.
import {prepareInvoiceEmail} from '../public/invoice-email.js';
export class EmailProblem extends Error {constructor(status,message){super(message);this.status=status}}
const fail=(status,message)=>{throw new EmailProblem(status,message)};
const validEmail=value=>typeof value==='string'&&!!prepareInvoiceEmail({number:'QV-1001',net:0,tax:0,total:0,vat:0},value).href;
export function emailConfig(env={}){
 const mode=env.QUENVIRA_EMAIL_MODE;
 if(!['test','live'].includes(mode))return null;
 if(mode==='live'&&env.QUENVIRA_CUSTOMER_INVOICES_APPROVED!=='yes')return null;
 if(!validEmail(env.QUENVIRA_EMAIL_FROM)||!env.RESEND_API_KEY||!env.RESEND_WEBHOOK_SECRET)return null;
 return {mode,from:env.QUENVIRA_EMAIL_FROM,key:env.RESEND_API_KEY,webhookSecret:env.RESEND_WEBHOOK_SECRET,allowlist:(env.QUENVIRA_EMAIL_TEST_RECIPIENTS||'').split(',').map(s=>s.trim().toLowerCase()).filter(validEmail)};
}
export function prepareDelivery(state,invoiceId,config){
 if(!config)fail(503,'Automatic email is not configured. Your invoice remains saved.');
 const invoice=state.invoices.find(i=>i.id===invoiceId),job=state.jobs.find(j=>j.id===invoice?.jobId);
 if(!invoice?.issue||invoice.status!=='Issued'||job?.status!=='Completed')fail(400,'Only an authorised, unpaid issued invoice for a completed visit can be queued.');
 const to=state.customers.find(c=>c.id===invoice.customerId)?.email;
 if(!validEmail(to))fail(400,'Save a single valid customer email address before queueing.');
 if(config.mode==='test'&&!config.allowlist.includes(to.toLowerCase()))fail(403,'Test email is limited to owner-approved test recipients. No customer email was queued.');
 const mail=prepareInvoiceEmail(invoice,to);
 let text=mail.body;
 if(config.mode==='live')text=text.replace('PRIVATE TEST DOCUMENT — NOT FOR CUSTOMER USE\r\n','').replace('Private testing only. Do not use this document to request customer payment.','Please contact the supplier shown above with any invoice queries.');
 return {mode:config.mode,payload:JSON.stringify({from:config.from,to:[to],subject:(config.mode==='test'?'[Quenvira test] ':'')+mail.subject,text,reply_to:validEmail(invoice.issue.supplier.contact)?invoice.issue.supplier.contact:'ccscreativetech@gmail.com'})};
}
export function enqueueStatement(db,workspace,operation,invoiceId,delivery,timestamp){
 // SELECT condition ties the outbox entry to the winning revision transaction.
 return db.prepare(`INSERT OR IGNORE INTO invoice_outbox (id,workspace_id,invoice_id,mode,payload,status,next_attempt_at,created_at,updated_at) SELECT ?,id,?,?,?,'queued',?,?,? FROM workspaces WHERE id = ? AND last_operation = ?`).bind(crypto.randomUUID(),invoiceId,delivery.mode,delivery.payload,timestamp,timestamp,timestamp,workspace,operation);
}
const audit=(db,row,status,timestamp,lease)=>db.prepare('INSERT INTO invoice_email_events (id,workspace_id,outbox_id,status,created_at) SELECT ?,workspace_id,id,?,? FROM invoice_outbox WHERE id=? AND lease_token=?').bind(crypto.randomUUID(),status,timestamp,row.id,lease);
export async function deliveryHistory(db,workspace){
 const rows=await db.prepare('SELECT invoice_id,status,attempts,provider_id,last_error,created_at,updated_at FROM invoice_outbox WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 200').bind(workspace).all();
 return rows.results;
}
export async function dispatchEmails(db,config,{now=()=>new Date(),fetcher=fetch,workspace}={}){
 if(!config)fail(503,'Automatic email is not configured. No emails were sent.');
 const timestamp=now().toISOString(),scope=workspace?' AND workspace_id = ?':'';
 // One small batch bounds costs and Worker duration. A durable lease survives crashes.
 const pending=await db.prepare(`SELECT * FROM invoice_outbox WHERE mode = ? AND ((status IN ('queued','retry') AND next_attempt_at <= ?) OR (status = 'sending' AND lease_until <= ?))${scope} ORDER BY created_at LIMIT 5`).bind(config.mode,timestamp,timestamp,...(workspace?[workspace]:[])).all();
 let processed=0;
 for(const row of pending.results){
  const recent=await db.prepare("SELECT COUNT(*) AS n FROM invoice_email_events WHERE status='attempt' AND created_at>=?").bind(new Date(Date.parse(timestamp)-86400000).toISOString()).first();if(recent.n>=90)break;
  const lease=crypto.randomUUID(),leaseUntil=new Date(Date.parse(timestamp)+60000).toISOString();
  const claimed=await db.prepare(`UPDATE invoice_outbox SET status='sending',lease_token=?,lease_until=?,first_attempt_at=COALESCE(first_attempt_at,?),attempts=attempts+1,updated_at=? WHERE id=? AND ((status IN ('queued','retry') AND next_attempt_at<=?) OR (status='sending' AND lease_until<=?)) RETURNING *`).bind(lease,leaseUntil,timestamp,timestamp,row.id,timestamp,timestamp).all();
  if(!claimed.results.length)continue;
  const current=claimed.results[0];let status='review',error='Delivery needs operator review.',providerId=null;
  const update=async()=>db.batch([
   audit(db,row,status,timestamp,lease),
   db.prepare('UPDATE invoice_outbox SET status=?,provider_id=COALESCE(?,provider_id),last_error=?,next_attempt_at=?,lease_token=NULL,lease_until=NULL,updated_at=? WHERE id=? AND lease_token=?').bind(status,providerId,error,new Date(Date.parse(timestamp)+Math.min(3600000,60000*2**current.attempts)).toISOString(),timestamp,row.id,lease)
  ]);
  // Never repeat an ambiguous send outside the provider's 24-hour key retention.
  if(Date.parse(timestamp)-Date.parse(current.first_attempt_at)>=23*3600000){await update();continue}
  const payload=JSON.parse(row.payload);
  try{await assertRecipientAvailable(db,row.workspace_id,{payload:row.payload})}catch{status='failed';error='Recipient suppressed after a bounce or complaint.';await update();continue}
  // Re-check test allowlist and sender at dispatch, including after configuration changes.
  if(payload.from!==config.from||config.mode==='test'&&!config.allowlist.includes(payload.to[0].toLowerCase())){error='Email configuration changed. Operator review required.';await update();continue}
  const business=await db.prepare('SELECT document FROM workspaces WHERE id=?').bind(row.workspace_id).first();
  const invoice=business&&JSON.parse(business.document).invoices.find(i=>i.id===row.invoice_id);
  if(!invoice||invoice.status!=='Issued'){status='cancelled';error='Invoice is no longer unpaid and issued.';await update();continue}
  try{
   const permitted=await db.prepare("INSERT INTO invoice_email_events (id,workspace_id,outbox_id,status,created_at) SELECT ?,workspace_id,id,'attempt',? FROM invoice_outbox WHERE id=? AND lease_token=? AND (SELECT COUNT(*) FROM invoice_email_events WHERE status='attempt' AND created_at>=?) < 90 RETURNING id").bind(crypto.randomUUID(),timestamp,row.id,lease,new Date(Date.parse(timestamp)-86400000).toISOString()).all();
   if(!permitted.results.length){status='review';error='Daily email safety limit reached. Operator review required.';await update();continue}
   const response=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+config.key,'Content-Type':'application/json','Idempotency-Key':'quenvira-invoice/'+row.id},body:row.payload,signal:AbortSignal.timeout(10000)});
   if(response.ok){const result=await response.json();if(typeof result.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(result.id))throw Error('Ambiguous response');providerId=result.id;status='accepted';error=null}
   else if(response.status===429||response.status>=500){status=current.attempts<6?'retry':'review';error='Email provider temporarily unavailable.'}
   else {status='failed';error='Email provider rejected the request. Check sender and provider configuration.'}
  }catch{status=current.attempts<6?'retry':'review';error='Provider response uncertain. Safe retry uses the same message key.'}
  // If this commit fails, let the lease expire; reuse the same provider key/payload.
  await update();processed++;
 }
 return {processed};
}
export async function emailWebhook(request,db,env,{now=()=>new Date()}={}){
 if(request.method!=='POST')fail(405,'Method not allowed.');
 if(!env.RESEND_WEBHOOK_SECRET)fail(503,'Email webhook is not configured.');
 const reader=request.body?.getReader();if(!reader)fail(400,'Invalid email webhook.');
 let size=0;const chunks=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536){await reader.cancel();fail(413,'Email webhook too large.')}chunks.push(value)}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
 let event;const eventId=request.headers.get('svix-id');
 try{const {Webhook}=await import('svix');if(!/^[\w-]{1,200}$/.test(eventId||''))throw Error();new Webhook(env.RESEND_WEBHOOK_SECRET).verify(new TextDecoder().decode(bytes),{'svix-id':eventId,'svix-timestamp':request.headers.get('svix-timestamp'),'svix-signature':request.headers.get('svix-signature')});event=JSON.parse(new TextDecoder().decode(bytes));if(!event||typeof event!=='object'||Array.isArray(event)||typeof event.type!=='string')throw Error();}catch{fail(400,'Invalid email webhook signature.')}
 const states={'email.sent':'accepted','email.delivered':'delivered','email.bounced':'bounced','email.complained':'complained','email.failed':'failed','email.delivery_delayed':'delayed'};
 const status=states[event.type];if(!status)return {received:true,ignored:true};
 const row=await db.prepare('SELECT * FROM invoice_outbox WHERE provider_id=?').bind(event.data?.email_id||'').first();
 // A provider webhook can race the acceptance commit; request retry rather than lose it.
 if(!row)fail(503,'Email acceptance is not recorded yet. Retry delivery status.');
 const timestamp=now().toISOString();
 await db.batch([
  db.prepare('INSERT OR IGNORE INTO invoice_email_events (id,workspace_id,outbox_id,status,created_at) VALUES (?,?,?,?,?)').bind(eventId,row.workspace_id,row.id,status,timestamp),
  // Monotonic priority: late sent/delayed events cannot downgrade delivery/bounce.
  db.prepare(`UPDATE invoice_outbox SET status=?,updated_at=?,last_error=NULL WHERE id=? AND status NOT IN ('bounced','complained','cancelled') AND (? IN ('bounced','complained') OR (status!='delivered' AND (?='delivered' OR status!='failed'))) AND EXISTS (SELECT 1 FROM invoice_email_events WHERE id=?)`).bind(status,timestamp,row.id,status,status,eventId)
 ]);
 return {received:true};
}

// For a future authenticated scheduler. No token or mode => no dispatch.
export async function authoriseDispatcher(request,env){
 if(request.method!=='POST')fail(405,'Method not allowed.');
 const expected=env.QUENVIRA_EMAIL_DISPATCH_TOKEN;
 if(!expected||expected.length<32)fail(503,'Email dispatcher is not configured.');
 const actual=request.headers.get('authorization')||'';
 const digest=async text=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)));
 const a=await digest(actual),b=await digest('Bearer '+expected);let difference=0;
 for(let n=0;n<a.length;n++)difference|=a[n]^b[n];
 if(difference)fail(401,'Dispatcher authentication required.');
}
export async function assertRecipientAvailable(db,workspace,delivery){
 const recipient=JSON.parse(delivery.payload).to[0];
 const suppressed=await db.prepare("SELECT id FROM invoice_outbox WHERE workspace_id=? AND status IN ('bounced','complained') AND lower(json_extract(payload,'$.to[0]'))=lower(?) LIMIT 1").bind(workspace,recipient).first();
 if(suppressed)fail(400,'This recipient previously bounced or complained. Contact support before sending further invoices.');
}
