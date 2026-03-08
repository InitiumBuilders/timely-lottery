# Security Policy — Timely.Works

## Reporting Vulnerabilities

Found a security issue? Please **do not** open a public GitHub issue.

Email us privately at: **InitiumBuilders@gmail.com**

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Your suggested fix (if any)

We will respond within 48 hours and aim to patch critical issues within 7 days.

---

## What NOT to Commit

The following must **never** appear in any committed file:

| Secret | Where it lives |
|---|---|
| `DASH_MNEMONIC` — 12-word BIP39 mnemonic | `.env.local` on VPS only |
| `ADMIN_PASSWORD` — admin panel password | `.env.local` on VPS only |
| `TELEGRAM_BOT_TOKEN` | `.env.local` on VPS only |
| `RESEND_API_KEY` | `.env.local` on VPS only |
| Any private key (WIF or hex) | Never stored — ephemeral only |
| Any GitHub PAT | Never stored in files |

The `.gitignore` is configured to block `.env` and `.env.local` from being committed. Do not override this.

---

## How Secrets Are Managed

### Environment Variables
All secrets are stored as environment variables in `.env.local` on the VPS. This file is:
- Never committed to git (blocked by `.gitignore`)
- Owned by root, readable only by the service user
- Not present on Vercel (Vercel uses platform env vars)

### Admin Password
- Stored in `process.env.ADMIN_PASSWORD` only
- Verified server-side via `/api/admin/verify`
- Never exposed to the client bundle
- No hardcoded fallback — if env var is not set, auth fails with 401

### DASH Mnemonic
- Stored in `process.env.DASH_MNEMONIC` only
- Used exclusively in server-side payout scripts
- Never logged, never sent over network
- The payout scripts (`scripts/run-payouts.mjs`) are in `.gitignore`

### DPNS Private Keys
- Private keys are **never stored** by Timely.Works
- The WIF signing flow in `DashLogin.tsx` sends the WIF to `/api/auth/dash-sign` over HTTPS
- The API signs the message and **immediately discards** the key — it is never logged or persisted
- For production security, users should sign locally with their wallet and paste the signature

---

## Rate Limiting

All sensitive API endpoints are rate-limited:
- `/api/auth/dash-challenge` — 10 requests/minute per IP
- `/api/auth/dash-verify` — 10 requests/minute per IP
- `/api/auth/login` — 20 requests/minute per IP
- `/api/admin/*` — 30 requests/minute per IP

Rate limiting is implemented via `lib/ratelimit.ts` using an in-memory sliding window.

---

## API Security Audit

| Endpoint | Auth Required | Rate Limited | Notes |
|---|---|---|---|
| `POST /api/auth/login` | No | ✅ | Email/password hash comparison |
| `POST /api/auth/dash-challenge` | No | ✅ | DPNS resolution via DAPI |
| `POST /api/auth/dash-sign` | No | ✅ | Signs + immediately discards key |
| `POST /api/auth/dash-verify` | No | ✅ | Nonce-based, 5-min expiry |
| `POST /api/lottery/create` | Admin password | ✅ | Server-side password check |
| `POST /api/lottery/end` | Admin password | ✅ | Server-side password check |
| `POST /api/lottery/payout` | Admin password | ✅ | Server-side password check |
| `POST /api/admin/verify` | n/a | ✅ | Returns 200/401 only |
| `GET /api/stats` | No | No | Public read-only |

---

## On-Chain vs Off-Chain Data

### Off-Chain (VPS SQLite + store.json)
- User accounts (email hash, session tokens)
- Lottery entry records
- Admin configuration

### On-Chain (Dash Platform — roadmap)
- Lottery creation documents
- Result documents (winner, payout txid)
- Entry documents (anonymized by DPNS identity)

The goal is to migrate all lottery data to Dash Platform for full transparency. See [DASH-EVOLUTION.md](./DASH-EVOLUTION.md) for the roadmap.

---

## Responsible Disclosure Timeline

| Day | Action |
|---|---|
| 0 | Report received, acknowledgment sent |
| 1–2 | Triage and severity assessment |
| 3–7 | Patch developed (critical) |
| 7–14 | Patch deployed and verified |
| 30 | Public disclosure (coordinated) |

Thank you for helping keep Timely.Works secure. 🔒
