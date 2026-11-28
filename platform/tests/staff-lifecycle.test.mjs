import test from 'node:test';
import assert from 'node:assert/strict';
import {database,setup,fixtures,request,command,job} from './support/database.mjs';
import {validateState,accessibleJobs} from '../server/domain.mjs';
import {dispatchAfterCommand} from '../server/email-background.mjs';
import {JPEG} from './support/photo-fixture.mjs';
const links=db=>({members:db.sqlite.prepare("SELECT * FROM memberships ORDER BY user_id").all(),invites:db.sqlite.prepare('SELECT * FROM invitations ORDER BY hash').all()});
async function fixture(){const db=database(),w=await setup(db),f=await fixtures(db,w);await command(db,w,'staff.photo',{id:f.staffId,jpegBase64:JPEG});const invite=await request(db,`workspaces/${w}/invitations`,{staffId:f.staffId,email:'worker@example.com'});assert.equal(invite.status,201);assert.equal((await request(db,'invitations/accept',{token:invite.body.token},'worker')).status,200);return {db,w,f,token:invite.body.token}}
test('deactivation preserves history and photos, atomically revokes links, blocks old tokens and supports explicit reactivation',async()=>{
 const {db,w,f,token}=await fixture();try{
  const booked=await command(db,w,'job.save',job(f)),id=booked.body.result[0].id;await command(db,w,'job.update',{id,action:'cancel'});
  const before=(await request(db,'workspaces/'+w)).body;
  const result=await command(db,w,'staff.active',{id:f.staffId,active:false});assert.equal(result.status,200);assert.equal(result.headers.get('x-quenvira-email-wake'),'skip');
  let woke=false;dispatchAfterCommand(new Request(`https://quenvira.test/api/quenvira/workspaces/${w}/commands`,{method:'POST'}),new Response(null,{headers:result.headers}),{DB:db},{waitUntil(){woke=true}});assert.equal(woke,false);
  const after=(await request(db,'workspaces/'+w)).body;assert.equal(after.state.staff[0].active,false);assert.equal(after.state.staff[0].photoId,before.state.staff[0].photoId);assert.deepEqual(after.state.jobs,before.state.jobs);assert.equal(links(db).members.length,1);assert.equal(links(db).invites.length,0);assert.equal(db.bucket.files.size,1);
  assert.equal((await request(db,'workspaces/'+w,undefined,'worker')).status,404);assert.equal((await request(db,'invitations/accept',{token},'worker')).status,403);
  assert.equal((await command(db,w,'job.save',{...job(f),time:'12:00'})).status,400);assert.equal((await request(db,`workspaces/${w}/invitations`,{staffId:f.staffId,email:'worker@example.com'})).status,400);
  assert.equal((await command(db,w,'staff.active',{id:f.staffId,active:true})).status,200);assert.equal(links(db).members.length,1);assert.equal(links(db).invites.length,0);
  assert.equal((await command(db,w,'job.save',{...job(f),time:'12:00'})).status,200);
  const fresh=await request(db,`workspaces/${w}/invitations`,{staffId:f.staffId,email:'worker@example.com'});assert.equal(fresh.status,201);assert.equal((await request(db,'invitations/accept',{token:fresh.body.token},'worker')).status,200);
 }finally{db.sqlite.close()}
});
test('open visits, staff callers, invalid status and cross-tenant attempts cannot change lifecycle or permissions',async()=>{
 const {db,w,f}=await fixture();try{
  await setup(db,'bob');await command(db,w,'job.save',job(f));const before=(await request(db,'workspaces/'+w)).body,access=links(db);
  assert.equal((await command(db,w,'staff.active',{id:f.staffId,active:false})).status,400);assert.deepEqual((await request(db,'workspaces/'+w)).body,before);assert.deepEqual(links(db),access);
  assert.equal((await command(db,w,'staff.active',{id:f.staffId,active:false},'worker')).status,403);assert.equal((await command(db,w,'staff.active',{id:f.staffId,active:false},'bob',crypto.randomUUID(),before.revision)).status,404);
  for(const active of [null,'false',0])assert.equal((await command(db,w,'staff.active',{id:f.staffId,active})).status,400);
  const corrupt=structuredClone(before.state);corrupt.staff[0].active='false';assert.equal(validateState(corrupt),false);corrupt.staff[0].active=false;assert.deepEqual(accessibleJobs(corrupt,{role:'staff',staffId:f.staffId}),[]);
 }finally{db.sqlite.close()}
});
test('deactivation rolls back with database failure and cannot revoke links on a losing revision',async()=>{
 for(const racing of [false,true]){const {db,w,f}=await fixture();try{
  const before=(await request(db,'workspaces/'+w)).body,access=links(db);
  if(racing)db.beforeBatch=()=>db.sqlite.prepare('UPDATE workspaces SET revision=revision+1 WHERE id=?').run(w);else db.failAt=6;
  const result=await command(db,w,'staff.active',{id:f.staffId,active:false});assert.equal(result.status,racing?409:503);db.failAt=null;
  const after=(await request(db,'workspaces/'+w)).body;assert.deepEqual(after.state,before.state);assert.deepEqual(links(db),access);
 }finally{db.sqlite.close()}}
});
test('inactive profile blocks residual memberships and racing creation cannot produce a new invitation',async()=>{
 const {db,w,f}=await fixture();try{
  const deactivate=()=>{const row=db.sqlite.prepare('SELECT document FROM workspaces WHERE id=?').get(w),s=JSON.parse(row.document);s.staff[0].active=false;db.sqlite.prepare('UPDATE workspaces SET document=? WHERE id=?').run(JSON.stringify(s),w)};
  db.beforeBatch=deactivate;const created=await request(db,`workspaces/${w}/invitations`,{staffId:f.staffId,email:'another@example.com'});assert.equal(created.status,409);
  for(const path of [`workspaces/${w}`,`workspaces/${w}/staff/${f.staffId}/photo`,`workspaces/${w}/backups`])assert.equal((await request(db,path,undefined,'worker')).status,403);
 }finally{db.sqlite.close()}
});
