# Personal AI Site — template

An open-source template for a chat-first personal website. Visitors chat
with an AI version of you that can check your calendar, request bookings,
and pass along contact messages. Clone it, personalize it, run it locally.

> **Status — v1 (local-first).** The full template runs end-to-end on
> your laptop: embedded Postgres, in-process Lambda runner, live LLM
> proxy, Google Calendar integration. One-command deploy to OpenKBS is
> planned for v2 — for now this is for exploring, customizing, and
> running locally.

## What you get

- **Chat with tools** — an LLM persona of the site owner, wired to three
  tools: `checkAvailability`, `createBooking`, `sendMessage`.
- **Calendar panel** — free/busy read from the owner's Google Calendar
  via a service account; visitor sign-in (Google Identity Services) to
  request a slot.
- **Two-phase booking** — visitor requests a slot → HMAC-signed
  approve/reject links hit the owner's inbox → confirmation email to the
  visitor on approve.
- **Contact form** — rate-limited, honeypot-protected.
- **Agent-guided setup** — a coding agent reads your LinkedIn PDF or
  resume, fills `config.json` and `assets/career.json`, then saves
  credentials to `.env.local` via the local setup API — with test
  endpoints that validate each credential before saving. Manual setup
  (editing files directly) is also supported.

## Prerequisites

- **Node.js 20+** and **npm**.
- **LLM key** — either an [OpenAI API key](https://platform.openai.com/api-keys)
  (direct) or an [OpenKBS API key](https://openkbs.com) (proxy that covers
  OpenAI + Anthropic + Google under one key).

That's enough to get chat working. Calendar, bookings, and contact form
are **optional** — they activate when you add Google and email credentials
later. See [AGENTS.md](./AGENTS.md) step 8 for details.

## Quickstart

### Recommended — AI-guided (coding agent fills it in)

If you use Claude Code, Cursor, Codex, or another coding agent, drop
your `linkedin.pdf` in the repo root, then:

```bash
git clone <this-repo> my-site && cd my-site
npm install
npm run dev
# Open the repo in your coding agent and say: "set up this project"
```

The agent follows [`SETUP.md`](./SETUP.md): parses your PDF, writes
`assets/career.json`, fills `config.json`, then saves your LLM key to
`.env.local` and validates it via the setup API — all without leaving
the terminal. Calendar and email credentials are optional (step 7).

### Alternative — manual

```bash
git clone <this-repo> my-site && cd my-site
npm install
```

1. Edit `config.json` — fill in `owner.*`, `branding.*`, `social.*`, and
   `starterPrompts`. See `.env.example` for the credential reference.
2. Copy `.env.example` to `.env.local` and fill in each value.
3. Run `npm run dev` and verify with:
   ```bash
   curl -s http://127.0.0.1:8787/api/setup/status | jq .
   ```
   All arrays should be empty and `"configured": true`.
4. Open http://localhost:5173 — chat with the AI to confirm it knows
   who you are.

## Development

```bash
npm run dev
```

Starts two processes:

- **API** on `127.0.0.1:8787` — a Hono server that runs the Lambda
  handlers in-process, backed by an embedded Postgres (PGlite) at
  `./local/.pgdata/`.
- **Web** on `127.0.0.1:5173` — Vite dev server with HMR, proxies
  `/api-*` and `/api/setup` to the API. The `/api/setup` endpoints are
  used during first-time credential setup (see AGENTS.md).

### Common customizations

| What | Where |
|---|---|
| Owner name, title, location, bio | `config.json` → `owner.*` |
| Career data (the AI's "knowledge") | `assets/career.json` |
| Chat personality / tone rules | `config.json` → `systemPrompt.*` |
| Starter prompt chips | `config.json` → `starterPrompts` |
| Email subjects and bodies | `config.json` → `emails.*` |
| Avatar and CV | `assets/avatar.png`, `assets/cv.pdf` |
| Site name, logo text, meta description | `config.json` → `branding.*` |
| Social links | `config.json` → `social.*` |

### Resetting local state

```bash
rm -rf local/.pgdata      # wipes local Postgres (bookings, rate-limits)
rm .env.local             # re-run agent setup or copy .env.example and fill manually
```

## Layout

```
config.json              Non-secret owner config (personalize here)
.env.local               Secrets — gitignored; setup API writes this
.env.example             Reference for .env.local
assets/
  career.json            Structured bio — the chat system prompt reads this
  avatar.png, cv.pdf     Static assets
functions/               Lambda handlers (run locally in-process)
  _shared/               Shared modules: db, auth, emails, career, rate-limit
  api-chat/              LLM chat + 3 tools
  api-availability/      Google Calendar free-busy
  api-bookings/          Create / approve / reject
  api-contact/           Contact form
  api-cleanup/           Cron: prune stale rate-limits + expired bookings
site-src/                React + Vite + Tailwind source
local/                   Dev harness (server, PGlite shim, setup API)
SETUP.md                 First-time setup guide (agents read this once)
AGENTS.md                Ongoing dev guide (agents read this always)
CLAUDE.md                One-line pointer → AGENTS.md
```

## Deployment

Deferred to v2. The production target is [OpenKBS](https://openkbs.com)
— Lambda functions, managed Postgres, SES, S3+CloudFront. Once the
deploy pipeline lands, it'll be `npm run deploy` from a clean clone.

Until then, this is a template for local exploration and for running
the full stack on your own machine.

## License

MIT — see [LICENSE](./LICENSE).
