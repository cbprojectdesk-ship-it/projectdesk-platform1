import test from 'node:test';
import assert from 'node:assert/strict';
import {guardStandaloneRequest} from '../server/standalone-identity.mjs';
const origin='https://example.test';
test('standalone identity rejects forged caller headers without verified session',()=>{
 const request=new Request(origin+'/api/quenvira/workspaces',{headers:{
  'oai-authenticated-user-id':'admin','oai-authenticated-user-email':'admin@example.test'
 }});
 const result=guardStandaloneRequest(request);
 assert.equal(result.response.status,401);
 assert.equal(result.request,undefined);
});
test('standalone identity strips forged headers and injects verified principal',()=>{
 const request=new Request(origin+'/api/quenvira/workspaces',{headers:{
  'oai-authenticated-user-id':'attacker','oai-authenticated-user-email':'attacker@example.test'
 }});
 const result=guardStandaloneRequest(request,{verifiedPrincipal:{id:'verified',email:'verified@example.test'}});
 assert.equal(result.request.headers.get('oai-authenticated-user-id'),'verified');
 assert.equal(result.request.headers.get('oai-authenticated-user-email'),'verified@example.test');
});
test('Stripe webhook bypasses browser identity but never bypasses signature handler',()=>{
 const request=new Request(origin+'/api/quenvira/subscription-webhook',{method:'POST',headers:{
  'oai-authenticated-user-id':'attacker','stripe-signature':'bad'
 },body:'{}'});
 const result=guardStandaloneRequest(request);
 assert.equal(result.response,undefined);
 assert.equal(result.request.headers.get('oai-authenticated-user-id'),null);
 assert.equal(result.request.headers.get('stripe-signature'),'bad');
 assert.equal(await result.request.text(),'{}');
});
