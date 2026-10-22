import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {verifyAccessIdentity} from '../server/cloudflare-access.mjs';
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'key1',alg:'RS256',use:'sig'};
const b64=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const now=1700000000000,seconds=now/1000;
const claims={iss:'https://example.cloudflareaccess.com',aud:['app-audience'],sub:'user123',email:'user@example.test',iat:seconds-30,exp:seconds+300};
const jwt=(payload=claims,header={alg:'RS256',kid:'key1'})=>{const input=b64(header)+'.'+b64(payload);return input+'.'+sign('RSA-SHA256',Buffer.from(input),privateKey).toString('base64url')};
const options={teamDomain:'example.cloudflareaccess.com',audience:'app-audience',now:()=>now,fetcher:async()=>({ok:true,json:async()=>({keys:[jwk]})})};
const req=token=>new Request('https://app.example.test',{headers:token?{'cf-access-jwt-assertion':token}:{}});

test('valid signed Cloudflare Access assertion becomes server-verified principal',async()=>{
 assert.deepEqual(await verifyAccessIdentity(req(jwt()),options),{id:'access:user123',email:'user@example.test'});
});
test('missing, expired, wrong audience and wrong issuer fail closed',async()=>{
 assert.equal(await verifyAccessIdentity(req(),options),null);
 for(const override of [{exp:seconds-1},{aud:['other']},{iss:'https://evil.example'}])
  assert.equal(await verifyAccessIdentity(req(jwt({...claims,...override})),options),null);
});
test('tampered JWT cannot impersonate an account',async()=>{
 const parts=jwt().split('.');parts[1]=b64({...claims,email:'admin@example.test'});
 assert.equal(await verifyAccessIdentity(req(parts.join('.')),options),null);
});
test('untrusted key endpoint configuration is rejected',async()=>{
 await assert.rejects(verifyAccessIdentity(req(jwt()),{...options,teamDomain:'evil.example'}));
});
