// Public, read-only readiness. Never returns records, identity or configuration.
import {billingConfig} from './subscriptions.mjs';
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const reply=(status,code)=>new Response(JSON.stringify({status}),{status:code,headers});
export async function health(request,db,{bucket,billingEnv={}}={}){
 if(request.method!=='GET')return reply('method_not_allowed',405);
 try{
  if(!db||!bucket)throw Error('Missing storage binding');
  // LIMIT 0 validates the deployed schema without reading business records.
  await db.prepare('SELECT id, document, revision FROM workspaces LIMIT 0').all();
  await db.prepare('SELECT workspace_id, user_id, role FROM memberships LIMIT 0').all();
  await db.prepare('SELECT workspace_id, trial_end, customer_id, checkout_generation FROM subscription_accounts LIMIT 0').all();
  await db.prepare('SELECT id, workspace_id, received_at FROM subscription_events LIMIT 0').all();
  await db.prepare('SELECT id,workspace_id,invoice_id,status FROM invoice_outbox LIMIT 0').all();
  await db.prepare('SELECT id,outbox_id,status FROM invoice_email_events LIMIT 0').all();
  await bucket.list({prefix:'__quenvira_readiness__/',limit:1});
  billingConfig(billingEnv);
  return reply('ok',200);
 }catch{
  // Avoid logging provider exceptions that may contain identifiers or secrets.
  console.error('Quenvira readiness check failed; inspect storage and runtime configuration.');
  return reply('unavailable',503);
 }
}
