# First-time setup

Follow these steps in order. Ask one question at a time — do not batch
multiple questions into a single prompt.

Before starting, run `npm install` if `node_modules/` doesn't exist.

---

## Choose your path

Ask:

> **How do you want to run your site?**
>
> **[A] Local** — run on your machine with your own OpenAI key.
>
> **[B] Deploy to OpenKBS** — no LLM key needed, OpenKBS provides one
> with bonus credits. You'll also get access to OpenKBS Studio where
> you can vibe code on your project.

Wait for the user to choose, then show the steps for their path:

**Path A (local):**
> 1. Career data
> 2. Avatar
> 3. LinkedIn
> 4. GitHub
> 5. LLM key

**Path B (deploy):**
> 1. Career data
> 2. Avatar
> 3. LinkedIn
> 4. GitHub
> 5. Deploy

---

## Step 1 — Career data

Ask:

> I need your CV or resume to fill in your profile. Drop a PDF in the
> repo root and tell me the filename.
>
> If you don't have a CV handy, go to your LinkedIn profile and export
> it as PDF, then drop that file here.

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
   - `owner.name`, `owner.firstName`, `owner.nameLocal` (the owner's
     name in their native script, e.g. Cyrillic, Kanji, Arabic — leave
     empty if same as `owner.name`)
   - `owner.title`, `owner.location`, `owner.timezone`, `owner.timezoneLabel`
   - `owner.bioTagline`
   - `branding.siteName` ("Ask {firstName}"), `branding.logoText` (uppercase)
   - `branding.metaDescription` — one SEO sentence
   - `starterPrompts` — 4 prompts tuned to their field (include one booking
     + one message prompt)
Tell the user:

> **Profile filled in. You can always edit `config.json` and
> `assets/career.json` later — or ask your coding agent to do it.**

---

## Step 2 — Avatar

Ask:

> **Do you have an avatar image?** Drop it in the repo root and tell me
> the filename, or skip for now.

If they provide one, copy to `assets/avatar.png` (the build copies it to
`site/assets/` automatically). If they skip, move on.

---

## Step 3 — LinkedIn

Ask:

> **What's your LinkedIn URL?** This will show as a link in your site's
> nav bar. (or skip)

Save to `config.json` → `social.linkedin` (or `null` if skipped).

---

## Step 4 — GitHub

Ask:

> **What's your GitHub URL?** This will show as a link in your site's
> nav bar. (or skip)

Save to `config.json` → `social.github` (or `null` if skipped).

---

## Step 5A — LLM key (local path only)

Skip this step if the user chose path B.

Ask:

> The chat needs an OpenAI API key. You have two options:
>
> **A) Paste it here** — I'll save and test it automatically. Note: the
> key will appear in this conversation's logs.
>
> **B) Add it yourself** — open `.env.local` and add
> `OPENAI_API_KEY=sk-...`, then tell me when it's done.
>
> Which do you prefer?

Wait for the user to choose.

**If option A (paste):**

1. Save as `OPENAI_API_KEY` via the setup API (the user must have `npm run dev` running):
   ```bash
   curl -s -X POST http://127.0.0.1:8787/api/setup/save \
     -H 'Content-Type: application/json' \
     -d '{ "env": { "OPENAI_API_KEY": "<value>" } }'
   ```
2. If the save fails because the server isn't running, tell the user:
   **"Run `npm run dev` in a separate terminal, then tell me when it's
   ready."**
3. Test:
   ```bash
   curl -s -X POST http://127.0.0.1:8787/api/setup/test/llm \
     -H 'Content-Type: application/json' \
     -d '{ "apiKey": "<value>", "provider": "openai" }'
   ```
4. If test fails, show the error and ask the user to check the key.

**If option B (manual):**

1. Wait for the user to confirm they've added the key to `.env.local`.
2. If the server isn't running, tell the user to start it (`npm run dev`).
3. Read the key from `.env.local` and test it using the curl command above.
4. If test fails, show the error. If it passes, continue.

**Do not start `npm run dev` yourself.** Always ask the user to run it
in a separate terminal.

After the key is verified, tell the user:

> **Chat is working! You can now run `npm run dev` and try it out.**
>
> **Want to enable calendar, bookings, and contact form?** These are
> optional — see the "Optional" section below, or ask me anytime later.

Done — setup complete for path A.

---

## Step 5B — Deploy (deploy path only)

Skip this step if the user chose path A.

Tell the user:

> **Profile is ready. Let's deploy your site.**
>
> The deployment uses the OpenKBS CLI. You can read more about it at
> https://openkbs.org/developers/#cli-reference

Run each step and report the result before moving on:

1. Install or update the OpenKBS CLI:
   ```bash
   if command -v openkbs &>/dev/null; then
     openkbs update
   else
     curl -fsSL https://openkbs.com/install.sh | bash
   fi
   ```
   If the CLI is already installed, `openkbs update` refreshes the
   binary and project skill files. Otherwise, `install.sh` downloads a
   single binary to your PATH — no sudo, no system changes.
2. Authenticate:
   ```bash
   openkbs login
   ```
3. Load the OpenKBS skill:
   ```bash
   openkbs init
   ```
4. Build the frontend:
   ```bash
   npm run build
   ```
5. Deploy everything (builds frontend, bundles functions, deploys):
   ```bash
   npm run deploy
   ```

If any step fails, show the error and help debug before continuing.

After deploy succeeds, tell the user:

> **Your site is live! Chat is working.**
>
> **Want to enable calendar, bookings, and contact form?** These are
> optional — see the "Optional" section below, or ask me anytime later.

Done — setup complete for path B.

---

## Optional — Calendar, bookings, and email

These features require Google credentials. Set them up now or anytime
later — just ask your coding agent.

The user must have `npm run dev` running for the setup API. If the
server isn't running, tell the user: **"Run `npm run dev` in a separate
terminal, then tell me when it's ready."**

**a.** Ask:
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

**b.** Ask:
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

**c.** Ask:
> Which calendar(s) should I read for availability? (comma-separated email
> addresses, e.g. `you@gmail.com`)

Save as `GOOGLE_CALENDAR_IDS`.

**d.** Ask:
> Which calendar should booking events be written to? (usually the same as
> above)

Save as `GOOGLE_CALENDAR_WRITE_ID`.

**e.** Ask:
> What email should contact form messages go to?

Save as `CONTACT_EMAIL`.

**f.** Save all at once:
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

**g.** Test Google Calendar:
```bash
curl -s -X POST http://127.0.0.1:8787/api/setup/test/google-calendar \
  -H 'Content-Type: application/json' \
  -d '{ "serviceAccountKey": "<base64_key>", "calendarIds": "<ids>" }'
```

If the test fails, show the error and help debug. Common issues:
- Calendar API not enabled in Google Cloud Console
- Service account not shared on the calendar
- Wrong calendar ID

After all credentials are saved and tested:

> **Calendar, bookings, and contact form are now enabled!**

---

## Rules for the agent

- Show which step you're on (e.g. "**Step 1 of 5 — Career data**")
  when moving to the next step.
- Ask one question at a time. Wait for the answer before moving on.
- Never invent data — only use what the user provides.
- Never commit or push. Don't suggest committing, don't mention
  uncommitted changes, don't offer to commit. The user handles git.
- Never write `.env.local` by hand — always use `/api/setup/save`.
- Don't rewrite `config.json.systemPrompt` unless the user asks.
  The defaults are carefully tuned.
- Don't start `npm run dev` yourself. Ask the user to run it in a
  separate terminal.
