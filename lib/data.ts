// Receipt data + derivation helpers, ported from the design prototype's DC script.
// "Today" is pinned to match the prototype so the seeded countdowns line up.

export const TODAY = new Date(2026, 6, 30); // Jul 30, 2026

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const CATS = ['Groceries', 'Electronics', 'Home', 'Dining', 'Travel'] as const;

export type LineItem = { name: string; price: number };

// Claim lifecycle: an open receipt still counts down its return/warranty
// deadlines; once a claim is filed (or the receipt is resolved/refunded) it
// leaves the active deadline list and is tracked separately.
export type ReceiptStatus = 'open' | 'filed' | 'resolved';
export type StatusKind = 'return' | 'warranty';

export type Receipt = {
  id: number;
  merchant: string;
  cat: string;
  date: Date;
  total: number;
  pay: string;
  ret: number; // return window in days (0 = none)
  war: number; // warranty in months (0 = none)
  items: LineItem[];
  imageUri?: string | null; // local file path to the receipt photo (null = none)
  status?: ReceiptStatus; // claim lifecycle (undefined = 'open')
  statusKind?: StatusKind | null; // which claim was filed/resolved
  statusAt?: Date | null; // when the status last changed
};

/** Current lifecycle status, defaulting legacy receipts to 'open'. */
export const statusOf = (r: Receipt): ReceiptStatus => r.status ?? 'open';
/** Only 'open' receipts count toward active deadlines/countdowns. */
export const isActive = (r: Receipt): boolean => statusOf(r) === 'open';

export type Derived = {
  retBy: Date | null;
  warTo: Date | null;
  retLeft: number; // days left (-1 when none)
  warLeft: number;
};

// ── formatting ──────────────────────────────────────────────────────────────
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);
export const fmtD = (x: Date) => `${MON[x.getMonth()]} ${x.getDate()}`;
export const fmtDY = (x: Date) => `${MON[x.getMonth()]} ${x.getDate()}, ${x.getFullYear()}`;
export const money = (n: number) =>
  '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export const addDays = (x: Date, n: number) => {
  const r = new Date(x);
  r.setDate(r.getDate() + n);
  return r;
};
export const addMonths = (x: Date, n: number) => {
  const r = new Date(x);
  r.setMonth(r.getMonth() + n);
  return r;
};
export const daysLeft = (x: Date) => Math.ceil((x.getTime() - TODAY.getTime()) / 86400000);

export function derive(r: Receipt): Derived {
  const retBy = r.ret ? addDays(r.date, r.ret) : null;
  const warTo = r.war ? addMonths(r.date, r.war) : null;
  return {
    retBy,
    warTo,
    retLeft: retBy ? daysLeft(retBy) : -1,
    warLeft: warTo ? daysLeft(warTo) : -1,
  };
}

export type NextDeadline = {
  receiptId: number;
  kind: 'return' | 'warranty';
  merchant: string;
  date: Date;
  daysLeft: number;
};

/** The single soonest upcoming deadline across all receipts (or null). */
export function nextDeadline(receipts: Receipt[]): NextDeadline | null {
  let best: NextDeadline | null = null;
  const consider = (c: NextDeadline) => {
    if (!best || c.daysLeft < best.daysLeft) best = c;
  };
  for (const r of receipts) {
    if (!isActive(r)) continue; // filed/resolved receipts drop out of the countdown
    const v = derive(r);
    if (v.retLeft >= 0 && v.retBy) {
      consider({ receiptId: r.id, kind: 'return', merchant: r.merchant, date: v.retBy, daysLeft: v.retLeft });
    }
    if (v.warLeft >= 0 && v.warTo) {
      consider({ receiptId: r.id, kind: 'warranty', merchant: r.merchant, date: v.warTo, daysLeft: v.warLeft });
    }
  }
  return best;
}

// ── seed data (matches the prototype) ────────────────────────────────────────
export const SEED: Receipt[] = [
  {
    id: 1, merchant: 'Fern & Flour Market', cat: 'Groceries', date: d(2026, 7, 28),
    total: 63.4, pay: 'Visa ·4417', ret: 14, war: 0,
    items: [
      { name: 'Sourdough loaf', price: 6.5 },
      { name: 'Olive oil 500ml', price: 18.0 },
      { name: 'Produce box', price: 38.9 },
    ],
  },
  {
    id: 2, merchant: 'Northline Electronics', cat: 'Electronics', date: d(2026, 7, 21),
    total: 429.0, pay: 'Amex ·1002', ret: 30, war: 24,
    items: [
      { name: 'Wireless headphones', price: 349.0 },
      { name: 'Extended cable', price: 24.0 },
      { name: 'Sales tax', price: 56.0 },
    ],
  },
  {
    id: 3, merchant: 'Clay & Cotton Home', cat: 'Home', date: d(2026, 7, 14),
    total: 187.25, pay: 'Visa ·4417', ret: 60, war: 12,
    items: [
      { name: 'Linen throw', price: 89.0 },
      { name: 'Stoneware set', price: 98.25 },
    ],
  },
  {
    id: 4, merchant: 'Harbor Coffee House', cat: 'Dining', date: d(2026, 7, 12),
    total: 18.6, pay: 'Apple Pay', ret: 0, war: 0,
    items: [
      { name: 'Flat white ×2', price: 9.6 },
      { name: 'Almond pastry', price: 9.0 },
    ],
  },
  {
    id: 5, merchant: 'Cedarline Rail', cat: 'Travel', date: d(2026, 7, 3),
    total: 214.0, pay: 'Amex ·1002', ret: 0, war: 0,
    items: [
      { name: 'Return fare', price: 198.0 },
      { name: 'Seat reservation', price: 16.0 },
    ],
  },
  {
    id: 6, merchant: 'Birch Hardware', cat: 'Home', date: d(2026, 6, 26),
    total: 96.1, pay: 'Visa ·4417', ret: 30, war: 12,
    items: [
      { name: 'Cordless drill', price: 79.0 },
      { name: 'Bit set', price: 17.1 },
    ],
  },
];

// What the mocked "AI extraction" returns after a scan.
export const EXTRACTED = {
  merchant: 'Northline Electronics',
  total: '82.15',
  date: 'Jul 30, 2026',
  cat: 'Electronics',
};
