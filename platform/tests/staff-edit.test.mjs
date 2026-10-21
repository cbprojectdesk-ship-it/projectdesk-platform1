import test from 'node:test';
import assert from 'node:assert/strict';
import {database,setup,fixtures,request,command,job} from './support/database.mjs';
import {JPEG} from './support/photo-fixture.mjs';
test('staff edits preserve identity, photo and assignments and reject reductions below booked hours atomically',async()=>{
 const db=database(),w=await setup(db),f=await fixtures(db,w);
 await command(db,w,'staff.photo',{id:f.staffId,jpegBase64:JPEG});await command(db,w,'job.save',{...job(f),repeat:'Weekly',count:2});
 let before=(await request(db,'workspaces/'+w)).body;const values={id:f.staffId,name:'Updated name',role:'Deep cleaning',capacity:90};
 let r=await command(db,w,'staff.update',values);assert.equal(r.status,400);assert.match(r.body.error,/Already booked for 2 hours on 2026-10-20/);assert.deepEqual((await request(db,'workspaces/'+w)).body,before);
 r=await command(db,w,'staff.update',{...values,capacity:120});assert.equal(r.status,200);let after=(await request(db,'workspaces/'+w)).body;
 assert.equal(after.state.staff[0].photoId,before.state.staff[0].photoId);assert.equal(after.state.staff[0].capacity,120);assert.deepEqual(after.state.jobs,before.state.jobs);
 r=await command(db,w,'staff.update',{...values,capacity:600});assert.equal(r.status,200);
 db.sqlite.prepare("INSERT INTO memberships VALUES (?,?,'staff',?)").run(w,'worker',f.staffId);
 assert.equal((await command(db,w,'staff.update',{...values,capacity:480},'worker')).status,403);
 for(const capacity of [0,59,721,NaN,90.5])assert.equal((await command(db,w,'staff.update',{...values,capacity})).status,400);
 assert.equal((await command(db,w,'staff.update',{...values,id:'missing',capacity:480})).status,400);db.sqlite.close();
});
