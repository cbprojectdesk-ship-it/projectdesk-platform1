import test from 'node:test';
import assert from 'node:assert/strict';
import {handle} from '../server/api.mjs';
import {validateState} from '../server/domain.mjs';
import {database,setup,fixtures,request,command,job,ORIGIN,fixed} from './support/database.mjs';
import {JPEG} from './support/photo-fixture.mjs';
import {createBusinessBackup,prepareBusinessRestore} from '../server/business-backup.mjs';
import {decodeJobPhoto} from '../server/job-photos.mjs';
const hash=async value=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))).toString('hex');
const supplier={legalName:'Fictional Cleaner',tradingName:'',entity:'sole-trader',address:'Fictional Road',contact:'billing@example.com',companyNumber:'',vatRegistered:true,vatNumber:'GB123456789'};
const week=()=>Array.from({length:7},()=>({available:true,start:'09:00',end:'17:00'}));
const state=async(db,w,user='alice')=>(await request(db,'workspaces/'+w,undefined,user)).body.state;
const worker=(db,w,f,user='worker')=>db.sqlite.prepare("INSERT INTO memberships VALUES (?,?,'staff',?)").run(w,user,f.staffId);
async function init(){const db=database(),w=await setup(db),f=await fixtures(db,w);worker(db,w,f);return {db,w,f};}
const ok=r=>{assert.equal(r.status,200,JSON.stringify(r.body));return r.body.result;};
const qdata=f=>({customerId:f.customerId,description:'Fictional regular clean',validUntil:'2026-11-20',vat:20,terms:'Fictional test only',lines:[{description:'Two visits',quantity:2,unitPrice:2501},{description:'Supplies',quantity:1,unitPrice:999}]});
test('quote lifecycle persists snapshots, converts once and inherits agreed VAT through invoicing',async()=>{
 const {db,w,f}=await init();try{
 ok(await command(db,w,'supplier.save',supplier));const q=ok(await command(db,w,'quote.save',qdata(f)));assert.equal(q.net,6001);assert.equal(q.total,7201);
 assert.equal((await command(db,w,'quote.action',{id:q.id,action:'accept'})).status,400);
 ok(await command(db,w,'quote.action',{id:q.id,action:'issue'}));const frozen=structuredClone((await state(db,w)).quotes[0].snapshot);
 ok(await command(db,w,'supplier.save',{...supplier,legalName:'Revised supplier'}));assert.deepEqual((await state(db,w)).quotes[0].snapshot,frozen);
 assert.equal((await command(db,w,'quote.save',{...qdata(f),id:q.id,description:'Changed'})).status,400);
 ok(await command(db,w,'quote.action',{id:q.id,action:'accept'}));const converted=ok(await command(db,w,'quote.action',{id:q.id,action:'convert',date:'2026-10-20',time:'09:00',duration:60,staffId:f.staffId}));
 assert.equal((await command(db,w,'quote.action',{id:q.id,action:'convert',date:'2026-10-20',time:'11:00',duration:60})).status,400);
 let current=await state(db,w);assert.equal(current.jobs.length,1);const j=current.jobs[0];assert.equal(j.quoteId,q.id);assert.equal(j.price,q.net);assert.equal(converted.jobId,j.id);
 assert.equal((await command(db,w,'job.save',{...j,price:1})).status,400);
 ok(await command(db,w,'job.update',{id:j.id,action:'start'},'worker'));for(let value=0;value<j.checklist.length;value++)ok(await command(db,w,'job.update',{id:j.id,action:'check',value},'worker'));ok(await command(db,w,'job.update',{id:j.id,action:'complete'},'worker'));
 const i=ok(await command(db,w,'invoice.create',{jobId:j.id,vat:0}));assert.equal(i.vat,20);assert.equal(i.total,q.total);
 const staff=await state(db,w,'worker');assert.equal(staff.quotes,undefined);assert.equal(staff.jobs[0].quoteId,undefined);assert.equal(staff.jobs[0].price,undefined);assert.deepEqual(staff.invoices,[]);
 }finally{db.sqlite.close()}
});
test('quote validation rejects invalid prices, VAT, expiry and staff access without mutations',async()=>{
 const {db,w,f}=await init();try{
 for(const data of [{...qdata(f),vat:20},{...qdata(f),vat:0,lines:[]},{...qdata(f),vat:0,lines:[{description:'Bad',quantity:1.5,unitPrice:100}]},{...qdata(f),vat:0,lines:[{description:'Bad',quantity:1,unitPrice:-1}]},{...qdata(f),vat:0,validUntil:'2026-02-30'}])assert.equal((await command(db,w,'quote.save',data)).status,400);
 assert.equal((await state(db,w)).quotes,undefined);assert.equal((await command(db,w,'quote.save',{...qdata(f),vat:0},'worker')).status,403);
 const q=ok(await command(db,w,'quote.save',{...qdata(f),vat:0}));assert.equal((await command(db,w,'quote.action',{id:q.id,action:'issue'})).status,400);
 }finally{db.sqlite.close()}
});
test('weekly availability checks recurring bookings atomically and protects other staff records',async()=>{
 const {db,w,f}=await init();try{
 const restricted=week();restricted[1]={available:true,start:'10:00',end:'12:00'};
 ok(await command(db,w,'availability.save',{staffId:f.staffId,week:restricted},'worker'));
 assert.equal((await command(db,w,'job.save',{...job(f),repeat:'Weekly',count:3})).status,400);assert.equal((await state(db,w)).jobs.length,0);
 const j=ok(await command(db,w,'job.save',{...job(f),time:'10:00',duration:60}))[0];
 const unavailable=week();unavailable[1].available=false;assert.equal((await command(db,w,'availability.save',{staffId:f.staffId,week:unavailable},'worker')).status,400);
 assert.equal((await state(db,w)).availability[0].week[1].available,true);
 const other=ok(await command(db,w,'staff.add',{name:'Other worker',role:'Cleaner',capacity:480}));
 assert.equal((await command(db,w,'availability.save',{staffId:other.id,week:week()},'worker')).status,403);
 assert.equal((await command(db,w,'leave.request',{staffId:other.id,from:'2026-10-21',to:'2026-10-21',type:'Holiday'},'worker')).status,403);
 assert.equal((await state(db,w,'worker')).availability.length,1);assert.equal(j.staffId,f.staffId);
 }finally{db.sqlite.close()}
});
test('time off needs manager approval, detects existing bookings and blocks subsequent assignments',async()=>{
 const {db,w,f}=await init();try{
 const j=ok(await command(db,w,'job.save',{...job(f),date:'2026-10-21'}))[0];
 const r=ok(await command(db,w,'leave.request',{staffId:f.staffId,from:'2026-10-21',to:'2026-10-23',type:'Holiday',note:'Family plans'},'worker'));
 assert.equal((await command(db,w,'leave.decide',{id:r.id,status:'Approved'},'worker')).status,403);
 assert.equal((await command(db,w,'leave.decide',{id:r.id,status:'Approved'})).status,400);
 ok(await command(db,w,'job.update',{id:j.id,action:'cancel'}));ok(await command(db,w,'leave.decide',{id:r.id,status:'Approved',managerNote:'Approved dates'}));
 assert.equal((await command(db,w,'job.save',{...job(f),date:'2026-10-22'})).status,400);
 assert.equal((await command(db,w,'leave.request',{staffId:f.staffId,from:'2026-10-22',to:'2026-10-24',type:'Holiday'},'worker')).status,400);
 ok(await command(db,w,'leave.decide',{id:r.id,status:'Cancelled'}));ok(await command(db,w,'job.save',{...job(f),date:'2026-10-22'}));
 const notifications=(await state(db,w,'worker')).notifications;assert.ok(notifications.some(n=>n.message.includes('approved')));assert.ok(notifications.every(n=>n.target===f.staffId));
 }finally{db.sqlite.close()}
});
test('notifications persist across sessions, target recipients, and replay without duplicate assignment updates',async()=>{
 const {db,w,f}=await init();try{
 const revision=(await request(db,'workspaces/'+w)).body.revision,id=crypto.randomUUID();
 ok(await command(db,w,'job.save',job(f),'alice',id,revision));ok(await command(db,w,'job.save',job(f),'alice',id,revision));
 const ns=(await state(db,w,'worker')).notifications;assert.equal(ns.length,1);
 const n=ns[0];ok(await command(db,w,'notification.read',{id:n.id},'worker'));assert.ok((await state(db,w,'worker')).notifications[0].readAt);
 ok(await command(db,w,'availability.save',{staffId:f.staffId,week:week()},'worker'));
 const managerNotice=(await state(db,w)).notifications.find(n=>n.target==='manager');assert.ok(managerNotice);
 assert.equal((await command(db,w,'notification.read',{id:managerNotice.id},'worker')).status,403);
 }finally{db.sqlite.close()}
});
test('private job photos enforce assignment and workspace access and survive complete backup restore',async()=>{
 const {db,w,f}=await init();try{
 const j=ok(await command(db,w,'job.save',job(f)))[0];ok(await command(db,w,'job.photo',{id:j.id,stage:'before',caption:'Fictional room',jpegBase64:JPEG},'worker'));
 const s=await state(db,w),p=s.jobs[0].photos[0];assert.equal(p.id,await hash(JPEG));
 const path=`workspaces/${w}/jobs/${j.id}/photos/${p.id}`;
 const read=async(user,workspace=w)=>handle(new Request(ORIGIN+'/api/quenvira/'+path.replace(w,workspace),{headers:{'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@example.com'}}),db,{now:fixed,bucket:db.bucket});
 assert.equal((await read('worker')).status,200);assert.equal((await read('alice')).headers.get('cache-control'),'no-store, private');
 const other=ok(await command(db,w,'staff.add',{name:'Other',role:'Cleaner',capacity:480}));worker(db,w,{staffId:other.id},'other');assert.equal((await read('other')).status,404);
 assert.equal((await command(db,w,'job.photo',{id:j.id,stage:'after',caption:'',jpegBase64:JPEG},'other')).status,403);
 assert.equal((await command(db,w,'job.photo',{id:j.id,stage:'after',caption:'',jpegBase64:JPEG},'worker')).status,400);
 const backup=await createBusinessBackup(s,'Fictional workspace',w,db.bucket,fixed().toISOString());assert.equal(backup.jobPhotos.length,1);
 const empty={version:1,customers:[],staff:[],jobs:[],invoices:[],audit:[]};const restored=await prepareBusinessRestore(empty,{role:'manager'},backup,'destination',db.bucket,hash);assert.deepEqual(restored.jobs[0].photos,s.jobs[0].photos);assert.ok(await db.bucket.get(`destination/jobs/${j.id}/${p.id}.jpg`));
 await assert.rejects(()=>prepareBusinessRestore(empty,{role:'manager'},{...backup,jobPhotos:[]},'other-dest',db.bucket,hash),/missing job photos/);
 db.sqlite.prepare('DELETE FROM memberships WHERE workspace_id=? AND user_id=?').run(w,'worker');assert.equal((await read('worker')).status,404);
 }finally{db.sqlite.close()}
});
test('photo validation, storage failure and transaction revocation do not publish photo references',async()=>{
 const {db,w,f}=await init();try{
 const j=ok(await command(db,w,'job.save',job(f)))[0];assert.throws(()=>decodeJobPhoto('invalid'),/valid staff photo/);
 assert.equal((await command(db,w,'job.photo',{id:j.id,stage:'before',caption:'',jpegBase64:'AAAA'},'worker')).status,400);
 db.bucket.failPut=true;assert.equal((await command(db,w,'job.photo',{id:j.id,stage:'before',caption:'',jpegBase64:JPEG},'worker')).status,503);db.bucket.failPut=false;
 assert.equal((await state(db,w)).jobs[0].photos,undefined);
 db.beforeBatch=()=>db.sqlite.prepare('DELETE FROM memberships WHERE workspace_id=? AND user_id=?').run(w,'worker');assert.equal((await command(db,w,'job.photo',{id:j.id,stage:'before',caption:'',jpegBase64:JPEG},'worker')).status,404);
 assert.equal((await state(db,w)).jobs[0].photos,undefined);
 }finally{db.sqlite.close()}
});
test('state validation rejects malformed optional records and recovery cannot erase issued quote evidence',async()=>{
 const {db,w,f}=await init();try{
 const initial=await state(db,w);for(const field of ['quotes','availability','leaveRequests','notifications'])assert.equal(validateState({...initial,[field]:null}),false);
 ok(await command(db,w,'supplier.save',supplier));const q=ok(await command(db,w,'quote.save',qdata(f)));const before=(await request(db,'workspaces/'+w)).body.revision;ok(await command(db,w,'quote.action',{id:q.id,action:'issue'}));
 assert.equal((await command(db,w,'backup.restore',{revision:before})).status,400);assert.equal((await state(db,w)).quotes[0].status,'Sent');
 }finally{db.sqlite.close()}
});
