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
const close=page=>page.locator('#modal [data-action="close"]').click();
async function navigate(page,route){await page.locator(`nav a[href="#${route}"]`).click();await expect(page.locator('main#main')).toBeVisible();await expect(page.locator('#app')).not.toHaveAttribute('aria-busy','true')}
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
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/workspace.html');await addCustomer(page);await addStaff(page);await book(page);
 await page.getByRole('button',{name:'Open visit',exact:true}).click();await page.getByRole('button',{name:'Start visit',exact:true}).click();await ready(page);
 await page.getByRole('button',{name:'Complete visit',exact:true}).click();await expect(page.locator('#form-error')).toContainText('checklist');
 await page.getByLabel('Visit notes').fill('QA visit completed');await page.getByRole('button',{name:'Save note',exact:true}).click();await ready(page);
 for(let n=0;n<4;n++){await page.locator('#modal input[type=checkbox]').nth(n).check();await ready(page);await expect(page.locator('#modal input[type=checkbox]').nth(n)).toBeChecked()}
 await page.getByRole('button',{name:'Complete visit',exact:true}).click();await ready(page);await expect(page.locator('#modal .badge')).toHaveText('Completed');
 await page.getByRole('button',{name:'Create invoice',exact:true}).click();await page.getByLabel('VAT for registered suppliers only').selectOption('20');await page.getByRole('button',{name:'Create draft',exact:true}).click();await ready(page);
 await expect(page.locator('.invoice-totals')).toContainText('£94.79');await expect(page.locator('.invoice-totals')).toContainText('£15.80');
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
 await page.getByRole('button',{name:'New job',exact:false}).click();await page.getByLabel('Time',{exact:true}).fill('13:30');await page.getByLabel('Staff',{exact:true}).selectOption({label:'QA Maya Ellis'});await page.getByRole('button',{name:'Save visit',exact:true}).click();await expect(page.locator('#form-error')).toContainText('overlapping');expect((await state(context)).state.jobs).toHaveLength(3);await close(page);
 await page.getByRole('button',{name:'Open visit',exact:true}).click();await page.getByRole('button',{name:'Cancel future visits',exact:true}).click();await ready(page);expect((await state(context)).state.jobs.every(j=>j.status==='Cancelled')).toBeTruthy();
});

test('offline retry and stale tabs do not silently duplicate or overwrite records',async({page,context})=>{
 await page.goto('/workspace.html');await navigate(page,'customers');await page.getByRole('button',{name:'Add customer',exact:false}).click();await page.getByLabel('Name',{exact:true}).fill('Offline QA');await page.getByLabel('Service address').fill('Fictional');
 await context.setOffline(true);await page.getByRole('button',{name:'Save customer',exact:true}).click();await expect(page.locator('#form-error')).toContainText('Connection lost');await context.setOffline(false);await page.getByRole('button',{name:'Save customer',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();expect((await state(context)).state.customers).toHaveLength(1);
 const other=await context.newPage();await other.goto('/workspace.html#customers');await expect(other.getByRole('button',{name:'View & edit',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'View & edit',exact:true}).click();await page.getByLabel('Name',{exact:true}).fill('Newer edit');await page.getByRole('button',{name:'Save customer',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();
 await other.getByRole('button',{name:'View & edit',exact:true}).click();await other.getByLabel('Name',{exact:true}).fill('Stale edit');await other.getByRole('button',{name:'Save customer',exact:true}).click();await expect(other.locator('#form-error')).toContainText('Latest records');expect((await state(context)).state.customers[0].name).toBe('Newer edit');
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
