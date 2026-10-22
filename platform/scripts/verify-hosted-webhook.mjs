#!/usr/bin/env node
// Non-destructive hosted Stripe webhook routing/signature smoke test.
// Usage: node scripts/verify-hosted-webhook.mjs https://your-verified-app.example
// Does not send payment data, create subscriptions, or require Stripe secrets.
const raw=process.argv[2];
if(!raw){console.error('Usage: node scripts/verify-hosted-webhook.mjs https://verified-host');process.exit(2)}
let origin;
try{const u=new URL(raw);if(u.protocol!=='https:'||u.origin!==raw||u.username||u.password)throw Error();origin=u.origin}catch{console.error('Provide an exact HTTPS origin without path or trailing slash.');process.exit(2)}
const url=origin+'/api/quenvira/subscription-webhook';
async function probe(method,headers={},body){
 const response=await fetch(url,{method,headers,body,redirect:'manual',signal:AbortSignal.timeout(10000)});
 const type=response.headers.get('content-type')||'';
 const text=await response.text();
 return {status:response.status,type,body:text.slice(0,250),redirect:response.headers.get('location')};
}
try{
 const unsigned=await probe('POST',{'content-type':'application/json'},'{}');
 const badSignature=await probe('POST',{'content-type':'application/json','stripe-signature':'t=1,v1=invalid'},'{}');
 const get=await probe('GET');
 console.log(JSON.stringify({url,unsigned,badSignature,get},null,2));
 // Both malformed signed and unsigned webhook requests must be rejected by the application.
 // A 401/403/404/HTML/redirect indicates routing/auth interception, not successful webhook verification.
 const valid=r=>r.status===400&&r.type.toLowerCase().includes('application/json')&&!r.redirect;
 if(!valid(unsigned)||!valid(badSignature)||get.status!==405){
  console.error('FAIL: webhook routing/signature rejection is not verified. Check deployment, identity bypass for this route, D1 and billing secrets.');
  process.exitCode=1;
 }else console.log('PASS: deployed endpoint reaches application and rejects invalid signatures. This does NOT prove valid Stripe event delivery or payment lifecycle.');
}catch(e){console.error('FAIL: endpoint unreachable or timed out:',e.message);process.exitCode=1}
