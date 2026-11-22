import test from 'node:test';
import assert from 'node:assert/strict';
import { SECURITY_HEADERS, securityHeaderEntries } from '../server/security-headers.mjs';

const value = name => SECURITY_HEADERS.find(header => header.key === name)?.value ?? '';

test('the hosted app emits the required baseline security headers',()=>{
  assert.match(value('Strict-Transport-Security'),/max-age=31536000/);
  assert.equal(value('X-Content-Type-Options'),'nosniff');
  assert.equal(value('X-Frame-Options'),'DENY');
  assert.equal(value('Referrer-Policy'),'strict-origin-when-cross-origin');
  assert.match(value('Permissions-Policy'),/camera=\(\)/);
  assert.match(value('Content-Security-Policy'),/frame-ancestors 'none'/);
  assert.match(value('Content-Security-Policy'),/object-src 'none'/);
  assert.match(value('Content-Security-Policy'),/base-uri 'self'/);
  assert.equal(securityHeaderEntries().length,SECURITY_HEADERS.length);
  assert.ok(securityHeaderEntries().every(header=>typeof header.key==='string'&&typeof header.value==='string'));
});
