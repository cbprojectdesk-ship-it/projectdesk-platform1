import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
test('staged plan election discloses prices and sends chosen plan/current terms at this viewport',async({page,context})=>{
 const key=randomUUID();await context.setExtraHTTPHeaders({'x-e2e-session':key});await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());await context.request.post('/__test/seed',{data:{scenario:'seeded'}});
 let elected=null;
 await page.route('**/api/quenvira/workspaces/*/subscription',async route=>{
  if(route.request().method()==='POST'){elected=route.request().postDataJSON();return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:'TEST ONLY: stopped before checkout'})})}
  return route.fulfill({contentType:'application/json',body:JSON.stringify({enabled:true,mode:'test',status:'trial',billingReviewRecorded:true,canWrite:true,canCheckout:true,termsVersion:'2026-10-29',plans:[{id:'solo',name:'Solo',amount:799,maxStaff:1,staffAccess:false},{id:'team',name:'Team 5',amount:1499,maxPeople:5,maxStaff:5,maxStaffAccounts:4,staffAccess:true},...[[10,2499],[15,3299],[20,3999]].map(([n,amount])=>({id:'team'+n,name:'Team '+n,amount,maxPeople:n,maxStaff:n,maxStaffAccounts:n-1,staffAccess:true}))]})});
 });
 await page.goto('/workspace.html#settings');await expect(page.locator('main#main')).toBeVisible();await page.getByRole('button',{name:'Subscription & billing',exact:true}).click();
 const modal=page.locator('#modal');await expect(modal).toContainText('£7.99');await expect(modal).toContainText('£14.99');await expect(modal).not.toContainText('£19');await expect(modal).toContainText('£39.99');await expect(modal).toContainText('billing review');await expect(modal).toContainText('19 staff sign-ins');await expect(modal.getByRole('link',{name:'Read subscription terms and data-processing schedule'})).toHaveAttribute('href','/subscription-terms-solo-team.html');
 await page.getByLabel('Choose a plan',{exact:true}).selectOption('team20');await modal.locator('input[name=acceptTerms]').check();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBeTruthy();await page.getByRole('button',{name:'Continue to secure checkout',exact:true}).click();await expect.poll(()=>elected?.plan).toBe('team20');expect(elected.termsVersion).toBe('2026-10-29');expect(elected.acceptTerms).toBe(true);await expect(modal.locator('#form-error')).toContainText('TEST ONLY: stopped before checkout');
});
