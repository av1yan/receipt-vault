# Receipt Vault

[![CI](https://github.com/av1yan/receipt-vault/actions/workflows/ci.yml/badge.svg)](https://github.com/av1yan/receipt-vault/actions/workflows/ci.yml)
![Expo SDK 57](https://img.shields.io/badge/Expo-SDK%2057-000?logo=expo&logoColor=fff)
![React Native 0.86](https://img.shields.io/badge/React%20Native-0.86-61dafb?logo=react&logoColor=000)
![License: MIT](https://img.shields.io/badge/License-MIT-c67139)

A local‑first mobile app for keeping every receipt and never missing a **return window** or **warranty expiry** again. Snap a receipt, let AI read it, and Receipt Vault tracks the deadlines, your spending, and your budgets — all stored on‑device first, synced to the cloud only when you choose.

Built with **Expo / React Native** (SDK 57) and a **Supabase** backend.

---

## Features

**Capture & organize**
- 📸 Camera capture with **AI extraction** (Claude vision) — reads merchant, total, date, category, and line items; manual entry + review fallback
- 🗂️ Searchable **Vault** with photo thumbnails, filters (returns open, under warranty, reimbursable, this month), and a torn‑receipt UI
- ✏️ **Edit** and 🗑️ **delete** receipts (deletes propagate across devices via tombstones)

**Deadlines — the core differentiator**
- ⏰ Auto‑computed **return‑by** and **warranty‑expiry** countdowns from the purchase date
- 🔔 Local **push reminders** before each deadline lapses
- 📮 **Claim Helper** — drafts a return/warranty email (AI or template) with a "what you'll need" checklist
- ✅ **Status tracking** — mark a claim *filed* → *resolved*; resolved items leave the countdown

**Money**
- 📊 **Spending** by month & category, with a real vs‑prior‑month comparison
- 🎯 **Budgets** — a monthly goal + per‑category limits, tracked live with over/under nudges
- 📈 **Insights** — monthly‑spend trend, top merchants, and recurring/subscription detection
- 🧾 **Reimbursable** flagging + a filtered CSV **report export**
- 📤 **CSV export** of the full ledger (spreadsheet‑safe, formula‑injection escaped)

**Sync (optional, private)**
- ☁️ **Cloud backup** gated by a per‑device **"sync code"** — no account, no email
- 🖼️ **Photo binaries** sync via a private storage bucket
- 🔀 **Conflict resolution** — last *editor* wins (by edit time), so a stale device can't clobber a newer change
- 📧 **Email import** — forward an e‑receipt to a private address and it files itself (setup required)

---

## Tech stack

- **Expo SDK 57**, React Native 0.86, React 19, TypeScript
- **expo-router** (file‑based navigation)
- **expo-sqlite** — local‑first persistence (dates as epoch millis)
- **Supabase** — Postgres (RLS‑locked), Edge Functions (Deno), Storage
- **Anthropic Claude** (`claude-opus-5`) for receipt extraction & claim drafting
- **jest + ts-jest** for unit tests

Design: the warm "Organic" system (cream `#f5ead8`, terracotta `#c67139`, sage `#7a8a5e`) with Caprasimo + Figtree fonts.

---

## Architecture

**Local‑first.** All reads/writes hit SQLite (`lib/db.ts`); the UI never waits on the network. The cloud is a backup/sync layer you opt into.

**Sync model (no accounts).** Each device holds a private **vault key** in the secure keychain. Data is scoped in the cloud by `sha256(vaultKey)`, so the `cloud_receipts` table is **RLS‑locked with no policies** — only the service‑role `sync` Edge Function can touch it. Enter the same sync code on another device to share a vault.

**Conflict resolution.** Every receipt carries an `updatedAt` stamp. Pushes go through a Postgres `sync_receipts()` function that only overwrites a row when the incoming edit is newer — *last‑writer‑wins by edit time*, not by sync time.

**Deletes.** Deleting a receipt records a local **tombstone** and soft‑deletes the cloud row (+ removes its photo object); a live push can never resurrect it.

**Edge Functions** (deployed to the Supabase project):
- `extract-receipt` — photo → structured receipt (Claude vision)
- `claim-helper` — drafts return/warranty emails
- `sync` — push/pull/delete + signed photo upload/download URLs
- `inbound-email` — parses forwarded e‑receipts into the vault

---

## Getting started

**Prerequisites:** Node 18+, the [Expo Go](https://expo.dev/go) app (SDK 57) on an iOS/Android device or simulator.

```bash
npm install
npx expo start --go
```

Then open the project in Expo Go (scan the QR, or press `i` / `a` for a simulator). The app ships with demo receipts on first run; add your own with the ＋ button.

> **Note:** a native/dev build (`expo run:ios`) needs CocoaPods; Expo Go is the quickest way to run it. The native home‑screen widget is scaffolded but requires an EAS build — see [`WIDGET.md`](WIDGET.md).

---

## Configuration

The client talks to a Supabase project via `lib/config.ts` (`SUPABASE_URL` + the public **anon** key — safe to ship). To point at your own project, swap those two values and deploy the Edge Functions.

**Server secrets** (Supabase → Edge Functions → Secrets) unlock the AI‑powered pieces:

| Secret | Enables |
|---|---|
| `ANTHROPIC_API_KEY` | Real Claude extraction, claim drafting, and email parsing (all fall back to heuristics/templates without it) |
| `INBOUND_SECRET` | Locks down the email‑import webhook (see [`EMAIL_IMPORT.md`](EMAIL_IMPORT.md)) |

Email import also needs an inbound‑mail provider pointed at the webhook — full setup in [`EMAIL_IMPORT.md`](EMAIL_IMPORT.md).

---

## Testing

Pure logic (deadline derivation, CSV building, insights math) is covered by unit tests:

```bash
npm test          # jest
npm run typecheck # tsc --noEmit
```

---

## Project structure

```
app/            expo-router screens
  (tabs)/       Vault, Deadlines, Spending, Budgets
  capture.tsx   camera + AI extraction + review
  receipt/[id]  detail sheet (status, reimbursable, edit/delete)
  edit/[id]     edit a receipt
  claim/[id]    Claim Helper
  insights.tsx  spending insights
  budgets.tsx   goal + category budgets
  sync.tsx      cloud backup + sync code + email import
  settings.tsx  settings hub
lib/            data model, SQLite, store, sync, budgets, insights, csv, …
components/     shared UI kit (ui.tsx)
__tests__/      jest unit tests
targets/        native widget scaffold (EAS build)
```

More docs: [`FEATURES.md`](FEATURES.md) (data model & contracts), [`EMAIL_IMPORT.md`](EMAIL_IMPORT.md), [`WIDGET.md`](WIDGET.md).

---

## Roadmap

- 🏠 **Home‑screen widget** — surface the next deadline at a glance (native scaffold in `targets/`, needs an EAS build)
- 🔎 **Full‑text search** across merchants and line items
- 🧠 **Smarter category suggestions** from merchant history
- 🌙 **Dark mode** for the Organic palette
- 🤝 **Shared vaults** — invite a partner to a vault beyond the current same‑sync‑code sharing
- 🧾 **Warranty document attachments** — store manuals / proof‑of‑purchase PDFs alongside the photo

---

## License

[MIT](LICENSE)
