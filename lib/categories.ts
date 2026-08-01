// User-defined categories, layered on top of the built-in CATS. Persisted as a
// small JSON string array on device. Built-ins can't be removed; customs can.

import * as FileSystem from 'expo-file-system/legacy';
import { CATS } from './data';

const FILE = FileSystem.documentDirectory + 'categories.json';

/** Trim and collapse internal whitespace. Returns '' for blank input. */
export function normalizeCat(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

const isBuiltin = (key: string) => CATS.some((c) => c.toLowerCase() === key);

export async function loadCategories(): Promise<string[]> {
  try {
    const info = await FileSystem.getInfoAsync(FILE);
    if (!info.exists) return [];
    const raw = JSON.parse(await FileSystem.readAsStringAsync(FILE));
    if (!Array.isArray(raw)) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const v of raw) {
      const n = normalizeCat(String(v));
      const key = n.toLowerCase();
      if (n && !isBuiltin(key) && !seen.has(key)) {
        seen.add(key);
        out.push(n);
      }
    }
    return out;
  } catch {
    return [];
  }
}

export async function saveCategories(cats: string[]): Promise<void> {
  try {
    await FileSystem.writeAsStringAsync(FILE, JSON.stringify(cats));
  } catch (e) {
    console.warn('[receipt-vault] saveCategories failed', e);
  }
}
