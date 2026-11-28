import test from 'node:test';
import assert from 'node:assert/strict';
import {handle} from '../server/api.mjs';
import {PLAN_TERMS_VERSION} from '../server/subscriptions.mjs';
import {database,ORIGIN,fixed,customer} from './support/database.mjs';

const env={QUENVIRA_BILLING_MODE:'test',STRIPE_RESTRICTED_KEY:'rk_test_fixture',STRIPE_WEBHOOK_SECRET:'whsec_fixture',STRIPE_PORTAL_CONFIGURATION:'bpc_fixture',QUENVIRA_SITE_ORIGIN:ORIGIN,QUENVIRA_TERMS_VERSION:PLAN_TERMS_VERSION,QUENVIRA_PLAN_CATALOG:'solo-team-v1',STRIPE_SOLO_PRICE_ID:'price_solo',STRIPE_TEAM_PRICE_ID:'price_team'};
const options=(db,client)=>({now:fixed,bucket:db.bucket,pilotEmails:'alice@example.com',billingEnv:env,billingClient:client});
const client=()=>({subscriptions:{list:async()=>({data:[],has_more:false})}});
const headers=user=>({'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@example.com'});
async function get(db,ws,user,provider){const r=await handle(new Request(`${ORIGIN}/api/quenvira/workspaces/${ws}`,{headers:headers(user)}),db,options(db,provider));return {status:r.status,body:await r.json()}}
async function send(db,ws,path,body,user,provider){const r=await handle(new Request(`${ORIGIN}/api/quenvira/workspaces/${ws}/${path}`,{method:body===undefined?'GET':'POST',headers:{...headers(user),...(body===undefined?{}:{origin:ORIGIN,'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)}),db,options(db,provider));return {status:r.status,body:await r.json()}}
async function workspace(db,provider){
 const r=await handle(new Request(`${ORIGIN}/api/quenvira/workspaces`,{method:'POST',headers:{...headers('alice'),origin:ORIGIN,'content-type':'application/json'},body:JSON.stringify({name:'Fictional Recovery Co'})}),db,options(db,provider));
 assert.equal(r.status,201);return (await r.json()).workspaceId;
}
async function command(db,ws,action,data,user='alice',provider){
 const current=await get(db,ws,user,provider);
 return send(db,ws,'commands'+(action==='backup.import'?'/backup':''),{action,data,requestId:crypto.randomUUID(),revision:current.body.revision},user,provider);
}
const expire=db=>db.sqlite.prepare("UPDATE subscription_accounts SET trial_end='2026-01-01T00:00:00.000Z'").run();

test('an expired trial blocks routine writes but keeps manager revision restore available',async()=>{
 const db=database(),provider=client(),w=await workspace(db,provider);
 assert.equal((await command(db,w,'customer.save',customer,undefined,provider)).status,200);
 assert.equal((await command(db,w,'staff.add',{name:'Fictional Worker',role:'Cleaner',capacity:480},undefined,provider)).status,200);
 const before=(await get(db,w,'alice',provider)).body;expire(db);
 assert.equal((await command(db,w,'customer.save',{...customer,name:'Blocked'},undefined,provider)).status,402);
 const restored=await command(db,w,'backup.restore',{revision:1},undefined,provider);
 assert.equal(restored.status,200);
 const after=(await get(db,w,'alice',provider)).body;
 assert.equal(after.revision,before.revision+1);
 assert.deepEqual(after.state.staff,[]);
 assert.equal(after.state.customers[0].name,customer.name);
 db.sqlite.close();
});

test('an expired trial keeps encrypted export and empty-workspace import available',async()=>{
 const db=database(),provider=client(),w=await workspace(db,provider);
 assert.equal((await command(db,w,'customer.save',customer,undefined,provider)).status,200);expire(db);
 const file=await send(db,w,'backup-file',undefined,'alice',provider);
 assert.equal(file.status,200);assert.equal(file.body.format,'quenvira-business-backup-v1');
 const targetDb=database(),target=await workspace(targetDb,provider);
 const imported=await command(targetDb,target,'backup.import',{backup:{format:'quenvira-business-backup-v1',createdAt:'2026-10-20T10:00:00.000Z',workspaceName:'Fictional Recovery Co',photos:[],state:{version:1,customers:[{id:'c-old',name:'Fictional Old Customer',email:'',type:'Domestic',address:'1 Fictional Street',notes:'',active:true}],staff:[],jobs:[],invoices:[],audit:[]}}},undefined,provider);
 assert.equal(imported.status,200);
 assert.equal((await get(targetDb,target,'alice',provider)).body.state.customers[0].name,'Fictional Old Customer');
 targetDb.sqlite.close();db.sqlite.close();
});

test('provider outage fails routine writes closed while recovery and export still work',async()=>{
 const db=database(),provider=client(),w=await workspace(db,provider);
 assert.equal((await command(db,w,'customer.save',customer,undefined,provider)).status,200);
 assert.equal((await command(db,w,'staff.add',{name:'Fictional Worker',role:'Cleaner',capacity:480},undefined,provider)).status,200);
 const outage={subscriptions:{list:async()=>{throw Error('provider unavailable')}}};
 db.sqlite.prepare("UPDATE subscription_accounts SET customer_id='cus_fixture' WHERE workspace_id=?").run(w);
 assert.equal((await command(db,w,'customer.save',{...customer,name:'Blocked'},undefined,outage)).status,503);
 assert.equal((await send(db,w,'backup-file',undefined,'alice',outage)).status,200);
 const restored=await command(db,w,'backup.restore',{revision:1},undefined,outage);
 assert.equal(restored.status,200);
 assert.equal((await get(db,w,'alice',outage)).body.state.customers[0].name,customer.name);
 db.sqlite.close();
});

test('recovery remains manager-only on an expired trial',async()=>{
 const db=database(),provider=client(),w=await workspace(db,provider);
 const added=await command(db,w,'staff.add',{name:'Fictional Worker',role:'Cleaner',capacity:480},undefined,provider);
 db.sqlite.prepare("INSERT INTO memberships (workspace_id,user_id,role,staff_id) VALUES (?,?,'staff',?)").run(w,'worker',added.body.result.id);
 expire(db);
 assert.equal((await command(db,w,'backup.restore',{revision:1},'worker',provider)).status,403);
 db.sqlite.close();
});
