# Shared helpers

Modules here are copied into each function bundle at deploy time.

Contents:

- `config.mjs` — loads `config.json` (owner identity, branding, social, prompts)
- `db.mjs` — pool factory; `pg.Pool` in prod, PGlite shim for `npm run dev`
- `auth.mjs` — Google JWKS verify for Bearer id_token
- `google-calendar.mjs` — service-account freebusy + event create
- `availability.mjs` — 7-day slot generator driven by `owner.timezone` + `owner.workingHours`
- `bookings.mjs` — bookings CRUD via `db.mjs`
- `booking-token.mjs` — HMAC approve/reject
- `emails.mjs` — email templates via OpenKBS email service
- `career.mjs` — career data + `buildSystemPrompt()`
- `rate-limit.mjs` — per-visitor rate limiting via `db.mjs`
