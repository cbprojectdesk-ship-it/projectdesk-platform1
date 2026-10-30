import test from 'node:test';
import assert from 'node:assert/strict';
import {billingConfig,startTrial,entitlement,checkout,PLAN_TERMS_VERSION} from '../server/subscriptions.mjs';
import {handle} from '../server/api.mjs';
import {database,setup,fixtures,ORIGIN,fixed,customer} from './support/database.mjs';
const env={QUENVIRA_BILLING_MODE:'test',STRIPE_RESTRICTED_KEY:'rk_test_fixture',STRIPE_WEBHOOK_SECRET:'whsec_fixture',STRIPE_PORTAL_CONFIGURATION:'bpc_fixture',QUENVIRA_SITE_ORIGIN:ORIGIN,QUENVIRA_TERMS_VERSION:PLAN_TERMS_VERSION,QUENVIRA_PLAN_CATALOG:'solo-team-v1',STRIPE_SOLO_PRICE_ID:'price_solo',STRIPE_TEAM_PRICE_ID:'price_team',QUENVIRA_TEAM_STAFF_LIMIT:'5'};
const terms={acceptTerms:true,termsVersion:PLAN_TERMS_VERSION},stamp=fixed().toISOString(),time=fixed().getTime();
function provider(){
 let subs=[];const calls=[],sessions=new Map(),keys=new Map();
 return {calls,sessions,setSubs:s=>subs=s,invoices:{list:async()=>({data:[],has_more:false})},subscriptions:{list:async()=>({data:subs,has_more:false})},customers:{create:async()=>({id:'cus_plan',livemode:false})},prices:{retrieve:async id=>({active:true,livemode:false,currency:'gbp',unit_amount:id==='price_solo'?799:1499,billing_scheme:'per_unit',tax_behavior:'inclusive',recurring:{interval:'month',interval_count:1,usage_type:'licensed'}})},checkout:{sessions:{retrieve:async id=>sessions.get(id),create:async(params,options)=>{calls.push(params);if(keys.has(options.idempotencyKey)){assert.deepEqual(params,keys.get(options.idempotencyKey).params);return keys.get(options.idempotencyKey).result}const result={id:'cs_'+sessions.size,status:'open',customer:'cus_plan',livemode:false,url:'https://checkout.stripe.com/c/pay/test',metadata:params.metadata};sessions.set(result.id,result);keys.set(options.idempotencyKey,{params,result});return result}}}};
}
const paid=(plan,status='active')=>({id:'sub_plan',customer:'cus_plan',livemode:false,status,latest_invoice:{id:'in_confirmed',livemode:false,status:'paid',amount_remaining:0,customer:'cus_plan',subscription:'sub_plan'},items:{data:[{price:{id:'price_'+plan},quantity:1,current_period_end:Math.floor(time/1000)+86400}]}});
async function fixture(){const db=database(),workspace=await setup(db);await startTrial(db,workspace,stamp);const client=provider(),config=billingConfig(env);return {db,workspace,client,config}}
async function call(f,path,body,user='alice'){
 const r=await handle(new Request(ORIGIN+'/api/quenvira/'+path,{method:body===undefined?'GET':'POST',headers:{'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@example.com',origin:ORIGIN,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})}),f.db,{billingEnv:env,billingClient:f.client,now:fixed,bucket:f.db.bucket});return {status:r.status,body:await r.json()};
}
const command=(f,action,data)=>call(f,'workspaces/'+f.workspace+'/commands',{action,data,revision:f.db.sqlite.prepare('SELECT revision FROM workspaces WHERE id=?').get(f.workspace).revision,requestId:crypto.randomUUID()});
test('catalogue is opt-in, requires distinct fixed prices and the agreed five-person Team allowance',()=>{
 assert.equal(billingConfig({...env,QUENVIRA_TEAM_STAFF_LIMIT:undefined}).plans[1].maxStaff,5);
 assert.equal(billingConfig({...env,QUENVIRA_PLAN_CATALOG:undefined,QUENVIRA_TERMS_VERSION:'2026-10-28',STRIPE_PRICE_ID:'price_legacy'}).plans,undefined);
 for(const patch of [{QUENVIRA_BILLING_MODE:'live',STRIPE_RESTRICTED_KEY:'rk_live_fixture',QUENVIRA_PAID_LAUNCH_APPROVED:'yes'},{QUENVIRA_TERMS_VERSION:'2026-10-28'},{QUENVIRA_PLAN_CATALOG:'enterprise'},{STRIPE_TEAM_PRICE_ID:'price_solo'},{QUENVIRA_TEAM_STAFF_LIMIT:'10'},{QUENVIRA_TEAM_STAFF_LIMIT:'1'},{QUENVIRA_TEAM_STAFF_LIMIT:'51'},{STRIPE_SOLO_PRICE_ID:'evil'}])assert.throws(()=>billingConfig({...env,...patch}));
});
test('each election uses its exact server price, validates amount, and never trusts client price or limit',async()=>{
 for(const [plan,price]of [['solo','price_solo'],['team','price_team']]){const f=await fixture();try{await checkout(f.db,f.workspace,'alice@example.com',{...terms,plan,price:'price_evil',maxStaff:900},f.config,f.client,stamp);assert.deepEqual(f.client.calls[0].line_items,[{price,quantity:1}]);assert.equal(f.client.calls[0].metadata.quenvira_plan,plan);assert.equal(f.client.calls[0].subscription_data.trial_end,Math.floor(time/1000)+14*86400);await checkout(f.db,f.workspace,'alice@example.com',{...terms,plan},f.config,f.client,stamp);assert.equal(f.client.calls.length,1);await assert.rejects(checkout(f.db,f.workspace,'alice@example.com',{...terms,plan:plan==='solo'?'team':'solo'},f.config,f.client,stamp),/another plan/)}finally{f.db.sqlite.close()}}
 const f=await fixture();try{for(const plan of [undefined,'enterprise','price_solo'])await assert.rejects(checkout(f.db,f.workspace,'alice@example.com',{...terms,plan},f.config,f.client,stamp),/Choose an available Solo or Team plan/);f.client.prices.retrieve=async()=>({active:true,livemode:false,currency:'gbp',unit_amount:1});await assert.rejects(checkout(f.db,f.workspace,'alice@example.com',{...terms,plan:'solo'},f.config,f.client,stamp),/approved/);assert.equal(f.client.calls.length,0)}finally{f.db.sqlite.close()}
});
test('trial is card-free Team access and paid plan follows provider state across downgrade and recovery',async()=>{
 const f=await fixture();try{let a=await entitlement(f.db,f.workspace,f.config,f.client,time);assert.equal(a.plan,'team');assert.equal(a.canWrite,true);assert.equal(a.maxStaff,5);assert.equal(a.plans[0].price,undefined);
 await checkout(f.db,f.workspace,'alice@example.com',{...terms,plan:'team'},f.config,f.client,stamp);f.db.sqlite.prepare('UPDATE subscription_accounts SET trial_end=?').run('2026-01-01');
 for(const plan of ['solo','team']){f.client.setSubs([paid(plan)]);a=await entitlement(f.db,f.workspace,f.config,f.client,time);assert.equal(a.plan,plan);assert.equal(a.canWrite,true);assert.equal(a.staffAccess,plan==='team')}
 for(const status of ['past_due','unpaid','paused','incomplete','canceled']){f.client.setSubs([paid('team',status)]);assert.equal((await entitlement(f.db,f.workspace,f.config,f.client,time)).canWrite,false,status)}
 f.client.setSubs([paid('team')]);assert.equal((await entitlement(f.db,f.workspace,f.config,f.client,time)).canWrite,true);
 f.client.setSubs([paid('solo'),paid('team')]);await assert.rejects(entitlement(f.db,f.workspace,f.config,f.client,time),/Multiple subscriptions/);
 for(const s of [{...paid('team'),livemode:true},paid('unapproved'),{...paid('team'),items:{data:[{price:{id:'price_team'},quantity:2,current_period_end:time/1000+1000}]}}]){f.client.setSubs([s]);assert.equal((await entitlement(f.db,f.workspace,f.config,f.client,time)).canWrite,false)}
 }finally{f.db.sqlite.close()}
});
test('Solo enforces owner-only access, preserves over-limit records/exports, and Team restores access without data rewrites',async()=>{
 const f=await fixture();try{const data=await fixtures(f.db,f.workspace);await checkout(f.db,f.workspace,'alice@example.com',{...terms,plan:'solo'},f.config,f.client,stamp);f.db.sqlite.prepare('UPDATE subscription_accounts SET trial_end=?').run('2026-01-01');f.client.setSubs([paid('solo')]);
 assert.equal((await command(f,'staff.add',{name:'Second',capacity:480,role:'Cleaner'})).status,409);assert.equal((await call(f,'workspaces/'+f.workspace+'/invitations',{email:'worker@example.com',staffId:data.staffId})).status,403);
 const invited=await call(f,'workspaces/'+f.workspace+'/subscription');assert.equal(invited.body.plan,'solo');
 f.db.sqlite.prepare("INSERT INTO memberships VALUES (?,?,'staff',?)").run(f.workspace,'worker',data.staffId);const before=f.db.sqlite.prepare('SELECT document FROM workspaces').get().document;
 for(const path of ['', '/staff/'+data.staffId+'/photo','/backup-file'])assert.equal((await call(f,'workspaces/'+f.workspace+path,undefined,'worker')).status,403);
 assert.equal((await command(f,'customer.save',customer)).status,402);assert.equal((await call(f,'workspaces/'+f.workspace)).status,200);assert.equal((await call(f,'workspaces/'+f.workspace+'/backup-file')).status,200);
 f.client.setSubs([paid('team')]);assert.equal((await call(f,'workspaces/'+f.workspace,undefined,'worker')).status,200);assert.equal(f.db.sqlite.prepare('SELECT document FROM workspaces').get().document,before);assert.equal((await command(f,'customer.save',customer)).status,200);
 }finally{f.db.sqlite.close()}
});
test('Team record limit is atomic and Solo checkout rejects existing multi-person records',async()=>{
 const f=await fixture();try{for(let i=0;i<5;i++)assert.equal((await command(f,'staff.add',{name:'Staff '+i,capacity:480,role:'Cleaner'})).status,200);const before=f.db.sqlite.prepare('SELECT document,revision FROM workspaces').get();const rejected=await command(f,'staff.add',{name:'Too many',capacity:480,role:'Cleaner'});assert.equal(rejected.status,409);assert.match(rejected.body.error,/people allowance/);assert.deepEqual(f.db.sqlite.prepare('SELECT document,revision FROM workspaces').get(),before);await assert.rejects(checkout(f.db,f.workspace,'alice@example.com',{...terms,plan:'solo'},f.config,f.client,stamp),/exceed this plan/);assert.equal(f.client.calls.length,0)}finally{f.db.sqlite.close()}
});
test('larger bands have fixed decreasing per-person rates, no enterprise checkout, and exact owner-inclusive seats',async()=>{
 const v2={...env,QUENVIRA_PLAN_CATALOG:'solo-team-v2',STRIPE_TEAM10_PRICE_ID:'price_team10',STRIPE_TEAM15_PRICE_ID:'price_team15',STRIPE_TEAM20_PRICE_ID:'price_team20'},config=billingConfig(v2);
 assert.deepEqual(config.plans.map(p=>[p.id,p.amount,p.maxPeople,p.maxStaffAccounts]),[['solo',799,1,0],['team',1499,5,4],['team10',2499,10,9],['team15',3299,15,14],['team20',3999,20,19]]);
 assert.throws(()=>billingConfig({...v2,STRIPE_TEAM20_PRICE_ID:'price_team10'}));assert.throws(()=>billingConfig({...v2,STRIPE_TEAM15_PRICE_ID:undefined}));
 for(const plan of config.plans){const f=await fixture();try{f.client.prices.retrieve=async id=>({active:true,livemode:false,currency:'gbp',unit_amount:plan.amount,billing_scheme:'per_unit',tax_behavior:'inclusive',recurring:{interval:'month',interval_count:1,usage_type:'licensed'}});await checkout(f.db,f.workspace,'alice@example.com',{...terms,plan:plan.id,maxPeople:100},config,f.client,stamp);assert.equal(f.client.calls[0].line_items[0].price,plan.price);f.db.sqlite.prepare("UPDATE subscription_accounts SET trial_end='2026-01-01'").run();f.client.setSubs([paid(plan.id)]);const access=await entitlement(f.db,f.workspace,config,f.client,time);assert.equal(access.maxStaffAccounts,plan.maxPeople-1);assert.equal(access.canWrite,true)}finally{f.db.sqlite.close()}}
});
test('fifth independent staff sign-in is rejected and racing acceptance cannot exceed owner plus four',async()=>{
 for(const racing of [false,true]){const f=await fixture();try{const data=await fixtures(f.db,f.workspace);const invite=await call(f,'workspaces/'+f.workspace+'/invitations',{email:'worker@example.com',staffId:data.staffId});assert.equal(invite.status,201);
 for(let i=0;i<(racing?3:4);i++)f.db.sqlite.prepare("INSERT INTO memberships VALUES (?,?,'staff',?)").run(f.workspace,'member'+i,data.staffId);
 if(racing)f.db.beforeBatch=()=>f.db.sqlite.prepare("INSERT INTO memberships VALUES (?,?,'staff',?)").run(f.workspace,'racer',data.staffId);
 const result=await call(f,'invitations/accept',{token:invite.body.token},'worker');assert.notEqual(result.status,200);assert.equal(f.db.sqlite.prepare("SELECT COUNT(*) n FROM memberships WHERE role='staff'").get().n,4);assert.equal(f.db.sqlite.prepare("SELECT accepted_by FROM invitations").get().accepted_by,null);
 }finally{f.db.sqlite.close()}}
});
