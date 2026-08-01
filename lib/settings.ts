// Small app-preferences store (a single JSON file on device). Currently holds
// the reminder lead time; add more keys here as the Settings screen grows.

import * as FileSystem from 'expo-file-system/legacy';

const FILE = FileSystem.documentDirectory + 'settings.json';

export type AppSettings = {
  /** Days before a deadline to fire its reminder. */
  reminderLeadDays: number;
};

export const DEFAULT_SETTINGS: AppSettings = { reminderLeadDays: 3 };

/** Allowed lead-time presets shown in Settings. */
export const LEAD_PRESETS = [1, 3, 7] as const;

export async function loadSettings(): Promise<AppSettings> {
  try {
    const info = await FileSystem.getInfoAsync(FILE);
    if (!info.exists) return { ...DEFAULT_SETTINGS };
    const raw = JSON.parse(await FileSystem.readAsStringAsync(FILE));
    const lead = Number(raw?.reminderLeadDays);
    return {
      reminderLeadDays: Number.isFinite(lead) && lead > 0 ? lead : DEFAULT_SETTINGS.reminderLeadDays,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(s: AppSettings): Promise<void> {
  try {
    await FileSystem.writeAsStringAsync(FILE, JSON.stringify(s));
  } catch (e) {
    console.warn('[receipt-vault] saveSettings failed', e);
  }
}
