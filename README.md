# ask-ivo (OpenKBS port)

Personal AI chatbot site — "Ask Ivo". Ported 1:1 from the Next.js / Vercel
original (kept for reference at `ask-ivo-temp/ask-ivo/`) onto OpenKBS
infrastructure: Lambda functions, Neon Postgres, S3 + CloudFront, OpenKBS
email service, OpenKBS AI proxy.

Live: https://d17hv7k5p5gs44.cloudfront.net

## Layout

```
./openkbs.json        project config (postgres, storage, email, functions)
./site-src/           React + Vite + TS + Tailwind source
./site/               Vite build output (deployed to S3 + CloudFront)
./functions/
  _shared/            shared helpers copied into each bundle at deploy time
  chat/               POST /chat           AI chat + 3 tools (non-streaming)
  availability/       GET  /availability   Google freebusy, Bearer id_token
  bookings/           POST /bookings       create (Bearer)
                      GET  /bookings?action=approve|reject  HMAC, HTML
  contact/            POST /contact        email to owner
./scripts/deploy-fn.sh          zip+deploy helper (copies _shared, bundles .env)
```

## Deploy

```bash
openkbs deploy                   # Postgres, storage, email
bash scripts/deploy-fn.sh chat
bash scripts/deploy-fn.sh availability
bash scripts/deploy-fn.sh bookings
bash scripts/deploy-fn.sh contact
cd site-src && npm run build && cd ..
openkbs site deploy
```

`scripts/deploy-fn.sh` copies `functions/_shared/` into the target function
and renders `.env.local` into `_env.mjs` (OpenKBS has no custom-env mechanism
yet, so secrets are bundled).

## Env (`.env.local` at repo root)

- `GOOGLE_SERVICE_ACCOUNT_KEY`  base64-encoded service account JSON
- `GOOGLE_CALENDAR_IDS`         comma-separated calendar IDs
- `GOOGLE_OAUTH_CLIENT_ID`      GIS client id (frontend bake + server verify)
- `BOOKING_SECRET`              HMAC for approve/reject links
- `APP_URL`                     absolute site URL (used in emails)
- `CONTACT_EMAIL`               where booking + contact emails land
- `FROM_EMAIL`                  verified sender for OpenKBS email service

`OPENKBS_API_KEY`, `OPENKBS_PROJECT_ID`, `DATABASE_URL` are injected by the
platform.

Frontend also needs `VITE_GOOGLE_CLIENT_ID` (same value as
`GOOGLE_OAUTH_CLIENT_ID`) in `site-src/.env.local` — baked into the Vite
bundle at build time.

## Differences vs the Next.js original

1. **No streaming chat.** Lambda can't stream a response body; chat uses a
   single JSON round-trip (`{ text, toolParts }`). UX: typing-dot, then
   full response.
2. **No NextAuth.** Visitor sign-in uses Google Identity Services in the
   browser; `id_token` is sent as `Authorization: Bearer <token>` to
   protected endpoints. Server verifies against Google JWKS.
3. **No Vercel AI SDK.** The `ai` + `@ai-sdk/openai` bundle is ~25 MB and
   got rejected by the deploy API (413). Chat uses a raw OpenAI-compatible
   fetch against the OpenKBS proxy (`proxy.openkbs.com/v1/openai`) with
   hand-rolled tool dispatch — same 3 tools, same JSON schemas.
4. **Google Calendar:** `googleapis` was also too heavy — replaced with a
   tiny `node:crypto` RS256 JWT signer that exchanges the service-account
   JWT for an access token, then hits the freebusy + events REST endpoints
   directly.
5. **Model:** `gpt-5.4-mini` via the proxy (instead of `gpt-5.4-nano`).
6. **No GitHub activity section.** (Left in `ask-ivo-temp/`; not ported.)
7. **Region:** `eu-central-1`.

## Smoke test

Live-deploy walk-through (see `SMOKE.md`).

## Known blocker

The `GOOGLE_SERVICE_ACCOUNT_KEY` in `.env.local` is corrupted — OpenSSL
reports `n does not equal p q`, so JWT signing is rejected by Google with
"Invalid JWT Signature". Generate a fresh key in Google Cloud Console →
IAM → Service Accounts → Keys, base64 the JSON (`base64 -w0 key.json`),
replace the value in `.env.local`, and redeploy the availability +
bookings + chat functions. Everything else is wired and verified.
