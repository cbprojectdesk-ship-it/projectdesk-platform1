// Executes the real UI module against minimal DOM adapters. This is not a browser test.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as domain from '../public/demo/domain.js';
import {prepareInvoiceEmail,copyInvoiceText} from '../public/invoice-email.js';
const src=fs.readFileSync(new URL('../public/demo/app.js',import.meta.url),'utf8').replace(/^import .*?;\n/gm,'');
function harness(saved){
 const elements=new Map();
 const make=()=>({innerHTML:'',textContent:'',open:false,value:'',dataset:{},classList:{add(){},remove(){}},addEventListener(){},querySelector(){return null},querySelectorAll(){return []},showModal(){this.open=true},close(){this.open=false},focus(){},setSelectionRange(){},click(){}});
 for(const id of ['#app','#modal','#toast','#persona','#form-error'])elements.set(id,make());
 const storage=new Map(saved?[['quenvira-demo-v1',saved]]:[]);
 const context={...domain,prepareInvoiceEmail,copyInvoiceText,Intl,Date,JSON,Number,String,Error,Array,Set,Math,crypto,structuredClone,Blob,URL,setTimeout:()=>0,clearTimeout(){},confirm:()=>true,location:{hash:'#dashboard'},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{querySelector:s=>elements.get(s)||null,addEventListener(){},createElement:make},window:{addEventListener(){}}};
 vm.createContext(context);vm.runInContext(src+`\nglobalThis.testing={route,render,act,bindModal,jobDetail,customerForm,jobForm,invoiceForm,invoiceDetail,state:()=>state,actor:()=>actor,setActor:a=>actor=a,setView:v=>view=v,html:()=>document.querySelector('#app').innerHTML,modal:()=>document.querySelector('#modal').innerHTML};`,context);return {ui:context.testing,context,elements,storage};
}
test('all seven routes render meaningful content without runtime failures',()=>{const {ui,context}=harness();for(const route of ['dashboard','schedule','jobs','customers','team','invoices','settings']){context.location.hash='#'+route;ui.route();assert.match(ui.html(),/<main id="main"/);assert.match(ui.html(),/<h1>[^<]+<\/h1>/);assert.ok(!ui.html().includes('undefined'))}});
test('unknown route returns dashboard',()=>{const {ui,context}=harness();context.location.hash='#bad-route';ui.route();assert.match(ui.html(),/A clearer day starts here/)});
test('all primary navigation destinations exist',()=>{const {ui}=harness();const links=[...ui.html().matchAll(/href="#([a-z]+)"/g)].map(x=>x[1]);for(const v of ['dashboard','jobs','schedule','customers','team','invoices','settings'])assert.ok(links.includes(v))});
test('staff cannot render financial or customer pages via direct hash',()=>{const {ui,context}=harness();ui.setActor({role:'staff',staffId:'s1'});for(const target of ['dashboard','invoices','customers','team']){context.location.hash='#'+target;ui.route();assert.match(ui.html(),/Your jobs. Your day/);assert.ok(!ui.html().includes('Outstanding invoices'));assert.ok(!ui.html().includes('Harbour &amp; Finch Studio'))}});
test('all staff job detail dialogs reject another member’s job',()=>{const {ui}=harness();ui.setActor({role:'staff',staffId:'s1'});assert.throws(()=>ui.jobDetail('j0-1'),/not found/);ui.jobDetail('j0-4');assert.match(ui.modal(),/Seabreeze Apartments/)});
test('stored user text is escaped on customer, job, invoice and team screens',()=>{const state=domain.seed(),payload='<img src=x onerror="alert(1)">';state.customers[0].name=payload;state.customers[0].notes=payload;state.staff[0].name=payload;state.invoices[0].customerName=payload;const {ui,context}=harness(JSON.stringify(state));for(const route of ['dashboard','customers','schedule','team','invoices']){context.location.hash='#'+route;ui.route();assert.ok(!ui.html().includes(payload));assert.ok(ui.html().includes('&lt;img'))}ui.jobDetail('j0-0');assert.ok(!ui.modal().includes(payload));ui.invoiceDetail('i0');assert.ok(!ui.modal().includes(payload));});
test('job, customer, staff and invoice dialogs render their forms and labels',()=>{const {ui}=harness();ui.jobForm();assert.match(ui.modal(),/id="job-form"/);assert.match(ui.modal(),/name="duration"/);assert.match(ui.modal(),/name="staffId"/);ui.customerForm();assert.match(ui.modal(),/id="customer-form"/);ui.invoiceForm();assert.match(ui.modal(),/id="invoice-form"/);ui.act('new-staff',{dataset:{}});assert.match(ui.modal(),/id="staff-form"/)});
test('real action handler performs start, guarded completion, note, checklist and payment workflows',()=>{const {ui,elements,storage}=harness(),id='j0-4';ui.act('start-job',{dataset:{id}});assert.equal(ui.state().jobs.find(j=>j.id===id).status,'In progress');assert.throws(()=>ui.act('complete-job',{dataset:{id}}),/checklist/);elements.set('#visit-note',{value:'Fictional visit finished'});ui.act('save-note',{dataset:{id}});const state=ui.state();for(let i=0;i<4;i++)domain.updateJob(state,{role:'manager'},id,'check',i);elements.get('#visit-note').value='Final note entered before completion';ui.act('complete-job',{dataset:{id}});assert.equal(ui.state().jobs.find(j=>j.id===id).status,'Completed');assert.equal(ui.state().jobs.find(j=>j.id===id).notes,'Final note entered before completion');const invoice=domain.createInvoice(ui.state(),{role:'manager'},id,20);ui.act('pay-invoice',{dataset:{id:invoice.id}});assert.equal(invoice.status,'Paid');assert.equal(JSON.parse(storage.get('quenvira-demo-v1')).invoices.at(-1).status,'Paid')});
test('invalid saved storage recovers with visible warning',()=>{for(const saved of ['{broken','{"version":99}']){const {ui}=harness(saved);assert.match(ui.html(),/Saved data could not be loaded/);assert.equal(ui.state().customers.length,6)}});
test('storage failure leaves in-memory progress and displays an export warning',()=>{const {ui,context}=harness();context.localStorage.setItem=()=>{throw Error('quota')};ui.act('start-job',{dataset:{id:'j0-4'}});assert.match(ui.html(),/storage is unavailable or full/);assert.equal(ui.state().jobs.find(j=>j.id==='j0-4').status,'In progress')});
test('failed action rolls back state and records no partial change',()=>{const {ui}=harness();const before=JSON.stringify(ui.state());assert.throws(()=>ui.act('complete-job',{dataset:{id:'j0-4'}}));assert.equal(JSON.stringify(ui.state()),before)});
test('invoice rendering identifies fictional draft, exact totals and manual payment',()=>{const {ui}=harness();const i=domain.createInvoice(ui.state(),{role:'manager'},'j0-0',20);ui.invoiceDetail(i.id);assert.match(ui.modal(),/DEMONSTRATION DRAFT/);assert.match(ui.modal(),/£78.00/);assert.match(ui.modal(),/Record demo payment/)});
test('all declared action names have a handler',()=>{const declared=[...src.matchAll(/(?:data-action="|button\([^\n]*?,\s*['"])([a-z]+(?:-[a-z]+)*)/g)].map(m=>m[1]);const handlers=new Set([...src.matchAll(/case\s*'([^']+)'/g)].map(m=>m[1]));for(const action of declared)assert.ok(handlers.has(action),'Missing handler for '+action)});
test('static entrypoint references real assets, CSP has no inline script exemption',()=>{const root=new URL('../public/demo/',import.meta.url),html=fs.readFileSync(new URL('index.html',root),'utf8');for(const file of ['app.js','domain.js','style.css','icon.svg'])assert.ok(fs.existsSync(new URL(file,root)));assert.match(html,/connect-src 'none'/);assert.ok(!html.includes('unsafe-inline'));assert.ok(!html.includes('onclick='));});

test('skip to content preserves the current page and moves focus',()=>{
 const {ui,context,elements}=harness();context.location.hash='#customers';ui.route();
 let focused=false;elements.set('#main',{focus(){focused=true}});
 context.location.hash='#main';ui.route();assert.ok(focused);assert.match(ui.html(),/active customers/);
});
test('another tab cannot silently overwrite newer persisted edits or reset them',()=>{
 for(const action of ['start-job','reset']){
  const {ui,storage}=harness();const newer=domain.seed();newer.customers[0].name='Other tab';
  const serialized=JSON.stringify(newer);storage.set('quenvira-demo-v1',serialized);
  assert.throws(()=>ui.act(action,{dataset:{id:'j0-4'}}),/another tab/);
  assert.equal(storage.get('quenvira-demo-v1'),serialized);
  assert.equal(ui.state().jobs.find(j=>j.id==='j0-4').status,'Scheduled');
 }
});
test('nested corrupt saved records recover to a usable demo with a warning',()=>{
 const saved=domain.seed();saved.jobs[0].checklist=[null];const {ui}=harness(JSON.stringify(saved));
 assert.match(ui.html(),/Saved data could not be loaded/);assert.ok(domain.validateState(ui.state()));
});
test('all relative downloadable guide and presentation resources exist',()=>{
 for(const file of ['demo-guide.md','test-results.txt','presentation.html','presentation.css'])assert.ok(fs.existsSync(new URL('../public/demo/'+file,import.meta.url)),file);
});

test('actual form submit handler creates customers, staff, recurring jobs and invoices',()=>{
 const {ui,context,elements,storage}=harness();
 context.FormData=class{constructor(form){return new Map(Object.entries(form.values))}};
 const submit=(id,values,recordId='')=>{
  const form={id,values,dataset:{id:recordId}};
  elements.get('#modal').querySelector=()=>form;ui.bindModal();
  elements.get('#form-error').textContent='';form.onsubmit({preventDefault(){}});
  assert.equal(elements.get('#form-error').textContent,'');
 };
 submit('customer-form',{name:'Form Customer',type:'Domestic',address:'Fictional Road',email:'form@example.com',notes:'Invented'});
 const customerId=ui.state().customers.at(-1).id;
 submit('staff-form',{name:'Form Worker',role:'Cleaner',capacity:'480'});
 const staffId=ui.state().staff.at(-1).id;
 submit('job-form',{customerId,staffId,date:'2026-11-03',time:'10:00',duration:'120',price:'78.99',round:'Form round',repeat:'Weekly',count:'3'});
 assert.equal(ui.state().jobs.slice(-3).length,3);assert.equal(ui.state().jobs.at(-1).price,7899);
 const id=ui.state().jobs.at(-3).id;
 ui.act('start-job',{dataset:{id}});
 for(let i=0;i<4;i++)domain.updateJob(ui.state(),{role:'manager'},id,'check',i);
 ui.act('complete-job',{dataset:{id}});
 submit('invoice-form',{jobId:id,vat:'20'});
 const invoice=ui.state().invoices.at(-1);assert.equal(invoice.total,9479);
 ui.act('pay-invoice',{dataset:{id:invoice.id}});
 assert.ok(domain.validateState(JSON.parse(storage.get('quenvira-demo-v1'))));
});
test('failed form submission shows an error and preserves existing state',()=>{
 const {ui,context,elements}=harness();context.FormData=class{constructor(form){return new Map(Object.entries(form.values))}};
 const form={id:'customer-form',dataset:{},values:{name:'',type:'Domestic',address:'Fictional',email:'',notes:''}};
 elements.get('#modal').querySelector=()=>form;ui.bindModal();const before=JSON.stringify(ui.state());
 form.onsubmit({preventDefault(){}});assert.match(elements.get('#form-error').textContent,/name is required/);
 assert.equal(JSON.stringify(ui.state()),before);
});

test('demo email preview uses saved address and workers cannot open it',()=>{const {ui}=harness();ui.act('email-invoice',{dataset:{id:'i0'}});assert.match(ui.modal(),/mailto:willow@example.com/);assert.match(ui.modal(),/does not send it or track delivery/);ui.setActor({role:'staff',staffId:'s1'});assert.throws(()=>ui.act('email-invoice',{dataset:{id:'i0'}}),/Manager/)});
