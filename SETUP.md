# First-time setup

Follow these steps in order. Ask one question at a time — do not batch
multiple questions into a single prompt.

Before starting, run `npm install` if `node_modules/` doesn't exist.

---

## Step 1 — Choose your path

Ask:

> **How do you want to run your site?**
>
> **A) Local only** — run on your machine with your own OpenAI key.
> Chat works immediately. Calendar, sign-in, and email require
> deployment later.
>
> **B) Deploy to OpenKBS** — I'll collect everything needed for
> production (Google Calendar, email). No LLM key needed — OpenKBS
> provides one with bonus credits.

Wait for the user to choose, then show the steps for their path:

**Path A (local):**
> 1. Career data  2. Avatar & links  3. LLM key  4. Done

**Path B (deploy):**
> 1. Career data  2. Avatar & links  3. Google Calendar & email  4. Deploy  5. Done

After setup, this file is no longer needed — see
[AGENTS.md](./AGENTS.md) for ongoing development guidance.

---

## Step 2 — Career data

Ask:

> Drop your LinkedIn PDF in the repo root (or paste your resume/bio here)
> and I'll fill in your profile.

Wait for the user to provide source material. Accept any of:
- A LinkedIn PDF at `./linkedin.pdf`, `./Profile.pdf`, or `./tmp/*.pdf`
- Pasted text (bio, resume, role list)

Then:

1. Read `assets/career.json` to see the schema.
2. Write `assets/career.json` from the source material:
   - `summary` — 2–4 sentences, first person, how the AI introduces them.
   - `experience[]` — most recent first. `highlights` optional.
   - `skills` — only skills they'd claim in an interview.
   - `sideProjects[]` — only real, publicly known projects.
   - `conditionalFacts[]` — leave empty unless user explicitly asks.
3. Fill `config.json` fields:
   - `owner.name`, `owner.firstName`, `owner.nameLocal` (empty if N/A)
   - `owner.title`, `owner.location`, `owner.timezone`, `owner.timezoneLabel`
   - `owner.bioTagline`
   - `branding.siteName` ("Ask {firstName}"), `branding.logoText` (uppercase)
   - `branding.metaDescription` — one SEO sentence
   - `social.*` — URLs from source material, or null
   - `starterPrompts` — 4 prompts tuned to their field (include one booking
     + one message prompt)
4. If the user provided an avatar, copy to `assets/avatar.png`.

Show the diff and ask: **"Does this look right? Also, do you have an
avatar image you'd like to use? (drop it in the repo root or skip for
now)"**

If they provide one, copy to `assets/avatar.png`. If they skip, move on.

Then ask:

> **What are your LinkedIn and GitHub URLs?** (paste both, or skip if
> you don't want them in the nav)

Save to `config.json` → `social.linkedin` and `social.github` (or `null`
if skipped).

Do not proceed until the user confirms the profile data.

---

## Step 3A — LLM key (local path only)

Skip this step if the user chose path B.

Ask:

> The chat needs an LLM key. You have two options:
>
> **A) Paste it here** — I'll save and test it automatically. Note: the
> key will appear in this conversation's logs.
>
> **B) Add it yourself** — open `.env.local` and add
> `OPENAI_API_KEY=sk-...` or `OPENKBS_API_KEY=...`, then tell me when
> it's done.
>
> Which do you prefer?

Wait for the user to choose.

**If option A (paste):**

1. Detect the type: starts with `sk-` → `OPENAI_API_KEY`, otherwise →
   `OPENKBS_API_KEY`.
2. Save via the setup API (the user must have `npm run dev` running):
   ```bash
   curl -s -X POST http://127.0.0.1:8787/api/setup/save \
     -H 'Content-Type: application/json' \
     -d '{ "env": { "<KEY_NAME>": "<value>" } }'
   ```
3. If the save fails because the server isn't running, tell the user:
   **"Run `npm run dev` in a separate terminal, then tell me when it's
   ready."**
4. Test:
   ```bash
   curl -s -X POST http://127.0.0.1:8787/api/setup/test/llm \
     -H 'Content-Type: application/json' \
     -d '{ "apiKey": "<value>", "provider": "openai" }'
   ```
   Omit `"provider"` for OpenKBS keys.
5. If test fails, show the error and ask the user to check the key.

**If option B (manual):**

1. Wait for the user to confirm they've added the key to `.env.local`.
2. If the server isn't running, tell the user to start it (`npm run dev`).
3. Read the key from `.env.local` and test it using the curl command above.
4. If test fails, show the error. If it passes, continue.

**Do not start `npm run dev` yourself.** Always ask the user to run it
in a separate terminal.

After the key is verified, tell the user:

> **Chat is working! Calendar, sign-in, and email notifications require
> deployment to OpenKBS — you can set that up later.**

Done — setup complete for path A.

---

## Step 3B — Google Calendar and email (deploy path only)

Skip this step if the user chose path A.

Ask for each credential one at a time. The user must have `npm run dev`
running for the setup API. If the server isn't running, tell the user:
**"Run `npm run dev` in a separate terminal, then tell me when it's ready."**

**3B-a.** Ask:
> Paste your Google OAuth Client ID (looks like `...apps.googleusercontent.com`).

Save it as `GOOGLE_OAUTH_CLIENT_ID`.

After saving, tell the user to check these three things in
[Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials):

1. **Authorized JavaScript origins** — the OAuth Client ID must include
   `http://localhost:5173` (no trailing slash, `http` not `https`, port
   must match).
2. **OAuth consent screen → Test users** — if publishing status is
   "Testing", the Google account they sign in with must be listed under
   test users.
3. **Same project** — the OAuth Client ID and consent screen must be in
   the same Google Cloud project.

**3B-b.** Ask:
> I need your Google service account JSON key. Two options:
>
> **A) Drop the JSON file in the repo root** (e.g. `service-account.json`)
> and tell me the filename — I'll read and base64-encode it. The key
> stays out of the chat logs.
>
> **B) Paste the JSON here** — I'll base64-encode it, but it will appear
> in this conversation's logs.

If they give a file path, read it. If they paste raw JSON, use it directly.
Either way, base64-encode the JSON and save as `GOOGLE_SERVICE_ACCOUNT_KEY`.

**3B-c.** Ask:
> Which calendar(s) should I read for availability? (comma-separated email
> addresses, e.g. `you@gmail.com`)

Save as `GOOGLE_CALENDAR_IDS`.

**3B-d.** Ask:
> Which calendar should booking events be written to? (usually the same as
> above)

Save as `GOOGLE_CALENDAR_WRITE_ID`.

**3B-e.** Ask:
> What email should contact form messages go to?

Save as `CONTACT_EMAIL`.

**3B-f.** Save all at once:
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

**3B-g.** Test Google Calendar:
```bash
curl -s -X POST http://127.0.0.1:8787/api/setup/test/google-calendar \
  -H 'Content-Type: application/json' \
  -d '{ "serviceAccountKey": "<base64_key>", "calendarIds": "<ids>" }'
```

If the test fails, show the error and help debug. Common issues:
- Calendar API not enabled in Google Cloud Console
- Service account not shared on the calendar
- Wrong calendar ID

**3B-h.** Deploy to OpenKBS.

Tell the user:

> **Credentials are saved. Let's deploy your site.**

Run each step and report the result before moving on:

1. Install the OpenKBS CLI (if `openkbs` isn't on PATH):
   ```bash
   curl -fsSL https://openkbs.com/install.sh | bash
   ```
2. Authenticate:
   ```bash
   openkbs login
   ```
3. Build the frontend:
   ```bash
   npm run build
   ```
4. Deploy elastic services (Postgres, Storage):
   ```bash
   openkbs deploy
   ```
5. Deploy the static site:
   ```bash
   openkbs site deploy
   ```
6. Deploy each function:
   ```bash
   openkbs fn deploy api-chat
   openkbs fn deploy api-availability
   openkbs fn deploy api-bookings
   openkbs fn deploy api-contact
   openkbs fn deploy api-cleanup
   ```

If any step fails, show the error and help debug before continuing.

After all deploys succeed, tell the user:

> **Your site is live! All functions and the frontend are deployed.**

Done — setup complete for path B.

---

## Rules for the agent

- Show which step you're on (e.g. "**Step 2 of 4 — Career data**" for
  path A, or "**Step 2 of 5 — Career data**" for path B) when moving to
  the next step.
- Ask one question at a time. Wait for the answer before moving on.
- Never invent data — only use what the user provides.
- Never commit. Show diffs and let the user review.
- Never write `.env.local` by hand — always use `/api/setup/save`.
- Don't rewrite `config.json.systemPrompt` unless the user asks.
  The defaults are carefully tuned.
- Don't start `npm run dev` yourself. Ask the user to run it in a
  separate terminal.
