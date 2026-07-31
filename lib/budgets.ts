// Per-category monthly budgets, persisted as a small JSON file on device.
// Shape: { [category]: monthlyLimit }. Categories with no entry are unbudgeted.

import * as FileSystem from 'expo-file-system/legacy';

export type Budgets = Record<string, number>;

const FILE = FileSystem.documentDirectory + 'budgets.json';

export async function loadBudgets(): Promise<Budgets> {
  try {
    const info = await FileSystem.getInfoAsync(FILE);
    if (!info.exists) return {};
    const raw = JSON.parse(await FileSystem.readAsStringAsync(FILE));
    const out: Budgets = {};
    for (const [k, v] of Object.entries(raw ?? {})) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) out[k] = n;
    }
    return out;
  } catch {
    return {};
  }
}

export async function saveBudgets(b: Budgets): Promise<void> {
  try {
    await FileSystem.writeAsStringAsync(FILE, JSON.stringify(b));
  } catch (e) {
    console.warn('[receipt-vault] saveBudgets failed', e);
  }
}
