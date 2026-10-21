import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {handle} from '../server/api.mjs';
import {encryptBusinessBackup,decryptBusinessBackup} from '../public/backup-crypto.js';
import {database,setup,fixtures,request,command,job,fixed,ORIGIN} from './support/database.mjs';
import {JPEG} from './support/photo-fixture.mjs';
const password='synthetic-test-password-only';
const restore=(db,w,backup,user='alice',requestId=crypto.randomUUID(),revision=0)=>request(db,`workspaces/${w}/commands/backup`,{action:'backup.import',data:{backup},revision,requestId},user);
async function sourceBackup(){const db=database(),w=await setup(db),f=await fixtures(db,w);await command(db,w,'staff.photo',{id:f.staffId,jpegBase64:JPEG});const booked=await command(db,w,'job.save',job(f)),id=booked.body.result[0].id;await command(db,w,'job.update',{id,action:'start'});for(let value=0;value<4;value++)await command(db,w,'job.update',{id,action:'check',value});await command(db,w,'job.update',{id,action:'complete'});const invoice=(await command(db,w,'invoice.create',{jobId:id,vat:0})).body.result;await command(db,w,'supplier.save',{legalName:'Fictional Sole Trader',tradingName:'Fictional Cleaning',entity:'sole-trader',address:'10 Fictional Road',contact:'billing@example.com',companyNumber:'',vatRegistered:false,vatNumber:''});assert.equal((await command(db,w,'invoice.issue',{id:invoice.id})).status,200);assert.equal((await command(db,w,'invoice.credit',{id:invoice.id,reason:'Fictional full reduction'})).status,200);const backup=await request(db,`workspaces/${w}/backup-file`);assert.equal(backup.status,200);return {db,w,f,backup:backup.body}}
test('encrypted business file restores records, invoices and photo bytes after the source database and bucket are lost',async()=>{
 const source=await sourceBackup(),before=(await request(source.db,'workspaces/'+source.w)).body.state,dir=await mkdtemp(join(tmpdir(),'quenvira-business-dr-'));
 try{const path=join(dir,'business.qvb');await writeFile(path,await encryptBusinessBackup(source.backup,password),{mode:0o600});source.db.sqlite.close();source.db.bucket.files.clear();
 const target=database(),w=await setup(target),snapshot=await decryptBusinessBackup(await readFile(path,'utf8'),password),requestId=crypto.randomUUID();let result=await restore(target,w,snapshot,'alice',requestId);assert.equal(result.status,200);assert.equal(result.body.result.photos,1);
 const after=(await request(target,'workspaces/'+w)).body.state;assert.deepEqual(after,before);assert.equal(after.invoices[0].status,'Credited');assert.equal(after.invoices[0].issue.supplier.legalName,'Fictional Sole Trader');assert.equal(target.sqlite.prepare('SELECT COUNT(*) AS n FROM memberships').get().n,1);assert.equal(target.sqlite.prepare('SELECT COUNT(*) AS n FROM invitations').get().n,0);
 const photo=await handle(new Request(ORIGIN+`/api/quenvira/workspaces/${w}/staff/${source.f.staffId}/photo`,{headers:{'oai-authenticated-user-id':'alice','oai-authenticated-user-email':'alice@example.com'}}),target,{now:fixed,bucket:target.bucket});assert.equal(photo.status,200);assert.equal(btoa(String.fromCharCode(...new Uint8Array(await photo.arrayBuffer()))),JPEG);
 result=await restore(target,w,snapshot,'alice',requestId);assert.equal(result.status,200);assert.equal(result.body.replayed,true);assert.equal(target.bucket.files.size,1);assert.equal(target.sqlite.prepare('PRAGMA foreign_key_check').all().length,0);target.sqlite.close();
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('backup encryption is randomised, authenticates contents and rejects weak passwords and plain exports',async()=>{
 const source=await sourceBackup(),a=await encryptBusinessBackup(source.backup,password),b=await encryptBusinessBackup(source.backup,password);assert.notEqual(a,b);assert.ok(!a.includes('Fictional Worker'));assert.ok(!a.includes(JPEG));
 await assert.rejects(()=>decryptBusinessBackup(a,'different-password'),/incorrect/);const damaged=JSON.parse(a),bytes=Uint8Array.from(atob(damaged.encrypted),c=>c.charCodeAt(0));bytes[0]^=1;damaged.encrypted=btoa(String.fromCharCode(...bytes));await assert.rejects(()=>decryptBusinessBackup(JSON.stringify(damaged),password),/damaged/);
 await assert.rejects(()=>encryptBusinessBackup(source.backup,'short'),/12–256/);await assert.rejects(()=>decryptBusinessBackup(JSON.stringify(source.backup),password),/unsupported/);source.db.sqlite.close();
});
test('staff and another business cannot export a backup or force a restore',async()=>{
 const source=await sourceBackup();await setup(source.db,'bob');source.db.sqlite.prepare("INSERT INTO memberships VALUES (?,?,'staff',?)").run(source.w,'worker',source.f.staffId);
 assert.equal((await request(source.db,`workspaces/${source.w}/backup-file`,undefined,'worker')).status,403);assert.equal((await request(source.db,`workspaces/${source.w}/backup-file`,undefined,'bob')).status,404);
 const revision=(await request(source.db,'workspaces/'+source.w)).body.revision;assert.equal((await restore(source.db,source.w,source.backup,'worker',crypto.randomUUID(),revision)).status,403);source.db.sqlite.close();
});
test('restore refuses existing work, missing or substituted photos and storage failures without changing records',async()=>{
 const source=await sourceBackup(),before=(await request(source.db,'workspaces/'+source.w)).body;
 let result=await restore(source.db,source.w,source.backup,'alice',crypto.randomUUID(),before.revision);assert.equal(result.status,400);assert.match(result.body.error,/empty workspace/);assert.deepEqual((await request(source.db,'workspaces/'+source.w)).body,before);
 const target=database(),w=await setup(target),empty=(await request(target,'workspaces/'+w)).body;
 for(const mutate of [b=>b.photos=[],b=>b.photos[0].jpegBase64='invalid',b=>b.photos[0].staffId='other',b=>b.photos[0].photoId='other',b=>b.state.staff[0].capacity=9999,b=>Object.defineProperty(b.state,'__proto__',{value:{supplier:{}},enumerable:true})]){const bad=structuredClone(source.backup);mutate(bad);assert.equal((await restore(target,w,bad)).status,400);assert.deepEqual((await request(target,'workspaces/'+w)).body,empty);assert.equal(target.bucket.files.size,0)}
 target.bucket.failPut=true;assert.equal((await restore(target,w,source.backup)).status,503);assert.deepEqual((await request(target,'workspaces/'+w)).body,empty);target.bucket.failPut=false;target.failAt=2;assert.equal((await restore(target,w,source.backup)).status,503);target.failAt=null;assert.deepEqual((await request(target,'workspaces/'+w)).body,empty);
 source.db.bucket.files.clear();assert.equal((await request(source.db,`workspaces/${source.w}/backup-file`)).status,503);source.db.sqlite.close();target.sqlite.close();
});


test('backup failures do not expose internal storage messages',async()=>{const source=await sourceBackup();source.db.bucket.get=async()=>{throw Error('SECRET internal storage details')};const result=await request(source.db,`workspaces/${source.w}/backup-file`);assert.equal(result.status,503);assert.ok(!JSON.stringify(result.body).includes('SECRET'));assert.match(result.body.error,/could not be created/);source.db.sqlite.close();});
