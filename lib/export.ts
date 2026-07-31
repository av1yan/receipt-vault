// CSV export — build a spreadsheet-friendly ledger of receipts and hand it to
// the OS share sheet (Mail, Files, AirDrop, etc.). Great for taxes/expenses.

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { derive, fmtDY, statusOf, type Receipt } from './data';

/** Quote a CSV field only when it contains a comma, quote, or newline. */
function esc(v: string | number): string {
  const s = String(v ?? '');
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

export type ExportResult = 'shared' | 'unavailable' | 'empty' | 'error';

/** Write the CSV to a temp file and open the share sheet. */
export async function exportReceiptsCsv(receipts: Receipt[], fileBase = 'receipt-vault'): Promise<ExportResult> {
  if (receipts.length === 0) return 'empty';
  try {
    const uri = FileSystem.cacheDirectory + `${fileBase}.csv`;
    await FileSystem.writeAsStringAsync(uri, receiptsToCsv(receipts));
    if (!(await Sharing.isAvailableAsync())) return 'unavailable';
    await Sharing.shareAsync(uri, {
      mimeType: 'text/csv',
      UTI: 'public.comma-separated-values-text',
      dialogTitle: 'Export receipts',
    });
    return 'shared';
  } catch (e) {
    console.warn('[receipt-vault] CSV export failed', e);
    return 'error';
  }
}
