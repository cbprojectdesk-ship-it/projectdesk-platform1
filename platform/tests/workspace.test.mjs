import {createTeamFeatures} from '../public/team-features.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {database,setup,request,fixtures,command,job,customer,ORIGIN} from './support/database.mjs';
import {encryptBusinessBackup,decryptBusinessBackup} from '../public/backup-crypto.js';
import {prepareStaffPhoto} from '../public/staff-photo.js';
import {prepareInvoiceEmail,copyInvoiceText} from '../public/invoice-email.js';
const source=fs.readFileSync(new URL('../public/workspace.js',import.meta.url),'utf8').replace(/^import .*?;\n/gm,'');
test('invoice preview retains its issued mode independently of the current workspace mode',async()=>{
 const db=database();try{
  const w=await setup(db),h=await browserAdapter(db);
  const data=h.ui.data();data.documentMode='live';
  const invoice={id:'local-mode-preview',number:'QV-9999',customerName:'Fictional QA',address:'Fictional Road',description:'Fictional service',issued:'2026-10-20',due:'2026-11-03',net:0,tax:0,total:0,vat:0,status:'Issued',issue:{supplier:{legalName:'Fictional QA',address:'Fictional Road',contact:'qa@example.com',vatRegistered:false},supplyDate:'2026-10-20',line:{description:'Fictional service',unitPrice:0}}};
  data.state.invoices.push(invoice);h.ui.invoiceDetail(invoice.id);
  assert.match(h.elements.get('#modal').innerHTML,/PRIVATE TEST DOCUMENT/);
  invoice.issue.documentMode='live';data.documentMode='test';h.ui.invoiceDetail(invoice.id);
  assert.doesNotMatch(h.elements.get('#modal').innerHTML,/PRIVATE TEST DOCUMENT/);
  assert.match(h.elements.get('#modal').innerHTML,/>INVOICE</);
 }finally{db.sqlite.close()}
});
async function browserAdapter(db,user='alice'){
 const elements=new Map(),events=new Map();let currentControls=[];
 const make=()=>({innerHTML:'',textContent:'',open:false,dataset:{},setAttribute(){},classList:{add(){},remove(){}},showModal(){this.open=true},close(){this.open=false},click(){},focus(){},setSelectionRange(){}});
 for(const k of ['#app','#modal','#toast','#form-error','#workspace-select','#job-date','#search','#save-status'])elements.set(k,make());
 const control={dropNextResponse:false,failNextRefresh:false,malformedNextResponse:false,failNextResponse:false,malformedNextRefresh:false,failNextRefreshResponse:false};
 const context={createTeamFeatures,encryptBusinessBackup,decryptBusinessBackup,prepareStaffPhoto,showConflictWarning:()=>false,prepareInvoiceEmail,copyInvoiceText,console,Map,Set,Object,String,Array,Number,Math,Date,Intl,Error,URL,Blob,crypto,JSON,setTimeout(){return 0},confirm:()=>true,location:{hash:'',pathname:'/workspace.html',origin:ORIGIN},history:{replaceState(){}},document:{querySelector:s=>elements.get(s)||null,querySelectorAll:()=>currentControls,addEventListener:(name,fn)=>events.set(name,fn),createElement:make},window:{location:{assign(url){control.redirectedURL=url}},addEventListener:(name,fn)=>events.set(name,fn)},FormData:class{constructor(form){return new Map(Object.entries(form.values).filter(([name])=>!form.controls?.find(c=>c.name===name)?.disabled))}},fetch:async(path,options)=>{if(path.endsWith('/subscription')&&control.billingResponse){control.billingBody=options.body?JSON.parse(options.body):null;if(options.body)control.lastBillingWrite=control.billingBody;return new Response(JSON.stringify(options.body?{url:control.paymentURL||'https://checkout.stripe.com/c/pay/test'}:control.billingResponse),{status:200})}const value=await request(db,path.replace('/api/quenvira/',''),options.body?JSON.parse(options.body):undefined,user);if(!options.body&&control.malformedNextRefresh){control.malformedNextRefresh=false;return new Response('truncated',{status:200})}if(!options.body&&control.failNextRefreshResponse){control.failNextRefreshResponse=false;return new Response(JSON.stringify({error:'Refresh unavailable'}),{status:503})}if(!options.body&&control.failNextRefresh){control.failNextRefresh=false;throw Error('Refresh unavailable')}if(options.body&&control.malformedNextResponse){control.malformedNextResponse=false;return new Response('truncated',{status:200})}if(options.body&&control.failNextResponse){control.failNextResponse=false;return new Response(JSON.stringify({error:'Temporary upstream error'}),{status:502})}if(control.dropNextResponse){control.dropNextResponse=false;throw Error('Lost response after commit')}return new Response(JSON.stringify(value.body),{status:value.status,headers:{'Content-Type':'application/json'}})}};
 vm.createContext(context);vm.runInContext(source.replace(/start\(\);\s*$/,`globalThis.ready=start();globalThis.ui={act,command,reload,render,closeModal,formCustomer,formJob,jobDetail,formInvoice,invoiceDetail,addDay,data:()=>data,busy:()=>busy};`),context);
 await context.ready;
 return {ui:context.ui,context,elements,control,emit(name,event){events.get(name)?.(event)},navigate(hash){context.location.hash=hash;events.get('hashchange')()},async submit(kind,values,id='',scope='visit'){currentControls=Object.keys(values).map(name=>({name,disabled:false,dataset:{}}));const form={dataset:{form:kind,id,scope},values,controls:currentControls,closest(){return this}};events.get('submit')({target:form,preventDefault(){}});const deadline=Date.now()+5000;while(context.ui.busy()){if(Date.now()>deadline)throw Error('Form did not settle');await new Promise(resolve=>setTimeout(resolve,1))}}};
}
test('secure client forms exercise customer, worker, booking, checklist, invoicing and persistence through real server handlers',async()=>{const db=database(),w=await setup(db),h=await browserAdapter(db);
 await h.submit('customer',{name:'Fictional Customer',type:'Domestic',address:'Invented Road',email:'client@example.com',notes:'Invented preferences'});
 await h.submit('staff',{name:'Fictional Worker',role:'Cleaner',capacity:'480'});
 const state=h.ui.data().state;
 await h.submit('job',{customerId:state.customers[0].id,staffId:state.staff[0].id,date:'2026-10-20',time:'09:00',duration:'120',price:'78.99',round:'Local',repeat:'One-off',count:'1'});
 const id=h.ui.data().state.jobs[0].id;await h.ui.act('start-job',id);
 for(let n=0;n<4;n++)await h.ui.command('job.update',{id,action:'check',value:n});
 await h.submit('note',{note:'Work complete'},id);await h.ui.act('complete-job',id);
 await h.submit('invoice',{jobId:id,vat:'20'});const invoice=h.ui.data().state.invoices[0];assert.equal(invoice.total,9479);
 await h.ui.act('pay',invoice.id);const reloaded=await browserAdapter(db);assert.equal(reloaded.ui.data().state.invoices[0].status,'Paid');assert.equal(reloaded.ui.data().state.jobs[0].notes,'Work complete');assert.equal(reloaded.ui.data().workspaceId,w);
});
test('client retries a lost response using the same request ID without creating duplicate records',async()=>{const db=database();await setup(db);const h=await browserAdapter(db),values={name:'Retry customer',type:'Domestic',address:'Invented',email:'',notes:''};h.control.dropNextResponse=true;await assert.rejects(()=>h.ui.command('customer.save',values),/Connection lost/);await h.ui.command('customer.save',values);assert.equal(h.ui.data().state.customers.length,1)});
test('supplier form persists automatic-draft opt-in and completion opens its single saved draft',async()=>{
 const db=database(),w=await setup(db),f=await fixtures(db,w),h=await browserAdapter(db);
 try{
  const values={legalName:'Fictional Cleaner',tradingName:'',entity:'sole-trader',address:'Fictional Road',contact:'billing@example.com',companyNumber:'',vatRegistered:'false',vatNumber:'',autoDraftInvoices:'on',autoDraftVat:'0'};
  await h.submit('supplier',values);assert.equal(h.ui.data().state.supplier.autoDraftInvoices,true);
  const booked=await command(db,w,'job.save',job(f)),id=booked.body.result[0].id;await h.ui.reload();
  await h.ui.act('start-job',id);for(let value=0;value<4;value++)await h.ui.command('job.update',{id,action:'check',value});
  await h.ui.act('complete-job',id);assert.equal(h.ui.data().state.invoices.length,1);
  assert.match(h.elements.get('#modal').innerHTML,/View invoice/);
  const reloaded=await browserAdapter(db);assert.equal(reloaded.ui.data().state.invoices.length,1);
  await reloaded.ui.act('supplier');assert.match(reloaded.elements.get('#modal').innerHTML,/name="autoDraftInvoices" checked/);
  delete values.autoDraftInvoices;await reloaded.submit('supplier',values);assert.equal(reloaded.ui.data().state.supplier.autoDraftInvoices,false);
 }finally{db.sqlite.close()}
});
test('client refreshes stale state on a conflict and does not overwrite another session',async()=>{const db=database(),w=await setup(db),h=await browserAdapter(db);await command(db,w,'customer.save',{name:'Other session',type:'Domestic',address:'Invented',email:'',notes:''});await assert.rejects(()=>h.ui.command('staff.add',{name:'New worker',role:'Cleaner',capacity:480}),/Latest records/);assert.equal(h.ui.data().state.customers.length,1);assert.equal(h.ui.data().state.staff.length,0)});
test('assigned worker UI renders no manager navigation or invoices',async()=>{const db=database(),w=await setup(db),f=await fixtures(db,w);await command(db,w,'job.save',job(f));db.sqlite.prepare("INSERT INTO memberships VALUES (?,?,'staff',?)").run(w,'worker',f.staffId);const h=await browserAdapter(db,'worker'),html=h.elements.get('#app').innerHTML;assert.ok(html.includes('Your jobs. Your day.'));assert.ok(!html.includes('href="#invoices"'));assert.ok(!html.includes('href="#customers"'));assert.equal(h.ui.data().state.jobs[0].price,undefined)});
test('secure client does not write personal data or tokens to browser storage, and forms have dedicated handlers',()=>{assert.ok(!/localStorage|sessionStorage/.test(source.replace(/^\/\/.*$/gm,'')));for(const form of ['setup','customer','staff','job','note','invoice','invite'])assert.match(source,new RegExp("case '"+form+"'"));const html=fs.readFileSync(new URL('../public/workspace.html',import.meta.url),'utf8');assert.match(html,/connect-src 'self'/);assert.ok(!html.includes('unsafe-inline'))});

for(const mode of ['failNextRefresh','malformedNextRefresh','failNextRefreshResponse','malformedNextResponse','failNextResponse'])test('retry preserves idempotency after '+mode,async()=>{const db=database();await setup(db);const h=await browserAdapter(db),values={name:'Exactly once',type:'Domestic',address:'Invented',email:'',notes:''};h.control[mode]=true;await assert.rejects(()=>h.ui.command('customer.save',values));await h.ui.command('customer.save',values);assert.equal(h.ui.data().state.customers.length,1);assert.equal(h.ui.data().revision,1)});
test('an uncertain change blocks different edits until the same action is retried or records are explicitly reloaded',async()=>{const db=database();await setup(db);const h=await browserAdapter(db),values={name:'Unconfirmed',type:'Domestic',address:'Invented',email:'',notes:''};h.control.dropNextResponse=true;await assert.rejects(()=>h.ui.command('customer.save',values));await assert.rejects(()=>h.ui.command('staff.add',{name:'Different action',role:'Cleaner',capacity:480}),/previous change is unconfirmed/);await h.ui.act('reload');await h.ui.command('staff.add',{name:'Different action',role:'Cleaner',capacity:480});assert.equal(h.ui.data().state.customers.length,1);assert.equal(h.ui.data().state.staff.length,1)});

test('secure workspace navigation renders all manager routes and escapes stored text',async()=>{const db=database(),w=await setup(db);await command(db,w,'customer.save',{name:'<script>alert(1)</script>',type:'Domestic',address:'<img src=x>',email:'',notes:'<svg onload=alert(2)>'});const h=await browserAdapter(db);for(const route of ['dashboard','schedule','jobs','customers','team','invoices','quotes','availability','notifications','settings','unknown']){h.navigate('#'+route);const html=h.elements.get('#app').innerHTML;assert.ok(html.includes('<main id="main"'));assert.ok(!html.includes('<script>alert'));assert.ok(!html.includes('<img src=x>'));assert.ok(!html.includes('<svg onload'));assert.ok(html.includes('/legal.html'));}h.navigate('#customers');assert.ok(h.elements.get('#app').innerHTML.includes('&lt;script&gt;'));});
test('secure client pause, edit-future, resume and cancel actions use persisted series commands',async()=>{const db=database(),w=await setup(db),f=await fixtures(db,w);await command(db,w,'job.save',{...job(f),repeat:'Weekly',count:3});const h=await browserAdapter(db),id=h.ui.data().state.jobs[0].id;await h.ui.act('job',id);assert.ok(h.elements.get('#modal').innerHTML.includes('Change future visits'));await h.ui.act('series-pause',id);assert.ok(h.ui.data().state.jobs.every(j=>j.status==='Paused'));h.ui.formJob(id,'future');assert.ok(h.elements.get('#modal').innerHTML.includes('data-scope="future"'));await h.submit('job',{date:'2026-10-21',time:'13:00',duration:'90',price:'75.50',staffId:f.staffId,round:'New round'},id,'future');assert.deepEqual(Array.from(h.ui.data().state.jobs,j=>j.date),['2026-10-21','2026-10-28','2026-11-04']);assert.ok(h.ui.data().state.jobs.every(j=>j.price===7550&&j.status==='Paused'));await h.ui.act('series-resume',id);assert.ok(h.ui.data().state.jobs.every(j=>j.status==='Scheduled'));await h.ui.act('series-cancel',id);assert.ok(h.ui.data().state.jobs.every(j=>j.status==='Cancelled'));});
test('staff cannot see series management controls and cannot force a series action',async()=>{const db=database(),w=await setup(db),f=await fixtures(db,w),booked=await command(db,w,'job.save',{...job(f),repeat:'Weekly',count:2});db.sqlite.prepare("INSERT INTO memberships VALUES (?,?,'staff',?)").run(w,'worker',f.staffId);const h=await browserAdapter(db,'worker'),id=booked.body.result[0].id;await h.ui.act('job',id);assert.ok(!h.elements.get('#modal').innerHTML.includes('Change future visits'));await assert.rejects(()=>h.ui.act('series-pause',id),/Manager/);assert.ok((await request(db,'workspaces/'+w)).body.state.jobs.every(j=>j.status==='Scheduled'));});
test('calendar navigation rejects invalid dates and years outside the supported range',async()=>{const db=database();await setup(db);const h=await browserAdapter(db);assert.equal(h.ui.addDay('2026-10-24',7),'2026-10-31');for(const [date,n]of [['2026-02-30',1],['0001-01-01',-1],['9999-12-31',1],['bad',1]])assert.throws(()=>h.ui.addDay(date,n),/date|calendar/i);});

test('submitting a form captures successful controls before busy-state disabling',async()=>{const db=database();await setup(db);const h=await browserAdapter(db);await h.submit('customer',{name:'Captured fields',type:'Domestic',address:'Invented',email:'',notes:''});assert.equal(h.ui.data().state.customers.length,1);assert.equal(h.ui.data().state.customers[0].name,'Captured fields');});

test('schedule heading shows the actual last supported day when fewer than seven days remain',async()=>{const db=database();await setup(db);const h=await browserAdapter(db);h.navigate('#jobs');h.elements.get('#job-date').onchange({target:{value:'9999-12-30'}});h.navigate('#schedule');const html=h.elements.get('#app').innerHTML;assert.ok(html.includes('9999-12-30 – 9999-12-31'));assert.ok(!html.includes('undefined'));});

test('invoice email preview uses saved recipient, stays read-only, and handles a missing address without claiming delivery',async()=>{
 const db=database(),w=await setup(db),f=await fixtures(db,w),j=(await command(db,w,'job.save',job(f))).body.result[0];
 await command(db,w,'job.update',{id:j.id,action:'start'});for(let n=0;n<4;n++)await command(db,w,'job.update',{id:j.id,action:'check',value:n});await command(db,w,'job.update',{id:j.id,action:'complete'});
 const i=(await command(db,w,'invoice.create',{jobId:j.id,vat:20})).body.result,h=await browserAdapter(db);
 const before=JSON.stringify(h.ui.data());await h.ui.act('email-invoice',i.id);assert.match(h.elements.get('#modal').innerHTML,/mailto:home@example.com/);assert.match(h.elements.get('#modal').innerHTML,/does not send it or track delivery/);assert.equal(JSON.stringify(h.ui.data()),before);
 await command(db,w,'customer.save',{...customer,id:f.customerId,email:''});await h.ui.reload();await h.ui.act('email-invoice',i.id);assert.ok(!h.elements.get('#modal').innerHTML.includes('mailto:'));assert.match(h.elements.get('#modal').innerHTML,/Add the customer/);
 db.sqlite.close();
});

test('copy fallback enables and selects the preview text without mutating saved records',async()=>{
 const db=database();await setup(db);const h=await browserAdapter(db);let focused=false,selected=false;
 const area={value:'DRAFT — £94.79',disabled:true,focus(){assert.equal(this.disabled,false);focused=true},select(){selected=true}};h.elements.set('#invoice-email-text',area);
 h.context.navigator={clipboard:{writeText:async()=>{throw Error('Blocked')}}};const before=JSON.stringify(h.ui.data());await h.ui.act('copy-invoice-text');
 assert.equal(focused,true);assert.equal(selected,true);assert.match(h.elements.get('#toast').textContent,/Text selected/);assert.equal(JSON.stringify(h.ui.data()),before);db.sqlite.close();
});

test('guided start progresses through persisted staff, customer, booking and assignment without losing existing records',async()=>{
 const db=database();await setup(db);let h=await browserAdapter(db);const html=()=>h.elements.get('#app').innerHTML;
 assert.match(html(),/STEP 1 OF 4/);await h.ui.act('guide-staff');await h.submit('staff',{name:'Guided worker',role:'Cleaner',capacity:'480'});assert.match(html(),/STEP 2 OF 4/);
 await h.ui.act('guide-customer');assert.match(h.elements.get('#modal').innerHTML,/<details>/);await h.submit('customer',{name:'Guided client',type:'Domestic',address:'Fictional guided address',email:'',notes:''});assert.match(html(),/STEP 3 OF 4/);
 await h.ui.act('guide-job');assert.match(h.elements.get('#modal').innerHTML,/Next step: assign a team member/);const state=h.ui.data().state;
 await h.submit('job',{customerId:state.customers[0].id,staffId:'',date:'2026-10-20',time:'09:00',duration:'60',price:'45.00',round:'Local',repeat:'One-off',count:'1'});assert.match(html(),/STEP 4 OF 4/);
 h=await browserAdapter(db);assert.match(html(),/STEP 4 OF 4/);await h.ui.act('guide-assign');await h.submit('assignment',{staffId:h.ui.data().state.staff[0].id},h.ui.data().state.jobs[0].id);assert.match(html(),/What would you like to do next/);assert.equal(h.ui.data().state.jobs[0].staffId,h.ui.data().state.staff[0].id);assert.equal(h.ui.data().state.customers.length,1);assert.equal(h.ui.data().state.jobs.length,1);db.sqlite.close();
});
test('staff landing shows assigned addresses, day counts and upcoming work without manager finance data',async()=>{
 const db=database(),w=await setup(db),f=await fixtures(db,w);await command(db,w,'job.save',{...job(f),repeat:'Weekly',count:3});db.sqlite.prepare("INSERT INTO memberships VALUES (?,?,'staff',?)").run(w,'worker',f.staffId);const h=await browserAdapter(db,'worker'),html=h.elements.get('#app').innerHTML;assert.match(html,/Jobs today/);assert.match(html,/Upcoming jobs/);assert.match(html,/Fictional Street/);assert.match(html,/View my calendar/);assert.match(html,/2026-10-27/);assert.ok(!html.includes('Owner report'));assert.ok(!html.includes('Net value'));assert.ok(!html.includes('home@example.com'));db.sqlite.close();
});


test('profile editor persists hours and cleaning level, keeps the photo, and applies new booking capacity',async()=>{
 const db=database(),w=await setup(db),f=await fixtures(db,w),h=await browserAdapter(db);
 await h.ui.act('staff-photo',f.staffId);let form=h.elements.get('#modal').innerHTML;
 assert.match(form,/Daily working hours/);assert.match(form,/Cleaning role \/ level/);assert.match(form,/name="hours"[^>]*value="8"/);
 await h.submit('staff-profile',{name:'Updated Worker',role:'Deep cleaning specialist',hours:'6.5'},f.staffId);
 assert.equal(h.elements.get('#form-error').textContent,'');let fresh=await browserAdapter(db),member=fresh.ui.data().state.staff[0];
 assert.equal(member.capacity,390);assert.equal(member.role,'Deep cleaning specialist');assert.equal(member.id,f.staffId);
 const visit=await command(db,w,'job.save',{...job(f),duration:420});assert.equal(visit.status,400);assert.match(visit.body.error,/daily capacity/);
 await h.ui.act('new-staff');assert.match(h.elements.get('#modal').innerHTML,/name="hours"/);
 await h.submit('staff',{name:'Quarter hour',role:'Standard cleaning',hours:'4.25'});assert.equal(h.ui.data().state.staff[1].capacity,255);db.sqlite.close();
});


test('directory searches and job status filters narrow results and clear without altering saved records',async()=>{
 const db=database(),w=await setup(db),f=await fixtures(db,w);
 const second=(await command(db,w,'customer.save',{...customer,name:'Other client',email:'other@example.com'})).body.result;
 await command(db,w,'staff.add',{name:'Another worker',role:'Deep cleaning',capacity:480});
 await command(db,w,'job.save',job(f));await command(db,w,'job.save',{...job(f),customerId:second.id,staffId:'',time:'14:00'});
 const h=await browserAdapter(db),before=JSON.stringify(h.ui.data().state),html=()=>h.elements.get('#app').innerHTML;
 h.navigate('#customers');h.elements.get('#search').oninput({target:{value:'other@example.com',selectionStart:17}});assert.match(html(),/<h2>Other client<\/h2>/);assert.ok(!html().includes('<h2>Fictional Home</h2>'));
 h.elements.get('#search').oninput({target:{value:'no match',selectionStart:8}});assert.match(html(),/No matching customers/);await h.ui.act('clear-search');assert.match(html(),/2 of 2 customers/);
 h.navigate('#team');h.elements.get('#search').oninput({target:{value:'Deep cleaning',selectionStart:13}});assert.match(html(),/1 of 2 team members/);assert.ok(!html().includes('<h2>Fictional Worker</h2>'));
 h.navigate('#jobs');await h.ui.act('job-filter','Unassigned');assert.match(html(),/1 of 2 visits/);assert.ok(!html().includes('<strong>Fictional Home</strong>'));
 h.elements.get('#search').oninput({target:{value:'no match',selectionStart:8}});assert.match(html(),/No matching visits/);await h.ui.act('clear-search');assert.match(html(),/2 of 2 visits/);assert.equal(JSON.stringify(h.ui.data().state),before);db.sqlite.close();
});
test('unsaved changes can be kept when closing or navigating, then discarded explicitly',async()=>{
 const db=database();await setup(db);const h=await browserAdapter(db);h.ui.formCustomer();
 h.emit('input',{target:{readOnly:false,closest:()=>({dataset:{form:'customer'}})}});
 let warned=false;h.emit('beforeunload',{preventDefault(){warned=true}});assert.equal(warned,true);
 h.context.confirm=()=>false;await h.ui.act('close');assert.equal(h.elements.get('#modal').open,true);h.navigate('#team');assert.equal(h.elements.get('#modal').open,true);assert.match(h.elements.get('#app').innerHTML,/Let’s set up your working day/);
 h.context.confirm=()=>true;await h.ui.act('close');assert.equal(h.elements.get('#modal').open,false);warned=false;h.emit('beforeunload',{preventDefault(){warned=true}});assert.equal(warned,false);db.sqlite.close();
});
test('save feedback identifies an uncertain update and resolves after replay without duplicating records',async()=>{
 const db=database(),w=await setup(db),h=await browserAdapter(db);h.control.dropNextResponse=true;
 await assert.rejects(()=>h.ui.command('staff.add',{name:'Saved once',role:'Cleaner',capacity:480}),/Connection lost/);assert.equal(h.elements.get('#save-status').textContent,'Check your last update');
 await h.ui.command('staff.add',{name:'Saved once',role:'Cleaner',capacity:480});assert.equal(h.elements.get('#save-status').textContent,'All changes saved');assert.equal(h.ui.data().state.staff.length,1);db.sqlite.close();
});
test('job checklist shows progress and keeps completion guarded until every task is done',async()=>{
 const db=database(),w=await setup(db),f=await fixtures(db,w);await command(db,w,'job.save',job(f));const h=await browserAdapter(db),id=h.ui.data().state.jobs[0].id;
 h.ui.jobDetail(id);assert.match(h.elements.get('#modal').innerHTML,/0 of 4 tasks complete/);assert.match(h.elements.get('#modal').innerHTML,/Start the visit to tick tasks/);
 await h.ui.act('start-job',id);await h.ui.command('job.update',{id,action:'check',value:0});h.ui.jobDetail(id);assert.match(h.elements.get('#modal').innerHTML,/1 of 4 tasks complete/);await assert.rejects(()=>h.ui.command('job.update',{id,action:'complete'}),/finish every checklist/);db.sqlite.close();
});


test('staff My account shows their profile and account actions without manager settings or backup controls',async()=>{
 const db=database(),w=await setup(db),f=await fixtures(db,w);db.sqlite.prepare("INSERT INTO memberships VALUES (?,?,'staff',?)").run(w,'worker',f.staffId);
 const h=await browserAdapter(db,'worker');h.navigate('#settings');const html=h.elements.get('#app').innerHTML;
 assert.match(html,/>My account<\/a>/);assert.match(html,/<h1>My account<\/h1>/);assert.match(html,/Fictional Worker/);assert.match(html,/Refresh my records/);assert.match(html,/worker@example.com/);assert.match(html,/>Help<\/a>/);assert.match(html,/>Sign out<\/a>/);
 for(const text of ['Settings & backups','Export and recovery','Delete workspace','Invoice supplier','Review recovery history','Download JSON snapshot','Download encrypted backup','Restore backup into empty workspace','Edit supplier details','Release status'])assert.ok(!html.includes(text),'Staff page must omit '+text);
 for(const action of ['supplier','export','backups','restore','delete-workspace','invite','invitations','revoke','backup-download','backup-import'])await assert.rejects(()=>h.ui.act(action),/Manager access required/);
 assert.equal((await request(db,'workspaces/'+w+'/backups',undefined,'worker')).status,403);
 assert.equal((await request(db,'workspaces/'+w+'/delete',{confirmName:'alice cleaning'},'worker')).status,403);
 assert.equal((await command(db,w,'backup.restore',{revision:0},'worker')).status,403);
 const owner=await browserAdapter(db);owner.navigate('#settings');const ownerHtml=owner.elements.get('#app').innerHTML;assert.match(ownerHtml,/Settings & backups/);assert.match(ownerHtml,/Review recovery history/);assert.match(ownerHtml,/Delete this workspace/);assert.match(ownerHtml,/Edit supplier details/);db.sqlite.close();
});


test('managers can open protected backup forms while restore is blocked for a populated business',async()=>{const db=database(),w=await setup(db),h=await browserAdapter(db);await h.ui.act('backup-download');assert.match(h.elements.get('#modal').innerHTML,/never sent to Quenvira/);assert.match(h.elements.get('#modal').innerHTML,/name="backupPassword" type="password"/);await h.ui.act('backup-import');assert.match(h.elements.get('#modal').innerHTML,/name="backupFile"/);await command(db,w,'staff.add',{name:'Existing',role:'Cleaner',capacity:480});await h.ui.reload();await assert.rejects(()=>h.ui.act('backup-import'),/empty workspace/);db.sqlite.close();});


test('encrypted backup preparation provides a user-clicked file link and clears password fields without changing business records',async()=>{const db=database();await setup(db);const h=await browserAdapter(db),before=JSON.stringify(h.ui.data());await h.ui.act('backup-download');await h.submit('backup-download',{backupPassword:'Synthetic-password-only',confirmPassword:'Synthetic-password-only'});const html=h.elements.get('#modal').innerHTML;assert.match(html,/Your encrypted backup is ready/);assert.match(html,/download="quenvira-business-2026-10-20.qvb"/);assert.ok(!html.includes('Synthetic-password-only'));assert.ok(!html.includes('name="backupPassword"'));assert.equal(JSON.stringify(h.ui.data()),before);assert.equal(h.elements.get('#form-error').textContent,'');await h.ui.act('close');db.sqlite.close();});

test('manager subscription panel preserves pilot status; staff cannot open billing',async()=>{
 const db=database(),w=await setup(db),f=await fixtures(db,w),h=await browserAdapter(db);h.navigate('#settings');assert.match(h.elements.get('#app').innerHTML,/Subscription &amp; billing|Subscription & billing/);await h.ui.act('subscription');assert.match(h.elements.get('#modal').innerHTML,/not activated/);
 db.sqlite.prepare("INSERT INTO memberships VALUES (?,?,'staff',?)").run(w,'worker',f.staffId);const staff=await browserAdapter(db,'worker');staff.navigate('#settings');assert.doesNotMatch(staff.elements.get('#app').innerHTML,/data-action="subscription"/);await assert.rejects(staff.ui.act('subscription'),/Manager/);db.sqlite.close();
});
test('billing form captures explicit terms acceptance and validates Stripe redirect origin',async()=>{
 const db=database();await setup(db);const h=await browserAdapter(db);h.control.billingResponse={enabled:true,status:'trial',trialEnd:'2026-11-05T12:00:00Z',canWrite:true,canManage:true,canCheckout:true};await h.ui.act('subscription');assert.match(h.elements.get('#modal').innerHTML,/£19 total per month/);assert.match(h.elements.get('#modal').innerHTML,/required/);await h.submit('subscription',{acceptTerms:'yes'});assert.equal(h.control.billingBody.acceptTerms,true);assert.equal(h.control.billingBody.termsVersion,'2026-10-28');assert.equal(h.control.redirectedURL,'https://checkout.stripe.com/c/pay/test');
 h.control.paymentURL='https://evil.test/phish';await assert.rejects(h.ui.act('subscription-portal'),/Invalid payment provider/);db.sqlite.close();
});


test('existing subscriptions show cancellation dates and management without offering duplicate checkout',async()=>{
 const db=database();await setup(db);const h=await browserAdapter(db);
 try{
  for(const status of ['trialing','active','past_due','unpaid','paused','incomplete']){
   h.control.billingResponse={enabled:true,mode:'test',status,canWrite:status==='trialing'||status==='active',canManage:true,canCheckout:false,cancellationScheduled:true,cancelAt:1793880000,trialEnd:'2026-11-05T12:00:00Z'};
   await h.ui.act('subscription');const html=h.elements.get('#modal').innerHTML;
   assert.match(html,/Cancellation is scheduled for/);assert.match(html,/05\/11\/2026/);assert.match(html,/Manage subscription \/ cancel/);assert.match(html,/Refresh subscription status/);assert.match(html,/Sandbox testing only/);assert.doesNotMatch(html,/data-form="subscription"/);assert.doesNotMatch(html,/Continue to secure checkout/);
  }
  h.control.billingResponse={enabled:true,status:'canceled',canWrite:false,canManage:true,canCheckout:true};await h.ui.act('subscription');assert.match(h.elements.get('#modal').innerHTML,/Continue to secure checkout/);
 }finally{db.sqlite.close()}
});


test('signed-out workspace explains authentication instead of reporting a crash',async()=>{
 const h=await browserAdapter(database(),null),html=h.elements.get('#app').innerHTML;
 assert.match(html,/Sign in to your workspace/);
 assert.match(html,/session has expired/);
 assert.match(html,/signin-with-chatgpt\?return_to=%2Fworkspace.html/);
 assert.match(html,/target="_top"/);
 assert.match(html,/id="main"/);
 assert.doesNotMatch(html,/Workspace unavailable/);
 assert.equal(h.ui.data(),undefined);
});
test('storage failure offers a workspace retry without incorrectly requiring sign-in',async()=>{
 const h=await browserAdapter(undefined),html=h.elements.get('#app').innerHTML;
 assert.match(html,/Workspace could not be opened/);
 assert.match(html,/Persistent storage is not configured/);
 assert.match(html,/href="\/workspace.html"/);
 assert.doesNotMatch(html,/signin-with-chatgpt/);
 assert.equal(h.ui.data(),undefined);
});

test('manager sees honest email configuration status; staff cannot open email tools',async()=>{
 const db=database(),w=await setup(db),f=await fixtures(db,w);try{
  const h=await browserAdapter(db);h.navigate('#invoices');assert.match(h.elements.get('#app').innerHTML,/Email delivery history/);
  await h.ui.act('email-history');assert.match(h.elements.get('#modal').innerHTML,/Automatic email is not configured/);assert.ok(!h.elements.get('#modal').innerHTML.includes('Process due email'));
  db.sqlite.prepare("INSERT INTO memberships VALUES (?,?,'staff',?)").run(w,'worker',f.staffId);const worker=await browserAdapter(db,'worker');
  await assert.rejects(()=>worker.ui.act('email-history'),/Manager access required/);await assert.rejects(()=>worker.ui.act('dispatch-invoices'),/Manager access required/);
 }finally{db.sqlite.close()}
});

test('live business terms panel separates acceptance from paid checkout and sends exact version',async()=>{
 const db=database();try{await setup(db);const h=await browserAdapter(db);
 h.control.billingResponse={enabled:true,mode:'live',status:'trial',canWrite:false,canManage:false,canCheckout:true,termsAccepted:false,termsVersion:'2026-10-28'};
 await h.ui.act('subscription');let html=h.elements.get('#modal').innerHTML;
 assert.match(html,/data-form="service-terms"/);assert.match(html,/does not start a paid subscription/);assert.doesNotMatch(html,/Continue to secure checkout/);
 await h.submit('service-terms',{acceptTerms:'yes'});assert.equal(h.control.redirectedURL,undefined);assert.equal(h.control.lastBillingWrite.action,'accept-terms');assert.equal(h.control.lastBillingWrite.acceptTerms,true);assert.equal(h.control.lastBillingWrite.termsVersion,'2026-10-28');
 // The adapter captures the last request; refreshing the panel follows acceptance.
 h.control.billingResponse.termsAccepted=true;await h.ui.act('subscription');html=h.elements.get('#modal').innerHTML;
 assert.doesNotMatch(html,/data-form="service-terms"/);assert.match(html,/Continue to secure checkout/);
 }finally{db.sqlite.close()}
});

test('quote UI creates itemised draft, records decisions, books accepted work and reloads saved records',async()=>{
 const db=database();try{const w=await setup(db),f=await fixtures(db,w),h=await browserAdapter(db);
 await h.ui.command('supplier.save',{legalName:'Fictional supplier',entity:'sole-trader',address:'Invented Road',contact:'qa@example.com',vatRegistered:false});
 h.navigate('#quotes');assert.match(h.elements.get('#app').innerHTML,/New quote/);
 await h.ui.act('feature-quote-new');assert.match(h.elements.get('#modal').innerHTML,/whole quantity/);
 await h.submit('feature-quote',{customerId:f.customerId,description:'Fictional service',validUntil:'2026-11-20',vat:'0',terms:'Fictional test',lines:'Cleaning | 2 | 25.01\nSupplies | 1 | 9.99'});
 const q=h.ui.data().state.quotes[0];assert.equal(q.net,6001);await h.ui.act('feature-quote',q.id);assert.match(h.elements.get('#modal').innerHTML,/£60.01/);
 await h.ui.act('feature-quote-issue',q.id);assert.match(h.elements.get('#modal').innerHTML,/TEST QUOTE/);await h.ui.act('feature-quote-accept',q.id);
 await h.ui.act('feature-quote-book',q.id);await h.submit('feature-quote-book',{date:'2026-10-20',time:'10:00',duration:'60',staffId:f.staffId},q.id);
 const reloaded=await browserAdapter(db);assert.equal(reloaded.ui.data().state.jobs.length,1);assert.equal(reloaded.ui.data().state.quotes[0].status,'Converted');
 }finally{db.sqlite.close()}
});
test('staff UI saves own availability, requests leave and reads only their notifications',async()=>{
 const db=database();try{const w=await setup(db),f=await fixtures(db,w);db.sqlite.prepare("INSERT INTO memberships VALUES (?,?,'staff',?)").run(w,'worker',f.staffId);await command(db,w,'job.save',job(f));
 const h=await browserAdapter(db,'worker');h.navigate('#availability');assert.match(h.elements.get('#app').innerHTML,/My availability/);await h.ui.act('feature-hours',f.staffId);
 const values={};for(let i=0;i<7;i++)Object.assign(values,{['available'+i]:'on',['start'+i]:'09:00',['end'+i]:'17:00'});await h.submit('feature-hours',values,f.staffId);assert.equal(h.ui.data().state.availability.length,1);
 await h.ui.act('feature-leave',f.staffId);await h.submit('feature-leave',{type:'Holiday',from:'2026-10-21',to:'2026-10-22',note:'Fictional plans'},f.staffId);assert.equal(h.ui.data().state.leaveRequests[0].status,'Pending');
 h.navigate('#notifications');assert.match(h.elements.get('#app').innerHTML,/Unread/);const n=h.ui.data().state.notifications[0];await h.ui.act('feature-read',n.id);assert.ok(h.ui.data().state.notifications[0].readAt);
 await assert.rejects(()=>h.ui.act('feature-quote-new'),/Manager access/);h.navigate('#quotes');assert.ok(!h.elements.get('#app').innerHTML.includes('New quote'));
 const manager=await browserAdapter(db);const r=manager.ui.data().state.leaveRequests[0];await manager.ui.act('feature-leave-review',r.id);await manager.submit('feature-leave-review',{status:'Approved',managerNote:'Fictional approval'},r.id);await h.ui.reload();assert.equal(h.ui.data().state.leaveRequests[0].status,'Approved');
 }finally{db.sqlite.close()}
});

test('staged Solo/Team chooser shows exact prices and sends elected plan and current terms without old price',async()=>{
 const db=database();try{await setup(db);const h=await browserAdapter(db);h.control.billingResponse={enabled:true,mode:'test',status:'trial',canWrite:true,canCheckout:true,termsVersion:'2026-10-29',plans:[{id:'solo',name:'Solo',amount:799,maxStaff:1,staffAccess:false},{id:'team',name:'Team',amount:1499,maxStaff:3,staffAccess:true}]};await h.ui.act('subscription');const html=h.elements.get('#modal').innerHTML;assert.match(html,/£7.99/);assert.match(html,/£14.99/);assert.match(html,/name="plan" required/);assert.match(html,/subscription-terms-solo-team.html/);assert.doesNotMatch(html,/£19/);await h.submit('subscription',{acceptTerms:'yes',plan:'solo',termsVersion:'2026-10-29'});assert.equal(h.control.billingBody.plan,'solo');assert.equal(h.control.billingBody.termsVersion,'2026-10-29');assert.equal(h.control.redirectedURL,'https://checkout.stripe.com/c/pay/test');}finally{db.sqlite.close()}
});
