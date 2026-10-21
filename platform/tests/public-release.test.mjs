import test from 'node:test';
import assert from 'node:assert/strict';
import {handle} from '../server/api.mjs';
import {database,setup,fixtures,request,ORIGIN,fixed} from './support/database.mjs';

async function call(db,path,{user='visitor',email='visitor@example.com',body,pilotEmails,headers={}}={}){
 const h={'oai-authenticated-user-id':user,'oai-authenticated-user-email':email,...headers};
 if(body!==undefined)Object.assign(h,{'content-type':'application/json',origin:ORIGIN});
 const r=await handle(new Request(ORIGIN+'/api/quenvira/'+path,{method:body===undefined?'GET':'POST',headers:h,body:body===undefined?undefined:JSON.stringify(body)}),db,{now:fixed,bucket:db.bucket,pilotEmails});
 return {status:r.status,body:await r.json()};
}

test('public sign-in does not enroll a new business, even with spoofed body or header flags',async()=>{
 const db=database();
 for(const pilotEmails of [undefined,'','owner@example.com']){
  const s=await call(db,'session',{pilotEmails});assert.equal(s.status,200);assert.equal(s.body.canCreateWorkspace,false);assert.deepEqual(s.body.workspaces,[]);
  const r=await call(db,'workspaces',{pilotEmails,body:{name:'Unapproved business',pilotEmails:'visitor@example.com',canCreateWorkspace:true},headers:{'x-pilot-email':'visitor@example.com'}});
  assert.equal(r.status,403);assert.match(r.body.error,/invitation-only/);
 }
 assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM workspaces').get().n,0);
 assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM memberships').get().n,0);
 db.sqlite.close();
});
test('exact enrolled identity can create retry-safely without leaking the allowlist',async()=>{
 const db=database(),options={email:'PILOT@example.com',pilotEmails:' owner@example.com, pilot@example.com '};
 const s=await call(db,'session',options);assert.equal(s.body.canCreateWorkspace,true);assert.ok(!JSON.stringify(s.body).includes('owner@example.com'));
 const a=await call(db,'workspaces',{...options,body:{name:'Pilot business'}}),b=await call(db,'workspaces',{...options,body:{name:'Duplicate'}});
 assert.equal(a.status,201);assert.equal(b.body.workspaceId,a.body.workspaceId);
 assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM workspaces').get().n,1);
 for(const email of ['notpilot@example.com','pilot@example.com.evil','xpilot@example.com'])assert.equal((await call(db,'workspaces',{...options,email,body:{name:'Denied'}})).status,403);
 db.sqlite.close();
});
test('closing enrollment preserves existing manager and staff access and cross-business isolation',async()=>{
 const db=database(),w=await setup(db),f=await fixtures(db,w);
 const invitation=await request(db,`workspaces/${w}/invitations`,{email:'visitor@example.com',staffId:f.staffId});
 assert.equal((await call(db,'invitations/accept',{body:{token:invitation.body.token}})).status,200);
 const staff=await call(db,'workspaces/'+w);assert.equal(staff.status,200);assert.equal(staff.body.actor.role,'staff');
 assert.equal((await call(db,`workspaces/${w}/backup-file`)).status,403);
 assert.equal((await call(db,'workspaces/'+w,{user:'stranger',email:'stranger@example.com'})).status,404);
 const manager=await call(db,'workspaces/'+w,{user:'alice',email:'alice@example.com'});assert.equal(manager.status,200);assert.equal(manager.body.actor.role,'manager');
 const session=await call(db,'session',{user:'alice',email:'alice@example.com'});assert.equal(session.body.canCreateWorkspace,false);assert.equal(session.body.workspaces[0].id,w);
 db.sqlite.close();
});
