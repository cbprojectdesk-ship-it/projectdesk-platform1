import test from 'node:test';
import assert from 'node:assert/strict';
import {database,setup,fixtures,command,request,job} from './support/database.mjs';

async function paidDraft(){
 const db=database(),w=await setup(db),f=await fixtures(db,w);
 const booked=await command(db,w,'job.save',job(f)),id=booked.body.result[0].id;
 await command(db,w,'job.update',{id,action:'start'});
 for(let n=0;n<4;n++)await command(db,w,'job.update',{id,action:'check',value:n});
 await command(db,w,'job.update',{id,action:'complete'});
 const beforeInvoice=(await request(db,'workspaces/'+w)).body.revision;
 const invoice=(await command(db,w,'invoice.create',{jobId:id,vat:0})).body.result;
 const beforePayment=(await request(db,'workspaces/'+w)).body.revision;
 await command(db,w,'invoice.paid',{id:invoice.id});
 const afterPayment=(await request(db,'workspaces/'+w)).body.revision;
 return {db,w,invoice,beforeInvoice,beforePayment,afterPayment};
}
const invoiceState=async(db,w,id)=>(await request(db,'workspaces/'+w)).body.state.invoices.find(i=>i.id===id);

test('revision restore cannot remove a payment recorded against a draft invoice',async()=>{
 const f=await paidDraft();
 const failed=await command(f.db,f.w,'backup.restore',{revision:f.beforeInvoice});
 assert.equal(failed.status,400);
 assert.match(failed.body.error,/recorded payment/);
 assert.equal((await invoiceState(f.db,f.w,f.invoice.id)).status,'Paid');
 f.db.sqlite.close();
});

test('revision restore cannot revert a paid invoice to its earlier unpaid draft',async()=>{
 const f=await paidDraft();
 const failed=await command(f.db,f.w,'backup.restore',{revision:f.beforePayment});
 assert.equal(failed.status,400);
 assert.match(failed.body.error,/recorded payment/);
 assert.equal((await invoiceState(f.db,f.w,f.invoice.id)).status,'Paid');
 f.db.sqlite.close();
});

test('revision restore that keeps the recorded payment unchanged remains available',async()=>{
 const f=await paidDraft();
 await command(f.db,f.w,'staff.add',{name:'Later Worker',role:'Cleaner',capacity:480});
 const restored=await command(f.db,f.w,'backup.restore',{revision:f.afterPayment});
 assert.equal(restored.status,200);
 assert.equal((await invoiceState(f.db,f.w,f.invoice.id)).status,'Paid');
 assert.equal((await request(f.db,'workspaces/'+f.w)).body.state.staff.length,1);
 f.db.sqlite.close();
});
