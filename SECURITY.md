# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly.

**Email:** [ivostoynovski@gmail.com](mailto:ivostoynovski@gmail.com)

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

**Do not** open a public GitHub issue for security vulnerabilities.

## Response Timeline

- **Acknowledgement:** within 3 business days
- **Initial assessment:** within 7 business days
- **Fix or mitigation:** best effort, typically within 30 days for confirmed issues

## Scope

### In scope

- Authentication and authorization flaws (OAuth token handling, HMAC verification)
- Injection vulnerabilities (SQL injection, XSS, command injection)
- Secrets leaking into git history, logs, or client-side bundles
- Rate-limiting bypasses
- Email template injection

### Out of scope

- Vulnerabilities in upstream dependencies (report those to the relevant project)
- Denial-of-service against the OpenKBS platform infrastructure
- Social engineering
- Issues that require physical access to the server

## Supported Versions

Only the latest release on the `main` branch is supported with security fixes.
