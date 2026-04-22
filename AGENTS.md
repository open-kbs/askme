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

### 5. What NOT to do

- **Don't touch `.env.local`.** It holds secrets (Google service account key,
  OAuth client ID, OpenKBS API key). You can't know these. Tell the user to
  run `npm run dev` and open the setup wizard at the `/setup` URL — the
  wizard has live-test buttons for each credential.
- **Don't commit** anything. Show the diff and let the user review.
- **Don't rewrite `config.json.systemPrompt` wholesale** — it's carefully
  tuned (honest-scope rules, personal-question policy, no-markdown rule).
  If the user asks for tone changes, edit individual strings in
  `guidelines[]` or `persona`, don't rebuild from scratch.

### 6. Verify

```bash
npm install          # installs root + site-src
npm run dev          # starts Hono API on :8787 and Vite on :5173
```

Open http://localhost:5173 — the app should load without redirecting to
`/setup`. Chat with the AI and check it introduces itself as the owner.

Then tell the user to open `/setup` to fill in the Google / OpenKBS
credentials.

## Ongoing development

### Layout

```
config.json              # Non-secret owner config (personalize here)
.env.local               # Secrets — gitignored, wizard writes this
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
  setup.mjs              # /api/setup/* backend (loopback-only)
```

### Running locally

- `npm run dev` — starts API (`:8787`) + web (`:5173`) in parallel.
- Local DB lives at `./local/.pgdata/` (PGlite cluster). Safe to `rm -rf`
  to reset.
- Setup wizard at http://localhost:5173/setup. Only reachable from the
  loopback interface.

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
