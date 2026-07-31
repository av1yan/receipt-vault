# Receipt Vault — Feature Spec

A local-first mobile app to **capture, organize, and never lose track of receipts** —
combining a searchable receipt vault, warranty & return deadline reminders, and simple
spending insight.

> Status: design phase. This doc is the feature definition to design UI against.
> Backend + frontend wiring comes later. Stack target: Expo / React Native (SDK 57),
> local-first SQLite, pluggable AI extraction.

---

## 1. Core value proposition

People take photos of receipts and forget them. Receipt Vault makes each receipt *useful*:

1. **Vault** — one clean, searchable home for every receipt (photo + structured data).
2. **Deadlines** — auto-track warranty expiry and return windows, remind before they lapse.
3. **Spending** — see where money goes by month and category, export when needed.

---

## 2. Feature list

### 2.1 Capture
- **Snap a photo** of a receipt (camera) or **pick from library**.
- **AI extraction**: image → auto-filled fields (merchant, date, total, tax, currency,
  line items, suggested category).
- **Manual review & edit**: every extracted field is editable; extraction is a
  head-start, never a lock-in. User can also skip AI and type everything by hand.
- **Multi-photo per receipt** (long receipts / receipt + product box).
- **Re-run extraction** button if the first pass was poor.

### 2.2 Vault (archive)
- Chronological list of all receipts (newest first), each row: merchant, date, total,
  thumbnail, category tag, and small badges (⏳ warranty active, ↩︎ return window open).
- **Search** by merchant, item name, note, or amount.
- **Filters**: by category, date range, "has active warranty", "return window open".
- **Sort**: date, amount, merchant.
- **Receipt detail**: full-size photo(s), all fields, line items, warranty/return status,
  notes, and quick actions (edit, delete, share/export, set reminder).

### 2.3 Warranty & returns (Deadlines)
- Per receipt: optional **warranty length** (months) and **return window** (days).
- App derives **warranty expires on** and **return by** dates from the purchase date.
- **Deadlines screen**: upcoming return-by and warranty-expiry dates, grouped
  (This week / This month / Later), soonest first.
- **Local reminders** (push notification) at configurable lead time
  (e.g. 3 days before a return window closes, 1 week before warranty ends).
- Visual status on each receipt: return window open/closed, warranty active/expired
  with days remaining.

### 2.4 Spending
- **Monthly total** and per-category breakdown.
- Simple bar/donut of category share for the selected month.
- Month switcher; optional "this year" rollup.
- **Export** filtered receipts to CSV / share sheet (for budgeting or taxes).

### 2.5 Cross-cutting
- **Categories**: preset list (Groceries, Electronics, Dining, Clothing, Home, Health,
  Transport, Other) + user-added custom categories.
- **Local-first**: everything works offline; data lives in on-device SQLite. Cloud sync
  is a later phase.
- **Privacy**: receipt images stored locally in app storage; AI extraction is the only
  network call and is opt-in / provider-pluggable.

---

## 3. Screens (navigation map)

Bottom tab bar: **Vault · Deadlines · Spending** + a prominent **＋ Capture** action.

```
Tabs
├── Vault (list)            → search, filter, sort
│     └── Receipt Detail    → edit / delete / share / set reminder
├── Deadlines               → grouped upcoming return + warranty dates
├── Spending                → month total, category breakdown, export
└── ＋ Capture (modal flow)
      ├── 1. Camera / library picker
      ├── 2. Extracting… (AI)  [skippable → straight to manual]
      ├── 3. Review & Edit form (pre-filled, all editable)
      │       + warranty months, return window days, category
      └── 4. Save → lands on Receipt Detail
Settings (from Vault header)
      ├── Categories manager
      ├── Reminder lead-time defaults
      ├── Currency default
      └── AI provider / API key (later)
```

---

## 4. Key user flows

**Add a receipt (happy path)**
1. Tap ＋ Capture → take photo.
2. AI extracts fields; "Extracting…" shows briefly.
3. Review form appears pre-filled. User confirms merchant/date/total, sets category,
   optionally sets warranty (e.g. 24 months) and return window (e.g. 30 days).
4. Save → Receipt Detail. If a deadline was set, a reminder is scheduled.

**Manual add (no AI)**
1. ＋ Capture → "Enter manually" → blank review form → fill → save.

**Beat a return deadline**
1. Deadlines screen shows "Return by Aug 12 — 3 days left" for a jacket.
2. Push notification fired 3 days prior. Tap → Receipt Detail with store + total.

**Check spending**
1. Spending tab → July: $842 total, Electronics 38%, Groceries 21%…
2. Export → CSV of July receipts to share sheet.

---

## 5. Data model (design reference)

```
Receipt
  id                string (uuid)
  merchant          string
  purchase_date     date (ISO)
  total             number (minor units or decimal)
  tax               number?           optional
  currency          string            e.g. "USD"
  category          string            FK-ish to Category.name
  note              string?
  image_uris        string[]          local file paths (1+)
  warranty_months   number?           null = no warranty tracked
  return_window_days number?          null = no return tracked
  created_at        datetime
  updated_at        datetime

  // derived (computed, not stored):
  warranty_expires_at = purchase_date + warranty_months
  return_by           = purchase_date + return_window_days

LineItem
  id            string
  receipt_id    string  (FK → Receipt.id)
  name          string
  qty           number
  price         number

Category
  name          string (unique)
  color         string
  is_custom     boolean

Reminder
  id            string
  receipt_id    string  (FK → Receipt.id)
  type          "return" | "warranty"
  fire_at       datetime
  lead_days     number
  notification_id string?   (OS-scheduled id)
```

---

## 6. AI extraction contract (so frontend can be designed independently)

The extraction service is a black box the UI calls with an image and gets back a
partially-confident, fully-editable result. Design the review form around this shape:

```ts
type ExtractionResult = {
  merchant?: string;
  purchaseDate?: string;      // ISO date
  total?: number;
  tax?: number;
  currency?: string;          // ISO 4217, e.g. "USD"
  category?: string;          // best-guess from preset list
  items?: { name: string; qty?: number; price?: number }[];
  confidence: number;         // 0..1 overall — dim/flag low-confidence fields
  raw?: string;               // OCR text fallback for debugging
};

async function extractReceipt(imageUri: string): Promise<ExtractionResult>;
```

Design notes for the review form:
- Show extracted values pre-filled; visually mark low-confidence fields for a quick glance.
- Never block on the network — if extraction fails or is offline, drop straight to an
  empty editable form (manual entry).
- Provider is swappable (Claude vision / OpenAI vision / on-device OCR) behind this one
  function; the UI never needs to know which.

---

## 7. Suggested build phases (for when you return)

1. **Vault + manual capture** — SQLite, add/edit/list/detail, photos, search. (No AI.)
2. **Deadlines** — warranty/return derivation + local notifications.
3. **Spending** — aggregation + CSV export.
4. **AI extraction** — wire the `extractReceipt` provider into the capture flow.
5. **Cloud sync** (optional) — mirror Habit Tracker's Supabase sync pattern.

---

## 8. Out of scope (v1)

- Multi-user / sharing receipts between accounts
- Bank/email auto-import of receipts
- Tax-report generation (beyond raw CSV export)
- Web app
