import {stripeOperation} from './stripe-diagnostics.mjs';
// Server-only SaaS billing. Defaults to disabled; never trust a return URL,
// visitor-supplied customer ID, price, status, or event metadata for access.
import {planCatalog,planForSubscription,selectPlan,fitsPlan,publicPlans} from './plans.mjs';
export class SubscriptionProblem extends Error {
 constructor(status,message){super(message);this.status=status}
}
const fail=(status,message)=>{throw new SubscriptionProblem(status,message)};
export const TERMS_VERSION='2026-10-28';
export const PLAN_TERMS_VERSION='2026-10-29';
const riskEvents=new Set(['charge.dispute.created','charge.refunded','radar.early_fraud_warning.created']);
const handledEvents=new Set([...riskEvents,'checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','invoice.paid','invoice.payment_failed']);
const objectId=value=>typeof value==='string'?value:value?.id;
export function billingConfig(env={}) {
 const mode=env.QUENVIRA_BILLING_MODE;
 if(!mode||mode==='disabled')return null;
 if(!['test','live'].includes(mode))fail(503,'Subscription configuration needs operator attention.');
 let plans;try{plans=planCatalog(env)}catch{fail(503,'Plan configuration needs operator attention.')}
 const key=env.STRIPE_RESTRICTED_KEY;
 // Permit the previous version only in sandbox during this staged rollout.
 const termsVersion=plans?PLAN_TERMS_VERSION:TERMS_VERSION;
 const termsReady=env.QUENVIRA_TERMS_VERSION===termsVersion||(!plans&&mode==='test'&&env.QUENVIRA_TERMS_VERSION==='2026-10-22');
 if(plans&&mode==='live'&&env.QUENVIRA_PLAN_TERMS_APPROVED!=='yes')fail(503,'Solo and Team terms have not been approved for paid launch.');
 if(typeof key!=='string'||!key.startsWith(mode==='live'?'rk_live_':'rk_test_')||!env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_')||(!plans&&!/^price_\w+$/.test(env.STRIPE_PRICE_ID||''))||!/^bpc_\w+$/.test(env.STRIPE_PORTAL_CONFIGURATION||'')||!termsReady)fail(503,'Subscriptions are not configured for this release.');
 let origin;try{origin=new URL(env.QUENVIRA_SITE_ORIGIN)}catch{fail(503,'Subscription origin is not configured.')}
 if(origin.protocol!=='https:'||origin.origin!==env.QUENVIRA_SITE_ORIGIN)fail(503,'Subscription origin is invalid.');
 if(mode==='live'&&env.QUENVIRA_PAID_LAUNCH_APPROVED!=='yes')fail(503,'Paid subscriptions have not been activated.');
 return {mode,key,termsVersion,price:env.STRIPE_PRICE_ID,secret:env.STRIPE_WEBHOOK_SECRET,portal:env.STRIPE_PORTAL_CONFIGURATION,origin:origin.origin,selfServe:env.QUENVIRA_SELF_SERVE==='yes',...(plans?{plans}:{})};
}
export async function stripeClient(config) {
 const {default:Stripe}=await import('stripe');
 return new Stripe(config.key,{apiVersion:'2026-09-30.endive',httpClient:Stripe.createFetchHttpClient(),maxNetworkRetries:2,timeout:10000});
}
// Isolated, non-charging live signature acceptance. These staged credentials
// are never consumed by checkout, enrollment or paid entitlement decisions.
export function liveVerificationConfig(env={}) {
 if(env.QUENVIRA_LIVE_WEBHOOK_VERIFY!=='yes')return null;
 const key=env.STRIPE_LIVE_RESTRICTED_KEY,secret=env.STRIPE_LIVE_WEBHOOK_SECRET;
 if(typeof key!=='string'||!key.startsWith('rk_live_')||typeof secret!=='string'||!secret.startsWith('whsec_'))fail(503,'Live webhook verification is not configured.');
 return {mode:'live',key,secret,verificationOnly:true};
}
async function row(db,workspace){return db.prepare('SELECT * FROM subscription_accounts WHERE workspace_id = ?').bind(workspace).first()}
export function assertServiceTerms(body,version=TERMS_VERSION){
 if(body.acceptTerms!==true||body.termsVersion!==version)fail(400,'Review and accept the current business terms and data-processing schedule first.');
}
export async function serviceTermsAccepted(db,workspace,version=TERMS_VERSION){
 const account=await row(db,workspace);return account?.terms_version===version&&!!account.terms_accepted_at;
}
export async function acceptServiceTerms(db,workspace,user,body,timestamp,version=TERMS_VERSION){
 assertServiceTerms(body,version);
 // Membership is rechecked in the acceptance write, not only in the route.
 const saved=await db.batch([
  db.prepare("UPDATE subscription_accounts SET terms_accepted_at=CASE WHEN terms_version=? AND terms_accepted_at IS NOT NULL THEN terms_accepted_at ELSE ? END,terms_version=? WHERE workspace_id=? AND EXISTS(SELECT 1 FROM memberships WHERE workspace_id=? AND user_id=? AND role='manager') RETURNING terms_version,terms_accepted_at").bind(version,timestamp,version,workspace,workspace,user),
  db.prepare("INSERT OR IGNORE INTO events (workspace_id,id,user_id,action,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM subscription_accounts a JOIN memberships m ON a.workspace_id=m.workspace_id WHERE a.workspace_id=? AND m.user_id=? AND m.role='manager' AND a.terms_version=? AND a.terms_accepted_at IS NOT NULL)").bind(workspace,'terms-'+version,user,'terms.accept.'+version,timestamp,workspace,user,version)
 ]);
 if(!saved[0].results.length)fail(403,'Current manager permission is required to accept business terms.');
 return {accepted:true,termsVersion:version,acceptedAt:saved[0].results[0].terms_accepted_at};
}
export async function startTrial(db,workspace,timestamp){
 const end=new Date(Date.parse(timestamp)+14*86400000).toISOString();
 await db.prepare('INSERT OR IGNORE INTO subscription_accounts (workspace_id,trial_end,checkout_generation) VALUES (?,?,0)').bind(workspace,end).run();
 return row(db,workspace);
}
function matches(subscription,config){if(config.plans)return !!planForSubscription(subscription,config);const items=subscription.items?.data;return subscription.livemode===(config.mode==='live')&&Array.isArray(items)&&items.length===1&&objectId(items[0].price)===config.price&&items[0].quantity===1}
async function subscriptions(client,customer){
 const list=await stripeOperation('subscriptions.list',()=>client.subscriptions.list({customer,status:'all',limit:100,expand:['data.latest_invoice']}));
 if(list.has_more)fail(503,'Subscription account requires support.');return list.data;
}
async function paid(subscription,config,client,now){
 const item=subscription.items.data[0];
 if(subscription.status!=='active'||!Number.isSafeInteger(item.current_period_end)||item.current_period_end<=Math.floor(now/1000)||subscription.cancel_at&&subscription.cancel_at<=Math.floor(now/1000))return false;
 const ref=subscription.latest_invoice;
 const invoice=typeof ref==='string'?await stripeOperation('invoices.retrieve',()=>client.invoices.retrieve(ref)):ref;
 if(!invoice||invoice.livemode!==(config.mode==='live')||invoice.status!=='paid'||invoice.amount_remaining!==0||objectId(invoice.customer)!==objectId(subscription.customer)||objectId(invoice.parent?.subscription_details?.subscription||invoice.subscription)!==subscription.id)return false;
 // The default provider status can ignore an older unpaid invoice. Do not
 // restore paid access while any invoice on this same subscription is open.
 const outstanding=await stripeOperation('invoices.list',()=>client.invoices.list({subscription:subscription.id,status:'open',limit:1}));
 return Array.isArray(outstanding.data)&&outstanding.data.length===0&&!outstanding.has_more;
}
const terminal=subscription=>['canceled','incomplete_expired'].includes(subscription.status);
export async function entitlement(db,workspace,config,client,now=Date.now()){
 const account=await row(db,workspace);
 if(!account)return {status:'not_enrolled',canWrite:false,trialEnd:null,canManage:false,canCheckout:false};
 const current=account.customer_id?await subscriptions(client,account.customer_id):[];
 const ongoing=current.filter(s=>!terminal(s));
 if(config.plans&&ongoing.length>1)fail(503,'Multiple subscriptions require support before plan access can be determined.');
 const matching=ongoing.filter(s=>matches(s,config));
 let active;for(const candidate of matching){if(await paid(candidate,config,client,now)){active=candidate;break}}
 const subscription=active||matching.find(s=>s.status==='trialing')||matching[0];
 const trial=Date.parse(account.trial_end)>now;
 const plan=config.plans?(planForSubscription(subscription,config)||(trial?selectPlan(config,'team'):null)):null;
 let overLimit=false;
 if(plan){const business=await db.prepare('SELECT document FROM workspaces WHERE id=?').bind(workspace).first();const members=await db.prepare("SELECT COUNT(*) AS n FROM memberships WHERE workspace_id=? AND role='staff'").bind(workspace).first();overLimit=!business||!fitsPlan(JSON.parse(business.document),members.n,plan);}
 const periodEnd=subscription?.items?.data?.[0]?.current_period_end;
 const cancelAt=Number.isSafeInteger(subscription?.cancel_at)&&subscription.cancel_at>0?subscription.cancel_at:null;
 const cancellationScheduled=!!subscription?.cancel_at_period_end||cancelAt!==null;
 return {
  status:active?'active':subscription?.status==='active'?'payment_pending':subscription?.status||(trial?'trial':current.some(s=>s.status==='canceled')?'canceled':'expired'),
  canWrite:(!!active||trial)&&!overLimit,...(config.plans?{plan:plan?.id||null,maxStaff:plan?.maxStaff||0,maxPeople:plan?.maxPeople||0,maxStaffAccounts:plan?.maxStaffAccounts||0,staffAccess:!!plan?.staffAccess,overLimit,plans:publicPlans(config)}:{}),trialEnd:account.trial_end,canManage:!!account.customer_id,
  canCheckout:ongoing.length===0,subscriptionStatus:subscription?.status||null,
  cancelAtPeriodEnd:!!subscription?.cancel_at_period_end,cancellationScheduled,cancelAt,
  periodEnd:Number.isSafeInteger(periodEnd)?periodEnd:null
 };
}

async function customer(db,workspace,email,config,client,timestamp){
 let account=await startTrial(db,workspace,timestamp);
 if(!account.customer_id){
  const result=await stripeOperation('customers.create',()=>client.customers.create({email},{idempotencyKey:'quenvira-customer-'+workspace}));
  if(result.livemode!==(config.mode==='live')||!/^cus_\w+$/.test(result.id))fail(503,'Unexpected payment account response.');
  await db.prepare('UPDATE subscription_accounts SET customer_id = ? WHERE workspace_id = ? AND customer_id IS NULL').bind(result.id,workspace).run();
  account=await row(db,workspace);
 }
 return account;
}
async function verifyPrice(client,config,plan){
 const price=await stripeOperation('prices.retrieve',()=>client.prices.retrieve(plan?.price||config.price));
 if(price.livemode!==(config.mode==='live')||!price.active||price.currency!=='gbp'||price.unit_amount!==(plan?.amount||1900)||price.billing_scheme!=='per_unit'||price.recurring?.interval!=='month'||price.recurring.interval_count!==1||price.recurring.usage_type!=='licensed'||price.tax_behavior!=='inclusive')fail(503,'The configured price must match the approved total monthly plan.');
}
function safeURL(value,host){let url;try{url=new URL(value)}catch{fail(503,'Invalid payment provider redirect.')};if(url.protocol!=='https:'||url.hostname!==host||url.username||url.password)fail(503,'Invalid payment provider redirect.');return url.href}
export async function checkout(db,workspace,email,body,config,client,timestamp){
 if(body.acceptTerms!==true||body.termsVersion!==(config.termsVersion||TERMS_VERSION))fail(400,'Review and accept the current subscription terms first.');
 const plan=config.plans?selectPlan(config,body.plan):null;
 if(config.plans&&!plan)fail(400,'Choose an available Solo or Team plan.');
 if(plan){const business=await db.prepare('SELECT document FROM workspaces WHERE id=?').bind(workspace).first();const members=await db.prepare("SELECT COUNT(*) AS n FROM memberships WHERE workspace_id=? AND role='staff'").bind(workspace).first();if(!business||!fitsPlan(JSON.parse(business.document),members.n,plan))fail(409,'Existing staff records or access exceed this plan. Keep your current plan and contact support before changing it.');}
 await verifyPrice(client,config,plan);
 let account=await customer(db,workspace,email,config,client,timestamp);
 const existing=await subscriptions(client,account.customer_id);
 if(existing.some(s=>!terminal(s)))fail(409,'A subscription already exists. Use Manage subscription.');
 if(account.checkout_id){
  const session=await stripeOperation('checkout.sessions.retrieve',()=>client.checkout.sessions.retrieve(account.checkout_id));
  if(objectId(session.customer)!==account.customer_id||session.livemode!==(config.mode==='live'))fail(503,'Checkout account mismatch.');
  if(session.status==='open'&&plan&&session.metadata?.quenvira_plan!==plan.id)fail(409,'An existing checkout is open for another plan. Finish or expire it before changing plans.');
  if(session.status==='open')return {url:safeURL(session.url,'checkout.stripe.com')};
  if(session.status==='complete'&&!existing.some(s=>s.id===objectId(session.subscription)&&terminal(s)))fail(409,'Checkout has completed. Refresh subscription status or use Manage subscription.');
  if(!['expired','complete'].includes(session.status))fail(503,'Checkout status is unavailable.');
  await db.prepare('UPDATE subscription_accounts SET checkout_id = NULL, checkout_generation = checkout_generation + 1 WHERE workspace_id = ? AND checkout_generation = ?').bind(workspace,account.checkout_generation).run();
  account=await row(db,workspace);
 }
 const now=Math.floor(Date.parse(timestamp)/1000),trialEnd=Math.floor(Date.parse(account.trial_end)/1000);
 if(trialEnd>now&&trialEnd<=now+172800)fail(409,'Your trial ends within 48 hours. Subscribe after it ends to keep the full free trial.');
 const subscriptionData={billing_mode:{type:'flexible'},...(trialEnd>now+172800?{trial_end:trialEnd}:{})};
 // The card-free app trial is anchored once in D1. Checkout never restarts it.
 const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(workspace+'-'+account.checkout_generation)));
 const identifier='quenvira_'+Array.from(digest.slice(0,8),n=>String.fromCharCode(97+n%26)).join('');
 // Account defaults can enable Stripe's merchant-of-record product. This app
 // uses CCS's own fixed-GBP subscription terms and tax configuration instead.
 const result=await stripeOperation('checkout.sessions.create',()=>client.checkout.sessions.create({mode:'subscription',customer:account.customer_id,...(plan?{metadata:{quenvira_plan:plan.id}}:{}),line_items:[{price:plan?.price||config.price,quantity:1}],subscription_data:subscriptionData,integration_identifier:identifier,success_url:config.origin+'/workspace.html?billing=return#settings',cancel_url:config.origin+'/workspace.html?billing=cancel#settings',billing_address_collection:'required',consent_collection:{terms_of_service:'required'},managed_payments:{enabled:false},automatic_tax:{enabled:false},adaptive_pricing:{enabled:false}},{idempotencyKey:(plan?'quenvira-checkout-plans-v1-':'quenvira-checkout-v2-')+workspace+'-'+account.checkout_generation}));
 if(result.livemode!==(config.mode==='live')||objectId(result.customer)!==account.customer_id)fail(503,'Checkout account mismatch.');
 await db.prepare('UPDATE subscription_accounts SET checkout_id = ?, terms_version = ?, terms_accepted_at = ? WHERE workspace_id = ? AND checkout_generation = ?').bind(result.id,config.termsVersion||TERMS_VERSION,timestamp,workspace,account.checkout_generation).run();
 return {url:safeURL(result.url,'checkout.stripe.com')};
}
export async function portal(db,workspace,config,client){
 const account=await row(db,workspace);if(!account?.customer_id)fail(409,'No subscription account exists yet.');
 const result=await stripeOperation('billingPortal.sessions.create',()=>client.billingPortal.sessions.create({customer:account.customer_id,configuration:config.portal,return_url:config.origin+'/workspace.html#settings'}));
 return {url:safeURL(result.url,'billing.stripe.com')};
}
export async function assertDeletable(db,workspace,client){
 const account=await row(db,workspace);if(!account?.customer_id)return;
 if((await subscriptions(client,account.customer_id)).some(s=>!['canceled','incomplete_expired'].includes(s.status)))fail(409,'Cancel the subscription and wait for its end before deleting the business. Your export remains available.');
 if(account.checkout_id){const session=await stripeOperation('checkout.sessions.retrieve',()=>client.checkout.sessions.retrieve(account.checkout_id));if(session.status==='open')await stripeOperation('checkout.sessions.expire',()=>client.checkout.sessions.expire(session.id))}
}
// Resolve risk ownership using provider resources, never customer IDs or
// workspace references supplied in event metadata. Current API uses InvoicePayments.
async function riskCustomer(source,type,config,client){
 const chargeId=type==='charge.refunded'?source?.id:objectId(source?.charge);
 if(!/^ch_\w+$/.test(chargeId||''))fail(400,'Risk event charge is missing.');
 const charge=await stripeOperation('charges.retrieve',()=>client.charges.retrieve(chargeId));
 if(charge.id!==chargeId||charge.livemode!==(config.mode==='live'))fail(400,'Risk event mode mismatch.');
 const customerId=objectId(charge.customer),intent=objectId(charge.payment_intent);
 if(!intent)return null; // Not an invoice PaymentIntent; not this checkout integration.
 const payments=await stripeOperation('invoicePayments.list',()=>client.invoicePayments.list({payment:{type:'payment_intent',payment_intent:intent},limit:100}));
 if(payments.has_more)fail(503,'Risk payment requires operator review.');
 let found=false;
 for(const payment of payments.data){
  if(payment.livemode!==(config.mode==='live')||objectId(payment.payment?.payment_intent)!==intent)fail(400,'Risk payment mismatch.');
  const invoice=await stripeOperation('invoices.retrieve',()=>client.invoices.retrieve(objectId(payment.invoice)));
  if(invoice.livemode!==(config.mode==='live')||objectId(invoice.customer)!==customerId)fail(400,'Risk invoice mismatch.');
  const id=objectId(invoice.parent?.subscription_details?.subscription);
  if(!id)continue;
  const subscription=await stripeOperation('subscriptions.retrieve',()=>client.subscriptions.retrieve(id));
  if(subscription.id!==id||subscription.livemode!==(config.mode==='live')||objectId(subscription.customer)!==customerId)fail(400,'Risk subscription mismatch.');
  found=true;
 }
 return found?customerId:null;
}
export async function billingReview(db,workspace){
 const result=await db.prepare("SELECT COUNT(*) AS n FROM subscription_events WHERE workspace_id=? AND type IN ('charge.dispute.created','charge.refunded','radar.early_fraud_warning.created')").bind(workspace).first();
 return {billingReviewRecorded:result.n>0};
}
export async function webhook(request,db,config,client){
 if(!config||!db&&!config.verificationOnly)fail(503,'Subscription webhook is not configured.');
 if(request.method!=='POST')fail(405,'Method not allowed.');
 if(Number(request.headers.get('content-length')||0)>262144)fail(413,'Webhook too large.');
 const reader=request.body?.getReader();let bytes=0,chunks=[];if(!reader)fail(400,'Webhook body required.');
 while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>262144){await reader.cancel();fail(413,'Webhook too large.')}chunks.push(value)}
 const raw=new Uint8Array(bytes);let n=0;for(const c of chunks){raw.set(c,n);n+=c.length}
 let event;try{event=await client.webhooks.constructEventAsync(new TextDecoder().decode(raw),request.headers.get('stripe-signature')||'',config.secret,300)}catch{fail(400,'Invalid webhook signature.')}
 if(event.livemode!==(config.mode==='live'))fail(400,'Webhook mode mismatch.');
 // A staged verification delivery proves the signature only. It must not touch
 // sandbox customer mappings, store live billing records or grant paid access.
 if(config.verificationOnly)return {received:true,verificationOnly:true};
 if(!handledEvents.has(event.type))return {received:true,ignored:true};
 const source=event.data?.object,customerId=riskEvents.has(event.type)?await riskCustomer(source,event.type,config,client):objectId(source?.customer);
 if(riskEvents.has(event.type)&&!customerId)return {received:true,ignored:true};
 if(!/^cus_\w+$/.test(customerId||''))fail(400,'Webhook customer is missing.');
 const account=await db.prepare('SELECT * FROM subscription_accounts WHERE customer_id = ?').bind(customerId).first();
 if(!account)return {received:true,ignored:true};
 if(await db.prepare('SELECT id FROM subscription_events WHERE id = ?').bind(event.id).first())return {received:true,replayed:true};
 // Always query authoritative current state; never apply an old event snapshot.
 // This is a receipt, not an entitlement cache: writes independently query Stripe.
 await subscriptions(client,customerId);
 const received=new Date();
 await db.batch([db.prepare('INSERT OR IGNORE INTO subscription_events (id,workspace_id,type,received_at) VALUES (?,?,?,?)').bind(event.id,account.workspace_id,event.type,received.toISOString()),db.prepare("DELETE FROM subscription_events WHERE received_at < ? AND type NOT IN ('charge.dispute.created','charge.refunded','radar.early_fraud_warning.created')").bind(new Date(received.getTime()-30*86400000).toISOString())]);
 return {received:true};
}
