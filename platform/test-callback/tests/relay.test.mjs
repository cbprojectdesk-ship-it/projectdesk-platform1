import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createHandler, TARGET, MAX_BYTES} from '../worker/index.mjs';

// Deliberately fictional secrets; no provider or Site credential is used.
const SECRET = 'whsec_' + 'fictionaltestsecret'.repeat(2);
const TOKEN = 'fictionalSitesServiceTokenOnly';
const NOW = 1793859600000;
const SECOND = NOW / 1000;
const ENV = {TEST_RELAY_ENABLED: 'yes', STRIPE_TEST_WEBHOOK_SECRET: SECRET,
  ISOLATED_SITES_SERVICE_TOKEN: TOKEN};
const EVENT = {object: 'event', id: 'evt_fictional001', livemode: false,
  type: 'invoice.paid', data: {object: {id: 'in_fictional001', livemode: false}}};
const BODY = JSON.stringify(EVENT);
function signed(body = BODY, timestamp = SECOND, secret = SECRET) {
  return `t=${timestamp},v1=${createHmac('sha256', secret).update(timestamp + '.').update(body).digest('hex')}`;
}
function request({body = BODY, signature = signed(body), path = '/stripe', method = 'POST', headers = {}} = {}) {
  return new Request('https://fictional-receiver.example' + path, {method,
    headers: {'content-type': 'application/json', ...(signature ? {'stripe-signature': signature} : {}), ...headers},
    ...(method === 'GET' || method === 'HEAD' ? {} : {body})});
}
function fixture(fetcher) {
  const calls = [];
  const handle = createHandler({now: () => NOW, fetcher: async (url, options) => {
    calls.push({url, options});
    return fetcher ? fetcher(url, options) : Response.json({received: true});
  }});
  return {handle, calls};
}

test('valid test event forwards exact bytes and original signature only to isolated app', async () => {
  const {handle, calls} = fixture();
  const raw = ' { "object":"event", "id":"evt_fictional002", "livemode":false, "type":"invoice.paid", "data":{"object":{"livemode":false,"note":"£ café"}} }\n';
  const sig = signed(raw);
  const res = await handle(request({body: raw, signature: sig, headers: {
    cookie: 'fictional=cookie', authorization: 'Bearer attacker',
    'oai-sites-authorization': 'Bearer attacker', 'x-forwarded-host': 'attacker.example',
  }}), ENV);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {received: true, mode: 'test'});
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, TARGET);
  assert.equal(calls[0].options.redirect, 'manual');
  assert.equal(new TextDecoder().decode(calls[0].options.body), raw);
  assert.deepEqual(calls[0].options.headers, {'content-type': 'application/json',
    'stripe-signature': sig, 'OAI-Sites-Authorization': 'Bearer ' + TOKEN});
  assert.ok(calls[0].options.signal instanceof AbortSignal);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal(res.headers.get('access-control-allow-origin'), null);
});

for (const [name, options] of [
  ['unsigned', {signature: null}],
  ['wrong secret', {signature: signed(BODY, SECOND, 'wrong-secret')}],
  ['tampered body', {body: BODY + ' ', signature: signed(BODY)}],
  ['old timestamp', {signature: signed(BODY, SECOND - 301)}],
  ['future timestamp', {signature: signed(BODY, SECOND + 301)}],
  ['duplicate timestamp', {signature: signed() + ',t=' + SECOND}],
  ['noninteger timestamp', {signature: `t=${SECOND}.5,v1=${'a'.repeat(64)}`}],
  ['v0 only', {signature: `t=${SECOND},v0=${'a'.repeat(64)}`}],
  ['invalid hex', {signature: `t=${SECOND},v1=${'z'.repeat(64)}`}],
  ['oversized signature', {signature: 'a'.repeat(2049)}],
]) test('rejects ' + name + ' without forwarding', async () => {
  const {handle, calls} = fixture();
  assert.equal((await handle(request(options), ENV)).status, 400);
  assert.equal(calls.length, 0);
});

test('accepts a valid v1 alongside an old rotated signature', async () => {
  const {handle} = fixture();
  assert.equal((await handle(request({signature: signed() + ',v1=' + '0'.repeat(64)}), ENV)).status, 200);
});

for (const [name, patch] of [
  ['live event', {livemode: true}], ['missing mode', {livemode: undefined}],
  ['other account', {account: 'acct_other'}], ['unknown type', {type: 'customer.created'}],
  ['invalid event id', {id: 'wrong'}], ['non-event', {object: 'customer'}],
  ['missing data', {data: null}], ['invalid data object', {data: {object: 'invalid'}}],
  ['array data object', {data: {object: []}}],
  ['live nested object', {data: {object: {livemode: true}}}],
]) test('rejects ' + name + ' even with a valid signature', async () => {
  const {handle, calls} = fixture();
  const body = JSON.stringify({...EVENT, ...patch});
  assert.equal((await handle(request({body}), ENV)).status, 400);
  assert.equal(calls.length, 0);
});

test('signed malformed JSON and invalid UTF-8 are rejected', async () => {
  const {handle, calls} = fixture();
  for (const body of ['{bad', Buffer.from([0xff, 0xfe])]) {
    assert.equal((await handle(request({body}), ENV)).status, 400);
  }
  assert.equal(calls.length, 0);
});

for (const env of [{}, {...ENV, TEST_RELAY_ENABLED: 'no'},
  {...ENV, STRIPE_TEST_WEBHOOK_SECRET: ''}, {...ENV, ISOLATED_SITES_SERVICE_TOKEN: ''},
  {...ENV, ISOLATED_SITES_SERVICE_TOKEN: 'bad\nheader'}]) {
  test('missing or disabled configuration fails closed', async () => {
    const {handle, calls} = fixture();
    const res = await handle(request(), env);
    assert.equal(res.status, 503);
    assert.equal(calls.length, 0);
    assert.ok(!(await res.text()).includes(SECRET));
  });
}

test('only exact callback path and method accepted; no target supplied by caller', async () => {
  const {handle, calls} = fixture();
  for (const path of ['/stripe?target=https://attacker.example', '/stripe/', '/workspace', '/stripe/other']) {
    assert.equal((await handle(request({path}), ENV)).status, 404);
  }
  assert.equal((await handle(request({method: 'GET'}), ENV)).status, 405);
  assert.equal((await handle(request({headers: {'content-type': 'text/plain'}}), ENV)).status, 415);
  assert.equal(calls.length, 0);
});

test('body cap enforced with and without declared content length', async () => {
  const {handle, calls} = fixture();
  assert.equal((await handle(request({headers: {'content-length': String(MAX_BYTES + 1)}}), ENV)).status, 413);
  assert.equal((await handle(request({body: 'x'.repeat(MAX_BYTES + 1), signature: 'invalid'}), ENV)).status, 413);
  const stream = new ReadableStream({start(controller) {
    controller.enqueue(new Uint8Array(MAX_BYTES));
    controller.enqueue(new Uint8Array(1)); controller.close();
  }});
  const streamed = new Request('https://fictional-receiver.example/stripe', {method: 'POST',
    headers: {'content-type': 'application/json'}, body: stream, duplex: 'half'});
  assert.equal((await handle(streamed, ENV)).status, 413);
  assert.equal(calls.length, 0);
});

for (const [name, response] of [
  ['redirect', () => new Response(null, {status: 302, headers: {location: 'https://attacker.example'}})],
  ['HTML', () => new Response('login', {headers: {'content-type': 'text/html'}})],
  ['403', () => Response.json({error: 'forbidden'}, {status: 403})],
  ['500', () => Response.json({error: SECRET}, {status: 500})],
  ['false acknowledgement', () => Response.json({received: false})],
  ['malformed JSON', () => new Response('{', {headers: {'content-type': 'application/json'}})],
  ['oversized acknowledgement', () => Response.json({received: true, extra: 'x'.repeat(5000)})],
]) test('does not acknowledge upstream ' + name, async () => {
  const {handle, calls} = fixture(response);
  const res = await handle(request(), ENV);
  assert.equal(res.status, 502);
  assert.equal(calls.length, 1);
  assert.ok(!(await res.text()).includes(SECRET));
});

test('network failure remains retryable and repeated delivery reaches app for deduplication', async () => {
  let attempt = 0;
  const {handle, calls} = fixture(() => {
    if (++attempt === 1) throw Error('do not expose ' + TOKEN);
    return Response.json({received: true});
  });
  const failed = await handle(request(), ENV);
  assert.equal(failed.status, 502);
  assert.ok(!(await failed.text()).includes(TOKEN));
  assert.equal((await handle(request(), ENV)).status, 200);
  assert.equal((await handle(request(), ENV)).status, 200);
  assert.equal(calls.length, 3);
});

test('health discloses no credentials and defaults to not ready', async () => {
  const {handle, calls} = fixture();
  const ready = await handle(request({path: '/health', method: 'GET'}), ENV);
  assert.equal(ready.status, 200);
  assert.deepEqual(await ready.json(), {ready: true, mode: 'test'});
  assert.equal((await handle(request({path: '/health', method: 'GET'}), {})).status, 503);
  assert.equal(calls.length, 0);
});
