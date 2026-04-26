# AGENTS.md

Guidance for coding agents (Claude Code, Cursor, Codex, Aider, …) working in
this repo. Humans can read it too.

**If `config.json` still has `"Your Name"` placeholders, read
[SETUP.md](./SETUP.md) and follow it before doing anything else.**

## What this repo is

A local-first template for a chat-first personal site. Visitors chat with an
AI persona of the site owner; the chat can look up calendar availability,
request a booking, or send a contact message. Everything runs locally via
`npm run dev` — an embedded Postgres (PGlite) and an in-process Lambda
harness stand in for the production OpenKBS services.

## Layout

```
config.json              # Non-secret owner config (personalize here)
.env.local               # Secrets — gitignored, setup API writes this
assets/
  career.json            # Structured bio (chat system prompt reads this)
  avatar.png, cv.pdf     # Static assets
functions/               # Lambda handlers, each has index.mjs
  _shared/               # Shared modules (db, auth, emails, career, …)
  api-chat/              # LLM chat + 3 tools
  api-availability/      # Google Calendar free-busy
  api-bookings/          # Create / approve / reject
  api-contact/           # Contact form
  api-cleanup/           # Scheduled cron (rate-limits + stale bookings)
site-src/                # Vite + React + Tailwind source
local/
  server.mjs             # Hono dev server — runs Lambdas in-process
  db.mjs                 # PGlite → pg.Pool shim for local dev
  setup.mjs              # /api/setup/* backend — agent calls these for credential setup
```

## Running locally

- `npm run dev` — starts API (`:8787`) + web (`:5173`) in parallel.
- Local DB lives at `./local/.pgdata/` (PGlite cluster). Safe to `rm -rf`
  to reset.
- Setup API at `http://127.0.0.1:8787/api/setup/*`. Loopback-only.
  Endpoints: `/status`, `/values`, `/save`, `/test/llm`,
  `/test/google-calendar`, `/test/email`.

## Common edits

- **Chat personality** — edit `config.json.systemPrompt.guidelines[]` or
  `persona`. Restart dev server (`_shared/career.mjs` caches the prompt
  on cold start).
- **Starter prompt chips** — `config.json.starterPrompts`.
- **Email copy** — `config.json.emails.*`. Templates are Mustache-lite;
  `{{booking.name}}` interpolates from the booking row.
- **A tool in chat** — tools are defined inside `functions/api-chat/index.mjs`
  with the OpenKBS proxy's OpenAI-compatible tool-call format.

## OpenKBS

Run `openkbs init` at the start of every session to load the OpenKBS
skill and CLI context.

### Quick Reference

- `openkbs deploy` — Deploy elastic services (Postgres, Storage, MQTT)
- `openkbs site deploy` — Deploy static site
- `openkbs fn deploy <name>` — Deploy function
- AI Proxy: `https://proxy.openkbs.com` — Use `OPENKBS_API_KEY` for auth
- List models: `curl https://proxy.openkbs.com/v1/models`

## Things not to do

- Don't commit `.env.local`, `local/.pgdata/`, or `node_modules/`.
- Don't import `pg` directly in functions — use `_shared/db.mjs`. It
  picks between real Postgres (prod) and PGlite (local) based on env.
- Don't add owner-specific strings (the user's name, city, etc.) to
  function or component source. Everything personal lives in
  `config.json` or `assets/career.json`.
- Don't rename functions from `api-*` → anything else. The SPA proxy
  and the deploy scripts both assume the `api-` prefix (it prevents
  route collisions with SPA paths like `/contact`).
