import test from 'node:test';
import assert from 'node:assert/strict';
import {handle} from '../server/api.mjs';
import {billingConfig,startTrial,acceptServiceTerms,serviceTermsAccepted,TERMS_VERSION} from '../server/subscriptions.mjs';
import {database,setup,ORIGIN,fixed,customer} from './support/database.mjs';
const env={QUENVIRA_BILLING_MODE:'live',QUENVIRA_PAID_LAUNCH_APPROVED:'yes',STRIPE_RESTRICTED_KEY:'rk_live_local_fixture',STRIPE_WEBHOOK_SECRET:'whsec_local_fixture',STRIPE_PRICE_ID:'price_local',STRIPE_PORTAL_CONFIGURATION:'bpc_local',QUENVIRA_SITE_ORIGIN:ORIGIN,QUENVIRA_TERMS_VERSION:TERMS_VERSION,QUENVIRA_SELF_SERVE:'yes'};
const terms={acceptTerms:true,termsVersion:TERMS_VERSION},stamp=fixed().toISOString();
async function call(db,path,body,user='alice'){
 const headers={'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@example.com'};
 if(body!==undefined){headers.origin=ORIGIN;headers['content-type']='application/json'}
 // No real provider client or network is used in these release-mode fixtures.
 const r=await handle(new Request(ORIGIN+'/api/quenvira/'+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body)}),db,{billingEnv:env,billingClient:{},now:fixed,bucket:db.bucket});
 return {status:r.status,body:await r.json()};
}
test('live trial enrollment requires current explicit terms before creating records; retries retain trial and agreement evidence',async()=>{
 const db=database();try{
  for(const body of [{name:'Fictional business'},{name:'Fictional business',acceptTerms:'true',termsVersion:TERMS_VERSION},{name:'Fictional business',acceptTerms:true,termsVersion:'2026-10-22'}])assert.equal((await call(db,'workspaces',body)).status,400);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM workspaces').get().n,0);
  const r=await call(db,'workspaces',{name:'Fictional business',...terms});assert.equal(r.status,201);
  const workspace=r.body.workspaceId,account=db.sqlite.prepare('SELECT * FROM subscription_accounts').get();
  assert.equal(account.terms_version,TERMS_VERSION);assert.equal(account.terms_accepted_at,stamp);assert.equal(account.customer_id,null);assert.equal(account.checkout_id,null);
  const event=db.sqlite.prepare('SELECT * FROM events').get();assert.equal(event.user_id,'alice');assert.equal(event.action,'terms.accept.'+TERMS_VERSION);
  await acceptServiceTerms(db,workspace,'alice',terms,'2026-11-01T10:00:00Z');
  const retry=await call(db,'workspaces',{name:'Retry',...terms});assert.equal(retry.body.workspaceId,workspace);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM events').get().n,1);
  assert.deepEqual(db.sqlite.prepare('SELECT * FROM subscription_accounts').get(),account);
 }finally{db.sqlite.close()}
});
test('existing live workspace preserves viewing and exports while consent blocks edits; manager acceptance restores trial edits without payment',async()=>{
 const db=database();try{
  const w=await setup(db);await startTrial(db,w,stamp);
  const command={action:'customer.save',data:customer,revision:0,requestId:crypto.randomUUID()};
  assert.equal((await call(db,'workspaces/'+w+'/commands',command)).status,403);
  assert.equal((await call(db,'workspaces/'+w)).status,200);
  assert.equal((await call(db,'workspaces/'+w+'/backup-file')).status,200);
  assert.equal((await call(db,'workspaces/'+w+'/subscription')).body.termsAccepted,false);
  db.sqlite.prepare("INSERT INTO memberships VALUES (?,?,'staff','fictional')").run(w,'worker');
  assert.equal((await call(db,'workspaces/'+w+'/subscription',{action:'accept-terms',...terms},'worker')).status,403);
  assert.equal((await call(db,'workspaces/'+w+'/subscription',{action:'accept-terms',...terms},'outsider')).status,404);
  assert.equal((await call(db,'workspaces/'+w+'/subscription',{action:'accept-terms',acceptTerms:true,termsVersion:'old'})).status,400);
  assert.equal(await serviceTermsAccepted(db,w),false);
  const accepted=await call(db,'workspaces/'+w+'/subscription',{action:'accept-terms',...terms});assert.equal(accepted.status,200);
  const status=await call(db,'workspaces/'+w+'/subscription');assert.equal(status.body.termsAccepted,true);assert.equal(status.body.termsVersion,TERMS_VERSION);
  assert.equal((await call(db,'workspaces/'+w+'/commands',command)).status,200);
  db.sqlite.prepare('UPDATE subscription_accounts SET trial_end=?').run('2026-10-01T00:00:00Z');
  assert.equal((await call(db,'workspaces/'+w+'/commands',{...command,requestId:crypto.randomUUID(),revision:1})).status,402);
  const a=db.sqlite.prepare('SELECT * FROM subscription_accounts').get();assert.equal(a.customer_id,null);assert.equal(a.checkout_id,null);
 }finally{db.sqlite.close()}
});
test('acceptance and named-user evidence are atomic and recheck current manager permission',async()=>{
 const db=database();try{
  const w=await setup(db);await startTrial(db,w,stamp);
  db.failAt=1;await assert.rejects(acceptServiceTerms(db,w,'alice',terms,stamp));db.failAt=null;
  assert.equal(await serviceTermsAccepted(db,w),false);assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM events').get().n,0);
  db.beforeBatch=()=>db.sqlite.prepare("UPDATE memberships SET role='staff' WHERE workspace_id=? AND user_id='alice'").run(w);
  await assert.rejects(acceptServiceTerms(db,w,'alice',terms,stamp),/manager permission/);
  assert.equal(await serviceTermsAccepted(db,w),false);assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM events').get().n,0);
 }finally{db.sqlite.close()}
});
test('superseded terms configuration is allowed only for staged sandbox rollout, never live',()=>{
 assert.throws(()=>billingConfig({...env,QUENVIRA_TERMS_VERSION:'2026-10-22'}),/not configured/);
 assert.equal(billingConfig({...env,QUENVIRA_BILLING_MODE:'test',STRIPE_RESTRICTED_KEY:'rk_test_local_fixture',QUENVIRA_TERMS_VERSION:'2026-10-22'}).mode,'test');
});
