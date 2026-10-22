#!/usr/bin/env node
// Fail-closed preflight for a standalone Cloudflare deployment.
// This is intentionally not a deploy command: managed Sites identity cannot be
// replaced with caller-provided oai-authenticated-user-* headers.
import {readFileSync,existsSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const errors=[];
const read=(path)=>{try{return readFileSync(new URL(path,root),'utf8')}catch{errors.push('Missing '+path);return ''}};
const hosting=JSON.parse(read('.openai/hosting.json')||'{}');
if(hosting.d1!=='DB')errors.push('Expected D1 binding DB');
const worker=read('build/sites-worker.ts');
const api=read('server/api.mjs');
if(!worker.includes('runWithConnectorBinding'))errors.push('Managed connector dispatch not identified');
if(!api.includes('oai-authenticated-user-id'))errors.push('Identity contract changed; review security boundary');
if(!existsSync(new URL('drizzle/',root)))errors.push('D1 migrations directory missing');
const config=process.env.QUENVIRA_STANDALONE_AUTH_VERIFIED;
if(config!=='yes')errors.push('Standalone authentication has not been independently implemented and security-tested; never expose the Worker directly with spoofable identity headers.');
if(!process.env.QUENVIRA_D1_MIGRATIONS_VERIFIED)errors.push('Production D1 migrations and independent backup/restore have not been verified.');
if(!process.env.QUENVIRA_HOSTED_WEBHOOK_VERIFIED)errors.push('Hosted signed Stripe webhook delivery has not been verified.');
if(errors.length){console.error('Quenvira standalone Cloudflare deployment BLOCKED:\n'+errors.map(x=>' - '+x).join('\n'));process.exit(1)}
console.log('Declared gates present. Confirm supporting evidence before deployment.');
