# Contributing to Timely.Works

Welcome. This project is built on emergent strategy — small, trusting contributions compound into something meaningful. The same applies here.

---

## Before You Start

1. **Read the README** — understand what we're building and why
2. **Read `docs/ARCHITECTURE.md`** — understand how it works
3. **Read `docs/PAYOUT-SYSTEM.md`** — the most sensitive system; understand it before touching it
4. **Run it locally** — see `docs/DEVELOPMENT.md`

---

## Core Principles for Contributors

### 🔒 Non-Custodial First
Never write code that holds, logs, or transmits user private keys or mnemonics. All key operations happen in `lib/dash.ts` — keys are derived on demand and never stored.

### 🔍 Transparency
Every financial operation must be verifiable on-chain. If you add a new fee or fund flow, it must:
- Be documented in `docs/PAYOUT-SYSTEM.md`
- Be visible in the admin panel
- Produce a verifiable TX on Dash blockchain

### ✅ Zero TypeScript Errors
`npm run build` must pass with zero errors before any PR.

### 📝 Document What You Change
If you change payout logic → update `docs/PAYOUT-SYSTEM.md`  
If you add an API route → update `docs/API.md`  
If you change the data model → update `docs/ARCHITECTURE.md`

### 🌱 Write for 10× Scale
The current store.json works for now. Write code that's easy to migrate to PostgreSQL. Avoid assumptions like "there's only one active lottery."

---

## Development Workflow

```bash
# Setup
npm install
cp .env.example .env
npx prisma migrate dev
npm run dev

# In second terminal
node scripts/worker.mjs

# Before committing
npm run build    # must pass with zero errors
npm run lint     # must pass
```

---

## File Organization

**Add new features here:**
- New page → `app/{feature}/page.tsx`
- New API endpoint → `app/api/{feature}/route.ts`
- New utility → `lib/{feature}.ts`
- New docs → `docs/{FEATURE}.md`

**Do not modify without discussion:**
- `lib/dash.ts` — blockchain layer (test carefully)
- `middleware.ts` — Vercel proxy (auth depends on it)
- `scripts/worker.mjs` — production background worker

---

## PR Checklist

- [ ] `npm run build` passes with zero errors
- [ ] No hardcoded secrets or addresses (use env vars)
- [ ] No new custody of user funds
- [ ] Documentation updated if flow changed
- [ ] Tested locally with real DASH testnet if touching payout logic

---

## Questions?

Open an issue or reach out to [@BuiltByAugust](https://x.com/BuiltByAugust) on X.

*"Move at the speed of trust."* — adrienne maree brown
