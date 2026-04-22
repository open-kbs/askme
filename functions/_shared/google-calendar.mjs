/**
 * Google Calendar client via service account — implemented with node:crypto
 * (no `googleapis` dep; that package is ~100MB and far too heavy for Lambda).
 *
 * Flow:
 *   1. build a JWT signed with the service-account private key (RS256)
 *   2. exchange it at https://oauth2.googleapis.com/token for an access token
 *   3. call Calendar v3 endpoints via fetch with `Authorization: Bearer ...`
 *
 * Access tokens are cached per-scope for 50 minutes (Google issues 1h).
 *
 * Expects: process.env.GOOGLE_SERVICE_ACCOUNT_KEY = base64(service-account JSON)
 */

import crypto from 'node:crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CAL_BASE = 'https://www.googleapis.com/calendar/v3';
const SCOPE_READ = 'https://www.googleapis.com/auth/calendar.readonly';
const SCOPE_WRITE = 'https://www.googleapis.com/auth/calendar';

let credentialsCache;
function getCredentials() {
  if (credentialsCache) return credentialsCache;
  const keyBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyBase64) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not set');
  credentialsCache = JSON.parse(Buffer.from(keyBase64, 'base64').toString('utf-8'));
  return credentialsCache;
}

function base64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

const tokenCache = new Map(); // scope -> { accessToken, expiresAt }

async function getAccessToken(scope) {
  const now = Date.now();
  const cached = tokenCache.get(scope);
  if (cached && cached.expiresAt > now + 60_000) return cached.accessToken;

  const creds = getCredentials();
  const iat = Math.floor(now / 1000);
  const claims = {
    iss: creds.client_email,
    scope,
    aud: TOKEN_URL,
    iat,
    exp: iat + 3600,
  };
  const header = { alg: 'RS256', typ: 'JWT' };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(creds.private_key);
  const assertion = `${signingInput}.${base64url(signature)}`;

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    throw new Error(`token exchange failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  tokenCache.set(scope, {
    accessToken: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  });
  return data.access_token;
}

async function calendarFetch(scope, path, init = {}) {
  const token = await getAccessToken(scope);
  const res = await fetch(`${CAL_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = data?.error?.message || text || `HTTP ${res.status}`;
    throw new Error(`Google Calendar: ${msg}`);
  }
  return data;
}

/**
 * freebusy.query — returns { calendars: { [id]: { busy: [{ start, end }] } } }
 */
export async function freeBusyQuery({ timeMin, timeMax, timeZone, calendarIds }) {
  return calendarFetch(SCOPE_READ, '/freeBusy', {
    method: 'POST',
    body: JSON.stringify({
      timeMin,
      timeMax,
      timeZone,
      items: calendarIds.map((id) => ({ id })),
    }),
  });
}

export async function createEvent({
  summary,
  description,
  startDateTime,
  endDateTime,
  attendeeEmail,
}) {
  return calendarFetch(SCOPE_WRITE, '/calendars/ivostoynovski%40gmail.com/events', {
    method: 'POST',
    body: JSON.stringify({
      summary,
      description: `${description}\n\nAttendee: ${attendeeEmail}`,
      start: { dateTime: startDateTime, timeZone: 'Europe/Sofia' },
      end: { dateTime: endDateTime, timeZone: 'Europe/Sofia' },
    }),
  });
}
