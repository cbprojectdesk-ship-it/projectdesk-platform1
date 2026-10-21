import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';

const testSessions=new WeakMap();
test.beforeEach(async({context,page})=>{
 const key=randomUUID();testSessions.set(context,key);
 await context.setExtraHTTPHeaders({'x-e2e-session':key});
 await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 const response=await context.request.post('/__test/seed',{data:{}});expect(response.ok()).toBeTruthy();
 page.on('dialog',dialog=>dialog.accept());
});
const close=page=>page.locator('#modal > header [data-action="close"]').click();
async function navigate(page,route){await page.locator(`nav a[href="#${route}"]`).click();await expect(page.locator('main#main')).toBeVisible();await expect(page.locator('#app')).not.toHaveAttribute('aria-busy','true')}
async function fits(page){const size=await page.evaluate(()=>({actual:document.documentElement.scrollWidth,available:window.innerWidth}));expect(size.actual,'page overflow with saved records').toBeLessThanOrEqual(size.available+1)}
async function ready(page){await expect(page.locator('main#main')).toBeVisible();await expect(page.locator('#app')).not.toHaveAttribute('aria-busy','true')}
async function state(context){const session=await (await context.request.get('/api/quenvira/session')).json();return (await context.request.get('/api/quenvira/workspaces/'+session.workspaces[0].id)).json()}
async function addCustomer(page,name='QA Willow House'){
 await navigate(page,'customers');await page.getByRole('button',{name:'Add customer',exact:false}).click();
 await page.getByLabel('Name',{exact:true}).fill(name);await page.getByLabel('Service address').fill('10 Example Lane (fictional)');
 await page.getByLabel('Email',{exact:true}).fill('willow@example.com');await page.getByLabel('Service preferences').fill('Fictional instructions');
 await page.getByRole('button',{name:'Save customer',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();
}
async function addStaff(page){await navigate(page,'team');await page.getByRole('button',{name:'Add team member',exact:false}).click();await page.getByLabel('Full name').fill('QA Maya Ellis');await page.getByRole('button',{name:'Add team member',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible()}
async function book(page,{repeat='One-off',count='1',date='2026-10-20',time='09:00'}={}){
 await navigate(page,'jobs');await page.getByRole('button',{name:'New job',exact:false}).click();
 await page.locator('#modal').getByLabel('Date',{exact:true}).fill(date);await page.getByLabel('Time',{exact:true}).fill(time);
 await page.getByLabel('Net price (£)').fill('78.99');await page.getByLabel('Staff',{exact:true}).selectOption({label:'QA Maya Ellis'});
 await page.getByLabel('Repeat',{exact:true}).selectOption(repeat);await page.getByLabel('Number of visits').fill(count);
 await page.getByRole('button',{name:'Save visit',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();
}

test('customer to completed checklist, exact VAT, download, payment and persisted reload',async({page,context})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/workspace.html');await addCustomer(page);await addStaff(page);await book(page);await fits(page);
 await page.getByRole('button',{name:'Open visit',exact:true}).click();await page.getByRole('button',{name:'Start visit',exact:true}).click();await ready(page);
 await page.getByRole('button',{name:'Complete visit',exact:true}).click();await expect(page.locator('#form-error')).toContainText('checklist');
 await page.getByLabel('Visit notes').fill('QA visit completed');await page.getByRole('button',{name:'Save note',exact:true}).click();await ready(page);
 for(let n=0;n<4;n++){await page.locator('#modal input[type=checkbox]').nth(n).check();await ready(page);await expect(page.locator('#modal input[type=checkbox]').nth(n)).toBeChecked()}
 await page.getByRole('button',{name:'Complete visit',exact:true}).click();await ready(page);await expect(page.locator('#modal .badge')).toHaveText('Completed');
 await page.getByRole('button',{name:'Create invoice',exact:true}).click();await page.getByLabel('VAT for registered suppliers only').selectOption('20');await page.getByRole('button',{name:'Create draft',exact:true}).click();await ready(page);
 await fits(page);await expect(page.locator('.invoice-totals')).toContainText('£94.79');await expect(page.locator('.invoice-totals')).toContainText('£15.80');
 const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Download draft',exact:true}).click();const download=await downloaded;
 expect(download.suggestedFilename()).toMatch(/DRAFT\.txt$/);expect(await fs.readFile(await download.path(),'utf8')).toContain('Total £94.79');
 await page.getByRole('button',{name:'Record manual payment',exact:true}).click();await ready(page);await expect(page.locator('#modal .badge')).toHaveText('Paid');
 await page.reload();await ready(page);const saved=await state(context);expect(saved.state.invoices).toHaveLength(1);expect(saved.state.invoices[0]).toMatchObject({total:9479,status:'Paid'});expect(saved.state.jobs[0]).toMatchObject({status:'Completed',notes:'QA visit completed'});expect(errors).toEqual([]);
});

test('recurring controls persist; overlap rejection leaves the existing bookings intact',async({page,context})=>{
 await page.goto('/workspace.html');await addCustomer(page);await addStaff(page);await book(page,{repeat:'Weekly',count:'3'});
 await page.getByRole('button',{name:'Open visit',exact:true}).click();await page.getByRole('button',{name:'Pause future visits',exact:true}).click();await ready(page);
 expect((await state(context)).state.jobs.every(j=>j.status==='Paused')).toBeTruthy();await expect(page.getByRole('button',{name:'Start visit',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Change future visits',exact:true}).click();await page.getByLabel('Time',{exact:true}).fill('13:00');await page.getByLabel('Net price (£)').fill('45.00');await page.getByRole('button',{name:'Save future visits',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();
 await page.getByRole('button',{name:'Open visit',exact:true}).click();await page.getByRole('button',{name:'Resume paused visits',exact:true}).click();await ready(page);await close(page);
 const jobs=(await state(context)).state.jobs;expect(jobs).toHaveLength(3);expect(jobs.every(j=>j.status==='Scheduled'&&j.time==='13:00'&&j.price===4500)).toBeTruthy();
 await page.getByRole('button',{name:'New job',exact:false}).click();await page.getByLabel('Time',{exact:true}).fill('13:30');await page.getByLabel('Staff',{exact:true}).selectOption({label:'QA Maya Ellis'});await page.getByRole('button',{name:'Save visit',exact:true}).click();await expect(page.locator('#form-error')).toContainText('overlapping');expect((await state(context)).state.jobs).toHaveLength(3);const warning=page.getByRole('alertdialog');await expect(warning).toBeVisible();await expect(warning).toContainText('There’s a booking clash');const bounds=await warning.boundingBox();expect(Math.abs(bounds.x+bounds.width/2-(await page.evaluate(()=>document.documentElement.clientWidth))/2)).toBeLessThan(3);await warning.getByRole('button',{name:'Close clash warning',exact:true}).click();await expect(warning).not.toBeVisible();await expect(page.getByLabel('Time',{exact:true})).toHaveValue('13:30');await page.getByRole('button',{name:'Save visit',exact:true}).click();await expect(warning).toBeVisible();await page.keyboard.press('Escape');await expect(warning).not.toBeVisible();await expect(page.getByLabel('Time',{exact:true})).toHaveValue('13:30');await close(page);
 await page.getByRole('button',{name:'Open visit',exact:true}).click();await page.getByRole('button',{name:'Cancel future visits',exact:true}).click();await ready(page);expect((await state(context)).state.jobs.every(j=>j.status==='Cancelled')).toBeTruthy();
});

test('offline retry and stale tabs do not silently duplicate or overwrite records',async({page,context})=>{
 await page.goto('/workspace.html');await navigate(page,'customers');await page.getByRole('button',{name:'Add customer',exact:false}).click();await page.getByLabel('Name',{exact:true}).fill('Offline QA');await page.getByLabel('Service address').fill('Fictional');
 await context.setOffline(true);await page.getByRole('button',{name:'Save customer',exact:true}).click();await expect(page.locator('#form-error')).toContainText('Connection lost');await context.setOffline(false);await page.getByRole('button',{name:'Save customer',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();expect((await state(context)).state.customers).toHaveLength(1);
 const other=await context.newPage();await other.goto('/workspace.html#customers');await expect(other.getByRole('button',{name:'View & edit',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'View & edit',exact:true}).click();await page.getByLabel('Name',{exact:true}).fill('Newer edit');await page.getByRole('button',{name:'Save customer',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();
 await other.getByRole('button',{name:'View & edit',exact:true}).click();await other.getByLabel('Name',{exact:true}).fill('Stale edit');await other.getByRole('button',{name:'Save customer',exact:true}).click();await expect(other.locator('#form-error')).toContainText('Latest records');expect((await state(context)).state.customers[0].name).toBe('Newer edit');await expect(other.getByRole('alertdialog')).toBeVisible();await other.getByRole('button',{name:'Close clash warning',exact:true}).click();await expect(other.getByLabel('Name',{exact:true})).toHaveValue('Stale edit');
});

test('worker browser hides manager data and API enforces tenant boundaries',async({page,context})=>{
 const seed=await (await context.request.post('/__test/seed',{data:{scenario:'seeded'}})).json();
 await context.setExtraHTTPHeaders({'x-e2e-session':testSessions.get(context),'x-e2e-user':'worker'});
 await page.goto('/workspace.html');await ready(page);
 await expect(page.getByRole('heading',{name:'Your jobs. Your day.'})).toBeVisible();
 await expect(page.locator('nav a[href="#invoices"]')).toHaveCount(0);await expect(page.locator('nav a[href="#customers"]')).toHaveCount(0);
 await expect(page.locator('main')).not.toContainText('Other worker customer');
 const data=await state(context);expect(data.state.jobs).toHaveLength(1);expect(data.state.jobs[0].price).toBeUndefined();expect(data.state.customers[0].email).toBeUndefined();expect(data.state.invoices).toEqual([]);
 expect((await context.request.get('/api/quenvira/workspaces/'+seed.otherWorkspaceId)).status()).toBe(404);
 const denied=await context.request.post('/api/quenvira/workspaces/'+seed.workspaceId+'/commands',{headers:{Origin:'http://127.0.0.1:4173'},data:{requestId:randomUUID(),revision:data.revision,action:'invoice.create',data:{jobId:seed.assignedJobId,vat:0}}});expect(denied.status()).toBe(403);
 await page.getByRole('button',{name:'Open visit',exact:true}).click();await expect(page.getByRole('button',{name:'Edit',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Start visit',exact:true}).click();await ready(page);expect((await state(context)).state.jobs[0].status).toBe('In progress');
});

test('export, recovery history, keyboard entry and all manager pages at this viewport',async({page,context})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/workspace.html');await ready(page);
 await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'Skip to content'})).toBeFocused();await page.keyboard.press('Enter');await expect(page.locator('main#main')).toBeFocused();
 await addCustomer(page);await page.getByRole('button',{name:'View & edit',exact:true}).click();await page.getByLabel('Name',{exact:true}).fill('Changed QA name');await page.getByRole('button',{name:'Save customer',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();
 await navigate(page,'settings');const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Download JSON snapshot',exact:true}).click();const download=await downloaded;
 const exported=JSON.parse(await fs.readFile(await download.path(),'utf8'));expect(exported.state.customers[0].name).toBe('Changed QA name');expect(exported.state.customers).toHaveLength(1);
 await page.getByRole('button',{name:'Review recovery history',exact:true}).click();await page.getByRole('button',{name:'Restore revision',exact:true}).first().click();await expect(page.locator('#modal')).not.toBeVisible();expect((await state(context)).state.customers[0].name).toBe('QA Willow House');
 for(const route of ['dashboard','schedule','jobs','customers','team','invoices','settings']){await navigate(page,route);await expect(page.locator('main h1')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'horizontal page overflow on '+route).toBeTruthy()}
 await page.getByRole('link',{name:'Test walkthrough',exact:true}).click();await expect(page.getByRole('heading',{name:'Try a complete working day.'})).toBeVisible();await page.getByRole('link',{name:'Legal & privacy',exact:true}).click();await expect(page.getByRole('heading',{name:'Clear terms before launch.'})).toBeVisible();expect(errors).toEqual([]);
});

// Text-field padding used to expand these 18px controls and obscure their native tick.
async function checkboxGeometry(box){
 await expect(box).toBeVisible();
 const style=await box.evaluate(el=>{const c=getComputedStyle(el),r=el.getBoundingClientRect();return {padding:c.padding,appearance:c.appearance,width:r.width,height:r.height}});
 expect(style.padding).toBe('0px');expect(style.appearance).not.toBe('none');expect(style.width).toBe(18);expect(style.height).toBe(18);
}
test('checklist native tick remains visible-sized through label, keyboard and persisted reload',async({page,context})=>{
 await page.goto('/workspace.html');await addCustomer(page);await addStaff(page);await book(page);
 await page.getByRole('button',{name:'Open visit',exact:true}).click();await page.getByRole('button',{name:'Start visit',exact:true}).click();await ready(page);
 const first=()=>page.locator('#modal .checklist input[type=checkbox]').first();
 await checkboxGeometry(first());await expect(first()).not.toBeChecked();
 await page.locator('#modal .checklist label').first().click();await ready(page);await expect(first()).toBeChecked();await checkboxGeometry(first());
 expect((await state(context)).state.jobs[0].checklist[0].done).toBe(true);
 await page.reload();await ready(page);await page.getByRole('button',{name:'Open visit',exact:true}).click();await expect(first()).toBeChecked();await checkboxGeometry(first());
 await first().focus();await page.keyboard.press('Space');await ready(page);await expect(first()).not.toBeChecked();expect((await state(context)).state.jobs[0].checklist[0].done).toBe(false);
 await first().check();await ready(page);await expect(first()).toBeChecked();await checkboxGeometry(first());
});

test('fictional demo checklist uses the same native tick and keeps it after reopening',async({page})=>{
 await page.goto('/demo/index.html');await page.locator('nav a[href="#jobs"]').click();await expect(page.getByRole('heading',{name:'Every job, in order.'})).toBeVisible();
 const phone=(page.viewportSize().width<=570);await expect(page.locator('.mobile-job-table tbody tr').first()).toHaveCSS('display',phone?'grid':'table-row');await fits(page);
 const visit=()=>page.locator('[data-action="job-detail"][data-id="j0-4"]').first();await visit().click();
 await page.locator('[data-action="start-job"]').click();
 const first=()=>page.locator('#modal .checklist input[type=checkbox]').first();
 await checkboxGeometry(first());await expect(first()).not.toBeChecked();await page.locator('#modal .checklist label').first().click();await expect(first()).toBeChecked();await checkboxGeometry(first());
 await page.reload();await page.locator('nav a[href="#jobs"]').click();await visit().click();await expect(first()).toBeChecked();
 await first().uncheck();await expect(first()).not.toBeChecked();await checkboxGeometry(first());
});

test('mobile preview renders the actual responsive app within a phone-width frame',async({page})=>{
 await page.goto('/mobile.html');await expect(page.getByRole('heading',{name:'Mobile preview',exact:true})).toBeVisible();
 const phone=page.locator('iframe');const bounds=await phone.boundingBox();expect(bounds.width).toBeLessThanOrEqual(390);expect(bounds.width).toBeGreaterThan(300);
 const app=page.frameLocator('iframe');await expect(app.getByRole('heading',{name:'Let’s set up your working day.'})).toBeVisible();
 const inner=await phone.elementHandle();const frame=await inner.contentFrame();expect(await frame.evaluate(()=>window.innerWidth)).toBeLessThanOrEqual(390);
 await page.getByRole('link',{name:'My workspace',exact:true}).click();await expect(app.locator('main#main')).toBeVisible();await expect(app.locator('nav a[href="#settings"]')).toHaveText(/Settings/);
 await fits(page);
});

test('customer-specific tasks persist, new visits inherit them and existing visits refresh only by choice',async({page,context})=>{
 const longTask='Area '+ 'x'.repeat(180);await page.goto('/workspace.html');await addCustomer(page);await addStaff(page);
 async function template(value){await navigate(page,'customers');await page.getByRole('button',{name:'View & edit',exact:true}).click();await page.getByLabel('Customer checklist (one task per line)',{exact:true}).fill(value);await page.getByRole('button',{name:'Save customer',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible()}
 await template('Conservatory <b>glass</b>\n'+longTask);await book(page,{repeat:'Weekly',count:'2'});
 await page.getByRole('button',{name:'Open visit',exact:true}).click();await expect(page.locator('#modal .checklist span')).toHaveText(['Conservatory <b>glass</b>',longTask]);await expect(page.locator('#modal .checklist b')).toHaveCount(0);expect(await page.locator('#modal').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);await close(page);
 await template('Porch\nFinal quality check');await navigate(page,'jobs');await page.getByRole('button',{name:'Open visit',exact:true}).click();await expect(page.locator('#modal .checklist span')).toHaveText(['Conservatory <b>glass</b>',longTask]);
 await page.getByRole('button',{name:'Edit',exact:true}).click();await page.getByLabel('Use customer’s latest checklist for this visit',{exact:true}).check();await page.getByRole('button',{name:'Save visit',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();
 await page.getByRole('button',{name:'Open visit',exact:true}).click();await expect(page.locator('#modal .checklist span')).toHaveText(['Porch','Final quality check']);
 await page.getByRole('button',{name:'Start visit',exact:true}).click();await ready(page);await page.getByRole('button',{name:'Complete visit',exact:true}).click();await expect(page.locator('#form-error')).toContainText('checklist');
 for(let n=0;n<2;n++){await page.locator('#modal [data-check]').nth(n).check();await ready(page)}
 await page.getByRole('button',{name:'Complete visit',exact:true}).click();await ready(page);await expect(page.locator('#modal .badge')).toHaveText('Completed');await page.reload();await ready(page);
 const saved=(await state(context)).state;expect(saved.customers[0].checklistTemplate).toEqual(['Porch','Final quality check']);expect(saved.jobs[0].checklist).toEqual([{label:'Porch',done:true},{label:'Final quality check',done:true}]);expect(saved.jobs[1].checklist).toEqual([{label:'Conservatory <b>glass</b>',done:false},{label:longTask,done:false}]);await fits(page);
});

test('fictional demo allows a bespoke customer checklist and explicit refresh of a booked visit',async({page})=>{
 await page.goto('/demo/index.html');await page.locator('nav a[href="#customers"]').click();await expect(page.locator('[data-action="customer-detail"][data-id="c5"]')).toBeVisible();await page.locator('[data-action="customer-detail"][data-id="c5"]').click();
 await page.getByLabel('Customer checklist (one task per line)',{exact:true}).fill('Inside conservatory glass\nLeave porch secure');await page.getByRole('button',{name:'Save customer',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();
 await page.locator('nav a[href="#jobs"]').click();await expect(page.getByRole('heading',{name:'Every job, in order.'})).toBeVisible();
 const visit=()=>page.locator('[data-action="job-detail"][data-id="j0-4"]').first();await visit().click();await page.locator('[data-action="edit-job"]').click();await page.getByLabel('Use customer’s latest checklist for this visit',{exact:true}).check();await page.getByRole('button',{name:'Save visit',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();
 await visit().click();await expect(page.locator('#modal .checklist span')).toHaveText(['Inside conservatory glass','Leave porch secure']);await page.locator('[data-action="start-job"]').click();
 for(let n=0;n<2;n++)await page.locator('#modal [data-check]').nth(n).check();await page.locator('[data-action="complete-job"]').click();await expect(page.locator('#modal .badge')).toHaveText('Completed');
});

test('completed visit offers optional email copy to saved address; composing never claims delivery',async({page,context})=>{
 await page.goto('/workspace.html');await addCustomer(page);await addStaff(page);await book(page);
 await page.getByRole('button',{name:'Open visit',exact:true}).click();await page.getByRole('button',{name:'Start visit',exact:true}).click();await ready(page);
 for(let n=0;n<4;n++){await page.locator('#modal [data-check]').nth(n).check();await ready(page)}
 await page.getByRole('button',{name:'Complete visit',exact:true}).click();await ready(page);await page.getByRole('button',{name:'Create invoice',exact:true}).click();
 const option=page.getByLabel('Prepare an email copy after creating this draft',{exact:true});await expect(option).not.toBeChecked();await option.check();await page.getByLabel('VAT for registered suppliers only').selectOption('20');await page.getByRole('button',{name:'Create draft',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Review draft invoice email'})).toBeVisible();expect(await page.getByLabel('Email text',{exact:true}).evaluate(el=>el.clientWidth>=el.closest('label').parentElement.clientWidth*0.8)).toBe(true);await expect(page.getByLabel('Email text',{exact:true})).toHaveValue(/Total: £94\.79/);
 await expect(page.getByRole('link',{name:'Open email app',exact:true})).toHaveAttribute('target','_blank');await expect(page.getByRole('link',{name:'Open email app',exact:true})).toHaveAttribute('rel','noopener noreferrer');await page.getByRole('button',{name:'Copy message text',exact:true}).click();await expect(page.getByRole('status')).toContainText(/copied|selected/);const href=await page.getByRole('link',{name:'Open email app',exact:true}).getAttribute('href'),uri=new URL(href);expect(decodeURIComponent(uri.pathname)).toBe('willow@example.com');expect(uri.searchParams.get('body')).toContain('NOT A VALID TAX INVOICE');expect(uri.searchParams.get('subject')).toContain('QV-1001');
 expect(await page.locator('#modal').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 const before=await state(context);expect(before.state.invoices).toHaveLength(1);await page.getByRole('button',{name:'Back to invoice',exact:true}).click();await page.getByRole('button',{name:'Prepare email copy',exact:true}).click();expect(await state(context)).toEqual(before);
 await close(page);await navigate(page,'customers');await page.getByRole('button',{name:'View & edit',exact:true}).click();await page.getByLabel('Email',{exact:true}).fill('');await page.getByRole('button',{name:'Save customer',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();
 await navigate(page,'invoices');await page.getByRole('button',{name:'View',exact:true}).click();await page.getByRole('button',{name:'Prepare email copy',exact:true}).click();await expect(page.locator('#modal [role=alert]').first()).toContainText('Add the customer');await expect(page.getByRole('link',{name:'Open email app',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Edit customer email',exact:true}).click();await expect(page.getByLabel('Email',{exact:true})).toHaveValue('');
});

test('fictional demo invoice provides a reviewed email copy using its saved customer email',async({page})=>{
 await page.goto('/demo/index.html');await page.locator('nav a[href="#invoices"]').click();await expect(page.locator('[data-action="invoice-detail"][data-id="i0"]')).toBeVisible();await page.locator('[data-action="invoice-detail"][data-id="i0"]').click();await page.getByRole('button',{name:'Prepare email copy',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Review draft invoice email'})).toBeVisible();expect(await page.getByLabel('Email text',{exact:true}).evaluate(el=>el.clientWidth>=el.closest('label').parentElement.clientWidth*0.8)).toBe(true);const uri=new URL(await page.getByRole('link',{name:'Open email app',exact:true}).getAttribute('href'));expect(decodeURIComponent(uri.pathname)).toBe('willow@example.com');await expect(page.getByLabel('Email text',{exact:true})).toHaveValue(/NOT A VALID TAX INVOICE/);expect(await page.locator('#modal').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
});

test('phone preview can open the real app full screen and preserves invoice text when clipboard access fails',async({page,context})=>{
 await context.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(new Error('Clipboard blocked for fixture'))}})});
 await page.goto('/mobile.html');await page.getByRole('link',{name:'Open demo full screen',exact:true}).click();await expect(page).toHaveURL(/\/demo\/index.html$/);await expect(page.locator('iframe')).toHaveCount(0);
 await page.locator('nav a[href="#invoices"]').click();await page.locator('[data-action="invoice-detail"][data-id="i0"]').click();await page.getByRole('button',{name:'Prepare email copy',exact:true}).click();
 const originalURL=page.url();const link=page.getByRole('link',{name:'Open email app',exact:true});await expect(link).toHaveAttribute('target','_blank');await expect(link).toHaveAttribute('rel','noopener noreferrer');
 await page.getByRole('button',{name:'Copy message text',exact:true}).click();await expect(page.getByRole('status')).toContainText('Text selected');const area=page.getByLabel('Email text',{exact:true});
 expect(await area.evaluate(el=>el.selectionStart===0&&el.selectionEnd===el.value.length)).toBe(true);await expect(page.getByRole('heading',{name:'Review draft invoice email'})).toBeVisible();expect(await page.getByLabel('Email text',{exact:true}).evaluate(el=>el.clientWidth>=el.closest('label').parentElement.clientWidth*0.8)).toBe(true);await expect(page).toHaveURL(originalURL);
});

test('supplier, locked issued invoice, printable document and exact full credit persist across reloads',async({page,context})=>{
 await page.goto('/workspace.html');await addCustomer(page);await addStaff(page);await book(page);
 await page.getByRole('button',{name:'Open visit',exact:true}).click();await page.getByRole('button',{name:'Start visit',exact:true}).click();await ready(page);
 for(let n=0;n<4;n++){await page.locator('#modal input[type=checkbox]').nth(n).check();await ready(page)}
 await page.getByRole('button',{name:'Complete visit',exact:true}).click();await ready(page);await page.getByRole('button',{name:'Create invoice',exact:true}).click();await page.getByLabel('VAT for registered suppliers only').selectOption('20');await page.getByRole('button',{name:'Create draft',exact:true}).click();await ready(page);
 await page.getByRole('button',{name:'Issue invoice',exact:true}).click();await expect(page.locator('#form-error')).toContainText('supplier details');await close(page);
 await navigate(page,'settings');await page.getByRole('button',{name:'Edit supplier details',exact:true}).click();
 await page.getByLabel('Legal name (full personal name for a sole trader)',{exact:true}).fill('Fictional Supplier Ltd');await page.getByLabel('Trading name (optional)',{exact:true}).fill('Fictional Services');await page.getByLabel('Business type',{exact:true}).selectOption('limited-company');await page.getByLabel('Business address (registered office for a limited company)',{exact:true}).fill('10 Example Street (fictional)');await page.getByLabel('Contact email or telephone',{exact:true}).fill('supplier@example.com');await page.getByLabel('Company registration number (limited companies)',{exact:true}).fill('01234567');await page.getByLabel('VAT registration',{exact:true}).selectOption('true');await page.getByLabel('VAT registration number',{exact:true}).fill('GB123456789');await page.getByRole('button',{name:'Save supplier details',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();
 await navigate(page,'invoices');await page.getByRole('button',{name:'View',exact:true}).click();await page.getByRole('button',{name:'Issue invoice',exact:true}).click();await ready(page);await expect(page.locator('#modal .badge')).toHaveText('Issued');await expect(page.locator('.invoice-preview')).toContainText('Fictional Supplier Ltd');await expect(page.locator('.invoice-preview')).toContainText('Supply date 2026-10-20');await expect(page.locator('.invoice-totals')).toContainText('£94.79');await fits(page);
 const issued=(await state(context)).state.invoices[0];
 await page.emulateMedia({media:'print'});await expect(page.locator('#app')).not.toBeVisible();await expect(page.locator('.invoice-preview')).toBeVisible();await expect(page.locator('.form-footer')).not.toBeVisible();await page.emulateMedia({media:'screen'});
 await page.getByRole('button',{name:'Create full credit note',exact:true}).click();await page.getByLabel('Reason for full credit',{exact:true}).fill('Agreed full reduction');await page.getByRole('button',{name:'Create credit note',exact:true}).click();await ready(page);await expect(page.locator('#modal .badge')).toHaveText('Credited');await expect(page.locator('.invoice-preview')).toContainText('Balance due: £0.00');await expect(page.getByRole('button',{name:'Record manual payment',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'View credit note',exact:true}).click();await expect(page.locator('.invoice-preview')).toContainText('CN-1001');await expect(page.locator('.invoice-preview')).toContainText('Agreed full reduction');await fits(page);await page.reload();await ready(page);const saved=(await state(context)).state.invoices[0];expect(saved.issue).toEqual(issued.issue);expect(saved.credit).toMatchObject({net:7899,tax:1580,total:9479,invoiceNumber:issued.number});
});

test('guided setup takes an owner from staff to customer to booked visit and assignment, then staff see their own day',async({page,context})=>{
 await page.goto('/workspace.html');await expect(page.getByRole('heading',{name:'Let’s set up your working day.',exact:true})).toBeVisible();await expect(page.locator('.journey-panel')).toContainText('STEP 1 OF 4');
 await page.getByRole('button',{name:'Add your staff',exact:true}).click();await page.getByLabel('Full name',{exact:true}).fill('Guided Maya');await page.getByRole('button',{name:'Add team member',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();await expect(page.locator('.journey-panel')).toContainText('STEP 2 OF 4');
 await page.getByRole('button',{name:'Add your first customer',exact:true}).click();await page.getByLabel('Name',{exact:true}).fill('Guided client');await page.getByLabel('Service address',{exact:true}).fill('10 Guided Lane (fictional)');await expect(page.getByLabel('Email',{exact:true})).not.toBeVisible();await page.getByRole('button',{name:'Save customer',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();await expect(page.locator('.journey-panel')).toContainText('STEP 3 OF 4');
 await page.getByRole('button',{name:'Book the first job',exact:true}).click();await expect(page.locator('#modal')).toContainText('Next step: assign a team member');await page.getByRole('button',{name:'Save visit',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();await expect(page.locator('.journey-panel')).toContainText('STEP 4 OF 4');await page.reload();await ready(page);await expect(page.locator('.journey-panel')).toContainText('STEP 4 OF 4');
 await page.getByRole('button',{name:'Assign a team member',exact:true}).click();await page.getByLabel('Team member',{exact:true}).selectOption({label:'Guided Maya'});await page.getByRole('button',{name:'Save assignment',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();await expect(page.getByRole('heading',{name:'What would you like to do next?',exact:true})).toBeVisible();await fits(page);
 const saved=await state(context);expect(saved.state.customers).toHaveLength(1);expect(saved.state.staff).toHaveLength(1);expect(saved.state.jobs[0].staffId).toBe(saved.state.staff[0].id);
 await navigate(page,'dashboard');await expect(page.getByRole('heading',{name:'A clearer day starts here.',exact:true})).toBeVisible();await navigate(page,'home');
 const invite=await context.request.post('/api/quenvira/workspaces/'+saved.workspaceId+'/invitations',{headers:{Origin:'http://127.0.0.1:4173'},data:{email:'worker@example.com',staffId:saved.state.staff[0].id}});expect(invite.status()).toBe(201);const token=(await invite.json()).token;
 await context.setExtraHTTPHeaders({'x-e2e-session':testSessions.get(context),'x-e2e-user':'worker'});const accepted=await context.request.post('/api/quenvira/invitations/accept',{headers:{Origin:'http://127.0.0.1:4173'},data:{token}});expect(accepted.status()).toBe(200);
 await page.goto('/workspace.html');await ready(page);await expect(page.getByRole('heading',{name:'Your jobs. Your day.',exact:true})).toBeVisible();await expect(page.locator('main')).toContainText('10 Guided Lane (fictional)');await expect(page.locator('main')).toContainText('Jobs today');await expect(page.locator('nav a[href="#dashboard"]')).toHaveCount(0);await expect(page.locator('nav a[href="#invoices"]')).toHaveCount(0);await fits(page);
 await page.getByRole('link',{name:'View my calendar',exact:false}).click();await expect(page.getByLabel('Calendar from',{exact:true})).toBeVisible();await page.getByLabel('Calendar from',{exact:true}).fill('2026-10-21');await expect(page.locator('main')).toContainText('2026-10-21 – 2026-10-27');await fits(page);
});
