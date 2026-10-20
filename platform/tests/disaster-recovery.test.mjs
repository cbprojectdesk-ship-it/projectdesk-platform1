import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {database,setup,fixtures,command,request,job} from './support/database.mjs';
import {snapshotDatabase,encryptBackup,decryptBackup,restoreIntoEmptyDatabase,tables} from '../scripts/workspace-recovery.mjs';

test('encrypted external snapshot recovers populated state after original database loss',async()=>{
 const source=database(),w=await setup(source),f=await fixtures(source,w);await setup(source,'bob');
 const booked=await command(source,w,'job.save',{...job(f),price:7899});const id=booked.body.result[0].id;
 await command(source,w,'job.update',{id,action:'start'});for(let n=0;n<4;n++)await command(source,w,'job.update',{id,action:'check',value:n});await command(source,w,'job.update',{id,action:'complete'});
 const invoice=await command(source,w,'invoice.create',{jobId:id,vat:20});await command(source,w,'invoice.paid',{id:invoice.body.result.id});
 const series=await command(source,w,'job.save',{...job(f),date:'2026-10-21',repeat:'Weekly',count:3});await command(source,w,'job.series',{id:series.body.result[0].id,action:'pause'});
 const invitation=await request(source,`workspaces/${w}/invitations`,{email:'worker@example.com',staffId:f.staffId});assert.equal(invitation.status,201);
 const before=(await request(source,'workspaces/'+w)).body;
 const dir=await mkdtemp(join(tmpdir(),'quenvira-recovery-')),key=randomBytes(32),snapshot=snapshotDatabase(source.sqlite),started=performance.now();
 try{
  const file=join(dir,'independent.enc');await writeFile(file,encryptBackup(snapshot,key),{mode:0o600});source.sqlite.close();
  const restored=database();const counts=restoreIntoEmptyDatabase(restored.sqlite,decryptBackup(await readFile(file),key));
  assert.ok(Object.values(counts).every(n=>n>0));const after=(await request(restored,'workspaces/'+w)).body;assert.deepEqual(after,before);assert.equal(after.state.invoices[0].total,9479);
  assert.ok(after.state.jobs.some(j=>j.status==='Paused'));assert.equal((await request(restored,'workspaces/'+w,undefined,'bob')).status,404);
  assert.equal(restored.sqlite.prepare('PRAGMA foreign_key_check').all().length,0);console.log('Synthetic encrypted recovery milliseconds:',Math.round(performance.now()-started));restored.sqlite.close();
 }finally{key.fill(0);await rm(dir,{recursive:true,force:true})}
});
test('wrong key, tampering and incomplete backups fail without restoring records',async()=>{
 const source=database();await setup(source);const snapshot=snapshotDatabase(source.sqlite),key=randomBytes(32),encrypted=encryptBackup(snapshot,key);
 assert.throws(()=>decryptBackup(encrypted,randomBytes(32)),/authentication/);
 const value=JSON.parse(encrypted);const bytes=Buffer.from(value.encrypted,'base64');bytes[0]^=1;value.encrypted=bytes.toString('base64');assert.throws(()=>decryptBackup(Buffer.from(JSON.stringify(value)),key),/authentication/);
 const empty=database(),invalid=structuredClone(snapshot);delete invalid.tables.memberships;assert.throws(()=>restoreIntoEmptyDatabase(empty.sqlite,invalid),/incomplete/);assert.equal(empty.sqlite.prepare('SELECT COUNT(*) AS n FROM workspaces').get().n,0);source.sqlite.close();empty.sqlite.close();key.fill(0);
});
test('restore refuses nonempty targets and rolls back broken cross-table references',async()=>{
 const source=database(),w=await setup(source),snapshot=snapshotDatabase(source.sqlite);assert.throws(()=>restoreIntoEmptyDatabase(source.sqlite,snapshot),/empty/);
 const target=database();snapshot.tables.memberships[0].workspace_id='missing';assert.throws(()=>restoreIntoEmptyDatabase(target.sqlite,snapshot),/FOREIGN KEY/);
 for(const table of Object.keys(tables))assert.equal(target.sqlite.prepare('SELECT COUNT(*) AS n FROM '+table).get().n,0);assert.ok(w);source.sqlite.close();target.sqlite.close();
});
