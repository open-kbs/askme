# First-time setup

Walk through these steps to turn the placeholder template into the
owner's personal site. After setup, this file is no longer needed —
see [AGENTS.md](./AGENTS.md) for ongoing development guidance.

## 1. Gather source material

Ask the user for whichever they have:

- A LinkedIn PDF export (usually `linkedin.pdf` or `Profile.pdf` in the repo
  root, or in `./tmp/`)
- A resume / CV
- A GitHub username
- A short bio paragraph

Prefer a LinkedIn PDF — it has the richest structured data. If none is
available, ask the user to paste a bio and list their roles + skills.

## 2. Write `assets/career.json`

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

## 3. Fill `config.json`

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

## 4. Avatar and CV

- If the user provides an avatar, copy it to `assets/avatar.png`
  (square, ≥256×256). Otherwise leave the placeholder and tell the user
  to drop one in.
- Same for CV at `assets/cv.pdf`. It's optional — the nav's "Download CV"
  link hides if the file is missing.

## 5. Set up the LLM key (required)

The chat needs exactly one LLM key. Ask the user which they have:

- `OPENAI_API_KEY` — from [platform.openai.com/api-keys](https://platform.openai.com/api-keys). Talks to OpenAI directly. Most developers already have one.
- `OPENKBS_API_KEY` — from [openkbs.com](https://openkbs.com). Routes through the OpenKBS proxy (one key for OpenAI + Anthropic + Google).

**Prerequisite:** `npm run dev` must be running (the setup API lives in the
local server).

Save the key:
```bash
curl -s -X POST http://127.0.0.1:8787/api/setup/save \
  -H 'Content-Type: application/json' \
  -d '{ "env": { "OPENAI_API_KEY": "sk-..." } }'
```
(Substitute `OPENKBS_API_KEY` if they gave an OpenKBS key instead.)

Test it (pass `"provider": "openai"` for an OpenAI key, omit for OpenKBS):
```bash
curl -s -X POST http://127.0.0.1:8787/api/setup/test/llm \
  -H 'Content-Type: application/json' \
  -d '{ "apiKey": "sk-...", "provider": "openai" }'
```

Expected: `{ "ok": true }`. If it fails, show the error and ask the user
to check the key.

Confirm setup status:
```bash
curl -s http://127.0.0.1:8787/api/setup/status | jq .
```
Expected: `{ "configured": true, ... }` once the LLM key is saved and
`config.json` placeholders are filled.

Tell the user to restart `npm run dev` so the chat handler picks up the
new key, then open http://localhost:5173 and test the chat.

**That's it for the essential setup.** Chat works now. Calendar, bookings,
and contact form are optional — see step 7 below.

## 6. Verify

```bash
npm install          # installs root + site-src
npm run dev          # starts Hono API on :8787 and Vite on :5173
```

Open http://localhost:5173 — the app should show the owner's name and bio
in the chat. If it still shows "Your Name" placeholders, `config.json` was
not updated correctly — go back to step 3.

Chat should work. Calendar and contact form will show "not configured"
messages until Google/email credentials are added (step 7).

## 7. Optional — connect Google Calendar and email

These features activate when you add the remaining credentials. Ask the
user if they want to set them up now or later. If later, skip this step.

**Credentials to collect:**
- `GOOGLE_OAUTH_CLIENT_ID` — Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID (web type)
- `GOOGLE_SERVICE_ACCOUNT_KEY` — base64-encoded JSON key for a service account with Calendar API access
- `GOOGLE_CALENDAR_IDS` — comma-separated calendar email addresses to read
- `GOOGLE_CALENDAR_WRITE_ID` — the calendar to write booking events to
- `APP_URL` — the public site URL (use `http://localhost:5173` for local dev)
- `CONTACT_EMAIL` — where contact form messages go (owner's email)
- `FROM_EMAIL` — verified sender address for outgoing email (optional — defaults to OpenKBS sender)

Do NOT ask for `BOOKING_SECRET` — the API auto-generates it.

Save all at once:
```bash
curl -s -X POST http://127.0.0.1:8787/api/setup/save \
  -H 'Content-Type: application/json' \
  -d '{
    "env": {
      "GOOGLE_OAUTH_CLIENT_ID": "...",
      "GOOGLE_SERVICE_ACCOUNT_KEY": "...",
      "GOOGLE_CALENDAR_IDS": "...",
      "GOOGLE_CALENDAR_WRITE_ID": "...",
      "APP_URL": "http://localhost:5173",
      "CONTACT_EMAIL": "..."
    }
  }'
```

Test each:

**Google Calendar:**
```bash
curl -s -X POST http://127.0.0.1:8787/api/setup/test/google-calendar \
  -H 'Content-Type: application/json' \
  -d '{ "serviceAccountKey": "<base64_key>", "calendarIds": "<ids>" }'
```

**Email (requires OPENKBS_API_KEY — OpenAI keys don't cover email):**
```bash
curl -s -X POST http://127.0.0.1:8787/api/setup/test/email \
  -H 'Content-Type: application/json' \
  -d '{ "apiKey": "<OPENKBS_API_KEY>", "to": "<CONTACT_EMAIL>", "from": "<FROM_EMAIL>" }'
```

Restart `npm run dev` after saving.

## What NOT to do

- **Don't write `.env.local` by hand** — always use `/api/setup/save`.
  It handles BOOKING_SECRET generation and won't clobber existing values
  with empty strings.
- **Don't commit** anything. Show the diff and let the user review.
- **Don't rewrite `config.json.systemPrompt` wholesale** — it's carefully
  tuned (honest-scope rules, personal-question policy, no-markdown rule).
  If the user asks for tone changes, edit individual strings in
  `guidelines[]` or `persona`, don't rebuild from scratch.
