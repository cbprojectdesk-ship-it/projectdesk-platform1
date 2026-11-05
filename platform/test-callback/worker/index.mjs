// Test-only Stripe ingress. No customer UI, storage, API key or arbitrary target.
export const TARGET = 'https://quenvira-isolated-acceptance.sprogg1973.chatgpt.site/api/quenvira/subscription-webhook';
export const MAX_BYTES = 262144;
const ACCOUNT = 'acct_1USzoBJMLR8T7SSt';
const TYPES = new Set([
  'checkout.session.completed', 'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed', 'customer.subscription.created',
  'customer.subscription.updated', 'customer.subscription.deleted',
  'invoice.paid', 'invoice.payment_failed', 'charge.dispute.created',
  'charge.refunded', 'radar.early_fraud_warning.created',
]);
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', {fatal: true});

function reply(status, result, extra = {}) {
  return Response.json(result, {status, headers: {
    'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
    ...extra,
  }});
}

function configuration(env) {
  if (env?.TEST_RELAY_ENABLED !== 'yes') return null;
  const secret = env.STRIPE_TEST_WEBHOOK_SECRET;
  const serviceToken = env.ISOLATED_SITES_SERVICE_TOKEN;
  if (typeof secret !== 'string' || !/^whsec_[A-Za-z0-9_]{16,256}$/.test(secret)) return null;
  if (typeof serviceToken !== 'string' || !/^[A-Za-z0-9_\-+/=]{16,512}$/.test(serviceToken)) return null;
  return {secret, serviceToken};
}

async function readBounded(request, maximum = MAX_BYTES) {
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maximum)) {
    return {error: 413};
  }
  const reader = request.body?.getReader();
  if (!reader) return {error: 400};
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) {
        await reader.cancel();
        return {error: 413};
      }
      chunks.push(value);
    }
  } catch {
    return {error: 400};
  } finally {
    reader.releaseLock();
  }
  if (!size) return {error: 400};
  const raw = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { raw.set(chunk, offset); offset += chunk.byteLength; }
  return {raw};
}

// Stripe's documented manual HMAC-SHA256 algorithm, over original bytes.
async function verified(raw, header, secret, now) {
  if (!header || header.length > 2048) return false;
  const fields = header.split(',').map(part => part.trim().split('='));
  const timestamps = fields.filter(([name]) => name === 't');
  const signatures = fields.filter(([name]) => name === 'v1');
  if (timestamps.length !== 1 || signatures.length < 1 || signatures.length > 8) return false;
  const [, time, extra] = timestamps[0];
  if (extra !== undefined || !/^\d{1,12}$/.test(time)) return false;
  const seconds = Number(time);
  if (!Number.isSafeInteger(seconds) || Math.abs(now / 1000 - seconds) > 300) return false;
  const prefix = encoder.encode(time + '.');
  const payload = new Uint8Array(prefix.length + raw.length);
  payload.set(prefix); payload.set(raw, prefix.length);
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret),
    {name: 'HMAC', hash: 'SHA-256'}, false, ['verify']);
  let valid = false;
  for (const [, value, rest] of signatures) {
    if (rest !== undefined || !/^[a-fA-F0-9]{64}$/.test(value ?? '')) continue;
    const bytes = Uint8Array.from(value.match(/../g), pair => parseInt(pair, 16));
    const matches = await crypto.subtle.verify('HMAC', key, bytes, payload);
    valid = matches || valid;
  }
  return valid;
}

export function createHandler({fetcher = fetch, now = Date.now} = {}) {
  return async function handle(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health' && request.method === 'GET' && !url.search) {
      return reply(configuration(env) ? 200 : 503, {ready: !!configuration(env), mode: 'test'});
    }
    if (url.pathname !== '/stripe' || url.search) return reply(404, {error: 'Not found'});
    if (request.method !== 'POST') return reply(405, {error: 'Method not allowed'}, {allow: 'POST'});
    const config = configuration(env);
    if (!config) return reply(503, {error: 'Test receiver is not configured'});
    if ((request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase() !== 'application/json') {
      return reply(415, {error: 'JSON required'});
    }
    const body = await readBounded(request);
    if (body.error) return reply(body.error, {error: 'Invalid request body'});
    const signature = request.headers.get('stripe-signature');
    if (!await verified(body.raw, signature, config.secret, now())) {
      return reply(400, {error: 'Invalid signature'});
    }
    let event;
    try { event = JSON.parse(decoder.decode(body.raw)); }
    catch { return reply(400, {error: 'Invalid event'}); }
    if (!event || typeof event !== 'object' || event.object !== 'event' ||
        !/^evt_[A-Za-z0-9]+$/.test(event.id ?? '') || event.livemode !== false ||
        (event.account !== undefined && event.account !== ACCOUNT) ||
        !event.data?.object || typeof event.data.object !== 'object' ||
        Array.isArray(event.data.object) || event.data.object.livemode === true) {
      return reply(400, {error: 'Test event required'});
    }
    if (!TYPES.has(event.type)) return reply(400, {error: 'Event type not allowed'});
    // The app re-verifies the original signature and performs durable deduplication.
    // Do not cache event IDs here: failed upstream deliveries must remain retryable.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const upstream = await fetcher(TARGET, {
        method: 'POST', redirect: 'manual', signal: controller.signal,
        headers: {
          'content-type': 'application/json', 'stripe-signature': signature,
          'OAI-Sites-Authorization': 'Bearer ' + config.serviceToken,
        },
        body: body.raw,
      });
      // A login redirect/HTML page is not an application acknowledgement.
      const json = (upstream.headers.get('content-type') || '').split(';')[0].trim() === 'application/json';
      if (!upstream.ok || !json) return reply(502, {error: 'Test app did not acknowledge event'});
      const acknowledgement = await readBounded(upstream, 4096);
      if (acknowledgement.error) return reply(502, {error: 'Invalid test app acknowledgement'});
      let result;
      try { result = JSON.parse(decoder.decode(acknowledgement.raw)); }
      catch { return reply(502, {error: 'Invalid test app acknowledgement'}); }
      if (result?.received !== true) return reply(502, {error: 'Test app did not acknowledge event'});
      return reply(200, {received: true, mode: 'test'});
    } catch {
      return reply(502, {error: 'Test app unavailable'});
    } finally { clearTimeout(timeout); }
  };
}

const handle = createHandler();
export default {fetch: handle};
