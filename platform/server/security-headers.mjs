// Baseline response headers for the Next/Vinext edge. Keep this module free of
// framework imports so it can be tested and reused by the proxy.
export const SECURITY_HEADERS = Object.freeze([
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
]);

export function securityHeaderEntries() {
  return SECURITY_HEADERS.map(({ key, value }) => ({ key, value }));
}

export function nonceCsp(nonce) {
  if (typeof nonce !== 'string' || !/^[A-Za-z0-9+/=_-]{16,128}$/.test(nonce)) {
    throw new Error('Invalid CSP nonce');
  }
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "form-action 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "upgrade-insecure-requests",
  ].join('; ');
}
