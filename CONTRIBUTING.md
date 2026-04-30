# Contributing

Thanks for your interest in contributing! This guide covers the basics.

## Development Setup

```bash
git clone https://github.com/open-kbs/askme.git
cd personal-ai-site
npm install
```

Copy `.env.example` to `.env.local` and add at least an `OPENAI_API_KEY` or `OPENKBS_API_KEY`. Then:

```bash
npm run dev
```

This starts the API server (`:8787`) and the Vite dev server (`:5173`) in parallel. The local API uses PGlite (embedded Postgres), so no external database is needed.

## Project Layout

- `functions/api/` — main Lambda handler (chat, bookings, calendar, contact)
- `functions/api-cleanup/` — scheduled cleanup cron
- `functions/_shared/` — shared modules imported by all functions
- `site-src/` — React + Vite + Tailwind frontend
- `local/` — local dev server and PGlite shim
- `config.json` — owner configuration (features, branding, system prompt)

## Available Commands

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start API + frontend dev servers |
| `npm run build` | Typecheck + build frontend |
| `npm run deploy` | Build, bundle functions, deploy to OpenKBS |

There is no linter or test suite configured yet. Contributions to add these are welcome.

## Making Changes

1. Fork the repo and create a branch from `main`.
2. Make your changes.
3. Run `npm run build` to verify the frontend typechecks and builds.
4. Commit using [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` — new feature
   - `fix:` — bug fix
   - `docs:` — documentation
   - `style:` — visual/UI changes
   - `refactor:` — code restructure without behavior change
   - `chore:` — maintenance, tooling, dependencies
5. Open a pull request against `main`.

## PR Guidelines

- Keep PRs focused — one feature or fix per PR.
- Describe what changed and why in the PR description.
- Ensure `npm run build` passes.
- No secrets in the diff (API keys, tokens, credentials).
- Don't add owner-specific strings (names, cities, etc.) to source code — those belong in `config.json` or `assets/career.json`.

## Project Scope

### In scope

- Chat experience and AI tool integrations
- Calendar, booking, and contact form features
- Frontend UI/UX improvements
- Local dev experience
- Documentation

### Out of scope

- Features tied to a specific individual's profile (this is a template)
- Integrations with providers other than Google Calendar (for now)
- Major architectural rewrites without prior discussion — open an issue first

## Questions?

Open an issue or start a discussion. We're happy to help.
