// Small app-preferences store (a single JSON file on device). Holds the
// reminder lead time and the theme preference; add more keys here as needed.

import * as FileSystem from 'expo-file-system/legacy';

const FILE = FileSystem.documentDirectory + 'settings.json';

export type ThemePref = 'system' | 'light' | 'dark';

export type AppSettings = {
  /** Days before a deadline to fire its reminder. */
  reminderLeadDays: number;
  /** Light / dark / follow the OS. */
  themePref: ThemePref;
  /** Require Face ID / passcode to open the vault. */
  appLock: boolean;
};

export const DEFAULT_SETTINGS: AppSettings = { reminderLeadDays: 3, themePref: 'system', appLock: false };

/** Allowed lead-time presets shown in Settings. */
export const LEAD_PRESETS = [1, 3, 7] as const;
/** Allowed theme options shown in Settings. */
export const THEME_OPTIONS: ThemePref[] = ['system', 'light', 'dark'];

export async function loadSettings(): Promise<AppSettings> {
  try {
    const info = await FileSystem.getInfoAsync(FILE);
    if (!info.exists) return { ...DEFAULT_SETTINGS };
    const raw = JSON.parse(await FileSystem.readAsStringAsync(FILE));
    const lead = Number(raw?.reminderLeadDays);
    const theme = raw?.themePref;
    return {
      reminderLeadDays: Number.isFinite(lead) && lead > 0 ? lead : DEFAULT_SETTINGS.reminderLeadDays,
      themePref: THEME_OPTIONS.includes(theme) ? theme : DEFAULT_SETTINGS.themePref,
      appLock: typeof raw?.appLock === 'boolean' ? raw.appLock : DEFAULT_SETTINGS.appLock,
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

/** Merge a partial change into the stored settings (load → merge → save). */
export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const next = { ...(await loadSettings()), ...patch };
  await saveSettings(next);
  return next;
}
