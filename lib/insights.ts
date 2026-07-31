// Pure analytics over the receipt set — monthly trend, top merchants, and
// recurring-merchant / subscription detection. No side effects; easy to test.

import type { Receipt } from './data';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export type MonthPoint = { key: string; label: string; total: number };

/** Totals per calendar month, oldest→newest, limited to the last `months`. */
export function monthlyTotals(receipts: Receipt[], months = 6): MonthPoint[] {
  const by = new Map<string, number>();
  for (const r of receipts) {
    const k = `${r.date.getFullYear()}-${String(r.date.getMonth() + 1).padStart(2, '0')}`;
    by.set(k, (by.get(k) ?? 0) + r.total);
  }
  const keys = [...by.keys()].sort().slice(-months);
  // Disambiguate the month labels with a 2-digit year when the window spans years.
  const multiYear = new Set(keys.map((k) => k.slice(0, 4))).size > 1;
  return keys.map((k) => {
    const label = MON[Number(k.slice(5, 7)) - 1] + (multiYear ? ` '${k.slice(2, 4)}` : '');
    return { key: k, label, total: by.get(k) ?? 0 };
  });
}

export type MerchantAgg = { merchant: string; total: number; count: number };

/** Top merchants by total spend. */
export function topMerchants(receipts: Receipt[], n = 5): MerchantAgg[] {
  const by = new Map<string, MerchantAgg>();
  for (const r of receipts) {
    const cur = by.get(r.merchant) ?? { merchant: r.merchant, total: 0, count: 0 };
    cur.total += r.total;
    cur.count += 1;
    by.set(r.merchant, cur);
  }
  return [...by.values()].sort((a, b) => b.total - a.total).slice(0, n);
}

export type Recurring = {
  merchant: string;
  count: number;
  total: number;
  avg: number;
  monthly: number; // spend spread over the months it spans
  likely: boolean; // steady amount + 3+ hits → probably a subscription
};

/** Merchants you've bought from more than once, with a monthly estimate. */
export function recurringMerchants(receipts: Receipt[]): Recurring[] {
  const by = new Map<string, Receipt[]>();
  for (const r of receipts) {
    const list = by.get(r.merchant) ?? [];
    list.push(r);
    by.set(r.merchant, list);
  }
  const out: Recurring[] = [];
  for (const [merchant, list] of by) {
    if (list.length < 2) continue;
    const total = list.reduce((a, r) => a + r.total, 0);
    const avg = total / list.length;
    const idx = list.map((r) => r.date.getFullYear() * 12 + r.date.getMonth()).sort((a, b) => a - b);
    const span = Math.max(1, idx[idx.length - 1] - idx[0] + 1);
    const monthly = total / span;
    const variance = list.reduce((a, r) => a + (r.total - avg) ** 2, 0) / list.length;
    const cv = avg > 0 ? Math.sqrt(variance) / avg : 1;
    const likely = list.length >= 3 && cv < 0.15;
    out.push({ merchant, count: list.length, total, avg, monthly, likely });
  }
  return out.sort((a, b) => b.total - a.total);
}
