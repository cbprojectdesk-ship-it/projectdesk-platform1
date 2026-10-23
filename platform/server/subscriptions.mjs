// Server-only SaaS billing. Defaults to disabled; never trust a return URL,
// visitor-supplied customer ID, price, status, or event metadata for access.
export class SubscriptionProblem extends Error {
 constructor(status,message){super(message);this.status=status}
}
const fail=(status,message)=>{throw new SubscriptionProblem(status,message)};
export const TERMS_VERSION='2026-10-22';
const handledEvents=new Set(['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','invoice.paid','invoice.payment_failed']);
const objectId=value=>typeof value==='string'?value:value?.id;
export function billingConfig(env={}) {
 const mode=env.QUENVIRA_BILLING_MODE;
 if(!mode||mode==='disabled')return null;
 if(!['test','live'].includes(mode))fail(503,'Subscription configuration needs operator attention.');
 const key=env.STRIPE_RESTRICTED_KEY;
 if(typeof key!=='string'||!key.startsWith(mode==='live'?'rk_live_':'rk_test_')||!env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_')||!/^price_\w+$/.test(env.STRIPE_PRICE_ID||'')||!/^bpc_\w+$/.test(env.STRIPE_PORTAL_CONFIGURATION||'')||env.QUENVIRA_TERMS_VERSION!==TERMS_VERSION)fail(503,'Subscriptions are not configured for this release.');
 let origin;try{origin=new URL(env.QUENVIRA_SITE_ORIGIN)}catch{fail(503,'Subscription origin is not configured.')}
 if(origin.protocol!=='https:'||origin.origin!==env.QUENVIRA_SITE_ORIGIN)fail(503,'Subscription origin is invalid.');
 if(mode==='live'&&env.QUENVIRA_PAID_LAUNCH_APPROVED!=='yes')fail(503,'Paid subscriptions have not been activated.');
 return {mode,key,price:env.STRIPE_PRICE_ID,secret:env.STRIPE_WEBHOOK_SECRET,portal:env.STRIPE_PORTAL_CONFIGURATION,origin:origin.origin,selfServe:env.QUENVIRA_SELF_SERVE==='yes'};
}
export async function stripeClient(config) {
 const {default:Stripe}=await import('stripe');
 return new Stripe(config.key,{apiVersion:'2026-08-26.dahlia',httpClient:Stripe.createFetchHttpClient(),maxNetworkRetries:2,timeout:10000});
}
async function row(db,workspace){return db.prepare('SELECT * FROM subscription_accounts WHERE workspace_id = ?').bind(workspace).first()}
export async function startTrial(db,workspace,timestamp){
 const end=new Date(Date.parse(timestamp)+14*86400000).toISOString();
 await db.prepare('INSERT OR IGNORE INTO subscription_accounts (workspace_id,trial_end,checkout_generation) VALUES (?,?,0)').bind(workspace,end).run();
 return row(db,workspace);
}
function matches(subscription,config){const items=subscription.items?.data;return subscription.livemode===(config.mode==='live')&&Array.isArray(items)&&items.length===1&&objectId(items[0].price)===config.price&&items[0].quantity===1}
async function subscriptions(client,customer){
 const list=await client.subscriptions.list({customer,status:'all',limit:100});
 if(list.has_more)fail(503,'Subscription account requires support.');return list.data;
}
function paid(subscription,now){
 const item=subscription.items.data[0];
 return subscription.status==='active'&&Number.isSafeInteger(item.current_period_end)&&item.current_period_end>Math.floor(now/1000)&&(!subscription.cancel_at||subscription.cancel_at>Math.floor(now/1000));
}
export async function entitlement(db,workspace,config,client,now=Date.now()){
 const account=await row(db,workspace);
 if(!account)return {status:'not_enrolled',canWrite:false,trialEnd:null,canManage:false};
 let current=[];
 if(account.customer_id)current=await subscriptions(client,account.customer_id);
 const active=current.filter(s=>matches(s,config)&&paid(s,now));
 // Past-due, unpaid, paused and incomplete subscriptions never grant paid access.
 if(active.length)return {status:'active',canWrite:true,trialEnd:account.trial_end,canManage:true,cancelAtPeriodEnd:!!active[0].cancel_at_period_end,periodEnd:active[0].items.data[0].current_period_end};
 const trial=Date.parse(account.trial_end)>now;
 return {status:trial?'trial':current.some(s=>s.status==='past_due')?'past_due':current.some(s=>s.status==='canceled')?'canceled':'expired',canWrite:trial,trialEnd:account.trial_end,canManage:!!account.customer_id};
}
async function customer(db,workspace,email,config,client,timestamp){
 let account=await startTrial(db,workspace,timestamp);
 if(!account.customer_id){
  const result=await client.customers.create({email},{idempotencyKey:'quenvira-customer-'+workspace});
  if(result.livemode!==(config.mode==='live')||!/^cus_\w+$/.test(result.id))fail(503,'Unexpected payment account response.');
  await db.prepare('UPDATE subscription_accounts SET customer_id = ? WHERE workspace_id = ? AND customer_id IS NULL').bind(result.id,workspace).run();
  account=await row(db,workspace);
 }
 return account;
}
async function verifyPrice(client,config){
 const price=await client.prices.retrieve(config.price);
 if(price.livemode!==(config.mode==='live')||!price.active||price.currency!=='gbp'||price.unit_amount!==1900||price.billing_scheme!=='per_unit'||price.recurring?.interval!=='month'||price.recurring.interval_count!==1||price.recurring.usage_type!=='licensed'||price.tax_behavior!=='inclusive')fail(503,'The configured price must be the approved £19 total monthly plan.');
}
function safeURL(value,host){let url;try{url=new URL(value)}catch{fail(503,'Invalid payment provider redirect.')};if(url.protocol!=='https:'||url.hostname!==host||url.username||url.password)fail(503,'Invalid payment provider redirect.');return url.href}
export async function checkout(db,workspace,email,body,config,client,timestamp){
 if(body.acceptTerms!==true||body.termsVersion!==TERMS_VERSION)fail(400,'Review and accept the current subscription terms first.');
 await verifyPrice(client,config);
 let account=await customer(db,workspace,email,config,client,timestamp);
 const existing=await subscriptions(client,account.customer_id);
 if(existing.some(s=>!['canceled','incomplete_expired'].includes(s.status)))fail(409,'A subscription already exists. Use Manage subscription.');
 if(account.checkout_id){
  const session=await client.checkout.sessions.retrieve(account.checkout_id);
  if(objectId(session.customer)!==account.customer_id||session.livemode!==(config.mode==='live'))fail(503,'Checkout account mismatch.');
  if(session.status==='open')return {url:safeURL(session.url,'checkout.stripe.com')};
  if(session.status==='complete')fail(409,'Checkout has completed. Refresh subscription status or use Manage subscription.');
  if(session.status!=='expired')fail(503,'Checkout status is unavailable.');
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
 const result=await client.checkout.sessions.create({mode:'subscription',customer:account.customer_id,line_items:[{price:config.price,quantity:1}],subscription_data:subscriptionData,integration_identifier:identifier,success_url:config.origin+'/workspace.html?billing=return#settings',cancel_url:config.origin+'/workspace.html?billing=cancel#settings',billing_address_collection:'required',consent_collection:{terms_of_service:'required'},managed_payments:{enabled:false},automatic_tax:{enabled:false},adaptive_pricing:{enabled:false}},{idempotencyKey:'quenvira-checkout-v2-'+workspace+'-'+account.checkout_generation});
 if(result.livemode!==(config.mode==='live')||objectId(result.customer)!==account.customer_id)fail(503,'Checkout account mismatch.');
 await db.prepare('UPDATE subscription_accounts SET checkout_id = ?, terms_version = ?, terms_accepted_at = ? WHERE workspace_id = ? AND checkout_generation = ?').bind(result.id,TERMS_VERSION,timestamp,workspace,account.checkout_generation).run();
 return {url:safeURL(result.url,'checkout.stripe.com')};
}
export async function portal(db,workspace,config,client){
 const account=await row(db,workspace);if(!account?.customer_id)fail(409,'No subscription account exists yet.');
 const result=await client.billingPortal.sessions.create({customer:account.customer_id,configuration:config.portal,return_url:config.origin+'/workspace.html#settings'});
 return {url:safeURL(result.url,'billing.stripe.com')};
}
export async function assertDeletable(db,workspace,client){
 const account=await row(db,workspace);if(!account?.customer_id)return;
 if((await subscriptions(client,account.customer_id)).some(s=>!['canceled','incomplete_expired'].includes(s.status)))fail(409,'Cancel the subscription and wait for its end before deleting the business. Your export remains available.');
 if(account.checkout_id){const session=await client.checkout.sessions.retrieve(account.checkout_id);if(session.status==='open')await client.checkout.sessions.expire(session.id)}
}
export async function webhook(request,db,config,client){
 if(!config||!db)fail(503,'Subscription webhook is not configured.');
 if(request.method!=='POST')fail(405,'Method not allowed.');
 if(Number(request.headers.get('content-length')||0)>262144)fail(413,'Webhook too large.');
 const reader=request.body?.getReader();let bytes=0,chunks=[];if(!reader)fail(400,'Webhook body required.');
 while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>262144){await reader.cancel();fail(413,'Webhook too large.')}chunks.push(value)}
 const raw=new Uint8Array(bytes);let n=0;for(const c of chunks){raw.set(c,n);n+=c.length}
 let event;try{event=await client.webhooks.constructEventAsync(new TextDecoder().decode(raw),request.headers.get('stripe-signature')||'',config.secret,300)}catch{fail(400,'Invalid webhook signature.')}
 if(event.livemode!==(config.mode==='live'))fail(400,'Webhook mode mismatch.');
 if(!handledEvents.has(event.type))return {received:true,ignored:true};
 const source=event.data?.object,customerId=objectId(source?.customer);
 if(!/^cus_\w+$/.test(customerId||''))fail(400,'Webhook customer is missing.');
 const account=await db.prepare('SELECT * FROM subscription_accounts WHERE customer_id = ?').bind(customerId).first();
 if(!account)return {received:true,ignored:true};
 if(await db.prepare('SELECT id FROM subscription_events WHERE id = ?').bind(event.id).first())return {received:true,replayed:true};
 // Always query authoritative current state; never apply an old event snapshot.
 // This is a receipt, not an entitlement cache: writes independently query Stripe.
 await subscriptions(client,customerId);
 const received=new Date();
 await db.batch([db.prepare('INSERT OR IGNORE INTO subscription_events (id,workspace_id,type,received_at) VALUES (?,?,?,?)').bind(event.id,account.workspace_id,event.type,received.toISOString()),db.prepare('DELETE FROM subscription_events WHERE received_at < ?').bind(new Date(received.getTime()-30*86400000).toISOString())]);
 return {received:true};
}
