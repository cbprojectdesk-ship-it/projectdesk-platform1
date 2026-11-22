// Baseline response headers for the Next/Vinext edge. The CSP uses
// 'unsafe-inline' only because the framework currently emits inline hydration
// markup; a nonce-based policy is the next hardening step, not a reason to ship
// without any policy. Keep this module free of framework imports so it can be
// tested and reused by the hosting middleware.
export const SECURITY_HEADERS = Object.freeze([
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  { key: 'Content-Security-Policy', value: "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; form-action 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; upgrade-insecure-requests" },
]);

export function securityHeaderEntries() {
  return SECURITY_HEADERS.map(({ key, value }) => ({ key, value }));
}
