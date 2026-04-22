# Shared helpers

Modules here are ported from `ask-ivo-temp/ask-ivo/src/lib/` and copied into each function bundle at deploy time (see the port plan).

Planned files:

- `auth.mjs` — Google JWKS verify for Bearer id_token (card 1YP1hQMT)
- `google-calendar.mjs` — service-account freebusy + event create (card l1JlwGIw)
- `availability.mjs` — 7-day slot generator, Europe/Sofia, 9-21 (card l1JlwGIw)
- `bookings.mjs` — Postgres CRUD for bookings (card r5FHAwpo)
- `booking-token.mjs` — HMAC approve/reject (card r5FHAwpo)
- `emails.mjs` — 4 email templates via OpenKBS email service (card Sxj3nlpS)
- `career.mjs` — owner data + `buildSystemPrompt()` (card F2xY3M2k)
