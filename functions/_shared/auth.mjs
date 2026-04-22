/**
 * Verify a Google-issued ID token (from Google Identity Services on the frontend).
 *
 * Replaces NextAuth for the ask-ivo OpenKBS port. The browser gets an id_token
 * via GIS, sends it as `Authorization: Bearer <id_token>`, and we verify the
 * signature against Google's JWKS + basic claims (iss, aud, exp).
 *
 * Returns { sub, email, name, picture } on success. Throws on failure.
 */

import crypto from 'node:crypto';

const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISS_ALLOWED = new Set(['https://accounts.google.com', 'accounts.google.com']);

let jwksCache = { keys: null, expiresAt: 0 };

async function fetchJwks() {
  const now = Date.now();
  if (jwksCache.keys && jwksCache.expiresAt > now) return jwksCache.keys;

  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  const body = await res.json();

  // cache-control: public, max-age=NNNNN — respect it, else cache 1h
  const cc = res.headers.get('cache-control') || '';
  const m = cc.match(/max-age=(\d+)/);
  const ttlMs = (m ? parseInt(m[1], 10) : 3600) * 1000;

  jwksCache = { keys: body.keys, expiresAt: now + ttlMs };
  return body.keys;
}

function base64urlToBuffer(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64');
}

function jwkToPem(jwk) {
  return crypto.createPublicKey({ key: jwk, format: 'jwk' }).export({ type: 'spki', format: 'pem' });
}

/**
 * @param {string} idToken - the JWT
 * @param {string} audience - expected aud claim (GOOGLE_OAUTH_CLIENT_ID)
 * @returns {Promise<{sub:string,email:string,name?:string,picture?:string}>}
 */
async function verifyGoogleIdToken(idToken, audience) {
  if (!idToken || typeof idToken !== 'string') throw new Error('missing id_token');
  if (!audience) throw new Error('missing audience');

  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('malformed JWT');
  const [headerB64, payloadB64, sigB64] = parts;

  const header = JSON.parse(base64urlToBuffer(headerB64).toString('utf8'));
  const payload = JSON.parse(base64urlToBuffer(payloadB64).toString('utf8'));

  if (header.alg !== 'RS256') throw new Error(`unsupported alg: ${header.alg}`);

  const keys = await fetchJwks();
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error(`no matching JWK for kid ${header.kid}`);

  const pem = jwkToPem(jwk);
  const signingInput = Buffer.from(`${headerB64}.${payloadB64}`, 'utf8');
  const signature = base64urlToBuffer(sigB64);

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(signingInput);
  verifier.end();
  if (!verifier.verify(pem, signature)) throw new Error('signature mismatch');

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp < now) throw new Error('token expired');
  if (typeof payload.iat === 'number' && payload.iat > now + 60) throw new Error('token from the future');
  if (!ISS_ALLOWED.has(payload.iss)) throw new Error(`bad iss: ${payload.iss}`);
  if (payload.aud !== audience) throw new Error('audience mismatch');
  if (!payload.sub) throw new Error('missing sub');
  if (!payload.email_verified) throw new Error('email not verified');

  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
  };
}

/**
 * Extract + verify the Bearer token from a Lambda event.
 * Returns null on missing/invalid (so the handler can decide 401 vs anonymous).
 */
export async function getUserFromEvent(event) {
  const headers = event.headers || {};
  const auth = headers.authorization || headers.Authorization || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  try {
    return await verifyGoogleIdToken(m[1], process.env.GOOGLE_OAUTH_CLIENT_ID);
  } catch {
    return null;
  }
}
