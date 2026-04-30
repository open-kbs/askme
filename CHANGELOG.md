# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] - 2026-04-30

### Added

- AI chat with career-aware system prompt and tool calling (check availability, create booking, send message)
- Google Calendar integration for real-time free/busy availability
- Two-phase booking flow with HMAC-signed approve/reject email links
- Contact form with rate limiting and honeypot spam protection
- Google OAuth 2.0 authentication for calendar and booking access
- React + Vite + Tailwind frontend with dark/light theme
- Local development server with PGlite (embedded Postgres)
- Agent-assisted setup flow (SETUP.md) for first-time configuration
- Configurable feature flags for calendar, bookings, and contact form
- Mustache-lite email templates for booking and contact notifications
- Hourly cleanup cron for expired rate-limit records
- OpenKBS deployment support with function bundling script
