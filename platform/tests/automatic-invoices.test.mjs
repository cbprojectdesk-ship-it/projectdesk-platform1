import test from 'node:test';
import assert from 'node:assert/strict';
import {database,setup,request,fixtures,command,job} from './support/database.mjs';
const supplier={legalName:'Fictional Cleaner',tradingName:'',entity:'sole-trader',address:'Fictional Road',contact:'billing@example.com',companyNumber:'',vatRegistered:false,vatNumber:''};
async function fixture(options={}){
 const db=database(),w=await setup(db),f=await fixtures(db,w);
 await command(db,w,'supplier.save',{...supplier,...options});
 const booked=await command(db,w,'job.save',job(f)),id=booked.body.result[0].id;
 await command(db,w,'job.update',{id,action:'start'});
 for(let value=0;value<4;value++)await command(db,w,'job.update',{id,action:'check',value});
 return {db,w,f,id,read:async()=>(await request(db,'workspaces/'+w)).body};
}
test('automatic invoice drafts are opt-in and do not change existing manual completion',async()=>{
 const f=await fixture();try{
  assert.equal((await command(f.db,f.w,'job.update',{id:f.id,action:'complete'})).status,200);
  const {state}=await f.read();assert.equal(state.jobs[0].status,'Completed');assert.deepEqual(state.invoices,[]);
 }finally{f.db.sqlite.close()}
});
test('assigned staff completion creates one manager-authorised draft without exposing financial data; retries are idempotent',async()=>{
 const f=await fixture({autoDraftInvoices:true,autoDraftVat:0});try{
  f.db.sqlite.prepare("INSERT INTO memberships VALUES (?,?,'staff',?)").run(f.w,'worker',f.f.staffId);
  const before=await f.read(),key=crypto.randomUUID();
  const body={id:f.id,action:'complete'};
  const result=await command(f.db,f.w,'job.update',body,'worker',key,before.revision);
  assert.equal(result.status,200);assert.equal(result.body.result,null);
  const after=await f.read();assert.equal(after.revision,before.revision+1);assert.equal(after.state.jobs[0].status,'Completed');
  assert.equal(after.state.invoices.length,1);const invoice=after.state.invoices[0];
  assert.equal(invoice.status,'Draft');assert.equal(invoice.vat,0);assert.equal(invoice.total,10003);assert.equal(invoice.issue,undefined);assert.equal(after.state.jobs[0].invoiceId,invoice.id);
  const retry=await command(f.db,f.w,'job.update',body,'worker',key,before.revision);assert.equal(retry.body.replayed,true);
  assert.equal((await f.read()).state.invoices.length,1);
  const worker=await request(f.db,'workspaces/'+f.w,undefined,'worker');assert.deepEqual(worker.body.state.invoices,[]);assert.equal(worker.body.state.supplier,undefined);assert.equal(worker.body.state.jobs[0].invoiceId,undefined);
  assert.equal((await command(f.db,f.w,'invoice.create',{jobId:f.id,vat:0})).status,400);
 }finally{f.db.sqlite.close()}
});
test('automatic draft and completion roll back together on database failure and stale revisions',async()=>{
 const f=await fixture({autoDraftInvoices:true,autoDraftVat:0});try{
  const before=await f.read();f.db.failAt=3;
  assert.equal((await command(f.db,f.w,'job.update',{id:f.id,action:'complete'})).status,503);f.db.failAt=null;
  assert.deepEqual(await f.read(),before);
  assert.equal((await command(f.db,f.w,'job.update',{id:f.id,action:'complete'},'alice',crypto.randomUUID(),before.revision-1)).status,409);
  assert.deepEqual(await f.read(),before);
 }finally{f.db.sqlite.close()}
});
test('only managers choose automatic-invoice policy and VAT must match supplier registration',async()=>{
 const f=await fixture();try{
  f.db.sqlite.prepare("INSERT INTO memberships VALUES (?,?,'staff',?)").run(f.w,'worker',f.f.staffId);
  const before=await f.read();
  for(const patch of [{autoDraftInvoices:true,autoDraftVat:20},{autoDraftInvoices:'yes',autoDraftVat:0},{autoDraftInvoices:true,autoDraftVat:5}])assert.equal((await command(f.db,f.w,'supplier.save',{...supplier,...patch})).status,400);
  assert.equal((await command(f.db,f.w,'supplier.save',{...supplier,autoDraftInvoices:true,autoDraftVat:0},'worker')).status,403);
  assert.deepEqual(await f.read(),before);
 }finally{f.db.sqlite.close()}
});
test('registered supplier policy applies exact VAT and preserves earlier invoice snapshots',async()=>{
 const f=await fixture({autoDraftInvoices:true,autoDraftVat:20,vatRegistered:true,vatNumber:'GB123456789'});try{
  assert.equal((await command(f.db,f.w,'job.update',{id:f.id,action:'complete'})).status,200);
  const invoice=(await f.read()).state.invoices[0];assert.equal(invoice.tax,2001);assert.equal(invoice.total,12004);
  await command(f.db,f.w,'invoice.issue',{id:invoice.id});const issued=(await f.read()).state.invoices[0];
  await command(f.db,f.w,'supplier.save',{...supplier,autoDraftInvoices:false,autoDraftVat:0});
  assert.deepEqual((await f.read()).state.invoices[0],issued);
 }finally{f.db.sqlite.close()}
});
