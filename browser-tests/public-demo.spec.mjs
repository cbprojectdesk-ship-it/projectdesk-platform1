import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';

const demo='/public-demo/index.html';
test.beforeEach(async({context})=>{
 await context.setExtraHTTPHeaders({'x-e2e-session':randomUUID()});
 // A demo must remain usable with every external request denied.
 await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
});
async function fits(page){expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual((await page.viewportSize()).width+1)}
const nav=(page,view)=>page.locator(`nav a[href="#${view}"]`).click();
const close=page=>page.getByRole('button',{name:'Close dialog',exact:true}).click();

test('public demo creates recurring assigned jobs, completes checklist and invoices without a backend',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(demo);
 await nav(page,'customers');await page.locator('[data-action="new-customer"]').click();
 await page.getByLabel('Customer or business name',{exact:true}).fill('QA demo customer');
 await page.getByLabel('Fictional service address',{exact:true}).fill('10 Example Lane (fictional)');
 await page.getByLabel('Demo email (use example.com)',{exact:true}).fill('demo@example.com');
 await page.getByLabel('Customer checklist (one task per line)',{exact:true}).fill('Synthetic cleaning check');
 await page.getByRole('button',{name:'Create customer',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();
 await nav(page,'team');await page.locator('[data-action="new-staff"]').click();
 await page.getByLabel('Full name',{exact:true}).fill('QA demo cleaner');await page.getByRole('button',{name:'Add team member',exact:true}).click();
 await nav(page,'jobs');await page.locator('[data-action="new-job"]').click();
 await page.getByRole('combobox',{name:'Customer',exact:true}).selectOption({label:'QA demo customer'});
 await page.getByRole('combobox',{name:'Assign team member',exact:true}).selectOption({label:'QA demo cleaner'});
 await page.getByLabel('Start time',{exact:true}).fill('07:00');await page.getByLabel('Duration (minutes)',{exact:true}).fill('60');
 await page.getByLabel('Price excluding VAT (£)',{exact:true}).fill('78.99');
 await page.getByRole('combobox',{name:'Repeats',exact:true}).selectOption('Weekly');
 await page.getByLabel('Number of visits to create (1–12)',{exact:true}).fill('3');
 await page.getByRole('button',{name:'Book visit(s)',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();
 await page.getByRole('button',{name:'QA demo customer',exact:true}).click();
 await page.getByRole('button',{name:'Start job →',exact:true}).click();
 await page.getByRole('button',{name:'Complete job ✓',exact:true}).click();await expect(page.locator('#form-error')).toContainText('checklist');
 await page.getByRole('checkbox',{name:'Synthetic cleaning check',exact:true}).check();
 await page.getByLabel('Visit notes',{exact:true}).fill('Fictional QA clean complete');
 await page.getByRole('button',{name:'Complete job ✓',exact:true}).click();await expect(page.locator('#modal .badge')).toHaveText('Completed');
 await page.getByRole('button',{name:'Create invoice →',exact:true}).click();
 await page.getByRole('combobox',{name:'VAT (only for VAT-registered suppliers)',exact:true}).selectOption('20');
 await page.getByRole('button',{name:'Create draft invoice',exact:true}).click();
 await expect(page.locator('.invoice-totals')).toContainText('£94.79');await expect(page.locator('#modal')).toContainText('DEMONSTRATION DRAFT');await fits(page);
 await page.getByRole('button',{name:'Record demo payment',exact:true}).click();await expect(page.locator('#modal .badge')).toHaveText('Paid');
 await page.reload();await nav(page,'invoices');await expect(page.locator('main')).toContainText('£94.79');expect(errors).toEqual([]);
});

test('separate tabs isolate edits and staff previews cannot reveal manager screens',async({page,context})=>{
 await page.goto(demo);const other=await context.newPage();await other.goto(demo);
 await page.getByRole('button',{name:'Open Seabreeze Apartments job',exact:true}).click();await page.getByRole('button',{name:'Start job →',exact:true}).click();await close(page);
 await other.getByRole('button',{name:'Open Seabreeze Apartments job',exact:true}).click();await expect(other.locator('#modal .badge')).toHaveText('Scheduled');await close(other);
 await page.reload();await page.getByRole('button',{name:'Open Seabreeze Apartments job',exact:true}).click();await expect(page.locator('#modal .badge')).toHaveText('In progress');await close(page);
 await page.getByRole('combobox',{name:'Switch demo role',exact:true}).selectOption('s1');
 await expect(page.locator('main')).toContainText('Your jobs. Your day.');await expect(page.locator('main')).not.toContainText('Outstanding invoices');
 await page.goto(demo+'#invoices');await expect(page.locator('main')).not.toContainText('Outstanding invoices');await expect(page.locator('nav a[href="#invoices"]')).toHaveCount(0);
 await expect(page.getByRole('link',{name:'← CCS website',exact:true})).toHaveAttribute('href','https://ccs-creative-technologies.sprogg1973.chatgpt.site/#work');
 await expect(page.getByRole('link',{name:'Enquire about Quenvira subscriptions →',exact:true})).toHaveAttribute('href',/service=quenvira#contact$/);
});

test('all public demo pages fit the viewport with fictional records and stable navigation',async({page})=>{
 await page.goto(demo);
 for(const route of ['dashboard','schedule','jobs','customers','team','invoices','settings']){
  await nav(page,route);await expect(page.locator('main h1')).toBeVisible();await fits(page);
 }
 await expect(page.locator('main')).toContainText('Closing the tab ends the demo session');
});
