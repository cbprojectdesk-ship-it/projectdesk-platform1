import test from 'node:test';
import assert from 'node:assert/strict';
import * as server from '../server/domain.mjs';
import * as demo from '../public/demo/domain.js';
import {database,setup,fixtures,command,request,customer,job} from './support/database.mjs';

for(const [name,D] of [['server',server],['demo',demo]]){
 test(name+': checklist parsing is bounded, normalised and compatible with old records',()=>{
  assert.deepEqual(D.parseChecklistTemplate('  Conservatory glass  \r\n\n Marble-safe surfaces\rFinal check '),['Conservatory glass','Marble-safe surfaces','Final check']);
  assert.deepEqual(D.parseChecklistTemplate(' \n '),[]);
  for(const value of [null,{},[1],['Clean','clean'],['x'.repeat(201)],Array.from({length:31},(_,n)=>'Task '+n),['a\nb']])assert.throws(()=>D.parseChecklistTemplate(value),/Checklist/);
  assert.ok(D.validateState(D.seed()),'records without a template still load');
  for(const value of [null,[''],['Clean','clean'],Array(1)]){const s=D.seed();s.customers[0].checklistTemplate=value;assert.equal(D.validateState(s),false)}
 });
}

test('templates are snapshotted independently for recurring visits; refresh is explicit and completed records stay intact',async()=>{
 const db=database(),w=await setup(db),f=await fixtures(db,w);
 const saved=await command(db,w,'customer.save',{...customer,id:f.customerId,checklistTemplate:'Conservatory glass\nKitchen surfaces'});assert.equal(saved.status,200);
 const made=await command(db,w,'job.save',{...job(f),repeat:'Weekly',count:3});assert.equal(made.status,200);
 const visits=made.body.result;assert.ok(visits.every(j=>j.checklist.length===2&&j.checklist.every(c=>!c.done)));
 await command(db,w,'customer.save',{...customer,id:f.customerId,checklistTemplate:'New task\nFinal check'});
 const read=async()=> (await request(db,'workspaces/'+w)).body.state;
 assert.ok((await read()).jobs.every(j=>j.checklist[0].label==='Conservatory glass'));
 await command(db,w,'job.save',{...visits[1],time:'10:00'});assert.equal((await read()).jobs[1].checklist[0].label,'Conservatory glass');
 const refreshed=await command(db,w,'job.save',{...visits[1],applyCustomerChecklist:true});assert.equal(refreshed.status,200);assert.deepEqual(refreshed.body.result[0].checklist,[{label:'New task',done:false},{label:'Final check',done:false}]);
 assert.equal((await read()).jobs[0].checklist[0].label,'Conservatory glass');
 await command(db,w,'job.update',{id:visits[0].id,action:'start'});
 assert.equal((await command(db,w,'job.update',{id:visits[0].id,action:'complete'})).status,400);
 await command(db,w,'job.update',{id:visits[0].id,action:'check',value:0});
 assert.equal((await read()).jobs[2].checklist[0].done,false,'ticking one visit does not tick the series');
 await command(db,w,'job.update',{id:visits[0].id,action:'check',value:1});
 assert.equal((await command(db,w,'job.update',{id:visits[0].id,action:'complete'})).status,200);
 const before=await read();assert.equal((await command(db,w,'job.save',{...visits[0],applyCustomerChecklist:true})).status,400);assert.deepEqual(await read(),before);
 db.sqlite.close();
});

test('older clients preserve templates, clearing restores defaults, and changing customer uses the new checklist',async()=>{
 const db=database(),w=await setup(db),f=await fixtures(db,w);
 await command(db,w,'customer.save',{...customer,id:f.customerId,checklistTemplate:'Conservatory'});
 const oldClient=await command(db,w,'customer.save',{...customer,id:f.customerId,name:'Updated name'});assert.deepEqual(oldClient.body.result.checklistTemplate,['Conservatory']);
 const visit=(await command(db,w,'job.save',job(f))).body.result[0];
 const other=(await command(db,w,'customer.save',{...customer,name:'Other customer',checklistTemplate:'Porch'})).body.result;
 const moved=await command(db,w,'job.save',{...visit,customerId:other.id});assert.equal(moved.body.result[0].checklist[0].label,'Porch');
 await command(db,w,'customer.save',{...customer,id:f.customerId,checklistTemplate:''});
 const standard=await command(db,w,'job.save',{...job(f),time:'13:00'});assert.deepEqual(standard.body.result[0].checklist.map(i=>i.label),server.DEFAULT_CHECKLIST);
 db.sqlite.close();
});

test('invalid templates and refresh flags fail atomically without saved revisions or history',async()=>{
 const db=database(),w=await setup(db),f=await fixtures(db,w),visit=(await command(db,w,'job.save',job(f))).body.result[0];
 const before=(await request(db,'workspaces/'+w)).body;
 const historyBefore=db.sqlite.prepare('SELECT COUNT(*) AS n FROM history').get().n;
 for(const checklistTemplate of [null,[123],['Clean','clean'],['x'.repeat(201)],Array.from({length:31},(_,n)=>'Task '+n)])assert.equal((await command(db,w,'customer.save',{...customer,id:f.customerId,checklistTemplate})).status,400);
 assert.equal((await command(db,w,'job.save',{...visit,applyCustomerChecklist:'yes'})).status,400);
 assert.deepEqual((await request(db,'workspaces/'+w)).body,before);assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM history').get().n,historyBefore);
 db.sqlite.close();
});

test('staff see visit tasks rather than reusable templates, and cannot replace either',async()=>{
 const db=database(),w=await setup(db),f=await fixtures(db,w);
 await command(db,w,'customer.save',{...customer,id:f.customerId,checklistTemplate:'Conservatory'});
 const visit=(await command(db,w,'job.save',job(f))).body.result[0];
 await command(db,w,'customer.save',{...customer,id:f.customerId,checklistTemplate:'Private future specification'});
 db.sqlite.prepare("INSERT INTO memberships VALUES (?,?,'staff',?)").run(w,'worker',f.staffId);
 const visible=(await request(db,'workspaces/'+w,undefined,'worker')).body.state;
 assert.equal(visible.jobs[0].checklist[0].label,'Conservatory');assert.equal(visible.customers[0].checklistTemplate,undefined);
 assert.equal((await command(db,w,'customer.save',{...customer,id:f.customerId,checklistTemplate:'Changed'},'worker')).status,403);
 assert.equal((await command(db,w,'job.save',{...visit,applyCustomerChecklist:true},'worker')).status,403);
 db.sqlite.close();
});

test('recovery restores the saved customer specification and visit checklist together',async()=>{
 const db=database(),w=await setup(db),f=await fixtures(db,w);
 await command(db,w,'customer.save',{...customer,id:f.customerId,checklistTemplate:'Conservatory'});
 await command(db,w,'job.save',job(f));
 const before=(await request(db,'workspaces/'+w)).body;
 await command(db,w,'customer.save',{...customer,id:f.customerId,checklistTemplate:'Updated task'});
 assert.equal((await command(db,w,'backup.restore',{revision:before.revision})).status,200);
 const restored=(await request(db,'workspaces/'+w)).body.state;
 assert.deepEqual(restored.customers[0].checklistTemplate,['Conservatory']);assert.deepEqual(restored.jobs[0].checklist,[{label:'Conservatory',done:false}]);
 db.sqlite.close();
});
