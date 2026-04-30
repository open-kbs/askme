# Personal AI Site

A template for building a chat-first professional portfolio. Instead of reading a static resume, visitors chat with an AI version of you — it answers questions about your career, checks your Google Calendar availability, books calls (with a two-phase approve/reject flow), and takes messages through a contact form. All features are optional and can be toggled independently.

> **⚠️ Cost warning:** The AI chat makes real LLM API calls (OpenAI or via the OpenKBS proxy). Each conversation costs tokens. Monitor your usage and set billing limits on your provider account.

## Prerequisites

- **Node.js 24+** (LTS recommended)
- **npm 10+**
- An **OpenAI API key** or an [OpenKBS](https://openkbs.com) account (includes proxy credits)
- _(Optional)_ Google Cloud project with OAuth 2.0 Client ID + Service Account for calendar/booking features

## Quick start

```bash
git clone https://github.com/open-kbs/askme.git my-site
cd my-site
npm install
```

### Agent-assisted setup (recommended)

Open the repo in a coding agent (Claude Code, Cursor, Codex) and say **"set up this project"**. The agent reads `SETUP.md` and walks you through profile, avatar, LLM key, and optional Google credentials — one question at a time.

### Manual setup

1. Copy `.env.example` to `.env.local` and fill in your keys.
2. Edit `config.json` with your name, title, timezone, and branding.
3. Edit `assets/career.json` with your experience, skills, and projects.
4. (Optional) Place an avatar image at `assets/avatar.png`.

Then start the dev server:

```bash
npm run dev
```

This starts two processes:
- **API server** at `http://localhost:8787` (Hono + PGlite for local Postgres)
- **Frontend** at `http://localhost:5173` (Vite + React)

## Project structure

```
config.json              # Owner profile, feature flags, system prompt, email templates
.env.local               # Secrets (gitignored)
assets/
  career.json            # Structured career data (fed into AI system prompt)
  avatar.png             # Profile photo
functions/
  api/                   # Main Lambda — chat, bookings, calendar, contact
  api-cleanup/           # Hourly cron — cleans expired rate-limit rows
  _shared/               # Shared modules (db, auth, emails, availability, …)
site-src/                # Vite + React + Tailwind frontend
local/
  server.mjs             # Local dev server (Hono, PGlite)
  setup.mjs              # First-time setup API (loopback only)
scripts/
  bundle-functions.sh    # Pre-deploy: copies _shared + config into each function
```

## API

All requests go to `POST /api` with a JSON body. The `action` field selects the endpoint.

### `chat` — AI conversation

```json
{
  "action": "chat",
  "messages": [
    { "role": "user", "content": "Tell me about your work" }
  ]
}
```

Returns `{ "text": "...", "toolParts": [...] }`. The AI can call tools during the conversation:

| Tool | Description |
|------|-------------|
| `checkAvailability` | Returns 7 days of 30-min free/busy slots |
| `createBooking` | Creates a pending booking request |
| `sendMessage` | Sends a contact message to the site owner |

### `get-availability` — calendar slots

Requires `Authorization: Bearer <google-id-token>`.

```json
{ "action": "get-availability" }
```

Returns `{ "days": [{ "date": "01-05-2026", "dayOfWeek": "Fri", "slots": [...] }] }`.

### `create-booking` — book a call

Requires `Authorization: Bearer <google-id-token>`.

```json
{
  "action": "create-booking",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "date": "01-05-2026",
  "startTime": "14:00",
  "duration": 30
}
```

### `send-contact` — contact form

```json
{
  "action": "send-contact",
  "name": "John Smith",
  "email": "john@example.com",
  "message": "I'd like to work together."
}
```

## Configuration

### `config.json`

| Section | What it controls |
|---------|-----------------|
| `features` | Toggle `calendar`, `bookings`, `contactForm` independently |
| `owner` | Name, title, location, timezone, working hours |
| `branding` | Site name, logo text, meta description, avatar/CV URLs |
| `social` | LinkedIn, GitHub, Twitter, website links in nav |
| `starterPrompts` | Quick-action buttons shown in empty chat |
| `systemPrompt` | AI persona, guidelines, scope rules |
| `emails` | Mustache-lite templates for booking and contact emails |

### `.env.local`

See `.env.example` for all supported variables. Key ones:

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | One of these | Direct OpenAI access |
| `OPENKBS_API_KEY` | One of these | OpenKBS proxy (multi-vendor) |
| `GOOGLE_OAUTH_CLIENT_ID` | For calendar | Google OAuth client ID |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | For calendar | Base64-encoded service account JSON |
| `GOOGLE_CALENDAR_IDS` | For calendar | Comma-separated calendar emails |
| `BOOKING_SECRET` | For bookings | HMAC key for approve/reject links |

## Deploying to OpenKBS

```bash
npm run deploy
```

This builds the frontend, bundles shared modules into each function, and deploys via the OpenKBS CLI. See `openkbs.json` for the deployment configuration.

## Troubleshooting

**Chat returns an error about the API key**
Check that `.env.local` has either `OPENAI_API_KEY` or `OPENKBS_API_KEY` set. Restart the dev server after changing env vars.

**Google sign-in button doesn't appear**
Ensure `GOOGLE_OAUTH_CLIENT_ID` is set. In Google Cloud Console, verify that `http://localhost:5173` (no trailing slash, `http` not `https`) is listed under "Authorized JavaScript origins". If your OAuth consent screen is in "Testing" mode, your Google account must be listed as a test user.

**Calendar shows no availability**
The service account must be shared on the target Google Calendar (Calendar Settings → Share → add the service account email with "See all event details"). Also verify the Google Calendar API is enabled in your Cloud Console project.

**Booking approval link says "expired"**
Approval links expire after 7 days. The booking must also still be in `pending` status.

**`npm run dev` fails on first run**
Run `npm install` first — `postinstall` also installs `site-src` dependencies.

## Roadmap

- [x] AI chat with career-aware system prompt
- [x] Google Calendar availability + booking flow
- [x] Two-phase booking approval via email
- [x] Contact form with rate limiting
- [x] Dark/light theme
- [x] Local dev with PGlite (zero external dependencies)
- [ ] Custom themes and color schemes
- [ ] Multi-language support
- [ ] Analytics dashboard for site owners

## License

MIT — see [LICENSE](./LICENSE).
