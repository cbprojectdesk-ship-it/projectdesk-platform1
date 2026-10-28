import test from 'node:test';
import assert from 'node:assert/strict';
import {emailMcp} from '../server/email-mcp.mjs';
import {handle} from '../server/api.mjs';
import {startTrial,TERMS_VERSION} from '../server/subscriptions.mjs';
import {database,setup,fixtures,command,job,request,ORIGIN,fixed} from './support/database.mjs';
const env={QUENVIRA_EMAIL_MODE:'test',QUENVIRA_EMAIL_FROM:'invoices@example.com',RESEND_API_KEY:'synthetic-key',RESEND_WEBHOOK_SECRET:'synthetic-signing-key',QUENVIRA_EMAIL_TEST_RECIPIENTS:'home@example.com'};
function rpc(name,user='alice',args={}){const headers={'content-type':'application/json'};if(user){headers['oai-authenticated-user-id']=user;headers['oai-authenticated-user-email']=user+'@example.com'}return new Request(ORIGIN+'/mcp',{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})})}
const invoke=(db,name,user='alice',extra={})=>emailMcp(rpc(name,user),db,{billingEnv:env,now:fixed,...extra});
async function queued(db,user='alice'){
 const w=await setup(db,user),f=await fixtures(db,w);
 await command(db,w,'supplier.save',{legalName:'Fictional Cleaner',address:'Fictional Road',contact:'billing@example.com',entity:'sole-trader',vatRegistered:false});
 const booked=await command(db,w,'job.save',job(f)),id=booked.body.result[0].id;
 await command(db,w,'job.update',{id,action:'start'});for(let value=0;value<4;value++)await command(db,w,'job.update',{id,action:'check',value});
 await command(db,w,'job.update',{id,action:'complete'});const invoice=await command(db,w,'invoice.create',{jobId:id,vat:0});await command(db,w,'invoice.issue',{id:invoice.body.result.id});
 const current=await request(db,'workspaces/'+w);
 const r=await handle(new Request(ORIGIN+'/api/quenvira/workspaces/'+w+'/commands',{method:'POST',headers:{'content-type':'application/json',origin:ORIGIN,'oai-authenticated-user-id':'alice','oai-authenticated-user-email':'alice@example.com'},body:JSON.stringify({action:'invoice.email.queue',data:{id:invoice.body.result.id},revision:current.body.revision,requestId:crypto.randomUUID()})}),db,{billingEnv:env,now:fixed});assert.equal(r.status,200);return w;
}
const result=async r=>JSON.parse((await r.json()).result.content[0].text);
test('MCP discovery exposes only bounded email tools; unknown methods and oversized requests fail',async()=>{
 for(const method of ['server/discover','tools/list']){const r=await emailMcp(new Request(ORIGIN+'/mcp',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:1,method})}));assert.equal(r.status,200);const j=await r.json();if(method==='tools/list')assert.equal(j.result.tools.length,2)}
 assert.equal((await emailMcp(new Request(ORIGIN+'/mcp'))).status,405);
 assert.equal((await emailMcp(new Request(ORIGIN+'/mcp',{method:'POST',headers:{'content-type':'application/json'},body:'x'.repeat(9000)}))).status,413);
 const bad=await emailMcp(rpc('quenvira_process_due_invoice_emails','alice',{workspace:'another'}));assert.equal((await bad.json()).error.code,-32602);
});
test('anonymous, staff and unrelated users cannot operate the retry task',async()=>{
 const db=database();try{const w=await setup(db);db.sqlite.prepare("INSERT INTO memberships VALUES (?,?,'staff',?)").run(w,'worker','fictional');for(const [user,status] of [[null,401],['worker',403],['bob',403]])assert.equal((await invoke(db,'quenvira_process_due_invoice_emails',user)).status,status)}finally{db.sqlite.close()}
});
test('read-only retry status is scoped and contains no invoice payload or recipient',async()=>{
 const db=database();try{await queued(db);await setup(db,'bob');assert.deepEqual(await result(await invoke(db,'quenvira_email_retry_status','bob')),{mode:'test',dueBefore:0,review:0,processed:0,blocked:0});const r=await invoke(db,'quenvira_email_retry_status');const text=await r.text();assert.ok(!text.includes('home@example.com'));assert.ok(!text.includes('Fictional Cleaner'));assert.equal(db.sqlite.prepare('SELECT attempts FROM invoice_outbox').get().attempts,0)}finally{db.sqlite.close()}
});
test('unattended retry survives a missed run and preserves the provider key without duplicate sending',async()=>{
 const db=database(),original=globalThis.fetch;try{await queued(db);const calls=[];globalThis.fetch=async(url,options)=>{calls.push(options.headers['Idempotency-Key']);return calls.length===1?new Response('{}',{status:503}):new Response('{"id":"synthetic-provider-id"}',{status:200})};
  assert.equal((await result(await invoke(db,'quenvira_process_due_invoice_emails'))).processed,1);assert.equal(db.sqlite.prepare('SELECT status FROM invoice_outbox').get().status,'retry');
  assert.equal((await result(await invoke(db,'quenvira_process_due_invoice_emails'))).processed,0);
  const later={now:()=>new Date(fixed().getTime()+600000)};
  assert.equal((await result(await invoke(db,'quenvira_process_due_invoice_emails','alice',later))).processed,1);
  await invoke(db,'quenvira_process_due_invoice_emails','alice',later);assert.equal(calls.length,2);assert.equal(calls[0],calls[1]);assert.equal(db.sqlite.prepare('SELECT status FROM invoice_outbox').get().status,'accepted');
 }finally{globalThis.fetch=original;db.sqlite.close()}
});
test('disabled and unapproved live modes never dispatch',async()=>{
 const db=database(),original=globalThis.fetch;try{await queued(db);let sends=0;globalThis.fetch=async()=>{sends++;throw Error()};for(const billingEnv of [{},{...env,QUENVIRA_EMAIL_MODE:'live'}]){const r=await invoke(db,'quenvira_process_due_invoice_emails','alice',{billingEnv});assert.equal((await r.json()).result.isError,true)}assert.equal(sends,0)}finally{globalThis.fetch=original;db.sqlite.close()}
});
test('expired billing blocks unattended delivery without losing the queued invoice',async()=>{
 const db=database(),original=globalThis.fetch;try{
  const w=await queued(db);await startTrial(db,w,'2026-09-01T10:00:00.000Z');
  let sends=0;globalThis.fetch=async()=>{sends++;throw Error('must not send')};
  const billingEnv={...env,QUENVIRA_BILLING_MODE:'test',STRIPE_RESTRICTED_KEY:'rk_test_fixture_only',STRIPE_WEBHOOK_SECRET:'whsec_fixture_only',STRIPE_PRICE_ID:'price_test',STRIPE_PORTAL_CONFIGURATION:'bpc_test',QUENVIRA_SITE_ORIGIN:ORIGIN,QUENVIRA_TERMS_VERSION:TERMS_VERSION};
  const r=await result(await invoke(db,'quenvira_process_due_invoice_emails','alice',{billingEnv,billingClient:{}}));
  assert.equal(r.blocked,1);assert.equal(r.processed,0);assert.equal(sends,0);assert.equal(db.sqlite.prepare('SELECT status FROM invoice_outbox').get().status,'queued');
 }finally{globalThis.fetch=original;db.sqlite.close()}
});
test('a different manager cannot send another business queue',async()=>{
 const db=database(),original=globalThis.fetch;try{
  await queued(db);await setup(db,'bob');let sends=0;globalThis.fetch=async()=>{sends++;throw Error('must not send')};
  assert.equal((await result(await invoke(db,'quenvira_process_due_invoice_emails','bob'))).processed,0);assert.equal(sends,0);assert.equal(db.sqlite.prepare('SELECT attempts FROM invoice_outbox').get().attempts,0);
 }finally{globalThis.fetch=original;db.sqlite.close()}
});
