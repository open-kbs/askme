# AGENTS.md

Guidance for coding agents (Claude Code, Cursor, Codex, Aider, …) working in
this repo. Humans can read it too.

## What this repo is

A local-first template for a chat-first personal site. Visitors chat with an
AI persona of the site owner; the chat can look up calendar availability,
request a booking, or send a contact message. Everything runs locally via
`npm run dev` — an embedded Postgres (PGlite) and an in-process Lambda
harness stand in for the production OpenKBS services.

## First-time setup

Check whether personalization is already done:

```bash
grep -q '"Your Name"' config.json && echo "not personalized" || echo "already personalized"
```

If it says **already personalized**, skip this whole section — go to
*Ongoing development* below.

If **not personalized**, walk through these steps. The goal is to turn the
placeholder repo into the owner's site.

### 1. Gather source material

Ask the user for whichever they have:

- A LinkedIn PDF export (usually `linkedin.pdf` or `Profile.pdf` in the repo
  root, or in `./tmp/`)
- A resume / CV
- A GitHub username
- A short bio paragraph

Prefer a LinkedIn PDF — it has the richest structured data. If none is
available, ask the user to paste a bio and list their roles + skills.

### 2. Write `assets/career.json`

Follow the schema already in the file (read it first; it's a template with
placeholder values). Populate from the source material. Guidance per field:

- `summary` — 2–4 sentences, first person, how the AI will introduce the
  owner. Focus on what they do and the problems they solve, not job titles.
- `experience[]` — most recent first. `highlights` is optional; leave it
  empty if the source material doesn't mention specific achievements.
- `skills` — the owner's hands-on areas. Be honest: only skills they'd
  claim in an interview. The system prompt uses this list to decide
  what's in-scope for the chatbot, so overclaiming here means the bot
  will confidently answer questions the owner can't back up.
- `sideProjects[]` — only real, publicly known projects. Omit if none.
- `conditionalFacts[]` — facts the owner wants mentioned only when
  triggered (e.g. "mention my podcast only if asked about content").
  Leave empty unless the user explicitly asks.

### 3. Fill `config.json`

Edit only `owner.*`, `branding.*`, `social.*`, and `starterPrompts`. Leave
`systemPrompt` and `emails` at their defaults unless the user asks for
changes — the defaults work and are easy for the user to tweak later.

- `owner.name` — full name as they'd write it on a business card
- `owner.nameLocal` — native-script spelling, if different (e.g. Cyrillic,
  Chinese). Empty string if N/A.
- `owner.firstName` — what the chatbot uses in first person ("I'm {firstName}").
- `owner.title`, `owner.location`, `owner.timezone`, `owner.timezoneLabel`,
  `owner.bioTagline` — from the source material.
- `branding.siteName` / `logoText` — keep the "Ask …" pattern unless the
  user wants something else. `logoText` is usually uppercase.
- `branding.metaDescription` — one sentence for SEO.
- `social.*` — URLs or null. Don't invent handles.
- `starterPrompts` — 4 prompts tuned to the owner's field. First one should
  be an open question about their work; include at least one booking
  prompt and one message prompt so the chat tools get exercised.

### 4. Avatar and CV

- If the user provides an avatar, copy it to `assets/avatar.png`
  (square, ≥256×256). Otherwise leave the placeholder and tell the user
  to drop one in.
- Same for CV at `assets/cv.pdf`. It's optional — the nav's "Download CV"
  link hides if the file is missing.

### 5. Configure credentials (`.env.local`)

The local dev server exposes a setup API at `http://127.0.0.1:8787/api/setup/*`
for saving and testing credentials. Use it instead of writing `.env.local`
by hand — it handles merge logic and auto-generates `BOOKING_SECRET`.

**Prerequisite:** `npm run dev` must be running (the setup API lives in the
local server).

**Step-by-step:**

1. Ask the user for each credential value. Guide them to where each one
   comes from:
   - `OPENKBS_API_KEY` — from [openkbs.com](https://openkbs.com) project settings
   - `GOOGLE_OAUTH_CLIENT_ID` — Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID (web)
   - `GOOGLE_SERVICE_ACCOUNT_KEY` — base64-encoded JSON key for a service account with Calendar API access
   - `GOOGLE_CALENDAR_IDS` — comma-separated calendar email addresses to read
   - `GOOGLE_CALENDAR_WRITE_ID` — the calendar to write booking events to
   - `APP_URL` — use `http://localhost:5173` for local dev
   - `CONTACT_EMAIL` — where contact form messages go (owner's email)
   - `FROM_EMAIL` — verified sender address for outgoing email

   Do NOT ask for `BOOKING_SECRET` — the API auto-generates it.

2. Save all credentials in one call:
   ```bash
   curl -s -X POST http://127.0.0.1:8787/api/setup/save \
     -H 'Content-Type: application/json' \
     -d '{
       "env": {
         "OPENKBS_API_KEY": "...",
         "GOOGLE_OAUTH_CLIENT_ID": "...",
         "GOOGLE_SERVICE_ACCOUNT_KEY": "...",
         "GOOGLE_CALENDAR_IDS": "...",
         "GOOGLE_CALENDAR_WRITE_ID": "...",
         "APP_URL": "http://localhost:5173",
         "CONTACT_EMAIL": "...",
         "FROM_EMAIL": "..."
       }
     }'
   ```
   Response: `{ "ok": true }`. This writes `.env.local` (creating it if
   absent) and auto-generates `BOOKING_SECRET` if missing.

3. Validate each credential using the test endpoints:

   **LLM proxy (OpenKBS API key):**
   ```bash
   curl -s -X POST http://127.0.0.1:8787/api/setup/test/llm \
     -H 'Content-Type: application/json' \
     -d '{ "apiKey": "<OPENKBS_API_KEY>" }'
   ```

   **Google Calendar (service account + calendar IDs):**
   ```bash
   curl -s -X POST http://127.0.0.1:8787/api/setup/test/google-calendar \
     -H 'Content-Type: application/json' \
     -d '{ "serviceAccountKey": "<base64_key>", "calendarIds": "<comma_separated_ids>" }'
   ```

   **Email (OpenKBS email service):**
   ```bash
   curl -s -X POST http://127.0.0.1:8787/api/setup/test/email \
     -H 'Content-Type: application/json' \
     -d '{ "apiKey": "<OPENKBS_API_KEY>", "to": "<CONTACT_EMAIL>", "from": "<FROM_EMAIL>" }'
   ```

   Each returns `{ "ok": true, "message": "..." }` on success or
   `{ "ok": false, "error": "..." }` on failure. If a test fails, show
   the error to the user, ask them to fix the credential, re-save, and
   re-test.

4. Confirm everything is configured:
   ```bash
   curl -s http://127.0.0.1:8787/api/setup/status | jq .
   ```
   Expected: `{ "configured": true, "missingConfig": [], "missingEnv": [] }`.

5. Tell the user to restart `npm run dev` so the backend picks up the
   new `.env.local` values.

### 6. What NOT to do

- **Don't write `.env.local` by hand** — always use `/api/setup/save`.
  It handles BOOKING_SECRET generation and won't clobber existing values
  with empty strings.
- **Don't commit** anything. Show the diff and let the user review.
- **Don't rewrite `config.json.systemPrompt` wholesale** — it's carefully
  tuned (honest-scope rules, personal-question policy, no-markdown rule).
  If the user asks for tone changes, edit individual strings in
  `guidelines[]` or `persona`, don't rebuild from scratch.

### 7. Verify

```bash
npm install          # installs root + site-src
npm run dev          # starts Hono API on :8787 and Vite on :5173
```

Open http://localhost:5173 — the app should show the owner's name and bio
in the chat. If it still shows "Your Name" placeholders, `config.json` was
not updated correctly — go back to step 3.

Confirm credentials:
```bash
curl -s http://127.0.0.1:8787/api/setup/status | jq .
```
Response should show `"configured": true` with empty `missingConfig` and
`missingEnv` arrays.

## Ongoing development

### Layout

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

### Running locally

- `npm run dev` — starts API (`:8787`) + web (`:5173`) in parallel.
- Local DB lives at `./local/.pgdata/` (PGlite cluster). Safe to `rm -rf`
  to reset.
- Setup API at `http://127.0.0.1:8787/api/setup/*`. Loopback-only. Used by
  the coding agent during first-time setup (see above). Endpoints: `/status`,
  `/values`, `/save`, `/test/llm`, `/test/google-calendar`, `/test/email`.

### Common edits

- **Chat personality** — edit `config.json.systemPrompt.guidelines[]` or
  `persona`. Restart dev server (`_shared/career.mjs` caches the prompt
  on cold start).
- **Starter prompt chips** — `config.json.starterPrompts`.
- **Email copy** — `config.json.emails.*`. Templates are Mustache-lite;
  `{{booking.name}}` interpolates from the booking row.
- **A tool in chat** — tools are defined inside `functions/api-chat/index.mjs`
  with the OpenKBS proxy's OpenAI-compatible tool-call format.

### Things not to do

- Don't commit `.env.local`, `local/.pgdata/`, or `node_modules/`.
- Don't import `pg` directly in functions — use `_shared/db.mjs`. It
  picks between real Postgres (prod) and PGlite (local) based on env.
- Don't add owner-specific strings (the user's name, city, etc.) to
  function or component source. Everything personal lives in
  `config.json` or `assets/career.json`.
- Don't rename functions from `api-*` → anything else. The SPA proxy
  and the deploy scripts both assume the `api-` prefix (it prevents
  route collisions with SPA paths like `/contact`).
