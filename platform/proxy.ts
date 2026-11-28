import { NextResponse } from 'next/server';
import { nonceCsp } from './server/security-headers.mjs';

// Next/Vinext reads the nonce from the request CSP header and attaches it to
// framework scripts. The response carries the same policy so browsers enforce it.
export function proxy(request: Request) {
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const csp = nonceCsp(nonce);
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('content-security-policy', csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = { matcher: ['/'] };
