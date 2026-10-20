import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../public/demo/domain.js';
const manager={role:'manager'};
const booking={customerId:'c1',staffId:'s1',date:'9999-12-30',time:'09:00',duration:60,price:1000,round:'Test',repeat:'Weekly',count:2};
const corruptions=[
 s=>s.customers.push(null),s=>s.customers.push({...s.customers[0]}),
 s=>s.customers[0].notes=null,s=>s.staff[0].capacity=-1,
 s=>s.jobs[0].staffId='missing',s=>s.jobs[0].checklist=[null],
 s=>s.jobs[0].checklist[0].done='yes',s=>s.jobs[0].status='Unknown',
 s=>s.jobs[0].time='99:99',s=>s.jobs[0].price=-1,
 s=>s.jobs[0].invoiceId='missing',s=>s.invoices[0].total++,
 s=>s.invoices[0].due='invalid',s=>s.invoices[0].jobId='missing',
 s=>s.invoices[0].number='QV-NaN',s=>s.audit.push(null),
 s=>s.audit.push({at:'invalid',actor:'Manager',message:'text'})
];
test('saved-state validator rejects malformed records without throwing',()=>{
 for(const corrupt of corruptions){const s=D.seed();corrupt(s);assert.equal(D.validateState(s),false,corrupt.toString());}
});
test('generated dates stay inside supported calendar and recurrence fails atomically',()=>{
 const s=D.seed(),before=JSON.stringify(s);
 assert.throws(()=>D.saveJob(s,manager,booking),/date|calendar/i);
 assert.equal(JSON.stringify(s),before);
 assert.throws(()=>D.dayAdd('bad',1),/date|calendar/i);
 assert.throws(()=>D.dayAdd('2026-10-20',0.5),/integer|days/i);
});
test('unknown roles cannot obtain assigned jobs using a staff id',()=>{
 assert.deepEqual(D.accessibleJobs(D.seed(),{role:'visitor',staffId:'s1'}),[]);
 assert.deepEqual(D.accessibleJobs(D.seed(),{role:'staff',staffId:''}),[]);
});
test('valid full lifecycle survives serialization and validation',()=>{
 const s=D.seed();D.updateJob(s,manager,'j0-4','start');
 for(let i=0;i<4;i++)D.updateJob(s,manager,'j0-4','check',i);
 D.updateJob(s,manager,'j0-4','complete');
 const invoice=D.createInvoice(s,manager,'j0-4',20);D.markPaid(s,manager,invoice.id);
 assert.ok(D.validateState(JSON.parse(JSON.stringify(s))));
});
