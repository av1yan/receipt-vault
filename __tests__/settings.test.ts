// Unit tests for the settings persistence layer. The real module talks to
// expo-file-system; here we swap that for a tiny in-memory filesystem so the
// load/save/merge + validation logic can be tested without native deps.

const mockFiles: Record<string, string> = {};

jest.mock(
  'expo-file-system/legacy',
  () => ({
    documentDirectory: 'doc://',
    getInfoAsync: jest.fn(async (uri: string) => ({
      exists: Object.prototype.hasOwnProperty.call(mockFiles, uri),
    })),
    readAsStringAsync: jest.fn(async (uri: string) => {
      if (!(uri in mockFiles)) throw new Error('ENOENT');
      return mockFiles[uri];
    }),
    writeAsStringAsync: jest.fn(async (uri: string, data: string) => {
      mockFiles[uri] = data;
    }),
  }),
  { virtual: true },
);

import {
  DEFAULT_SETTINGS,
  LEAD_PRESETS,
  THEME_OPTIONS,
  loadSettings,
  saveSettings,
  updateSettings,
} from '../lib/settings';

const FILE = 'doc://settings.json';

beforeEach(() => {
  for (const k of Object.keys(mockFiles)) delete mockFiles[k];
});

describe('loadSettings', () => {
  it('returns defaults when no file exists', async () => {
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('returns a fresh object (not the DEFAULT_SETTINGS reference)', async () => {
    expect(await loadSettings()).not.toBe(DEFAULT_SETTINGS);
  });

  it('reads a valid stored lead time and theme', async () => {
    mockFiles[FILE] = JSON.stringify({ reminderLeadDays: 7, themePref: 'dark' });
    expect(await loadSettings()).toEqual({ reminderLeadDays: 7, themePref: 'dark' });
  });

  it.each([0, -3, NaN, 'abc', null, undefined])(
    'falls back to default lead for invalid value %p',
    async (bad) => {
      mockFiles[FILE] = JSON.stringify({ reminderLeadDays: bad });
      expect((await loadSettings()).reminderLeadDays).toBe(DEFAULT_SETTINGS.reminderLeadDays);
    },
  );

  it.each(['blue', '', 'System', 42, null])(
    'falls back to default theme for invalid value %p',
    async (bad) => {
      mockFiles[FILE] = JSON.stringify({ themePref: bad });
      expect((await loadSettings()).themePref).toBe(DEFAULT_SETTINGS.themePref);
    },
  );

  it('falls back to defaults when fields are missing', async () => {
    mockFiles[FILE] = JSON.stringify({ somethingElse: true });
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('falls back to defaults on malformed JSON', async () => {
    mockFiles[FILE] = 'not-json{';
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});

describe('saveSettings', () => {
  it('persists a value that loadSettings reads back (round-trip)', async () => {
    const s = { reminderLeadDays: 1, themePref: 'light' as const };
    await saveSettings(s);
    expect(mockFiles[FILE]).toBe(JSON.stringify(s));
    expect(await loadSettings()).toEqual(s);
  });

  it('round-trips every lead preset and theme option', async () => {
    for (const d of LEAD_PRESETS) {
      for (const t of THEME_OPTIONS) {
        await saveSettings({ reminderLeadDays: d, themePref: t });
        expect(await loadSettings()).toEqual({ reminderLeadDays: d, themePref: t });
      }
    }
  });
});

describe('updateSettings', () => {
  it('merges a partial change without clobbering the other field', async () => {
    await saveSettings({ reminderLeadDays: 7, themePref: 'light' });

    await updateSettings({ themePref: 'dark' });
    expect(await loadSettings()).toEqual({ reminderLeadDays: 7, themePref: 'dark' });

    await updateSettings({ reminderLeadDays: 1 });
    expect(await loadSettings()).toEqual({ reminderLeadDays: 1, themePref: 'dark' });
  });

  it('starts from defaults when nothing is stored yet', async () => {
    const next = await updateSettings({ themePref: 'dark' });
    expect(next).toEqual({ reminderLeadDays: DEFAULT_SETTINGS.reminderLeadDays, themePref: 'dark' });
  });
});
