// CSV building — pure (no native deps) so it's unit-testable. The file-write +
// share side lives in lib/export.ts.

import { derive, fmtDY, statusOf, type Receipt } from './data';

/** CSV-escape a field: neutralize spreadsheet formula injection, then quote as
 *  needed. A value beginning with = + - @ (or tab/CR) can execute when opened in
 *  Excel/Sheets/Numbers, so it's prefixed with an apostrophe. */
export function esc(v: string | number): string {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function receiptsToCsv(receipts: Receipt[]): string {
  const header = ['Date', 'Merchant', 'Category', 'Total', 'Payment', 'Return by', 'Warranty until', 'Status', 'Items'];
  const lines = [header.join(',')];
  // Oldest first reads like a ledger.
  const sorted = [...receipts].sort((a, b) => a.date.getTime() - b.date.getTime());
  for (const r of sorted) {
    const v = derive(r);
    const items = r.items.map((it) => `${it.name} (${it.price.toFixed(2)})`).join('; ');
    lines.push(
      [
        esc(fmtDY(r.date)),
        esc(r.merchant),
        esc(r.cat),
        esc(r.total.toFixed(2)),
        esc(r.pay),
        esc(v.retBy ? fmtDY(v.retBy) : ''),
        esc(v.warTo ? fmtDY(v.warTo) : ''),
        esc(statusOf(r)),
        esc(items),
      ].join(','),
    );
  }
  return lines.join('\n');
}
