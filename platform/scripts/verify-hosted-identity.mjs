// Read-only hosted-boundary probe. Run only against an approved staging origin.
// It sends forged identity headers and checks that the hosting edge strips them;
// it never sends credentials, reads business records or changes data.
const origin = process.argv[2];
if (!origin || !/^https:\/\/[^/]+$/.test(origin)) {
  console.error('Usage: node scripts/verify-hosted-identity.mjs https://staging.example');
  process.exit(64);
}

async function request(path, headers = {}) {
  const response = await fetch(origin + path, {
    headers,
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  return { status: response.status, headers: response.headers, body: await response.text() };
}

let failures = 0;
function check(name, condition, detail = '') {
  if (condition) console.log('PASS ' + name);
  else {
    failures++;
    console.error('FAIL ' + name + (detail ? ': ' + detail : ''));
  }
}

try {
  const forged = {
    'oai-authenticated-user-id': 'forged-boundary-user',
    'oai-authenticated-user-email': 'forged-boundary@example.invalid',
  };
  const withForged = await request('/api/quenvira/session', forged);
  check('forged identity is rejected', withForged.status === 401, 'got ' + withForged.status);
  const anonymous = await request('/api/quenvira/session');
  check('anonymous identity is rejected', anonymous.status === 401, 'got ' + anonymous.status);
  const health = await request('/api/quenvira/health');
  check('readiness endpoint is healthy', health.status === 200 && health.body.includes('"status":"ok"'), 'got ' + health.status);
  const home = await request('/');
  check('home is served over HTTPS', home.status === 200, 'got ' + home.status);
  check('HSTS is present', /max-age=31536000/.test(home.headers.get('strict-transport-security') || ''));
  check('CSP is present', /script-src/.test(home.headers.get('content-security-policy') || ''));
  check('CSP uses a nonce', /'nonce-[A-Za-z0-9+/=_-]{16,128}'/.test(home.headers.get('content-security-policy') || ''));
  check('frame denial is present', /frame-ancestors 'none'/.test(home.headers.get('content-security-policy') || ''));
} catch (error) {
  failures++;
  console.error('FAIL boundary probe could not complete: ' + error.message);
}
process.exitCode = failures ? 1 : 0;
