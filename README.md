# Personal AI Site — template

An open-source template for a chat-first personal website. Visitors chat
with an AI version of you that can check your calendar, request bookings,
and pass along contact messages.

Run it locally, deploy it wherever you want, or use
[OpenKBS](https://openkbs.com) for managed hosting (Lambda, Postgres,
CDN). If you choose OpenKBS, your coding agent will pull the
[OpenKBS CLI](https://openkbs.org) during setup and handle the
deployment for you.

## What you get

- **Chat with tools** — an LLM persona of you, wired to three tools:
  `checkAvailability`, `createBooking`, `sendMessage`.
- **Calendar panel** — free/busy from your Google Calendar; visitor
  sign-in to request a slot.
- **Two-phase booking** — visitor requests → approve/reject links in
  your inbox → confirmation email on approve.
- **Contact form** — rate-limited, honeypot-protected.

## Getting started

You need **Node.js 20+** and a coding agent (Claude Code, Cursor, Codex,
or similar).

```bash
git clone <this-repo> my-site && cd my-site
```

Open the repo in your coding agent and say **"set up this project"**.

The agent reads [`SETUP.md`](./SETUP.md) and walks you through
everything: career data, avatar, credentials, and optionally deployment
to [OpenKBS](https://openkbs.com). You answer questions — the agent does
the rest.

## Two paths

| | Local only | Deploy to OpenKBS |
|---|---|---|
| Chat | Your own OpenAI key | OpenKBS provides one (bonus credits) |
| Calendar, email, sign-in | Requires deployment | Fully configured |
| Hosting | Your machine | OpenKBS (Lambda, Postgres, CDN) |
| Vibe coding | Your coding agent | OpenKBS Studio + your coding agent |

The agent asks which path you want at the start of setup.

## Layout

```
config.json              Non-secret owner config
.env.local               Secrets — gitignored; setup API writes this
assets/
  career.json            Structured bio — chat system prompt reads this
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
SETUP.md                 First-time setup (agents read this once)
AGENTS.md                Ongoing dev guide (agents read this always)
```

## License

MIT — see [LICENSE](./LICENSE).
