import test from 'node:test';
import assert from 'node:assert/strict';
import { SECURITY_HEADERS, securityHeaderEntries, nonceCsp } from '../server/security-headers.mjs';

const value = name => SECURITY_HEADERS.find(header => header.key === name)?.value ?? '';

test('the hosted app emits the required baseline security headers',()=>{
  assert.match(value('Strict-Transport-Security'),/max-age=31536000/);
  assert.equal(value('X-Content-Type-Options'),'nosniff');
  assert.equal(value('X-Frame-Options'),'DENY');
  assert.equal(value('Referrer-Policy'),'strict-origin-when-cross-origin');
  assert.match(value('Permissions-Policy'),/camera=\(\)/);
  assert.equal(value('Content-Security-Policy'),'');
  const csp=nonceCsp('0123456789abcdef');
  assert.match(csp,/script-src 'self' 'nonce-0123456789abcdef' 'strict-dynamic'/);
  assert.match(csp,/frame-ancestors 'none'/);
  assert.match(csp,/object-src 'none'/);
  assert.match(csp,/base-uri 'self'/);
  assert.match(csp,/style-src 'self'/);
  assert.ok(!csp.includes("'unsafe-inline'"));
  assert.throws(()=>nonceCsp("x'; script-src *"));
  assert.equal(securityHeaderEntries().length,SECURITY_HEADERS.length);
  assert.ok(securityHeaderEntries().every(header=>typeof header.key==='string'&&typeof header.value==='string'));
});

test('the Worker response wrapper adds baseline headers to HTML responses without replacing route CSP', async () => {
  const { secureResponse } = await import('../server/security-headers.mjs');
  const html = secureResponse(new Response('<!doctype html><p>test</p>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
  assert.match(html.headers.get('strict-transport-security'), /max-age=31536000/);
  assert.equal(html.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(html.headers.get('x-frame-options'), 'DENY');
  assert.match(html.headers.get('content-security-policy'), /script-src 'self'/);
  const route = secureResponse(new Response('{}', { headers: { 'Content-Type': 'application/json', 'Content-Security-Policy': "default-src 'none'" } }));
  assert.equal(route.headers.get('content-security-policy'), "default-src 'none'");
  const redirect = secureResponse(new Response(null, { status: 307, headers: { Location: '/workspace' } }));
  assert.equal(redirect.status, 307);
  assert.equal(redirect.headers.get('location'), '/workspace');
  assert.match(redirect.headers.get('strict-transport-security'), /max-age=31536000/);
});
