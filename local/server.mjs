/**
 * Local dev harness — runs each Lambda function's `handler` in-process
 * behind a Hono HTTP server.
 *
 * What it does:
 *   1. Loads `.env.local` via dotenv (so handlers see GOOGLE_* / OPENKBS_API_KEY / etc).
 *   2. If `DATABASE_URL` is unset, defaults `LOCAL_DB_FILE=./local/.pgdata`
 *      so `_shared/db.mjs` routes queries to the PGlite shim.
 *   3. For each function: writes a no-op `_env.mjs` stub (the real one is
 *      generated at deploy time) and copies `_shared/` into the fn dir, so
 *      the in-process import resolves the same relative paths as the
 *      deployed zip.
 *   4. Dispatches `/api-chat`, `/api-availability`, `/api-bookings`,
 *      `/api-contact` to the imported handlers by synthesizing a Lambda
 *      Function-URL event.
 *
 * Vite runs separately on :5173 and proxies `/api-*` here (see
 * `site-src/vite.config.ts`). Start both with `npm run dev` at repo root.
 */

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { registerSetupRoutes } from './setup.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

// 1. Environment ------------------------------------------------------------
dotenv.config({ path: path.join(repoRoot, '.env.local') });
if (!process.env.DATABASE_URL && !process.env.LOCAL_DB_FILE) {
  process.env.LOCAL_DB_FILE = path.join(repoRoot, 'local', '.pgdata');
}
// Absolute path to the PGlite shim — _shared/db.mjs loads it via
// dynamic import. Needs to be absolute because _shared/ is copied into
// each function dir, breaking any repo-relative path.
process.env.LOCAL_DB_SHIM_PATH = path.join(repoRoot, 'local', 'db.mjs');

// 2. Prep each function dir (stub _env.mjs + copy _shared/) -----------------
const FUNCTIONS = ['api-chat', 'api-availability', 'api-bookings', 'api-contact'];
const sharedSrc = path.join(repoRoot, 'functions', '_shared');

for (const fn of FUNCTIONS) {
  const fnDir = path.join(repoRoot, 'functions', fn);
  // _env.mjs stub — the real one is generated at deploy time by deploy-fn.sh.
  // Locally we already loaded .env.local via dotenv, so this is a no-op.
  fs.writeFileSync(
    path.join(fnDir, '_env.mjs'),
    '// dev stub — .env.local is loaded by local/server.mjs\n',
  );

  // _shared/ — handlers `import './_shared/...'` expecting it as a sibling.
  // Copy instead of symlink for cross-platform reliability; restart on changes.
  const dest = path.join(fnDir, '_shared');
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(sharedSrc, dest, { recursive: true });

  // Deploy-time copies the root config.json + assets/career.json alongside
  // _shared/; mirror that so config.mjs + career.mjs find them at the same paths.
  fs.copyFileSync(
    path.join(repoRoot, 'config.json'),
    path.join(dest, 'config.json'),
  );
  fs.copyFileSync(
    path.join(repoRoot, 'assets', 'career.json'),
    path.join(dest, 'career.json'),
  );
}

// 3. Import handlers (after env + stubs are in place) -----------------------
const handlers = {};
for (const fn of FUNCTIONS) {
  const mod = await import(path.join(repoRoot, 'functions', fn, 'index.mjs'));
  handlers[fn] = mod.handler;
}

// 4. Lambda event synthesizer -----------------------------------------------
async function toLambdaEvent(c) {
  const url = new URL(c.req.url);
  const headers = {};
  c.req.raw.headers.forEach((v, k) => {
    headers[k.toLowerCase()] = v;
  });
  const queryStringParameters = Object.fromEntries(url.searchParams.entries());

  let body;
  const method = c.req.method;
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    body = await c.req.text();
  }

  const sourceIp =
    headers['x-forwarded-for']?.split(',').map((s) => s.trim()).pop() ||
    c.env?.incoming?.socket?.remoteAddress ||
    '127.0.0.1';

  return {
    requestContext: {
      http: { method, path: url.pathname, sourceIp },
    },
    httpMethod: method,
    headers,
    queryStringParameters,
    rawPath: url.pathname,
    rawQueryString: url.search.slice(1),
    body,
    isBase64Encoded: false,
  };
}

function fromLambdaResponse(c, result) {
  const status = result.statusCode ?? 200;
  const headers = result.headers ?? {};
  for (const [k, v] of Object.entries(headers)) {
    c.header(k, String(v));
  }
  c.status(status);
  return c.body(result.body ?? '');
}

async function dispatch(fn, c) {
  try {
    const event = await toLambdaEvent(c);
    const result = await handlers[fn](event);
    return fromLambdaResponse(c, result);
  } catch (err) {
    console.error(`[${fn}] handler error:`, err);
    return c.json({ error: err?.message || 'handler error' }, 500);
  }
}

// 5. Routes -----------------------------------------------------------------
const app = new Hono();

app.on(['GET', 'POST', 'OPTIONS'], '/api-chat', (c) => dispatch('api-chat', c));
app.on(['GET', 'POST', 'OPTIONS'], '/api-availability', (c) =>
  dispatch('api-availability', c),
);
app.on(['GET', 'POST', 'OPTIONS'], '/api-bookings', (c) =>
  dispatch('api-bookings', c),
);
app.on(['GET', 'POST', 'OPTIONS'], '/api-contact', (c) =>
  dispatch('api-contact', c),
);

app.get('/health', (c) => c.json({ ok: true }));

// Setup API — local-only, loopback-gated inside the module.
registerSetupRoutes(app, { repoRoot });

const port = Number(process.env.LOCAL_PORT || 8787);
serve(
  { fetch: app.fetch, port, hostname: '127.0.0.1' },
  ({ port }) => {
    console.log(`[local] API server listening on http://127.0.0.1:${port}`);
    console.log(`[local] routes: /api-chat /api-availability /api-bookings /api-contact /api/setup/*`);
    if (process.env.LOCAL_DB_FILE && !process.env.DATABASE_URL) {
      console.log(`[local] using PGlite at ${process.env.LOCAL_DB_FILE}`);
    }
  },
);
