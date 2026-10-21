import test from 'node:test';
import assert from 'node:assert/strict';
import {handle} from '../server/api.mjs';
import {decodePhoto,photoKey} from '../server/staff-photos.mjs';
import {JPEG} from './support/photo-fixture.mjs';
import {database,setup,fixtures,request,command,fixed,ORIGIN} from './support/database.mjs';
async function image(db,w,id,user='alice'){
 const headers={'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@example.com'};
 return handle(new Request(ORIGIN+`/api/quenvira/workspaces/${w}/staff/${id}/photo`,{headers}),db,{now:fixed,bucket:db.bucket});
}
test('photo is private, replay-safe and visible after reload without embedding image bytes in workspace records',async()=>{
 const db=database(),w=await setup(db),f=await fixtures(db,w);await setup(db,'bob');const before=(await request(db,'workspaces/'+w)).body,requestId=crypto.randomUUID();
 const saved=await command(db,w,'staff.photo',{id:f.staffId,jpegBase64:JPEG},'alice',requestId,before.revision);assert.equal(saved.status,200);assert.match(saved.body.result.photoId,/^[a-f0-9]{64}$/);assert.equal(db.bucket.files.size,1);
 const replay=await command(db,w,'staff.photo',{id:f.staffId,jpegBase64:JPEG},'alice',requestId,before.revision);assert.equal(replay.body.replayed,true);assert.equal(db.bucket.files.size,1);
 const state=(await request(db,'workspaces/'+w)).body.state;assert.ok(!JSON.stringify(state).includes(JPEG));const result=await image(db,w,f.staffId);assert.equal(result.status,200);assert.equal(result.headers.get('content-type'),'image/jpeg');assert.equal(result.headers.get('x-content-type-options'),'nosniff');assert.match(result.headers.get('cache-control'),/private/);assert.deepEqual(new Uint8Array(await result.arrayBuffer()),decodePhoto(JPEG));assert.equal((await image(db,w,f.staffId,'bob')).status,404);db.sqlite.close();
});
test('workers can see only their own photo and cannot replace staff images',async()=>{
 const db=database(),w=await setup(db),f=await fixtures(db,w),second=(await command(db,w,'staff.add',{name:'Other worker',role:'Cleaner',capacity:480})).body.result;
 for(const id of [f.staffId,second.id])assert.equal((await command(db,w,'staff.photo',{id,jpegBase64:JPEG})).status,200);
 db.sqlite.prepare("INSERT INTO memberships VALUES (?,?,'staff',?)").run(w,'worker',f.staffId);
 assert.equal((await image(db,w,f.staffId,'worker')).status,200);assert.equal((await image(db,w,second.id,'worker')).status,404);assert.equal((await command(db,w,'staff.photo',{id:f.staffId,jpegBase64:JPEG},'worker')).status,403);db.sqlite.close();
});
test('invalid and oversized images, missing storage and stale updates never change the saved pointer',async()=>{
 const db=database(),w=await setup(db),f=await fixtures(db,w),before=(await request(db,'workspaces/'+w)).body;
 for(const jpegBase64 of ['not-an-image','PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+','A'.repeat(44004),'',JPEG.slice(0,-8)])assert.equal((await command(db,w,'staff.photo',{id:f.staffId,jpegBase64})).status,400);
 assert.equal(db.bucket.files.size,0);const bucket=db.bucket;db.bucket=undefined;assert.equal((await command(db,w,'staff.photo',{id:f.staffId,jpegBase64:JPEG})).status,503);db.bucket=bucket;db.bucket.failPut=true;assert.equal((await command(db,w,'staff.photo',{id:f.staffId,jpegBase64:JPEG})).status,503);db.bucket.failPut=false;assert.deepEqual((await request(db,'workspaces/'+w)).body,before);
 await command(db,w,'staff.add',{name:'Concurrent',role:'Cleaner',capacity:480});assert.equal((await command(db,w,'staff.photo',{id:f.staffId,jpegBase64:JPEG},'alice',crypto.randomUUID(),before.revision)).status,409);assert.equal(db.bucket.files.size,0);db.sqlite.close();
});
test('replacement and removal update the pointer; recovery history can still restore a previous photo',async()=>{
 const db=database(),w=await setup(db),f=await fixtures(db,w);const a=await command(db,w,'staff.photo',{id:f.staffId,jpegBase64:JPEG});const revision=(await request(db,'workspaces/'+w)).body.revision;
 await command(db,w,'staff.photo',{id:f.staffId,jpegBase64:JPEG});assert.equal(db.bucket.files.size,1);await command(db,w,'staff.photo',{id:f.staffId,jpegBase64:null});assert.equal((await image(db,w,f.staffId)).status,404);
 assert.equal((await command(db,w,'backup.restore',{revision})).status,200);assert.equal((await image(db,w,f.staffId)).status,200);assert.ok(db.bucket.files.has(photoKey(w,f.staffId,a.body.result.photoId)));db.sqlite.close();
});
test('failed database commit does not expose a staged photo or change staff records',async()=>{
 const db=database(),w=await setup(db),f=await fixtures(db,w),before=(await request(db,'workspaces/'+w)).body;db.failAt=3;
 assert.equal((await command(db,w,'staff.photo',{id:f.staffId,jpegBase64:JPEG})).status,503);db.failAt=null;assert.deepEqual((await request(db,'workspaces/'+w)).body,before);assert.equal((await image(db,w,f.staffId)).status,404);db.sqlite.close();
});

test('workspace deletion removes its stored photos and preserves another business’s objects',async()=>{
 const db=database(),w=await setup(db),f=await fixtures(db,w);await command(db,w,'staff.photo',{id:f.staffId,jpegBase64:JPEG});await db.bucket.put('another-business/photo.jpg',new Uint8Array([1]));assert.equal(db.bucket.files.size,2);
 const removed=await request(db,`workspaces/${w}/delete`,{confirmName:'alice cleaning'});assert.equal(removed.status,200);assert.equal(removed.body.photoCleanupPending,false);assert.deepEqual([...db.bucket.files.keys()],['another-business/photo.jpg']);db.sqlite.close();
});
