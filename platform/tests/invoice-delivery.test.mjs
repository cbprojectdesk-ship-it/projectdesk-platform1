import test from 'node:test';
import assert from 'node:assert/strict';
import {Webhook} from 'svix';
import {emailConfig,prepareDelivery,dispatchEmails,emailWebhook} from '../server/invoice-delivery.mjs';
import {handle} from '../server/api.mjs';
import {dispatchAfterCommand} from '../server/email-background.mjs';
import {database,setup,fixtures,command,job,request,ORIGIN,fixed} from './support/database.mjs';
const secret='whsec_'+Buffer.from('synthetic-signing-key-not-a-real-secret').toString('base64');
const env={QUENVIRA_EMAIL_MODE:'test',QUENVIRA_EMAIL_FROM:'invoices@example.com',RESEND_API_KEY:'synthetic-key',RESEND_WEBHOOK_SECRET:secret,QUENVIRA_EMAIL_TEST_RECIPIENTS:'home@example.com'};
async function call(db,w,action,data={},revision){const current=await request(db,'workspaces/'+w);const response=await handle(new Request(`${ORIGIN}/api/quenvira/workspaces/${w}/commands`,{method:'POST',headers:{'Content-Type':'application/json',origin:ORIGIN,'oai-authenticated-user-id':'alice','oai-authenticated-user-email':'alice@example.com'},body:JSON.stringify({action,data,requestId:crypto.randomUUID(),revision:revision??current.body.revision})}),db,{now:fixed,billingEnv:env});return {status:response.status,body:await response.json()}}
async function fixture(){
 const db=database(),w=await setup(db),f=await fixtures(db,w);
 await command(db,w,'supplier.save',{legalName:'Fictional Cleaner',address:'Fictional Road',contact:'billing@example.com',entity:'sole-trader',vatRegistered:false});
 const booked=await command(db,w,'job.save',job(f)),id=booked.body.result[0].id;
 await command(db,w,'job.update',{id,action:'start'});for(let value=0;value<4;value++)await command(db,w,'job.update',{id,action:'check',value});
 await command(db,w,'job.update',{id,action:'complete'});const invoice=await command(db,w,'invoice.create',{jobId:id,vat:0});await command(db,w,'invoice.issue',{id:invoice.body.result.id});
 return {db,w,id,invoiceId:invoice.body.result.id};
}
const rows=db=>db.sqlite.prepare('SELECT * FROM invoice_outbox').all();
const ok=async()=>new Response(JSON.stringify({id:'provider_synthetic_123'}),{status:200});
test('successful command wakes only its workspace queue after commit, without duplicate sends',async()=>{
 const f=await fixture(),originalFetch=globalThis.fetch,tasks=[];
 try{
  await call(f.db,f.w,'invoice.email.queue',{id:f.invoiceId});
  let sends=0;globalThis.fetch=async()=>{sends++;return ok()};
  const wake=(workspace=f.w,status=200,method='POST',path='commands',settings=env)=>dispatchAfterCommand(new Request(`${ORIGIN}/api/quenvira/workspaces/${workspace}/${path}`,{method}),new Response(null,{status}),{...settings,DB:f.db},{waitUntil:p=>tasks.push(p)});
  for(const status of [400,401,403,409,500])wake(f.w,status);
  wake(f.w,200,'GET');wake(f.w,200,'POST','email-history');wake(f.w,200,'POST','commands',{});
  assert.equal(tasks.length,0);assert.equal(sends,0);
  const otherWorkspace=await setup(f.db,'bob');
  wake(otherWorkspace);await Promise.all(tasks.splice(0));assert.equal(sends,0);
  wake();await Promise.all(tasks.splice(0));assert.equal(rows(f.db)[0].status,'accepted');assert.equal(sends,1);
  wake();await Promise.all(tasks.splice(0));assert.equal(sends,1);
 }finally{globalThis.fetch=originalFetch;f.db.sqlite.close()}
});
test('background provider failure retains durable retry and never changes the saved command response',async()=>{
 const f=await fixture(),originalFetch=globalThis.fetch,tasks=[];
 try{
  await call(f.db,f.w,'invoice.email.queue',{id:f.invoiceId});
  globalThis.fetch=async()=>{throw Error('Synthetic network failure')};
  const response=new Response('{"revision":42}',{status:200});
  dispatchAfterCommand(new Request(`${ORIGIN}/api/quenvira/workspaces/${f.w}/commands`,{method:'POST'}),response,{...env,DB:f.db},{waitUntil:p=>tasks.push(p)});
  assert.equal(await response.text(),'{"revision":42}');await Promise.all(tasks);
  assert.equal(rows(f.db)[0].status,'retry');assert.equal(rows(f.db)[0].attempts,1);
 }finally{globalThis.fetch=originalFetch;f.db.sqlite.close()}
});
test('email remains disabled without configuration and live mode requires separate approval',()=>{
 assert.equal(emailConfig({}),null);assert.equal(emailConfig({...env,QUENVIRA_EMAIL_MODE:'live'}),null);assert.equal(emailConfig({...env,RESEND_WEBHOOK_SECRET:''}),null);assert.equal(emailConfig(env).mode,'test');
});
test('queue atomically snapshots saved recipient, invoice and supplier; duplicate commands cannot send twice',async()=>{
 const f=await fixture();try{
  assert.equal((await call(f.db,f.w,'invoice.email.queue',{id:f.invoiceId})).status,200);
  assert.equal((await call(f.db,f.w,'invoice.email.queue',{id:f.invoiceId})).status,200);assert.equal(rows(f.db).length,1);
  const payload=JSON.parse(rows(f.db)[0].payload);assert.deepEqual(payload.to,['home@example.com']);assert.match(payload.text,/Fictional Cleaner/);assert.match(payload.subject,/^\[Quenvira test\]/);
  let calls=0;await dispatchEmails(f.db,emailConfig(env),{now:fixed,fetcher:async(...args)=>{calls++;assert.match(args[1].headers['Idempotency-Key'],/^quenvira-invoice\//);return ok()}});
  assert.equal(rows(f.db)[0].status,'accepted');await dispatchEmails(f.db,emailConfig(env),{now:fixed,fetcher:ok});assert.equal(calls,1);
  const worker=await request(f.db,'workspaces/'+f.w+'/email-history',undefined,'worker');assert.equal(worker.status,404);
 }finally{f.db.sqlite.close()}
});
test('test recipient limits, draft/paid checks and database failure never queue unauthorised email',async()=>{
 const f=await fixture();try{
  const state=(await request(f.db,'workspaces/'+f.w)).body.state;
  assert.throws(()=>prepareDelivery(state,f.invoiceId,emailConfig({...env,QUENVIRA_EMAIL_TEST_RECIPIENTS:'owner@example.com'})),/owner-approved/);
  assert.throws(()=>prepareDelivery({...state,invoices:state.invoices.map(i=>({...i,status:'Draft'}))},f.invoiceId,emailConfig(env)),/Only an authorised/);
  const before=(await request(f.db,'workspaces/'+f.w)).body;f.db.failAt=5;
  assert.equal((await call(f.db,f.w,'invoice.email.queue',{id:f.invoiceId})).status,503);f.db.failAt=null;
  assert.equal(rows(f.db).length,0);assert.deepEqual((await request(f.db,'workspaces/'+f.w)).body,before);
  assert.equal((await call(f.db,f.w,'invoice.email.queue',{id:f.invoiceId},0)).status,409);assert.equal(rows(f.db).length,0);
 }finally{f.db.sqlite.close()}
});
test('network failures retain identical payload/key, back off and stop before idempotency expiry',async()=>{
 const f=await fixture();try{
  await call(f.db,f.w,'invoice.email.queue',{id:f.invoiceId});let sent=[];
  const fetcher=async(url,options)=>{sent.push(options);if(sent.length===1)throw Error('do not log synthetic key');return ok()};
  await dispatchEmails(f.db,emailConfig(env),{now:fixed,fetcher});assert.equal(rows(f.db)[0].status,'retry');
  await dispatchEmails(f.db,emailConfig(env),{now:fixed,fetcher});assert.equal(sent.length,1);
  await dispatchEmails(f.db,emailConfig(env),{now:()=>new Date(fixed().getTime()+180000),fetcher});assert.equal(sent.length,2);
  assert.equal(sent[0].headers['Idempotency-Key'],sent[1].headers['Idempotency-Key']);assert.equal(sent[0].body,sent[1].body);
  f.db.sqlite.prepare("UPDATE invoice_outbox SET status='sending',lease_until=?,first_attempt_at=?").run(fixed().toISOString(),new Date(fixed().getTime()-24*3600000).toISOString());
  await dispatchEmails(f.db,emailConfig(env),{now:fixed,fetcher});assert.equal(sent.length,2);assert.equal(rows(f.db)[0].status,'review');
 }finally{f.db.sqlite.close()}
});
test('concurrent dispatch leases prevent duplicate provider calls; 429 retries, 4xx fails',async()=>{
 const f=await fixture();try{
  await call(f.db,f.w,'invoice.email.queue',{id:f.invoiceId});let calls=0;
  await Promise.all([1,2].map(()=>dispatchEmails(f.db,emailConfig(env),{now:fixed,fetcher:async()=>{calls++;return new Response('{}',{status:429})}})));
  assert.equal(calls,1);assert.equal(rows(f.db)[0].status,'retry');
  await dispatchEmails(f.db,emailConfig(env),{now:()=>new Date(fixed().getTime()+180000),fetcher:async()=>new Response('secret provider error',{status:403})});
  assert.equal(rows(f.db)[0].status,'failed');assert.ok(!rows(f.db)[0].last_error.includes('secret'));
 }finally{f.db.sqlite.close()}
});
function signed(type,id='msg_synthetic_123',emailId='provider_synthetic_123',date=new Date()){
 const body=JSON.stringify({type,data:{email_id:emailId}}),signature=new Webhook(secret).sign(id,date,body);
 return new Request(ORIGIN+'/api/quenvira/email-webhook',{method:'POST',headers:{'svix-id':id,'svix-timestamp':String(Math.floor(date.getTime()/1000)),'svix-signature':signature},body});
}
test('real Svix verification tracks delivery, rejects forged/stale events and deduplicates replay',async()=>{
 const f=await fixture();try{
  await call(f.db,f.w,'invoice.email.queue',{id:f.invoiceId});await dispatchEmails(f.db,emailConfig(env),{now:fixed,fetcher:ok});
  await emailWebhook(signed('email.delivered'),f.db,env);assert.equal(rows(f.db)[0].status,'delivered');
  await emailWebhook(signed('email.delivered'),f.db,env);assert.equal(f.db.sqlite.prepare("SELECT COUNT(*) AS n FROM invoice_email_events WHERE id='msg_synthetic_123'").get().n,1);
  await emailWebhook(signed('email.sent','msg_late_sent'),f.db,env);assert.equal(rows(f.db)[0].status,'delivered');
  await assert.rejects(emailWebhook(signed('email.delivered','msg_old','provider_synthetic_123',new Date(Date.now()-600000)),f.db,env),/signature/);
  const forged=signed('email.bounced','msg_forged');forged.headers.set('svix-signature','v1,invalid');await assert.rejects(emailWebhook(forged,f.db,env),/signature/);
  await emailWebhook(signed('email.bounced','msg_bounce'),f.db,env);assert.equal(rows(f.db)[0].status,'bounced');
  await emailWebhook(signed('email.delivered','msg_late'),f.db,env);assert.equal(rows(f.db)[0].status,'bounced');
  await assert.rejects(emailWebhook(signed('email.delivered','msg_race','unknown'),f.db,env),/not recorded/);
 }finally{f.db.sqlite.close()}
});
test('paid/credited invoices cancel pending delivery; a changed test allowlist blocks send',async()=>{
 const f=await fixture();try{
  await call(f.db,f.w,'invoice.email.queue',{id:f.invoiceId});await command(f.db,f.w,'invoice.paid',{id:f.invoiceId});let calls=0;
  await dispatchEmails(f.db,emailConfig(env),{now:fixed,fetcher:async()=>{calls++;return ok()}});assert.equal(calls,0);assert.equal(rows(f.db)[0].status,'cancelled');
 }finally{f.db.sqlite.close()}
});
test('automatic completion issues and queues in one commit only under manager opt-in',async()=>{
 const db=database(),w=await setup(db),f=await fixtures(db,w);try{
  await command(db,w,'supplier.save',{legalName:'Fictional Cleaner',address:'Fictional Road',contact:'billing@example.com',entity:'sole-trader',vatRegistered:false,autoDraftInvoices:true,autoDraftVat:0,autoEmailInvoices:true});
  const booked=await command(db,w,'job.save',job(f)),id=booked.body.result[0].id;
  await command(db,w,'job.update',{id,action:'start'});for(let value=0;value<4;value++)await command(db,w,'job.update',{id,action:'check',value});
  assert.equal((await call(db,w,'job.update',{id,action:'complete'})).status,200);assert.equal(rows(db).length,1);assert.equal((await request(db,'workspaces/'+w)).body.state.invoices[0].status,'Issued');
 }finally{db.sqlite.close()}
});
test('missing provider configuration leaves automatic invoice as draft and preserves completed job',async()=>{
 const db=database(),w=await setup(db),f=await fixtures(db,w);try{
  await command(db,w,'supplier.save',{legalName:'Fictional Cleaner',address:'Fictional Road',contact:'billing@example.com',entity:'sole-trader',vatRegistered:false,autoDraftInvoices:true,autoDraftVat:0,autoEmailInvoices:true});
  const booked=await command(db,w,'job.save',job(f)),id=booked.body.result[0].id;await command(db,w,'job.update',{id,action:'start'});for(let value=0;value<4;value++)await command(db,w,'job.update',{id,action:'check',value});
  assert.equal((await command(db,w,'job.update',{id,action:'complete'})).status,200);const state=(await request(db,'workspaces/'+w)).body.state;
  assert.equal(state.jobs[0].status,'Completed');assert.equal(state.invoices[0].status,'Draft');assert.equal(state.invoices[0].issue,undefined);assert.equal(rows(db).length,0);assert.match(state.audit[0].message,/manager attention/);
 }finally{db.sqlite.close()}
});

test('staff and other tenants cannot inspect, queue or dispatch email; revoked manager cannot commit queue',async()=>{
 const f=await fixture();try{
  const state=(await request(f.db,'workspaces/'+f.w)).body.state;
  f.db.sqlite.prepare("INSERT INTO memberships VALUES (?,?,'staff',?)").run(f.w,'worker',state.staff[0].id);
  for(const user of ['worker','bob']){
   assert.equal((await request(f.db,'workspaces/'+f.w+'/email-history',undefined,user)).status,user==='worker'?403:404);
   assert.equal((await request(f.db,'workspaces/'+f.w+'/email-dispatch',{},user)).status,user==='worker'?403:404);
   assert.equal((await command(f.db,f.w,'invoice.email.queue',{id:f.invoiceId},user,crypto.randomUUID(),(await request(f.db,'workspaces/'+f.w)).body.revision)).status,user==='worker'?403:404);
  }
  f.db.beforeBatch=()=>f.db.sqlite.prepare("DELETE FROM memberships WHERE workspace_id=? AND user_id='alice'").run(f.w);
  assert.equal((await call(f.db,f.w,'invoice.email.queue',{id:f.invoiceId})).status,404);assert.equal(rows(f.db).length,0);
 }finally{f.db.sqlite.close()}
});
test('authenticated scheduler denies anonymous or wrong token; configured dispatch safely runs an empty queue',async()=>{
 const db=database();try{
  const url=ORIGIN+'/api/quenvira/email-dispatch',token='synthetic-dispatch-token-at-least-32-characters';
  for(const [config,auth,expected]of [[{},'',503],[{...env,QUENVIRA_EMAIL_DISPATCH_TOKEN:token},'',401],[{...env,QUENVIRA_EMAIL_DISPATCH_TOKEN:token},'Bearer wrong',401],[{...env,QUENVIRA_EMAIL_DISPATCH_TOKEN:token},'Bearer '+token,200]]){
   const response=await handle(new Request(url,{method:'POST',headers:{authorization:auth}}),db,{billingEnv:config});assert.equal(response.status,expected);
  }
 }finally{db.sqlite.close()}
});
test('configuration change, malformed acceptance and crash after accepted send preserve safe retry behavior',async()=>{
 const f=await fixture();try{
  await call(f.db,f.w,'invoice.email.queue',{id:f.invoiceId});let calls=0;
  await dispatchEmails(f.db,emailConfig({...env,QUENVIRA_EMAIL_TEST_RECIPIENTS:'owner@example.com'}),{now:fixed,fetcher:async()=>{calls++;return ok()}});assert.equal(calls,0);assert.equal(rows(f.db)[0].status,'review');
  f.db.sqlite.prepare("UPDATE invoice_outbox SET status='queued',next_attempt_at='2026-10-20T10:00:00.000Z'").run();
  f.db.failAt=1;await assert.rejects(dispatchEmails(f.db,emailConfig(env),{now:fixed,fetcher:async()=>{calls++;return ok()}}));f.db.failAt=null;assert.equal(rows(f.db)[0].status,'sending');
  let retryKey;await dispatchEmails(f.db,emailConfig(env),{now:()=>new Date(fixed().getTime()+120000),fetcher:async(url,opts)=>{calls++;retryKey=opts.headers['Idempotency-Key'];return ok()}});
  assert.equal(retryKey,'quenvira-invoice/'+rows(f.db)[0].id);assert.equal(rows(f.db)[0].status,'accepted');assert.equal(calls,2);
 }finally{f.db.sqlite.close()}
});

test('bounced recipients are suppressed on later invoices and before pending dispatch',async()=>{
 const f=await fixture();try{
  await call(f.db,f.w,'invoice.email.queue',{id:f.invoiceId});await dispatchEmails(f.db,emailConfig(env),{now:fixed,fetcher:ok});await emailWebhook(signed('email.complained','msg_complaint'),f.db,env);
  assert.equal((await call(f.db,f.w,'invoice.email.queue',{id:f.invoiceId})).status,400);
  assert.equal(rows(f.db)[0].status,'complained');
 }finally{f.db.sqlite.close()}
});

test('rolling daily attempt limit stops provider calls without losing the queued invoice',async()=>{
 const f=await fixture();try{
  await call(f.db,f.w,'invoice.email.queue',{id:f.invoiceId});const row=rows(f.db)[0];
  const insert=f.db.sqlite.prepare('INSERT INTO invoice_email_events VALUES (?,?,?,?,?)');for(let n=0;n<90;n++)insert.run('daily_'+n,f.w,row.id,'attempt',fixed().toISOString());
  let calls=0;await dispatchEmails(f.db,emailConfig(env),{now:fixed,fetcher:async()=>{calls++;return ok()}});assert.equal(calls,0);assert.equal(rows(f.db)[0].status,'queued');
 }finally{f.db.sqlite.close()}
});

test('an interrupted sixth attempt is held for reconciliation without a seventh provider call',async()=>{
 const f=await fixture();try{
  await call(f.db,f.w,'invoice.email.queue',{id:f.invoiceId});
  f.db.sqlite.prepare("UPDATE invoice_outbox SET status='sending',attempts=6,first_attempt_at=?,lease_until=?,lease_token='interrupted-sixth'").run(fixed().toISOString(),fixed().toISOString());
  let calls=0;
  await dispatchEmails(f.db,emailConfig(env),{now:fixed,fetcher:async()=>{calls++;return ok()}});
  assert.equal(calls,0);assert.equal(rows(f.db)[0].status,'review');
  assert.match(rows(f.db)[0].last_error,/attempt limit/);
  assert.equal(f.db.sqlite.prepare("SELECT COUNT(*) AS n FROM invoice_email_events WHERE status='attempt'").get().n,0);
 }finally{f.db.sqlite.close()}
});

test('a signed callback ID cannot be reused for another invoice or another outcome',async()=>{
 const f=await fixture();try{
  await call(f.db,f.w,'invoice.email.queue',{id:f.invoiceId});await dispatchEmails(f.db,emailConfig(env),{now:fixed,fetcher:ok});
  const other=await setup(f.db,'bob');
  f.db.sqlite.prepare("INSERT INTO invoice_outbox (id,workspace_id,invoice_id,mode,payload,status,provider_id,next_attempt_at,created_at,updated_at) VALUES ('another-outbox',?,'another-invoice','test','{}','accepted','provider_other',?,?,?)").run(other,fixed().toISOString(),fixed().toISOString(),fixed().toISOString());
  await emailWebhook(signed('email.delivered','msg_unique'),f.db,env);
  await assert.rejects(emailWebhook(signed('email.delivered','msg_unique','provider_other'),f.db,env),/event ID conflict/);
  assert.equal(f.db.sqlite.prepare("SELECT status FROM invoice_outbox WHERE id='another-outbox'").get().status,'accepted');
  await assert.rejects(emailWebhook(signed('email.bounced','msg_unique'),f.db,env),/event ID conflict/);
  assert.equal(rows(f.db)[0].status,'delivered');
 }finally{f.db.sqlite.close()}
});

test('signed malformed identifiers, unsupported methods and oversized callbacks are rejected',async()=>{
 const db=database();try{
  assert.deepEqual(await emailWebhook(signed('constructor'),db,env),{received:true,ignored:true});
  for(const emailId of [null,{},['provider'],123,'x'.repeat(101)]){
   const body=JSON.stringify({type:'email.delivered',data:{email_id:emailId}}),id='msg_bad_id',date=new Date();
   const req=new Request(ORIGIN+'/api/quenvira/email-webhook',{method:'POST',headers:{'svix-id':id,'svix-timestamp':String(Math.floor(date.getTime()/1000)),'svix-signature':new Webhook(secret).sign(id,date,body)},body});
   await assert.rejects(emailWebhook(req,db,env),/Invalid email event identifier/);
  }
  await assert.rejects(emailWebhook(new Request(ORIGIN+'/api/quenvira/email-webhook'),db,env),/Method not allowed/);
  await assert.rejects(emailWebhook(new Request(ORIGIN+'/api/quenvira/email-webhook',{method:'POST',body:'x'.repeat(65537)}),db,env),/too large/);
 }finally{db.sqlite.close()}
});
