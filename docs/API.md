# 📡 API Reference — Timely.Works

All routes live under `/api/`. On Vercel, the edge middleware proxies them to VPS.  
Auth routes require the `timely_session` httpOnly cookie (set automatically on login).

---

## Authentication

### POST `/api/auth/register`
Register a new account.
```json
// Request body
{ "email": "you@example.com", "password": "atleast8chars", "displayName": "August" }

// Response 200
{ "ok": true, "emailSent": true }
// or { "ok": true, "verifyUrl": "..." } if email not configured
```

### POST `/api/auth/login`
Sign in. Sets `timely_session` cookie.
```json
// Request body
{ "email": "you@example.com", "password": "yourpassword" }

// Response 200
{ "ok": true, "user": { "id", "email", "displayName", "emailVerified", ... } }
// Response 401
{ "error": "Invalid email or password" }
```

### POST `/api/auth/logout`
Clears session cookie and deletes session from DB.

### GET `/api/auth/me`
Get current authenticated user.
```json
// Response 200 (authenticated)
{ "user": { "id", "email", "displayName", "emailVerified", "dashUsername", ... } }
// Response 401
{ "error": "Unauthorized" }
```

### GET `/api/auth/verify-email?token=xxx`
Verify email address from link in verification email.

### POST `/api/auth/change-email`
Send email change confirmation.
```json
// Request body
{ "newEmail": "new@example.com", "currentPassword": "yourpassword" }
```

### GET `/api/auth/confirm-email-change?token=xxx`
Confirm email change. Redirects to `/account?emailChanged=1`.

### POST `/api/auth/resend-verify`
Resend verification email to current user.

---

## User Profile

### GET `/api/profile`
Get full profile of authenticated user.

### PATCH `/api/profile`
Update profile fields. All optional.
```json
// Request body (any subset)
{
  "displayName": "August",
  "dashUsername": "august",
  "xHandle": "BuiltByAugust",
  "bio": "Emergent strategist",
  "timelyTruth": "Be the change.",
  "avatarUrl": "/api/uploads/abc123.jpg",
  // Password change (requires currentPassword)
  "currentPassword": "old",
  "newPassword": "newpassword"
}
```

### DELETE `/api/profile`
Delete account and all sessions.

---

## Account Stats

### GET `/api/account/stats`
Returns dashboard stats for authenticated user.
```json
// Response 200
{
  "stats": {
    "totalDashContributed": 0.3,
    "totalDashWon": 0,
    "totalTicketsEarned": 3,
    "totalVotusEarned": 3,
    "totalVotusAvailable": 3,
    "lotteriesEntered": 2,
    "initiumCount": 1,
    "entriesThisLottery": 1
  },
  "entries": [...]
}
```

---

## Lottery

### GET `/api/lottery/current`
Get the active lottery (if any).
```json
{ "lottery": { "id", "title", "status", "address", "totalDash", "totalTickets", "endTime", ... } }
```

### GET `/api/lottery/pool`
Get active lottery + all entries (the live ticket feed).
```json
{ "lottery": {...}, "entries": [...] }
```

### POST `/api/lottery/scan`
Trigger blockchain scan of all entry deposit addresses + lottery address.  
Called automatically every 10s by the frontend poll and every 5s by the deposit watcher.
```json
{ "ok": true, "updated": 2, "anonAdded": 1, "results": [...] }
```

### POST `/api/lottery/create` *(Admin)*
```json
// Request body
{ "password": "YOUR_ADMIN_PASSWORD", "title": "Round 5", "description": "...", "durationMinutes": 4320 }
```

### POST `/api/lottery/end` *(Admin)*
Ends active lottery and picks a weighted-random winner.

### POST `/api/lottery/payout` *(Admin)*
Sends DASH to the winner's receive address from the HD wallet.

---

## Entries

### POST `/api/entry/submit`
Submit a new lottery entry.
```json
// Request body (all optional except at least one identity field recommended)
{
  "displayName": "August",
  "dashUsername": "august",
  "dashReceiveAddress": "Xv8GAV5sV...", // where prize goes
  "initiumTitle": "My Big Idea",
  "initiumDescription": "Here's why...",
  "initiumUrl": "https://myproject.xyz",
  "initiumId": "cmlzn2ap70...",  // ID of saved Initium card (optional)
  "mediaUrl": "/api/uploads/xyz.jpg",
  "mediaType": "image"
}

// Response 200
{ "entry": { "id", "entryAddress", "dashContributed", "totalTickets", ... } }
```

**Notes:**
- If `initiumId` is provided, title/description/URL/media are pulled from the saved card
- If logged in with no media uploaded, profile `avatarUrl` is used as entry media fallback
- If entry already exists for this identity, returns `{ "entry": ..., "existing": true }`

### GET `/api/entry/my`
Get the authenticated user's entry in the active lottery.
```json
{
  "entry": {
    "id", "entryAddress", "dashContributed",
    "totalTickets", "votusCredits", "votusAvailable", "verifiedTxIds"
  },
  "votusAvailable": 2
}
```

### GET `/api/entry/status?entryId=xxx`
**Live blockchain check** for a specific entry. Scans Insight API directly.  
Used by the deposit watcher (polls every 5s).
```json
{
  "entryId": "UVIoe7Qk8w",
  "depositAddress": "Xwcr...",
  "dashContributed": 0.2,
  "baseTickets": 2,
  "totalTickets": 2,
  "votusAvailable": 2,
  "verifiedTxIds": ["9393e9..."],
  "pendingDash": 0,
  "pendingTxs": 0,
  "newDashDetected": false,
  "scanned": true
}
```

### POST `/api/entry/verify-anon`
Verify an anonymous TX hash and credit the matching entry.
```json
// Request body
{
  "txId": "9393e998...",  // TX hash or full insight URL
  "entryId": "xxx",       // optional: scope to specific entry
  "displayName": "August",
  "dashAddress": "Xv8GA..."
}
```

### POST `/api/entry/claim`
Claim an anonymous TX to your authenticated account.
```json
{ "txId": "9393e998..." }
```

### POST `/api/entry/upvote`
Spend 1 Votus from your entry to boost another entry (+1 ticket).
```json
// Request body
{ "voterEntryId": "xxx", "entryId": "yyy" }

// Response 200
{ "ok": true, "votusRemaining": 1, "target": { "id", "totalTickets", "upvoteTickets" } }
```
**Limits:** Max 3 Votus per initium. Cannot upvote your own entry.

---

## Initium Cards (Saved)

### GET `/api/initium/list`
List authenticated user's saved initium cards.

### POST `/api/initium/create`
Create a new initium card.
```json
{
  "title": "My Idea",
  "description": "...",
  "url": "https://...",
  "mediaUrl": "/api/uploads/...",
  "mediaType": "image",
  "customSlug": "my-idea"  // optional, auto-generated if omitted
}
```

### GET `/api/initium/:id`
Get a single initium card (public if `isPublic: true`).

### PATCH `/api/initium/:id`
Update an initium card. Same body as create. Must own the card.

### DELETE `/api/initium/:id`
Delete an initium card. Must own the card.

### GET `/api/initium/view/:slug`
Public view of an initium card. Increments `viewCount`.

---

## Community Initiums

### GET `/api/initiums?search=xxx&username=yyy`
Browse all submitted initiums across all lotteries.  
Sorted by upvote count, then by recency.

---

## Media Upload

### POST `/api/upload`
Upload image or video. `multipart/form-data` with `file` field.
```json
// Response 200
{ "url": "/api/uploads/abc123.jpg", "type": "image" }
```
Max size: 50MB. Stored at `/timely-lottery-data/uploads/`.

### GET `/api/uploads/:filename`
Serve an uploaded file from VPS filesystem.

---

## Winners & History

### GET `/api/winners`
All lottery winners, newest first.

### GET `/api/history`
All completed lotteries with stats.

### GET `/api/stats`
Global platform stats (total lotteries, DASH awarded, participants).

---

## Script Download

### GET `/api/script`
Download the Dash identity registration script (for davara.dash setup).

---

## Words API (One Word Feature)

### `GET /api/words`
Returns word frequency data for the community pulse feature.

**Query params:**
- `target` — `current` | `next` | `all` (default: all)

**Response:**
```json
{
  "currentWords": [{ "word": "hope", "username": "August", "timestamp": 1234567890, "target": "current" }],
  "nextWords": [...],
  "currentFreq": [{ "word": "hope", "count": 3 }],
  "nextFreq": [...],
  "allFreq": [...],
  "currentLotteryId": "abc123",
  "currentLotteryTitle": "Round 15"
}
```

### `POST /api/words`
Submit one word. Requires authentication (session cookie).

**Body:**
```json
{ "word": "hope", "target": "current" }
```

**Rules:**
- One word per user per target per lottery cycle
- Max 32 characters, letters/numbers/hyphens only
- Re-submitting updates the previous word in-place

**Response:**
```json
{ "ok": true, "submission": { "id": "...", "word": "hope", ... } }
```

---

## Repayout API (Stuck Payout Recovery)

### `POST /api/lottery/repayout`
Retry payout for an ended lottery with no `winnerTxId`.

**Body:**
```json
{ "password": "ADMIN_PASSWORD", "lotteryId": "abc123" }
```

**Winner address resolution order:**
1. `entry.dashReceiveAddress` (if valid Dash address)
2. `entry.dashAddress` (if valid Dash address)
3. TX sender from Insight API (`entry.verifiedTxIds[0]` → `vin[0].addr`)

**Response includes `strategy`:**
- `"direct_sweep"` — immediate splits ran on deposit, sweep remaining to winner
- `"split_payout"` — no prior splits, applies 85/10/5 at end

