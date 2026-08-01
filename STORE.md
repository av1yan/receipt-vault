# App Store metadata — Receipt Vault

Copy‑paste text for App Store Connect. Character limits noted in `()`; counts are
approximate — Connect enforces the real limit, so trim if it complains. You are
responsible for the accuracy of the privacy answers below; review before submitting.

---

## Basics

- **App name** (30): `Receipt Vault`
- **Subtitle** (30): `Never miss a return again`
  - Alternates: `Receipts, returns & warranties` · `Scan receipts, track returns`
- **Bundle ID:** `com.av1yan.receipt-vault`
- **Primary category:** Finance
- **Secondary category:** Productivity
- **Age rating:** 4+ (no objectionable content)
- **Price:** Free

---

## Promotional text (170) — editable anytime without review

```
Snap a receipt and Receipt Vault reads it, then nudges you before every return window and warranty runs out. Private and local-first, with optional cloud sync.
```

---

## Keywords (100) — comma‑separated, no spaces (spaces waste characters)

```
receipt,receipts,warranty,returns,scanner,expense,expenses,budget,spending,tax,reminder,tracker,organizer,vault
```

---

## Description (4000)

```
Receipt Vault keeps every receipt and makes sure you never miss a return window or warranty again.

Snap a photo and Receipt Vault reads the merchant, total, date, and items for you — then quietly tracks the deadlines that actually matter.

CAPTURE IN SECONDS
• Photograph a receipt and let it fill in the details automatically
• Or add one by hand in a few taps
• Searchable vault with photo thumbnails and quick filters

NEVER MISS A DEADLINE
• Automatic return-by and warranty-expiry countdowns
• Reminders before a window closes — choose how many days ahead
• Claim Helper drafts a return or warranty email when you need it
• Mark a claim filed, then resolved — it leaves your countdown

UNDERSTAND YOUR SPENDING
• Spending by month and category, with budgets and a monthly goal
• Savings: what you saved by staying under budget, savings goals you set, and money owed back to you
• Insights: trends, top merchants, and recurring subscriptions
• Flag reimbursable receipts and export a clean CSV for taxes or expenses

PRIVATE BY DESIGN
• Local-first: your receipts live on your device
• App Lock with Face ID, Touch ID, or passcode
• Light, dark, and system themes
• Optional cloud backup — sync across devices with a private code, or an account

Receipt Vault is the calm, organized home for every receipt — so a missed return or a lapsed warranty never costs you again.
```

---

## What's New (4000) — for version 1.0.0

```
Welcome to Receipt Vault 1.0!

• Snap a receipt and let it read the merchant, total, date, and items
• Automatic return and warranty countdowns, with reminders before they lapse
• Claim Helper drafts your return/warranty emails
• Budgets, savings goals, and spending insights
• CSV export for taxes and expenses
• App Lock (Face ID / passcode) and dark mode
• Optional cloud sync — a private code or an account

Thanks for trying it out. Feedback is always welcome.
```

---

## URLs

- **Support URL:** `https://github.com/av1yan/receipt-vault` (or a dedicated support page/email)
- **Marketing URL** (optional): same, or a landing page
- **Privacy Policy URL** (required): host `PRIVACY.md` (below) somewhere public — e.g. GitHub Pages, a gist, or your site — and paste the URL here.

---

## App Privacy (data collection questionnaire)

Answer this in App Store Connect → App Privacy. Recommended answers based on how
the app currently works. **If you ship without cloud sync/accounts enabled, you can
declare "Data Not Collected" — but as built, the following applies.**

**Do you or your third‑party partners collect data from this app?** → **Yes**

| Data type | Collected? | Linked to identity? | Used for tracking? | Purpose |
|---|---|---|---|---|
| **Email address** | Yes — only if the user creates an account | Yes | No | App Functionality (sign‑in / cross‑device sync) |
| **Purchase history / financial info** (receipt merchant, total, date) | Yes — when cloud sync is used | Linked only if signed in; otherwise not linked | No | App Functionality |
| **Photos** (receipt images) | Yes — sent for AI extraction and stored in the cloud when synced | Linked only if signed in | No | App Functionality |
| **User content** (notes/items on a receipt) | Yes — when synced | As above | No | App Functionality |

- **Tracking:** None. No ads, no analytics SDKs, no cross‑app/website tracking. (No `NSUserTrackingUsageDescription` / ATT prompt.)
- **Third parties:** Cloud sync and AI extraction run on your Supabase backend; receipt images/text are processed by Anthropic (Claude) for extraction. Disclose this in the privacy policy.
- If you disable accounts and cloud features for launch, the honest answer can be **"Data Not Collected."**

**Permission strings (already in `app.json`):**
- Camera — capture receipts
- Photo Library — add receipt photos
- Face ID — unlock the vault (App Lock)
- Notifications — deadline reminders (local)

---

## PRIVACY.md (starter — review with counsel, then host at the Privacy Policy URL)

```
# Receipt Vault — Privacy Policy

Last updated: <DATE>

Receipt Vault is designed to be private and local-first. Your receipts are stored
on your device. Some features are optional and involve sending data off-device;
they are described below.

WHAT WE STORE
• On your device: your receipts, photos, budgets, and settings.
• If you enable cloud backup or an account: your receipts, their photos, and (for
  accounts) your email address are stored on our backend so they can sync across
  your devices. Cloud data is scoped to a private key and is not shared with other
  users.

AI EXTRACTION
• When you use automatic extraction, the receipt image or text is sent to our
  processing service (Anthropic’s Claude API) to read the merchant, total, date,
  and items. It is used only to return that result.

WHAT WE DON’T DO
• No advertising, no analytics/tracking SDKs, no selling of your data.
• Notifications are scheduled locally on your device.

YOUR CHOICES
• Use the app fully offline without an account.
• Sign out to detach from an account. Contact us to delete an account and its data.

CONTACT
• <your support email>
```
