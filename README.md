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
- **Setup wizard** — a `/setup` page (loopback-only) that writes
  `config.json` and `.env.local` for you, with live-test buttons for
  each credential.

## Prerequisites

- **Node.js 20+** and **npm**.
- **Google Cloud project** with:
  - OAuth 2.0 Client ID (web) — for visitor sign-in
  - Service account + JSON key — for Calendar read access
  - Calendar API enabled
- **OpenKBS API key** — for the LLM proxy. Get one at
  [openkbs.com](https://openkbs.com).

The setup wizard has "Test" buttons that verify each of these works
before you save them.

## Quickstart

Two paths — pick whichever you prefer.

### Option A — wizard (forms in a browser)

```bash
git clone <this-repo> my-site && cd my-site
npm install
npm run dev
```

Open http://localhost:5173 — if `config.json` still has placeholders,
you'll be redirected to `/setup`. Fill the form, click each "Test"
button, hit **Save**, and the app reloads with your data.

### Option B — AI-guided (coding agent fills it in)

If you use Claude Code, Cursor, Codex, or another coding agent, drop
your `linkedin.pdf` in the repo root, then:

```bash
git clone <this-repo> my-site && cd my-site
npm install
# Open the repo in your coding agent and say: "set up this project"
```

The agent follows [`AGENTS.md`](./AGENTS.md): parses your PDF, writes
`assets/career.json`, fills non-secret fields in `config.json`. Then you
still run `npm run dev` and visit `/setup` to enter the Google and
OpenKBS credentials (the agent intentionally doesn't touch those).

## Development

```bash
npm run dev
```

Starts two processes:

- **API** on `127.0.0.1:8787` — a Hono server that runs the Lambda
  handlers in-process, backed by an embedded Postgres (PGlite) at
  `./local/.pgdata/`.
- **Web** on `127.0.0.1:5173` — Vite dev server with HMR, proxies
  `/api-*` and `/api/setup` to the API.

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
rm .env.local             # back to a fresh wizard
```

## Layout

```
config.json              Non-secret owner config (personalize here)
.env.local               Secrets — gitignored; wizard writes this
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
local/                   Dev harness (server, PGlite shim, setup backend)
AGENTS.md                Agent-runnable personalization + dev guide
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
