import test from 'node:test';
import assert from 'node:assert/strict';
import {database,setup,fixtures,command,request,job,customer} from './support/database.mjs';
import {validateState} from '../server/domain.mjs';
import {prepareInvoiceEmail} from '../public/invoice-email.js';
import {snapshotDatabase,restoreIntoEmptyDatabase} from '../scripts/workspace-recovery.mjs';
const supplier={legalName:'Fictional Services Ltd',tradingName:'Fictional Cleaning',entity:'limited-company',address:'10 Test Street (fictional)',contact:'billing@example.com',companyNumber:'01234567',vatRegistered:true,vatNumber:'GB123456789'};
async function fixture(){const db=database(),w=await setup(db),f=await fixtures(db,w);const made=await command(db,w,'job.save',{...job(f),price:7899});const id=made.body.result[0].id;await command(db,w,'job.update',{id,action:'start'});for(let n=0;n<4;n++)await command(db,w,'job.update',{id,action:'check',value:n});await command(db,w,'job.update',{id,action:'complete'});const draft=await command(db,w,'invoice.create',{jobId:id,vat:20});assert.equal(draft.status,200);return {db,w,f,i:draft.body.result,read:async()=>(await request(db,'workspaces/'+w)).body}}
test('issue snapshots supplier, customer, supply date, line and exact VAT; later edits do not change issued documents',async()=>{
 const {db,w,f,i,read}=await fixture();assert.equal((await command(db,w,'invoice.issue',{id:i.id})).status,400);
 assert.equal((await command(db,w,'supplier.save',supplier)).status,200);const issued=await command(db,w,'invoice.issue',{id:i.id});assert.equal(issued.status,200);assert.equal(issued.body.result.status,'Issued');assert.deepEqual(issued.body.result.issue.supplier,supplier);assert.equal(issued.body.result.total,9479);assert.equal(issued.body.result.issue.supplyDate,'2026-10-20');assert.equal(issued.body.result.issue.line.unitPrice,7899);
 await command(db,w,'supplier.save',{...supplier,legalName:'Changed Legal Name'});await command(db,w,'customer.save',{...customer,id:f.customerId,name:'Changed Customer',address:'Changed address'});
 const saved=await read();assert.deepEqual(saved.state.invoices[0],issued.body.result);assert.ok(validateState(saved.state));assert.equal((await command(db,w,'invoice.issue',{id:i.id})).status,400);
 const email=prepareInvoiceEmail(saved.state.invoices[0],'home@example.com','wrong editable name');assert.match(email.subject,/Fictional Cleaning/);assert.match(email.body,/Fictional Services Ltd/);assert.match(email.body,/Supply date: 2026-10-20/);assert.match(email.body,/Total: £94.79/);assert.ok(!email.body.includes('Changed Legal Name'));db.sqlite.close();
});
test('invalid supplier and unregistered VAT issue are rejected without changing revision',async()=>{
 const {db,w,i,read}=await fixture();const before=await read();for(const p of [{...supplier,legalName:''},{...supplier,address:''},{...supplier,contact:'x\nBcc: stolen@example.com'},{...supplier,companyNumber:'123'},{...supplier,vatNumber:'bad'},{...supplier,vatRegistered:'true'}])assert.equal((await command(db,w,'supplier.save',p)).status,400);
 assert.deepEqual(await read(),before);await command(db,w,'supplier.save',{...supplier,vatRegistered:false,vatNumber:''});const after=await read();assert.equal((await command(db,w,'invoice.issue',{id:i.id})).status,400);assert.deepEqual(await read(),after);db.sqlite.close();
});
test('full credit is exact, unique, retry-safe and cannot be paid or duplicated',async()=>{
 const {db,w,i,read}=await fixture();await command(db,w,'supplier.save',supplier);await command(db,w,'invoice.issue',{id:i.id});const before=await read();assert.equal((await command(db,w,'invoice.credit',{id:i.id,reason:''})).status,400);assert.deepEqual(await read(),before);
 const key=crypto.randomUUID(),credited=await command(db,w,'invoice.credit',{id:i.id,reason:'Agreed full reduction'},'alice',key,before.revision);assert.equal(credited.status,200);assert.deepEqual(credited.body.result.credit,{number:'CN-1001',date:'2026-10-20',reason:'Agreed full reduction',invoiceNumber:i.number,invoiceDate:i.issued,net:7899,tax:1580,total:9479});
 const replay=await command(db,w,'invoice.credit',{id:i.id,reason:'Agreed full reduction'},'alice',key,before.revision);assert.equal(replay.body.replayed,true);assert.equal((await command(db,w,'invoice.paid',{id:i.id})).status,400);assert.equal((await command(db,w,'invoice.credit',{id:i.id,reason:'Again'})).status,400);assert.ok(validateState((await read()).state));db.sqlite.close();
});
test('paid issued invoices keep their locked snapshot and refuse unsupported refunds',async()=>{
 const {db,w,i,read}=await fixture();await command(db,w,'supplier.save',supplier);const issued=await command(db,w,'invoice.issue',{id:i.id});assert.equal((await command(db,w,'invoice.paid',{id:i.id})).status,200);const saved=await read();assert.deepEqual(saved.state.invoices[0].issue,issued.body.result.issue);assert.equal((await command(db,w,'invoice.credit',{id:i.id,reason:'Refund'})).status,400);assert.deepEqual(await read(),saved);db.sqlite.close();
});
test('staff and other tenants cannot configure, issue, credit or receive supplier data',async()=>{
 const {db,w,f,i,read}=await fixture();await command(db,w,'supplier.save',supplier);await setup(db,'bob');db.sqlite.prepare("INSERT INTO memberships VALUES (?,?,'staff',?)").run(w,'worker',f.staffId);
 for(const [action,data] of [['supplier.save',supplier],['invoice.issue',{id:i.id}],['invoice.credit',{id:i.id,reason:'Test'}]]){assert.equal((await command(db,w,action,data,'worker')).status,403);assert.equal((await command(db,w,action,data,'bob',crypto.randomUUID(),(await read()).revision)).status,404)}
 const worker=await request(db,'workspaces/'+w,undefined,'worker');assert.equal(worker.body.state.supplier,undefined);assert.deepEqual(worker.body.state.invoices,[]);db.sqlite.close();
});
test('transaction failure and stale issue do not partially allocate financial records',async()=>{
 const {db,w,i,read}=await fixture();await command(db,w,'supplier.save',supplier);const before=await read();db.failAt=3;assert.equal((await command(db,w,'invoice.issue',{id:i.id})).status,503);db.failAt=null;assert.deepEqual(await read(),before);await command(db,w,'supplier.save',{...supplier,tradingName:'New'});assert.equal((await command(db,w,'invoice.issue',{id:i.id},'alice',crypto.randomUUID(),before.revision)).status,409);assert.equal((await read()).state.invoices[0].status,'Draft');db.sqlite.close();
});
test('history restore cannot remove, unpay or change issued financial records; non-financial recovery remains available',async()=>{
 const {db,w,i,read}=await fixture();await command(db,w,'supplier.save',supplier);const before=await read();await command(db,w,'invoice.issue',{id:i.id});assert.equal((await command(db,w,'backup.restore',{revision:before.revision})).status,400);const issued=await read();await command(db,w,'customer.save',{...customer,name:'Changed'});assert.equal((await command(db,w,'backup.restore',{revision:issued.revision})).status,200);await command(db,w,'invoice.paid',{id:i.id});assert.equal((await command(db,w,'backup.restore',{revision:issued.revision})).status,400);assert.equal((await read()).state.invoices[0].status,'Paid');db.sqlite.close();
});
test('malformed snapshots are rejected and complete issued-credit records survive independent database recovery',async()=>{
 const {db,w,i,read}=await fixture();await command(db,w,'supplier.save',supplier);await command(db,w,'invoice.issue',{id:i.id});await command(db,w,'invoice.credit',{id:i.id,reason:'Agreed cancellation'});const before=await read();
 for(const mutate of [s=>s.invoices[0].issue.line.unitPrice++,s=>s.invoices[0].issue.supplyDate='2027-01-01',s=>s.invoices[0].credit.total++,s=>s.invoices[0].credit.invoiceNumber='QV-9999',s=>s.invoices[0].status='Paid']){const bad=structuredClone(before.state);mutate(bad);assert.equal(validateState(bad),false)}
 const target=database();restoreIntoEmptyDatabase(target.sqlite,snapshotDatabase(db.sqlite));assert.deepEqual((await request(target,'workspaces/'+w)).body,before);db.sqlite.close();target.sqlite.close();
});
