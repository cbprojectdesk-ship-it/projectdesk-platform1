// Optional defence-in-depth proof for managed identity headers. A hosting proxy
// that has already authenticated the caller can HMAC the exact id and email with
// a secret that never reaches the browser. The secret is intentionally optional
// until the hosting contract is verified; when present, every private request
// must carry a valid proof or it is treated as unauthenticated.
const encoder = new TextEncoder();
const proofPattern = /^[a-f0-9]{64}$/i;

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function identityProof(user, email, secret) {
  if (typeof user !== 'string' || typeof email !== 'string' || typeof secret !== 'string' || secret.length < 32) {
    throw new Error('Identity proof configuration is invalid');
  }
  return sign(user + '\n' + email, secret);
}

function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

export async function verifyIdentityProof(request, user, email, secret) {
  if (typeof secret !== 'string' || secret.length < 32) return false;
  const supplied = request.headers.get('x-quenvira-identity-proof');
  if (!supplied || !proofPattern.test(supplied)) return false;
  return constantTimeEqual(supplied.toLowerCase(), await identityProof(user, email, secret));
}
