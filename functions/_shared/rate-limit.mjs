/**
 * Rate limiting — sliding-window counter backed by Postgres.
 *
 * Usage:
 *   import { checkRateLimit, getClientIp } from './_shared/rate-limit.mjs';
 *
 *   const ip = getClientIp(event);
 *   const rl = await checkRateLimit({
 *     key: ip,
 *     endpoint: 'contact',
 *     limits: { perMinute: 2, perHour: 3 },
 *   });
 *   if (!rl.ok) return json({ error: 'Too many requests' }, 429);
 *
 * `key` is whatever identifier you want to throttle on (IP, user id, etc.).
 * `endpoint` namespaces counters so a /chat quota doesn't consume /contact quota.
 * `limits` enforces each configured window independently; record a hit only if
 * ALL windows are under quota.
 *
 * Rows live in a single `rate_limit` table and are cleaned up by the `cleanup`
 * cron function (runs hourly, deletes rows older than 2 hours — older than any
 * window we check).
 */

import { getPool } from './db.mjs';

let schemaReady;

async function ensureSchema() {
  if (schemaReady) return schemaReady;
  const db = getPool();
  schemaReady = (async () => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS rate_limit (
        key        text NOT NULL,
        endpoint   text NOT NULL,
        ts         timestamptz NOT NULL DEFAULT now()
      )
    `);
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_rate_limit_lookup ON rate_limit (key, endpoint, ts DESC)`,
    );
  })();
  return schemaReady;
}

const WINDOWS_SEC = {
  perMinute: 60,
  perHour: 3600,
  perDay: 86400,
};

export function getClientIp(event) {
  // Behind CloudFront, requestContext.http.sourceIp is the edge IP (rotates per
  // request). The real viewer IP is in X-Forwarded-For — CloudFront appends it
  // to whatever the client sent, so the LAST entry is the one CloudFront saw
  // directly and is the only trustworthy one. Walk the list right-to-left and
  // pick the first non-empty address.
  const headers = event?.headers || {};
  const xff = headers['x-forwarded-for'] || headers['X-Forwarded-For'] || '';
  if (xff) {
    const parts = xff.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return event?.requestContext?.http?.sourceIp || 'unknown';
}

export async function checkRateLimit({ key, endpoint, limits }) {
  if (!key || !endpoint) throw new Error('key and endpoint required');

  try {
    await ensureSchema();
  } catch (err) {
    console.error('rate_limit schema init failed:', err);
    return { ok: false };
  }

  const db = getPool();

  for (const [window, limit] of Object.entries(limits)) {
    const seconds = WINDOWS_SEC[window];
    if (!seconds || !limit) continue;
    const { rows } = await db.query(
      `SELECT count(*)::int AS n FROM rate_limit
        WHERE key = $1 AND endpoint = $2 AND ts > now() - ($3 || ' seconds')::interval`,
      [key, endpoint, String(seconds)],
    );
    if (rows[0].n >= limit) {
      return { ok: false, retryAfter: seconds, window };
    }
  }

  await db.query('INSERT INTO rate_limit (key, endpoint) VALUES ($1, $2)', [key, endpoint]);
  return { ok: true };
}

export async function cleanupOldRateLimits() {
  await ensureSchema();
  const db = getPool();
  const { rowCount } = await db.query(
    `DELETE FROM rate_limit WHERE ts < now() - interval '2 hours'`,
  );
  return rowCount ?? 0;
}
