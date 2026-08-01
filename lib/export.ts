// CSV export — hand the ledger CSV (built in lib/csv.ts) to the OS share sheet
// (Mail, Files, AirDrop, etc.). Great for taxes/expenses.

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { receiptsToCsv } from './csv';
import type { Receipt } from './data';

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
