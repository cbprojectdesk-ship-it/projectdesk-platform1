import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import {handle} from '../server/api.mjs';
import {billingConfig,liveVerificationConfig,TERMS_VERSION} from '../server/subscriptions.mjs';
const origin='https://quenvira.test';
const env={QUENVIRA_LIVE_WEBHOOK_VERIFY:'yes',STRIPE_LIVE_RESTRICTED_KEY:'rk_live_fixture_only',STRIPE_LIVE_WEBHOOK_SECRET:'whsec_live_fixture_only'};
const sdk=new Stripe('rk_live_fixture_only');
const forbidden=()=>{throw Error('Verification must not access billing or business records')};
const client={webhooks:sdk.webhooks,subscriptions:{list:forbidden},checkout:{sessions:{create:forbidden}}};
function signed({mode=true,secret=env.STRIPE_LIVE_WEBHOOK_SECRET,timestamp,body,method='POST'}={}){
 const payload=body??JSON.stringify({id:'evt_live_acceptance',api_version:'2026-09-30.endive',type:'invoice.paid',livemode:mode,data:{object:{customer:'cus_unmapped_live',paid:true}}});
 const signature=sdk.webhooks.generateTestHeaderString({payload,secret,...(timestamp?{timestamp}:{})});
 return new Request(origin+'/api/quenvira/subscription-webhook/live',{method,headers:{'stripe-signature':signature},...(method==='POST'?{body:payload}:{})});
}
test('staged live verification is off by default and requires separate live credentials',()=>{
 assert.equal(liveVerificationConfig({}),null);assert.equal(liveVerificationConfig({...env,QUENVIRA_LIVE_WEBHOOK_VERIFY:'no'}),null);
 for(const patch of [{STRIPE_LIVE_RESTRICTED_KEY:'rk_test_fixture_only'},{STRIPE_LIVE_RESTRICTED_KEY:undefined},{STRIPE_LIVE_WEBHOOK_SECRET:undefined}])assert.throws(()=>liveVerificationConfig({...env,...patch}),/not configured/);
 assert.equal(billingConfig(env),null);
});
test('valid live SDK signature is acknowledged without DB, provider calls, paid access or duplicate side effects',async()=>{
 for(let n=0;n<2;n++){
  const response=await handle(signed(),{prepare:forbidden,batch:forbidden},{billingEnv:env,billingClient:client});
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{received:true,verificationOnly:true});
 }
 const session=await handle(new Request(origin+'/api/quenvira/session'),undefined,{billingEnv:env,billingClient:client});
 assert.equal(session.status,401);assert.equal(billingConfig(env),null);
});
test('staged route rejects unsigned, mismatched-mode, wrong-secret, stale and oversized deliveries',async()=>{
 for(const req of [new Request(origin+'/api/quenvira/subscription-webhook/live',{method:'POST',body:'{}'}),signed({mode:false}),signed({secret:'whsec_wrong'}),signed({timestamp:1})]){
  const r=await handle(req,undefined,{billingEnv:env,billingClient:client});assert.equal(r.status,400);
 }
 const tooLarge=await handle(signed({body:'x'.repeat(262145)}),undefined,{billingEnv:env,billingClient:client});assert.equal(tooLarge.status,413);
 const wrongMethod=await handle(signed({method:'GET'}),undefined,{billingEnv:env,billingClient:client});assert.equal(wrongMethod.status,405);
 const disabled=await handle(signed(),undefined,{billingClient:client});assert.equal(disabled.status,503);
});
test('staged credentials cannot unlock normal webhook processing or unapproved live billing',async()=>{
 const body=JSON.stringify({id:'evt_live',type:'invoice.paid',livemode:true,data:{object:{customer:'cus_live'}}});
 const primary=new Request(origin+'/api/quenvira/subscription-webhook',{method:'POST',body});
 const r=await handle(primary,undefined,{billingEnv:env,billingClient:client});assert.equal(r.status,503);
 assert.throws(()=>billingConfig({...env,QUENVIRA_BILLING_MODE:'live',STRIPE_RESTRICTED_KEY:env.STRIPE_LIVE_RESTRICTED_KEY,STRIPE_WEBHOOK_SECRET:env.STRIPE_LIVE_WEBHOOK_SECRET,STRIPE_PRICE_ID:'price_live',STRIPE_PORTAL_CONFIGURATION:'bpc_live',QUENVIRA_TERMS_VERSION:TERMS_VERSION,QUENVIRA_SITE_ORIGIN:origin}),/not been activated/);
});
