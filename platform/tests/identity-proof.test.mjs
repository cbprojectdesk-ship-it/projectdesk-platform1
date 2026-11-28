import test from 'node:test';
import assert from 'node:assert/strict';
import {identityProof,verifyIdentityProof} from '../server/identity-proof.mjs';
import {handle} from '../server/api.mjs';
import {database,ORIGIN} from './support/database.mjs';
const secret='fictional-identity-proof-secret-0123456789';
const request=proof=>new Request(ORIGIN+'/api/quenvira/session',{headers:{'oai-authenticated-user-id':'alice','oai-authenticated-user-email':'alice@example.com',...(proof?{'x-quenvira-identity-proof':proof}:{})}});
test('optional identity proof accepts only the exact HMAC for the supplied identity',async()=>{
 const proof=await identityProof('alice','alice@example.com',secret);
 assert.equal(await verifyIdentityProof(request(proof),'alice','alice@example.com',secret),true);
 assert.equal(await verifyIdentityProof(request(proof),'bob','alice@example.com',secret),false);
 assert.equal(await verifyIdentityProof(request('a'.repeat(64)),'alice','alice@example.com',secret),false);
 assert.equal(await verifyIdentityProof(request(''),'alice','alice@example.com',secret),false);
});
test('proof mode fails closed when the host omits or forges the proof',async()=>{
 const db=database();
 const options={billingEnv:{QUENVIRA_IDENTITY_PROOF_SECRET:secret}};
 assert.equal((await handle(request(),db,options)).status,401);
 assert.equal((await handle(request('a'.repeat(64)),db,options)).status,401);
 const proof=await identityProof('alice','alice@example.com',secret);
 assert.equal((await handle(request(proof),db,options)).status,200);
 db.sqlite.close();
});
