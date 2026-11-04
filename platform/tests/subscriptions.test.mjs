import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import {billingConfig,startTrial,entitlement,checkout,webhook,billingReview,TERMS_VERSION} from '../server/subscriptions.mjs';
import {handle} from '../server/api.mjs';
import {database,setup,fixtures,ORIGIN,customer} from './support/database.mjs';
const timestamp='2026-10-22T12:00:00.000Z',now=Date.parse(timestamp);
const env={QUENVIRA_BILLING_MODE:'test',STRIPE_RESTRICTED_KEY:'rk_test_fixture_only',STRIPE_WEBHOOK_SECRET:'whsec_fixture_only',STRIPE_PRICE_ID:'price_test',STRIPE_PORTAL_CONFIGURATION:'bpc_test',QUENVIRA_SITE_ORIGIN:ORIGIN,QUENVIRA_TERMS_VERSION:TERMS_VERSION,QUENVIRA_SELF_SERVE:'yes'};
const config=billingConfig(env),terms={acceptTerms:true,termsVersion:TERMS_VERSION};
const paid=(status='active')=>({id:'sub_test',customer:'cus_test',livemode:false,status,latest_invoice:{id:'in_confirmed',livemode:false,status:'paid',amount_remaining:0,customer:'cus_test',subscription:'sub_test'},cancel_at_period_end:false,items:{data:[{price:{id:'price_test'},quantity:1,current_period_end:Math.floor(now/1000)+2592000}]}});
function provider(){
 const calls=[],sessions=new Map(),idempotency=new Map();let subs=[];
 const sdk=new Stripe('rk_test_fixture_only');
 const client={calls,sessions,setSubs:s=>{subs=s},fail:false,
 customers:{create:async(params,opts)=>{calls.push(['customer',params,opts]);return {id:'cus_test',livemode:false}}},
 prices:{retrieve:async()=>({active:true,livemode:false,currency:'gbp',unit_amount:1900,billing_scheme:'per_unit',tax_behavior:'inclusive',recurring:{interval:'month',interval_count:1,usage_type:'licensed'}})},
 invoices:{list:async()=>({data:[],has_more:false})},subscriptions:{list:async()=>{if(client.fail)throw Error('secret provider details');return {data:subs,has_more:false}}},
 checkout:{sessions:{retrieve:async id=>sessions.get(id),expire:async id=>{sessions.get(id).status='expired'},create:async(params,opts)=>{calls.push(['checkout',params,opts]);if(idempotency.has(opts.idempotencyKey)){assert.deepEqual(params,idempotency.get(opts.idempotencyKey).params);return idempotency.get(opts.idempotencyKey).result}const result={id:'cs_'+sessions.size,livemode:false,customer:'cus_test',status:'open',url:'https://checkout.stripe.com/c/pay/test'};sessions.set(result.id,result);idempotency.set(opts.idempotencyKey,{params,result});return result}}},
 billingPortal:{sessions:{create:async params=>{calls.push(['portal',params]);return {url:'https://billing.stripe.com/p/session/test'}}}},webhooks:sdk.webhooks};return client;
}
async function fixture(){const db=database(),workspace=await setup(db);await startTrial(db,workspace,timestamp);return {db,workspace,client:provider()}}
async function call(f,path,body,user='alice',date=timestamp){const headers={'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@example.com'};if(body!==undefined){headers.origin=ORIGIN;headers['content-type']='application/json'}const response=await handle(new Request(ORIGIN+'/api/quenvira/'+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body)}),f.db,{billingEnv:env,billingClient:f.client,now:()=>new Date(date)});return {status:response.status,body:await response.json()}}
async function expire(f){f.db.sqlite.prepare('UPDATE subscription_accounts SET trial_end=?').run('2026-10-01T12:00:00.000Z');await checkout(f.db,f.workspace,'alice@example.com',terms,config,f.client,timestamp)}
test('billing is disabled by default; incomplete, mismatched or unapproved live configuration fails closed',()=>{
 assert.equal(billingConfig({}),null);assert.equal(billingConfig({QUENVIRA_BILLING_MODE:'disabled'}),null);
 for(const patch of [{STRIPE_RESTRICTED_KEY:'rk_live_wrong'},{STRIPE_WEBHOOK_SECRET:''},{STRIPE_PORTAL_CONFIGURATION:''},{QUENVIRA_TERMS_VERSION:'old'},{QUENVIRA_SITE_ORIGIN:'https://evil.test/path'},{QUENVIRA_BILLING_MODE:'live',STRIPE_RESTRICTED_KEY:'rk_live_fixture'}])assert.throws(()=>billingConfig({...env,...patch}));
});
test('14-day card-free trial is persistent, retry safe and cannot restart on workspace recreation',async()=>{
 const f=await fixture();const before=await entitlement(f.db,f.workspace,config,f.client,now);assert.equal(before.status,'trial');assert.equal(before.trialEnd,'2026-11-05T12:00:00.000Z');await startTrial(f.db,f.workspace,'2027-01-01T00:00:00Z');assert.equal((await entitlement(f.db,f.workspace,config,f.client,now)).trialEnd,before.trialEnd);
 f.db.sqlite.prepare('DELETE FROM workspaces WHERE id=?').run(f.workspace);await setup(f.db);await startTrial(f.db,f.workspace,'2027-01-01T00:00:00Z');assert.equal((await entitlement(f.db,f.workspace,config,f.client,now)).trialEnd,before.trialEnd);f.db.sqlite.close();
});
test('checkout uses fixed price, tenant-owned customer, anchored trial and identical idempotency parameters',async()=>{
 const f=await fixture();await assert.rejects(checkout(f.db,f.workspace,'alice@example.com',{},config,f.client,timestamp));
 const result=await checkout(f.db,f.workspace,'alice@example.com',{...terms,price:'price_evil',customer:'cus_evil'},config,f.client,timestamp);
 assert.equal(result.url,'https://checkout.stripe.com/c/pay/test');const call=f.client.calls.find(c=>c[0]==='checkout');assert.equal(call[1].customer,'cus_test');assert.deepEqual(call[1].line_items,[{price:'price_test',quantity:1}]);assert.equal(call[1].subscription_data.trial_end,Math.floor(Date.parse('2026-11-05T12:00:00Z')/1000));assert.equal(call[1].payment_method_types,undefined);assert.equal(call[1].success_url,ORIGIN+'/workspace.html?billing=return#settings');
 await checkout(f.db,f.workspace,'alice@example.com',terms,config,f.client,timestamp);assert.equal(f.client.calls.filter(c=>c[0]==='checkout').length,1);
 // Simulate provider success followed by lost DB response.
 f.db.sqlite.prepare('UPDATE subscription_accounts SET checkout_id=NULL').run();await checkout(f.db,f.workspace,'alice@example.com',terms,config,f.client,timestamp);assert.equal(f.client.sessions.size,1);f.db.sqlite.close();
});
test('corrected checkout parameters use a new stable namespace after a rejected legacy request',async()=>{
 const f=await fixture(),create=f.client.checkout.sessions.create;
 f.client.checkout.sessions.create=async(params,options)=>{
  assert.notEqual(options.idempotencyKey,'quenvira-checkout-'+f.workspace+'-0');
  assert.equal(options.idempotencyKey,'quenvira-checkout-v2-'+f.workspace+'-0');
  return create(params,options);
 };
 await checkout(f.db,f.workspace,'alice@example.com',terms,config,f.client,timestamp);
 // A lost database response must still recover the same new session.
 f.db.sqlite.prepare('UPDATE subscription_accounts SET checkout_id=NULL').run();
 await checkout(f.db,f.workspace,'alice@example.com',terms,config,f.client,timestamp);
 assert.equal(f.client.sessions.size,1);f.db.sqlite.close();
});
test('checkout works when the Stripe account defaults to Managed Payments without changing the merchant model',async()=>{
 const f=await fixture(),create=f.client.checkout.sessions.create;
 f.client.checkout.sessions.create=async(params,options)=>{
  if(params.managed_payments?.enabled!==false&&params.adaptive_pricing?.enabled===false)throw Error('Managed Payments requires adaptive pricing');
  return create(params,options);
 };
 try{
  const result=await checkout(f.db,f.workspace,'alice@example.com',terms,config,f.client,timestamp);
  assert.equal(result.url,'https://checkout.stripe.com/c/pay/test');
  const params=f.client.calls.find(c=>c[0]==='checkout')[1];
  assert.equal(params.consent_collection.terms_of_service,'required');
  assert.equal(params.automatic_tax.enabled,false);
  assert.equal(params.adaptive_pricing.enabled,false);
 }finally{f.db.sqlite.close()}
});
test('expired checkout allocates one new generation, wrong price/mode and ongoing subscriptions are rejected',async()=>{
 const f=await fixture();await checkout(f.db,f.workspace,'alice@example.com',terms,config,f.client,timestamp);f.client.sessions.get('cs_0').status='expired';await checkout(f.db,f.workspace,'alice@example.com',terms,config,f.client,timestamp);assert.equal(f.client.sessions.size,2);assert.equal(f.db.sqlite.prepare('SELECT checkout_generation AS n FROM subscription_accounts').get().n,1);
 f.client.setSubs([paid()]);await assert.rejects(checkout(f.db,f.workspace,'alice@example.com',terms,config,f.client,timestamp),/already exists/);f.client.setSubs([]);f.client.prices.retrieve=async()=>({active:true,livemode:false,currency:'gbp',unit_amount:1});await assert.rejects(checkout(f.db,f.workspace,'alice@example.com',terms,config,f.client,timestamp),/approved/);f.db.sqlite.close();
});
test('checkout during final 48 trial hours cannot silently charge before the free trial ends',async()=>{const f=await fixture();await assert.rejects(checkout(f.db,f.workspace,'alice@example.com',terms,config,f.client,'2026-11-05T00:00:00.000Z'),/48 hours/);assert.equal(f.client.sessions.size,0);f.db.sqlite.close()});
test('subscription lifecycle grants only current paid correct-plan access; period-end cancellation preserves paid access',async()=>{
 const f=await fixture();await expire(f);
 for(const status of ['past_due','unpaid','paused','incomplete','incomplete_expired','canceled','trialing']){f.client.setSubs([paid(status)]);assert.equal((await entitlement(f.db,f.workspace,config,f.client,now)).canWrite,false,status)}
 const s=paid();s.cancel_at_period_end=true;f.client.setSubs([s]);assert.equal((await entitlement(f.db,f.workspace,config,f.client,now)).canWrite,true);
 s.items.data[0].current_period_end=Math.floor(now/1000);assert.equal((await entitlement(f.db,f.workspace,config,f.client,now)).canWrite,false);s.items.data[0].current_period_end+=1000;s.items.data[0].price.id='price_other';assert.equal((await entitlement(f.db,f.workspace,config,f.client,now)).canWrite,false);s.items.data[0].price.id='price_test';s.livemode=true;assert.equal((await entitlement(f.db,f.workspace,config,f.client,now)).canWrite,false);f.db.sqlite.close();
});
test('API enforces trial expiry for manager/staff writes, preserves read/backup, prevents paid deletion and isolates billing',async()=>{
 const f=await fixture(),person=await fixtures(f.db,f.workspace);await setup(f.db,'bob');await expire(f);
 const command={action:'customer.save',data:customer,revision:f.db.sqlite.prepare('SELECT revision FROM workspaces WHERE id=?').get(f.workspace).revision,requestId:crypto.randomUUID()};assert.equal((await call(f,'workspaces/'+f.workspace+'/commands',command)).status,402);assert.equal((await call(f,'workspaces/'+f.workspace)).status,200);assert.equal((await call(f,'workspaces/'+f.workspace+'/backup-file')).status,200);
 assert.equal((await call(f,'workspaces/'+f.workspace+'/subscription',undefined,'bob')).status,404);
 f.db.sqlite.prepare("INSERT INTO memberships VALUES (?,?,'staff',?)").run(f.workspace,'worker',person.staffId);assert.equal((await call(f,'workspaces/'+f.workspace+'/subscription',undefined,'worker')).status,403);assert.equal((await call(f,'workspaces/'+f.workspace+'/commands',command,'worker')).status,402);
 f.client.setSubs([paid()]);assert.equal((await call(f,'workspaces/'+f.workspace+'/delete',{confirmName:'alice cleaning'})).status,409);assert.equal((await call(f,'workspaces/'+f.workspace+'/commands',command)).status,200);
 const portal=await call(f,'workspaces/'+f.workspace+'/subscription',{action:'portal',customer:'cus_evil'});assert.equal(portal.status,200);assert.equal(f.client.calls.at(-1)[1].customer,'cus_test');f.db.sqlite.close();
});
test('provider outage fails closed for workflow writes without leaking details or blocking exports',async()=>{const f=await fixture();await expire(f);f.client.fail=true;const r=await call(f,'workspaces/'+f.workspace+'/commands',{action:'customer.save',data:customer,revision:0,requestId:crypto.randomUUID()});assert.equal(r.status,503);assert.equal(JSON.stringify(r.body).includes('secret provider'),false);assert.equal((await call(f,'workspaces/'+f.workspace+'/backup-file')).status,200);f.db.sqlite.close()});
async function signed(event,secret=config.secret){const body=JSON.stringify(event),sdk=new Stripe('rk_test_fixture_only');const signature=sdk.webhooks.generateTestHeaderString({payload:body,secret});return new Request(ORIGIN+'/api/quenvira/subscription-webhook',{method:'POST',headers:{'stripe-signature':signature},body})}
test('Stripe failure logs retain support identifiers without provider text, customer input or credentials',async()=>{
 const f=await fixture();await expire(f);
 const original=console.error,logs=[];
 console.error=(...args)=>logs.push(args.join(' '));
 f.client.subscriptions.list=async()=>{throw Object.assign(new Error('whsec_private rk_live_private sk_live_private client_secret_private alice@example.com'),{type:'StripeInvalidRequestError',requestId:'req_Safe123',statusCode:400,code:'whsec_private',param:'alice@example.com'})};
 try{
  const result=await call(f,'workspaces/'+f.workspace+'/subscription');
  assert.equal(result.status,503);assert.equal(result.body.error,'Service temporarily unavailable.');
  assert.equal(logs.length,1);assert.ok(logs[0].includes('req_Safe123'));
  assert.ok(logs[0].includes('StripeInvalidRequestError'));
  for(const secret of ['whsec_private','rk_live_private','sk_live_private','client_secret_private','alice@example.com'])assert.equal(logs[0].includes(secret),false);
 }finally{console.error=original;f.db.sqlite.close()}
});
test('real SDK raw-body signature verification rejects tamper, stale signatures, wrong mode; duplicates and old snapshots never change entitlements',async()=>{
 const f=await fixture();await expire(f);const event={id:'evt_test',type:'customer.subscription.updated',livemode:false,data:{object:paid()}};
 assert.deepEqual(await webhook(await signed(event),f.db,config,f.client),{received:true});assert.deepEqual(await webhook(await signed(event),f.db,config,f.client),{received:true,replayed:true});
 assert.equal((await entitlement(f.db,f.workspace,config,f.client,now)).canWrite,false);
 await assert.rejects(webhook(await signed(event,'whsec_wrong'),f.db,config,f.client),/signature/);await assert.rejects(webhook(await signed({...event,livemode:true}),f.db,config,f.client),/mode mismatch/);
 const sdk=new Stripe('rk_test_fixture_only'),body=JSON.stringify(event),stale=sdk.webhooks.generateTestHeaderString({payload:body,secret:config.secret,timestamp:1});await assert.rejects(webhook(new Request(ORIGIN,{method:'POST',headers:{'stripe-signature':stale},body}),f.db,config,f.client),/signature/);
 const valid=await signed(event),sig=valid.headers.get('stripe-signature');await assert.rejects(webhook(new Request(ORIGIN,{method:'POST',headers:{'stripe-signature':sig},body:body+' '}),f.db,config,f.client),/signature/);f.db.sqlite.close();
});
test('anonymous Stripe webhook is authenticated independently, never by forged browser identity or origin',async()=>{
 const f=await fixture();await expire(f);const event={id:'evt_api',type:'invoice.paid',livemode:false,data:{object:{customer:'cus_test'}}};let r=await handle(await signed(event),f.db,{billingEnv:env,billingClient:f.client});assert.equal(r.status,200);
 r=await handle(new Request(ORIGIN+'/api/quenvira/subscription-webhook',{method:'POST',body:'{}'}),f.db,{billingEnv:env,billingClient:f.client});assert.equal(r.status,400);r=await handle(await signed(event),f.db);assert.equal(r.status,503);f.db.sqlite.close();
});
test('self-service enrollment requires complete enabled configuration and creates trial once',async()=>{const db=database(),f={db,client:provider()};const a=await call(f,'workspaces',{name:'Fictional self-service'});assert.equal(a.status,201);assert.equal((await call(f,'workspaces/'+a.body.workspaceId+'/subscription')).body.status,'trial');const retry=await call(f,'workspaces',{name:'Retry'});assert.equal(retry.body.workspaceId,a.body.workspaceId);assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM subscription_accounts').get().n,1);db.sqlite.close()});


test('provider trial and custom cancellation date are visible without restarting checkout or extending app trial',async()=>{
 const f=await fixture();await checkout(f.db,f.workspace,'alice@example.com',terms,config,f.client,timestamp);
 const s=paid('trialing');s.cancel_at_period_end=false;s.cancel_at=Math.floor(Date.parse('2026-11-05T12:00:00Z')/1000);f.client.setSubs([s]);
 try{
  let result=await entitlement(f.db,f.workspace,config,f.client,now);
  assert.equal(result.status,'trialing');assert.equal(result.canCheckout,false);assert.equal(result.canWrite,true);assert.equal(result.cancellationScheduled,true);assert.equal(result.cancelAt,s.cancel_at);
  f.db.sqlite.prepare('UPDATE subscription_accounts SET trial_end=?').run('2026-10-01T12:00:00Z');
  assert.equal((await entitlement(f.db,f.workspace,config,f.client,now)).canWrite,false);
  for(const status of ['active','past_due','unpaid','paused','incomplete']){s.status=status;result=await entitlement(f.db,f.workspace,config,f.client,now);assert.equal(result.canCheckout,false);assert.equal(result.status,status);await assert.rejects(checkout(f.db,f.workspace,'alice@example.com',terms,config,f.client,timestamp),/already exists/)}
 }finally{f.db.sqlite.close()}
});
test('completed checkout can be replaced only after its exact subscription is authoritatively terminal',async()=>{
 const f=await fixture();await checkout(f.db,f.workspace,'alice@example.com',terms,config,f.client,timestamp);
 const session=f.client.sessions.get('cs_0');session.status='complete';session.subscription='sub_test';
 try{
  await assert.rejects(checkout(f.db,f.workspace,'alice@example.com',terms,config,f.client,timestamp),/Checkout has completed/);
  f.client.setSubs([{...paid('canceled'),id:'sub_other'}]);await assert.rejects(checkout(f.db,f.workspace,'alice@example.com',terms,config,f.client,timestamp),/Checkout has completed/);
  f.client.setSubs([paid('canceled')]);assert.equal((await entitlement(f.db,f.workspace,config,f.client,now)).canCheckout,true);
  await checkout(f.db,f.workspace,'alice@example.com',terms,config,f.client,timestamp);assert.equal(f.client.sessions.size,2);
  await checkout(f.db,f.workspace,'alice@example.com',terms,config,f.client,timestamp);assert.equal(f.client.sessions.size,2);
 }finally{f.db.sqlite.close()}
});
test('active status alone cannot grant access before settlement or while another invoice is open',async()=>{
 const f=await fixture();try{await expire(f);const good=paid(),invoice=good.latest_invoice;
 for(const patch of [null,{...invoice,status:'open',amount_remaining:1900},{...invoice,status:'draft'},{...invoice,livemode:true},{...invoice,customer:'cus_other'},{...invoice,subscription:'sub_other'}]){f.client.setSubs([{...good,latest_invoice:patch}]);const a=await entitlement(f.db,f.workspace,config,f.client,now);assert.equal(a.canWrite,false);assert.equal(a.status,'payment_pending')}
 f.client.setSubs([good]);f.client.invoices.list=async params=>{assert.equal(params.subscription,'sub_test');return {data:[{id:'in_older_unpaid'}],has_more:false}};assert.equal((await entitlement(f.db,f.workspace,config,f.client,now)).canWrite,false);
 f.client.invoices.list=async()=>({data:[],has_more:true});assert.equal((await entitlement(f.db,f.workspace,config,f.client,now)).canWrite,false);
 f.client.invoices.list=async()=>({data:[],has_more:false});f.client.setSubs([{...good,latest_invoice:'in_confirmed'}]);f.client.invoices.retrieve=async id=>{assert.equal(id,'in_confirmed');return {...invoice,subscription:undefined,parent:{subscription_details:{subscription:'sub_test'}}}};assert.equal((await entitlement(f.db,f.workspace,config,f.client,now)).canWrite,true);
 f.client.invoices.retrieve=async()=>{throw Error('provider unavailable')};await assert.rejects(entitlement(f.db,f.workspace,config,f.client,now));
 }finally{f.db.sqlite.close()}
});
test('signed refund/dispute/fraud events resolve provider ownership and retain a manager-only review without moving money',async()=>{
 const f=await fixture();try{await expire(f);const requests=[];
 f.client.charges={retrieve:async id=>{requests.push(id);return {id,livemode:false,customer:'cus_test',payment_intent:'pi_risk'}}};
 f.client.invoicePayments={list:async params=>{assert.deepEqual(params.payment,{type:'payment_intent',payment_intent:'pi_risk'});return {data:[{id:'inpay_risk',livemode:false,payment:{payment_intent:'pi_risk'},invoice:'in_risk'}],has_more:false}}};
 f.client.invoices.retrieve=async()=>({id:'in_risk',livemode:false,customer:'cus_test',parent:{subscription_details:{subscription:'sub_test'}}});
 f.client.subscriptions.retrieve=async()=>paid();
 for(const [i,type] of ['charge.refunded','charge.dispute.created','radar.early_fraud_warning.created'].entries()){
 const event={id:'evt_risk'+i,livemode:false,type,data:{object:{id:type==='charge.refunded'?'ch_risk':'object_risk',charge:'ch_risk',customer:'cus_evil',metadata:{workspace_id:'evil'}}}};
 assert.deepEqual(await webhook(await signed(event),f.db,config,f.client),{received:true});assert.deepEqual(await webhook(await signed(event),f.db,config,f.client),{received:true,replayed:true});
 }
 assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) n FROM subscription_events').get().n,3);assert.deepEqual(await billingReview(f.db,f.workspace),{billingReviewRecorded:true});assert.equal((await call(f,'workspaces/'+f.workspace+'/subscription')).body.billingReviewRecorded,true);
 f.db.sqlite.prepare("UPDATE subscription_events SET received_at='2020-01-01'").run();await webhook(await signed({id:'evt_normal',livemode:false,type:'invoice.paid',data:{object:{customer:'cus_test'}}}),f.db,config,f.client);assert.equal(f.db.sqlite.prepare("SELECT COUNT(*) n FROM subscription_events WHERE id LIKE 'evt_risk%'").get().n,3);
 f.client.charges.retrieve=async()=>({id:'ch_risk',livemode:true,customer:'cus_test',payment_intent:'pi_risk'});await assert.rejects(webhook(await signed({id:'evt_wrong',livemode:false,type:'charge.refunded',data:{object:{id:'ch_risk'}}}),f.db,config,f.client),/mode mismatch/);
 assert.equal(f.db.sqlite.prepare("SELECT COUNT(*) n FROM subscription_events WHERE id='evt_wrong'").get().n,0);
 }finally{f.db.sqlite.close()}
});
test('risk webhook retries provider failures and never maps unrelated invoices or metadata to a business',async()=>{
 const f=await fixture();try{await expire(f);const event={id:'evt_risk_unlinked',livemode:false,type:'charge.refunded',data:{object:{id:'ch_risk',customer:'cus_test'}}};
 f.client.charges={retrieve:async()=>({id:'ch_risk',livemode:false,customer:'cus_test',payment_intent:'pi_risk'})};
 f.client.invoicePayments={list:async()=>({data:[],has_more:false})};assert.deepEqual(await webhook(await signed(event),f.db,config,f.client),{received:true,ignored:true});
 f.client.invoicePayments.list=async()=>({data:[],has_more:true});await assert.rejects(webhook(await signed(event),f.db,config,f.client),/operator review/);
 f.client.invoicePayments.list=async()=>{throw Error('provider down')};await assert.rejects(webhook(await signed(event),f.db,config,f.client),/provider down/);assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) n FROM subscription_events').get().n,0);
 }finally{f.db.sqlite.close()}
});
