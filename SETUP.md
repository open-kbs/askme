# First-time setup

Follow these steps in order. Ask one question at a time — do not batch
multiple questions into a single prompt.

After setup, this file is no longer needed — see
[AGENTS.md](./AGENTS.md) for ongoing development guidance.

---

## Step 1 — Career data

Ask:

> Drop your LinkedIn PDF in the repo root (or paste your resume/bio here)
> and I'll fill in your profile.

Wait for the user to provide source material. Accept any of:
- A LinkedIn PDF at `./linkedin.pdf`, `./Profile.pdf`, or `./tmp/*.pdf`
- Pasted text (bio, resume, role list)
- A GitHub username + short blurb

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
   If not, tell them they can add one later.

Show the diff and ask: **"Does this look right?"**

Do not proceed until the user confirms.

---

## Step 2 — LLM key

Ask:

> Paste your OpenAI API key (starts with `sk-`) or OpenKBS API key so I
> can connect the chat.

Wait for the key. Then:

1. Detect the type: starts with `sk-` → `OPENAI_API_KEY`, otherwise →
   `OPENKBS_API_KEY`.
2. Make sure `npm run dev` is running. If not, start it.
3. Save:
   ```bash
   curl -s -X POST http://127.0.0.1:8787/api/setup/save \
     -H 'Content-Type: application/json' \
     -d '{ "env": { "<KEY_NAME>": "<value>" } }'
   ```
4. Test:
   ```bash
   curl -s -X POST http://127.0.0.1:8787/api/setup/test/llm \
     -H 'Content-Type: application/json' \
     -d '{ "apiKey": "<value>", "provider": "openai" }'
   ```
   Omit `"provider"` for OpenKBS keys.
5. If test fails, show the error and ask the user to check the key.
6. If test passes, tell the user to restart `npm run dev`.

---

## Step 3 — Verify

Open http://localhost:5173 and confirm:
- The site shows the owner's name (not "Your Name")
- Chat responds as the owner

Tell the user: **"Chat is working. Calendar and email are optional — want
to set them up now or later?"**

If **later** or **skip** → done. If **now** → continue to step 4.

---

## Step 4 — Google Calendar and email (optional)

Only reach this step if the user said "now" in step 3. Ask for each
credential one at a time:

**4a.** Ask:
> Paste your Google OAuth Client ID (looks like `...apps.googleusercontent.com`).

Save it as `GOOGLE_OAUTH_CLIENT_ID`.

**4b.** Ask:
> Paste your Google service account JSON key (or the file path). I'll
> base64-encode it.

If they paste raw JSON, base64-encode it. Save as `GOOGLE_SERVICE_ACCOUNT_KEY`.

**4c.** Ask:
> Which calendar(s) should I read for availability? (comma-separated email
> addresses, e.g. `you@gmail.com`)

Save as `GOOGLE_CALENDAR_IDS`.

**4d.** Ask:
> Which calendar should booking events be written to? (usually the same as
> above)

Save as `GOOGLE_CALENDAR_WRITE_ID`.

**4e.** Ask:
> What email should contact form messages go to?

Save as `CONTACT_EMAIL`.

**4f.** Save all at once:
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

**4g.** Test Google Calendar:
```bash
curl -s -X POST http://127.0.0.1:8787/api/setup/test/google-calendar \
  -H 'Content-Type: application/json' \
  -d '{ "serviceAccountKey": "<base64_key>", "calendarIds": "<ids>" }'
```

If the test fails, show the error and help debug. Common issues:
- Calendar API not enabled in Google Cloud Console
- Service account not shared on the calendar
- Wrong calendar ID

**4h.** Tell the user to restart `npm run dev`. Done.

---

## Rules for the agent

- Ask one question at a time. Wait for the answer before moving on.
- Never invent data — only use what the user provides.
- Never commit. Show diffs and let the user review.
- Never write `.env.local` by hand — always use `/api/setup/save`.
- Don't rewrite `config.json.systemPrompt` unless the user asks.
  The defaults are carefully tuned.
