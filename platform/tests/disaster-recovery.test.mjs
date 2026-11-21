import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {readdirSync,readFileSync} from 'node:fs';
import {database,setup,fixtures,command,request,job} from './support/database.mjs';
import {snapshotDatabase,encryptBackup,decryptBackup,restoreIntoEmptyDatabase,tables} from '../scripts/workspace-recovery.mjs';

function diskDatabase(path){
 const sqlite=new DatabaseSync(path);sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=0');
 for(const name of readdirSync(new URL('../drizzle/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort())sqlite.exec(readFileSync(new URL('../drizzle/'+name,import.meta.url),'utf8'));
 return sqlite;
}
test('snapshot remains consistent when another connection commits between table reads',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'quenvira-snapshot-race-'));let reader,writer;
 try{
  reader=diskDatabase(join(dir,'test.sqlite'));writer=new DatabaseSync(join(dir,'test.sqlite'));writer.exec('PRAGMA foreign_keys=ON');
  let injected=false;
  const wrapped={exec:sql=>reader.exec(sql),prepare(sql){const statement=reader.prepare(sql);return {all(){const result=statement.all();if(!injected&&sql.startsWith('SELECT id,name,revision,document')){
   injected=true;writer.exec('BEGIN IMMEDIATE');
   // Valid relational write after the snapshot's first read, using only a
   // disposable fictional workspace. Neither table may leak into the snapshot.
   writer.prepare('INSERT INTO workspaces (id,name,revision,document,created_at,updated_at) VALUES (?,?,0,?,?,?)').run('concurrent','Fictional concurrent workspace','{}','2026-10-31','2026-10-31');
   writer.prepare('INSERT INTO memberships (workspace_id,user_id,role) VALUES (?,?,?)').run('concurrent','fictional-user','manager');writer.exec('COMMIT');
  }return result}}}};
  const snapshot=snapshotDatabase(wrapped);assert.equal(injected,true);assert.equal(snapshot.tables.workspaces.length,0);assert.equal(snapshot.tables.memberships.length,0);
  assert.equal(reader.prepare('SELECT COUNT(*) AS n FROM workspaces').get().n,1);assert.equal(reader.isTransaction,false);
 }finally{writer?.close();reader?.close();await rm(dir,{recursive:true,force:true})}
});
test('snapshot failure releases only its savepoint and preserves the caller transaction',()=>{
 const source=database();source.sqlite.exec('BEGIN');
 const wrapped={exec:sql=>source.sqlite.exec(sql),prepare(){throw Error('Injected read failure')}};
 assert.throws(()=>snapshotDatabase(wrapped),/Injected read failure/);assert.equal(source.sqlite.isTransaction,true);
 source.sqlite.exec('ROLLBACK');assert.equal(source.sqlite.isTransaction,false);source.sqlite.close();
});
test('restore locks out concurrent writes before checking target emptiness',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'quenvira-restore-race-'));const source=database();let target,writer;
 try{
  await setup(source);const snapshot=snapshotDatabase(source.sqlite);target=diskDatabase(join(dir,'target.sqlite'));writer=new DatabaseSync(join(dir,'target.sqlite'));writer.exec('PRAGMA busy_timeout=0');let attempted=false;
  const wrapped={get isTransaction(){return target.isTransaction},exec:sql=>target.exec(sql),prepare(sql){const statement=target.prepare(sql);if(sql==='SELECT COUNT(*) AS n FROM invoice_email_events')return {get(){const result=statement.get();attempted=true;assert.throws(()=>writer.prepare('INSERT INTO events (workspace_id,id,user_id,action,created_at) VALUES (?,?,?,?,?)').run('other','racing','fictional','test','2026-10-31'),/locked/);return result}};return statement}};
  restoreIntoEmptyDatabase(wrapped,snapshot);assert.equal(attempted,true);assert.equal(target.isTransaction,false);assert.equal(target.prepare("SELECT COUNT(*) AS n FROM events WHERE id='racing'").get().n,0);
 }finally{writer?.close();target?.close();source.sqlite.close();await rm(dir,{recursive:true,force:true})}
});
test('restore rejects an outer transaction without committing caller changes',async()=>{
 const source=database();await setup(source);const snapshot=snapshotDatabase(source.sqlite),target=database();target.sqlite.exec('BEGIN');
 assert.throws(()=>restoreIntoEmptyDatabase(target.sqlite,snapshot),/outside a transaction/);assert.equal(target.sqlite.isTransaction,true);target.sqlite.exec('ROLLBACK');source.sqlite.close();target.sqlite.close();
});

test('encrypted external snapshot recovers populated state after original database loss',async()=>{
 const source=database(),w=await setup(source),f=await fixtures(source,w);await setup(source,'bob');
 const booked=await command(source,w,'job.save',{...job(f),price:7899});const id=booked.body.result[0].id;
 await command(source,w,'job.update',{id,action:'start'});for(let n=0;n<4;n++)await command(source,w,'job.update',{id,action:'check',value:n});await command(source,w,'job.update',{id,action:'complete'});
 const invoice=await command(source,w,'invoice.create',{jobId:id,vat:20});await command(source,w,'invoice.paid',{id:invoice.body.result.id});
 const series=await command(source,w,'job.save',{...job(f),date:'2026-10-21',repeat:'Weekly',count:3});await command(source,w,'job.series',{id:series.body.result[0].id,action:'pause'});
 const invitation=await request(source,`workspaces/${w}/invitations`,{email:'worker@example.com',staffId:f.staffId});assert.equal(invitation.status,201);
 source.sqlite.prepare('INSERT INTO subscription_accounts (workspace_id,trial_end,customer_id,checkout_generation) VALUES (?,?,?,?)').run(w,'2026-11-05T12:00:00Z','cus_recovery',2);
 source.sqlite.prepare('INSERT INTO subscription_events VALUES (?,?,?,?)').run('evt_recovery',w,'invoice.paid','2026-10-22T12:00:00Z');
 source.sqlite.prepare("INSERT INTO invoice_outbox (id,workspace_id,invoice_id,mode,payload,status,provider_id,next_attempt_at,created_at,updated_at) VALUES (?,?,?,'test','{}','delivered','synthetic_provider',?,?,?)").run('recovery_email',w,invoice.body.result.id,'2026-10-20T10:00:00Z','2026-10-20T10:00:00Z','2026-10-20T10:00:00Z');
 source.sqlite.prepare('INSERT INTO invoice_email_events VALUES (?,?,?,?,?)').run('msg_recovery',w,'recovery_email','delivered','2026-10-20T10:00:00Z');
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

test('legacy full-store backups restore business records without inventing billing mappings',async()=>{
 const source=database(),w=await setup(source),snapshot=snapshotDatabase(source.sqlite);snapshot.format='quenvira-logical-backup-v1';delete snapshot.tables.subscription_accounts;delete snapshot.tables.subscription_events;delete snapshot.tables.invoice_outbox;delete snapshot.tables.invoice_email_events;const target=database();restoreIntoEmptyDatabase(target.sqlite,snapshot);assert.equal((await request(target,'workspaces/'+w)).status,200);assert.equal(target.sqlite.prepare('SELECT COUNT(*) AS n FROM subscription_accounts').get().n,0);source.sqlite.close();target.sqlite.close();
});

test('restored ambiguous email is held for reconciliation rather than automatically resent',async()=>{
 const source=database(),w=await setup(source);source.sqlite.prepare("INSERT INTO invoice_outbox (id,workspace_id,invoice_id,mode,payload,status,next_attempt_at,created_at,updated_at) VALUES ('message',?,'invoice','test','{}','sending','2026-10-20','2026-10-20','2026-10-20')").run(w);
 const snapshot=snapshotDatabase(source.sqlite),target=database();restoreIntoEmptyDatabase(target.sqlite,snapshot);
 assert.equal(target.sqlite.prepare('SELECT status FROM invoice_outbox').get().status,'review');source.sqlite.close();target.sqlite.close();
});
test('v2 backups remain restorable without inventing historical email delivery',async()=>{
 const source=database(),w=await setup(source),snapshot=snapshotDatabase(source.sqlite);snapshot.format='quenvira-logical-backup-v2';delete snapshot.tables.invoice_outbox;delete snapshot.tables.invoice_email_events;const target=database();restoreIntoEmptyDatabase(target.sqlite,snapshot);assert.equal((await request(target,'workspaces/'+w)).status,200);assert.equal(target.sqlite.prepare('SELECT COUNT(*) AS n FROM invoice_outbox').get().n,0);source.sqlite.close();target.sqlite.close();
});
