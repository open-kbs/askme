/**
 * Setup API backend — registers `/api/setup/*` routes on the dev Hono app.
 *
 * Called by the coding agent (or manually via curl) during first-time setup
 * to save config, write .env.local, and test credentials. There is no
 * browser-based setup UI — see AGENTS.md for the setup flow.
 *
 * All routes are gated to the loopback interface. The server also binds to
 * 127.0.0.1 only, so these endpoints are never reachable from the network.
 *
 * Never imported by deployed Lambda functions — lives only in the local
 * harness.
 */

import { Hono } from 'hono';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

// Only an LLM key is required to get chat working. Everything else is
// optional — calendar, bookings, and email features activate when their
// keys are added later.
const LLM_KEY_NAMES = ['OPENAI_API_KEY', 'OPENKBS_API_KEY'];

const OPTIONAL_ENV = [
  'GOOGLE_OAUTH_CLIENT_ID',
  'GOOGLE_SERVICE_ACCOUNT_KEY',
  'GOOGLE_CALENDAR_IDS',
  'GOOGLE_CALENDAR_WRITE_ID',
  'APP_URL',
  'CONTACT_EMAIL',
  'FROM_EMAIL',
];

// Fields whose default value in the committed `config.json` means "not yet
// configured" — setup is needed until the owner replaces them.
const PLACEHOLDER_MARKERS = [
  { path: 'owner.name', placeholder: 'Your Name' },
  { path: 'owner.title', placeholder: 'Your Title' },
  { path: 'owner.location', placeholder: 'Your City, Country' },
];

function readConfig(repoRoot) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, 'config.json'), 'utf8'));
}

function getPath(obj, dotPath) {
  return dotPath.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function setPath(obj, dotPath, value) {
  const parts = dotPath.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] == null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function parseDotenv(text) {
  const out = {};
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    out[line.slice(0, eq).trim()] = line.slice(eq + 1);
  }
  return out;
}

function serializeDotenv(record) {
  return Object.entries(record)
    .map(([k, v]) => `${k}=${v ?? ''}`)
    .join('\n') + '\n';
}

function loopbackOnly(c, next) {
  const ip =
    c.env?.incoming?.socket?.remoteAddress?.replace(/^::ffff:/, '') || '';
  if (ip !== '127.0.0.1' && ip !== '::1') {
    return c.json({ error: 'setup is loopback-only' }, 403);
  }
  return next();
}

export function registerSetupRoutes(app, { repoRoot }) {
  const setup = new Hono();
  setup.use('*', loopbackOnly);

  // Status — does config.json still have placeholders, and is .env.local present?
  setup.get('/status', (c) => {
    const config = readConfig(repoRoot);
    const missingConfig = PLACEHOLDER_MARKERS.filter(
      (m) => getPath(config, m.path) === m.placeholder,
    ).map((m) => m.path);

    const envPath = path.join(repoRoot, '.env.local');
    const hasEnvLocal = fs.existsSync(envPath);
    const env = hasEnvLocal
      ? parseDotenv(fs.readFileSync(envPath, 'utf8'))
      : {};
    const hasLLMKey = LLM_KEY_NAMES.some((k) => Boolean(env[k]));
    const missingOptional = OPTIONAL_ENV.filter((k) => !env[k]);

    // "configured" means chat works: owner identity filled + LLM key set.
    const configured = missingConfig.length === 0 && hasLLMKey;
    return c.json({
      configured,
      missingConfig,
      hasLLMKey,
      missingOptional,
      hasEnvLocal,
    });
  });

  // Current values — secrets shown as present/absent, never raw.
  setup.get('/values', (c) => {
    const config = readConfig(repoRoot);
    const envPath = path.join(repoRoot, '.env.local');
    const env = fs.existsSync(envPath)
      ? parseDotenv(fs.readFileSync(envPath, 'utf8'))
      : {};
    const allKeys = [...LLM_KEY_NAMES, ...OPTIONAL_ENV];
    const envPresence = Object.fromEntries(
      allKeys.map((k) => [k, Boolean(env[k])]),
    );
    return c.json({ config, envPresence });
  });

  // Save — merges the patch into config.json and .env.local.
  setup.post('/save', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const configPatch = body.config || {};
    const envPatch = body.env || {};

    // 1. config.json — deep-merge patch into current.
    const current = readConfig(repoRoot);
    for (const [dotPath, value] of Object.entries(flatten(configPatch))) {
      setPath(current, dotPath, value);
    }
    fs.writeFileSync(
      path.join(repoRoot, 'config.json'),
      JSON.stringify(current, null, 2) + '\n',
    );

    // 2. .env.local — read existing (if any), apply patch, auto-gen BOOKING_SECRET.
    const envPath = path.join(repoRoot, '.env.local');
    const env = fs.existsSync(envPath)
      ? parseDotenv(fs.readFileSync(envPath, 'utf8'))
      : {};
    for (const [k, v] of Object.entries(envPatch)) {
      if (v === undefined || v === '') continue; // don't clobber with empties
      env[k] = v;
    }
    if (!env.BOOKING_SECRET) {
      env.BOOKING_SECRET = randomBytes(32).toString('hex');
    }
    fs.writeFileSync(envPath, serializeDotenv(env));

    return c.json({ ok: true });
  });

  // Test — LLM key auth. Sends a minimal chat completion to verify the key.
  // Accepts either an OpenAI key or an OpenKBS proxy key. The `provider`
  // field selects the endpoint: "openai" → api.openai.com, default → proxy.
  setup.post('/test/llm', async (c) => {
    const { apiKey, provider } = await c.req.json().catch(() => ({}));
    if (!apiKey) return c.json({ ok: false, error: 'apiKey required' }, 400);
    const baseURL = provider === 'openai'
      ? 'https://api.openai.com/v1/chat/completions'
      : 'https://proxy.openkbs.com/v1/openai/chat/completions';
    try {
      const res = await fetch(baseURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4.1-nano',
          messages: [{ role: 'user', content: 'say ok' }],
          max_completion_tokens: 16,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        return c.json({ ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` });
      }
      return c.json({ ok: true, message: 'OK — API key accepted' });
    } catch (err) {
      return c.json({ ok: false, error: err?.message || 'network error' });
    }
  });

  // Test — Google Calendar service-account access.
  setup.post('/test/google-calendar', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { serviceAccountKey, calendarIds } = body;
    if (!serviceAccountKey) {
      return c.json({ ok: false, error: 'serviceAccountKey required' }, 400);
    }
    if (!calendarIds) {
      return c.json({ ok: false, error: 'calendarIds required' }, 400);
    }
    try {
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY = serviceAccountKey;
      const { freeBusyQuery } = await import(
        path.join(repoRoot, 'functions', '_shared', 'google-calendar.mjs')
      );
      const ids = calendarIds.split(',').map((s) => s.trim()).filter(Boolean);
      const now = new Date();
      const later = new Date(now.getTime() + 60 * 60 * 1000);
      const res = await freeBusyQuery({
        timeMin: now.toISOString(),
        timeMax: later.toISOString(),
        timeZone: 'UTC',
        calendarIds: ids,
      });
      const errors = Object.entries(res.calendars || {})
        .filter(([, v]) => v?.errors)
        .map(([k, v]) => `${k}: ${v.errors[0]?.reason || 'error'}`);
      if (errors.length > 0) {
        return c.json({ ok: false, error: `Calendar errors: ${errors.join('; ')}` });
      }
      return c.json({ ok: true, message: `OK — ${ids.length} calendar(s) reachable` });
    } catch (err) {
      return c.json({ ok: false, error: err?.message || 'freeBusy failed' });
    }
  });

  // Test — send a one-off email via OpenKBS email service.
  setup.post('/test/email', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { apiKey, to, from } = body;
    if (!apiKey || !to) {
      return c.json({ ok: false, error: 'apiKey and to required' }, 400);
    }
    try {
      const projectId =
        process.env.OPENKBS_PROJECT_ID ||
        readProjectIdFromOpenKBSJson(repoRoot);
      if (!projectId) {
        return c.json({ ok: false, error: 'projectId not found (openkbs.json missing?)' });
      }
      const res = await fetch(
        `https://project.openkbs.com/projects/${projectId}/email/send`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            to,
            subject: 'Setup test email',
            html: '<p>If you see this, your OpenKBS email service is wired correctly.</p>',
            ...(from ? { from } : {}),
          }),
        },
      );
      const text = await res.text();
      if (!res.ok) {
        return c.json({ ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` });
      }
      return c.json({ ok: true, message: 'Email queued — check the inbox.' });
    } catch (err) {
      return c.json({ ok: false, error: err?.message || 'email send failed' });
    }
  });

  app.route('/api/setup', setup);
}

function readProjectIdFromOpenKBSJson(repoRoot) {
  try {
    const j = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'openkbs.json'), 'utf8'),
    );
    return j.projectId;
  } catch {
    return null;
  }
}

// Flatten nested config patch to dotted paths so we can splice into the
// current config without clobbering sibling keys.
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      flatten(v, key, out);
    } else {
      out[key] = v;
    }
  }
  return out;
}
