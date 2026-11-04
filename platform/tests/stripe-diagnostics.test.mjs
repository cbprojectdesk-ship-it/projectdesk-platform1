import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import {stripeOperation,stripeFailureDiagnostic} from '../server/stripe-diagnostics.mjs';
import {handle} from '../server/api.mjs';
import {startTrial} from '../server/subscriptions.mjs';
import {database,setup,ORIGIN,customer} from './support/database.mjs';
const stamp='2026-10-30T03:00:00Z',time=Date.parse(stamp),secret='whsec_synthetic_local_diagnostics';
const env={QUENVIRA_BILLING_MODE:'test',STRIPE_RESTRICTED_KEY:'rk_test_synthetic_fixture',STRIPE_WEBHOOK_SECRET:secret,STRIPE_PRICE_ID:'price_fixture',STRIPE_PORTAL_CONFIGURATION:'bpc_fixture',QUENVIRA_SITE_ORIGIN:ORIGIN,QUENVIRA_TERMS_VERSION:'2026-10-28'};
const invoice=()=>({id:'in_fixture',object:'invoice',customer:'cus_fixture',subscription:'sub_fixture',livemode:false,status:'paid',amount_remaining:0});
const subscription=()=>({id:'sub_fixture',object:'subscription',customer:'cus_fixture',livemode:false,status:'active',latest_invoice:invoice(),items:{data:[{price:{id:'price_fixture'},quantity:1,current_period_end:time/1000+3600}]}});
async function fixture(){
 const db=database(),w=await setup(db),state={sub:subscription(),now:time,deny:null,requests:[]};await startTrial(db,w,'2026-01-01T00:00:00Z');db.sqlite.prepare('UPDATE subscription_accounts SET customer_id=? WHERE workspace_id=?').run('cus_fixture',w);
 const client=new Stripe(env.STRIPE_RESTRICTED_KEY,{apiVersion:'2026-09-30.endive',maxNetworkRetries:0,httpClient:Stripe.createFetchHttpClient(async(url)=>{
  const path=new URL(url).pathname;state.requests.push(path);assert.equal(new URL(url).hostname,'api.stripe.com');
  if(state.deny===path)return Response.json({error:{type:'invalid_request_error',message:'rk_live_private whsec_private personal@example.com'}},{status:403,headers:{'request-id':'req_SafeDiagnostic123'}});
  if(path==='/v1/subscriptions')return Response.json({object:'list',data:[state.sub],has_more:false});
  if(path==='/v1/invoices')return Response.json({object:'list',data:[],has_more:false});
  throw Error('Unexpected local SDK transport request');
 })});
 const call=async(path,body,user='alice')=>{const response=await handle(new Request(ORIGIN+'/api/quenvira/'+path,{method:body===undefined?'GET':'POST',headers:{origin:ORIGIN,'content-type':'application/json','oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@example.com'},...(body===undefined?{}:{body:JSON.stringify(body)})}),db,{billingEnv:env,billingClient:client,now:()=>new Date(state.now),bucket:db.bucket});return {status:response.status,body:await response.json()}};
 const event=async(id,type,object)=>{const payload=JSON.stringify({id,type,livemode:false,data:{object}}),signature=client.webhooks.generateTestHeaderString({payload,secret});const r=await handle(new Request(ORIGIN+'/api/quenvira/subscription-webhook',{method:'POST',headers:{'stripe-signature':signature},body:payload}),db,{billingEnv:env,billingClient:client});return {status:r.status,body:await r.json()}};
 const write=()=>call(`workspaces/${w}/commands`,{requestId:crypto.randomUUID(),revision:db.sqlite.prepare('SELECT revision FROM workspaces WHERE id=?').get(w).revision,action:'customer.save',data:customer});
 return {db,w,state,client,call,event,write};
}
test('real SDK 403s retain only safe operation, permission family and request ID; application still fails closed',async()=>{
 for(const [path,operation,permissions]of [['/v1/subscriptions','subscriptions.list',['subscription_read','invoice_read']],['/v1/invoices','invoices.list',['invoice_read']]]){
  const f=await fixture(),logs=[],original=console.error;f.state.deny=path;console.error=(...args)=>logs.push(args.join(' '));
  try{const r=await f.call(`workspaces/${f.w}/subscription`);assert.equal(r.status,503);assert.equal(r.body.error,'Service temporarily unavailable.');assert.equal(logs.length,1);
   const diagnostic=JSON.parse(logs[0].slice(logs[0].indexOf('{')));assert.equal(diagnostic.type,'StripePermissionError');assert.equal(diagnostic.status,403);assert.equal(diagnostic.requestId,'req_SafeDiagnostic123');assert.equal(diagnostic.operation,operation);assert.deepEqual(diagnostic.expectedPermissions,permissions);
   for(const value of ['rk_live_private','whsec_private','personal@example.com','cus_fixture'])assert.ok(!logs[0].includes(value));
  }finally{console.error=original;f.db.sqlite.close()}
 }
});
test('diagnostics reject unknown operation labels and untrusted free-form diagnostic fields',async()=>{
 let executed=false;await assert.rejects(stripeOperation('secret-operation',async()=>{executed=true}));assert.equal(executed,false);
 assert.equal(stripeFailureDiagnostic(null),null);assert.equal(stripeFailureDiagnostic('secret'),null);
 const err=Object.assign(Error('private'),{type:'StripePermissionError',requestId:'req_bad?email=private',statusCode:700,operation:'private',expectedPermissions:['private']});
 assert.deepEqual(stripeFailureDiagnostic(err),{type:'StripePermissionError',requestId:undefined,status:undefined});
});
test('real SDK with local transport covers signed receipt replay, failed payment, settlement, renewal boundary and cancellation',async()=>{
 const f=await fixture();try{
  assert.equal((await f.call(`workspaces/${f.w}/subscription`)).body.canWrite,true);assert.equal((await f.write()).status,200);
  assert.equal((await f.event('evt_cycle','invoice.paid',invoice())).status,200);
  assert.equal((await f.event('evt_cycle','invoice.paid',invoice())).body.replayed,true);
  f.state.sub.status='past_due';f.state.sub.latest_invoice={...invoice(),status:'open',amount_remaining:1499};
  assert.equal((await f.event('evt_failed','invoice.payment_failed',f.state.sub.latest_invoice)).status,200);assert.equal((await f.write()).status,402);
  assert.equal((await f.call(`workspaces/${f.w}/backup-file`)).status,200);
  f.state.sub.status='active';assert.equal((await f.call(`workspaces/${f.w}/subscription`)).body.status,'payment_pending');assert.equal((await f.write()).status,402);
  f.state.sub.latest_invoice=invoice();assert.equal((await f.event('evt_recovered','invoice.paid',invoice())).status,200);assert.equal((await f.write()).status,200);
  f.state.sub.cancel_at_period_end=true;assert.equal((await f.call(`workspaces/${f.w}/subscription`)).body.canWrite,true);
  f.state.now+=3600001;assert.equal((await f.write()).status,402);f.state.sub.items.data[0].current_period_end=f.state.now/1000+86400;
  // Provider periods must be integer seconds, independent of millisecond clocks.
  f.state.sub.items.data[0].current_period_end=Math.ceil(f.state.sub.items.data[0].current_period_end);assert.equal((await f.write()).status,200);
  f.state.sub.status='canceled';assert.equal((await f.event('evt_cancel','customer.subscription.deleted',f.state.sub)).status,200);assert.equal((await f.write()).status,402);
  assert.equal((await f.event('evt_cycle','invoice.paid',invoice())).body.replayed,true);assert.equal((await f.call(`workspaces/${f.w}/subscription`)).body.canWrite,false);
  await setup(f.db,'bob');assert.equal((await f.call(`workspaces/${f.w}/subscription`,undefined,'bob')).status,404);assert.equal(f.db.sqlite.prepare('PRAGMA foreign_key_check').all().length,0);
 }finally{f.db.sqlite.close()}
});
