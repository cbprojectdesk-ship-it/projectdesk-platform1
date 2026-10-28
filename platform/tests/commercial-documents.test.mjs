import test from 'node:test';
import assert from 'node:assert/strict';
import {issueInvoice,validBilling} from '../server/billing.mjs';
import {prepareInvoiceEmail} from '../public/invoice-email.js';
import {prepareDelivery} from '../server/invoice-delivery.mjs';
import {handle} from '../server/api.mjs';
import {startTrial,acceptServiceTerms,TERMS_VERSION} from '../server/subscriptions.mjs';
import {database,setup,fixtures,command,job,request,ORIGIN,fixed} from './support/database.mjs';

const supplier={legalName:'Fictional Supplier',tradingName:'',address:'Fictional Road',contact:'billing@example.com',entity:'sole-trader',companyNumber:'',vatRegistered:false,vatNumber:''};
function state(){return {supplier:structuredClone(supplier),customers:[{id:'c1',email:'owner@example.com'}],jobs:[{id:'j1',date:'2026-10-20',status:'Completed'}],invoices:[{id:'i1',number:'QV-1001',jobId:'j1',customerId:'c1',customerName:'Fictional QA',address:'Fictional Road',status:'Draft',issued:'2026-10-20',paidOn:null,net:1900,tax:0,total:1900,vat:0,description:'Fictional cleaning'}],audit:[]}}
const config=mode=>({mode,from:'invoices@example.com',allowlist:['owner@example.com']});

test('existing and newly issued test documents stay visibly private and cannot enter live delivery',()=>{
 const s=state(),i=issueInvoice(s,{role:'manager'},'i1','2026-10-20');
 assert.equal(i.issue.documentMode,undefined);
 assert.match(prepareInvoiceEmail(i,'owner@example.com').body,/PRIVATE TEST DOCUMENT/);
 assert.throws(()=>prepareDelivery(s,i.id,config('live')),/document mode/);
 assert.match(JSON.parse(prepareDelivery(s,i.id,config('test')).payload).subject,/\[Quenvira test\]/);
 const unchanged=structuredClone(i.issue);
 prepareInvoiceEmail(i,'owner@example.com');assert.deepEqual(i.issue,unchanged);
});

test('commercial snapshots produce consistent invoice text and only match live email delivery',()=>{
 const s=state(),i=issueInvoice(s,{role:'manager'},'i1','2026-10-20','live');
 assert.equal(i.issue.documentMode,'live');assert.equal(validBilling(s),true);
 const mail=prepareInvoiceEmail(i,'owner@example.com');
 assert.match(mail.body,/^INVOICE\r\n/);assert.doesNotMatch(mail.body,/PRIVATE TEST|Private testing only/);
 assert.match(mail.body,/Total: £19.00/);assert.match(mail.body,/Not VAT registered/);
 assert.throws(()=>prepareDelivery(s,i.id,config('test')),/document mode/);
 const payload=JSON.parse(prepareDelivery(s,i.id,config('live')).payload);
 assert.doesNotMatch(payload.subject,/Quenvira test/);assert.equal(payload.text,mail.body);
 i.issue.documentMode='invalid';assert.equal(validBilling(s),false);
});

test('document mode is assigned by the server release configuration, never command data',async()=>{
 for(const mode of ['test','live']){
  const db=database();try{
   const w=await setup(db),f=await fixtures(db,w);await command(db,w,'supplier.save',supplier);
   const made=await command(db,w,'job.save',job(f)),id=made.body.result[0].id;
   await command(db,w,'job.update',{id,action:'start'});
   for(let value=0;value<4;value++)await command(db,w,'job.update',{id,action:'check',value});
   await command(db,w,'job.update',{id,action:'complete'});
   const draft=await command(db,w,'invoice.create',{jobId:id,vat:0});
   const current=await request(db,'workspaces/'+w);
   const billingEnv=mode==='live'?{QUENVIRA_BILLING_MODE:'live',QUENVIRA_PAID_LAUNCH_APPROVED:'yes',STRIPE_RESTRICTED_KEY:'rk_live_local_fixture',STRIPE_WEBHOOK_SECRET:'whsec_local_fixture',STRIPE_PRICE_ID:'price_local',STRIPE_PORTAL_CONFIGURATION:'bpc_local',QUENVIRA_SITE_ORIGIN:ORIGIN,QUENVIRA_TERMS_VERSION:TERMS_VERSION}:{};
   if(mode==='live'){await startTrial(db,w,fixed().toISOString());await acceptServiceTerms(db,w,'alice',{acceptTerms:true,termsVersion:TERMS_VERSION},fixed().toISOString())}
   const options={now:fixed,bucket:db.bucket,billingEnv,billingClient:{}};
   const r=await handle(new Request(`${ORIGIN}/api/quenvira/workspaces/${w}/commands`,{method:'POST',headers:{origin:ORIGIN,'Content-Type':'application/json','oai-authenticated-user-id':'alice','oai-authenticated-user-email':'alice@example.com'},body:JSON.stringify({requestId:crypto.randomUUID(),revision:current.body.revision,action:'invoice.issue',data:{id:draft.body.result.id,documentMode:mode==='test'?'live':'test'}})}),db,options);
   assert.equal(r.status,200);const result=await r.json();assert.equal(result.result.issue.documentMode??'test',mode);
   const view=await handle(new Request(`${ORIGIN}/api/quenvira/workspaces/${w}`,{headers:{'oai-authenticated-user-id':'alice','oai-authenticated-user-email':'alice@example.com'}}),db,options);
   assert.equal((await view.json()).documentMode,mode);
  }finally{db.sqlite.close()}
 }
});
