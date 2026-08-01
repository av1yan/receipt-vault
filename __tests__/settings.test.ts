// Unit tests for the settings persistence layer. The real module talks to
// expo-file-system; here we swap that for a tiny in-memory filesystem so the
// load/save + validation logic can be tested without native deps.

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

import { DEFAULT_SETTINGS, LEAD_PRESETS, loadSettings, saveSettings } from '../lib/settings';

const FILE = 'doc://settings.json';

beforeEach(() => {
  for (const k of Object.keys(mockFiles)) delete mockFiles[k];
});

describe('loadSettings', () => {
  it('returns defaults when no file exists', async () => {
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('returns a fresh object (not the DEFAULT_SETTINGS reference)', async () => {
    const s = await loadSettings();
    expect(s).not.toBe(DEFAULT_SETTINGS);
  });

  it('reads a valid stored lead time', async () => {
    mockFiles[FILE] = JSON.stringify({ reminderLeadDays: 7 });
    expect((await loadSettings()).reminderLeadDays).toBe(7);
  });

  it.each([0, -3, NaN, 'abc', null, undefined])(
    'falls back to default for invalid lead value %p',
    async (bad) => {
      mockFiles[FILE] = JSON.stringify({ reminderLeadDays: bad });
      expect((await loadSettings()).reminderLeadDays).toBe(DEFAULT_SETTINGS.reminderLeadDays);
    },
  );

  it('falls back to default when the field is missing', async () => {
    mockFiles[FILE] = JSON.stringify({ somethingElse: true });
    expect((await loadSettings()).reminderLeadDays).toBe(DEFAULT_SETTINGS.reminderLeadDays);
  });

  it('falls back to default on malformed JSON', async () => {
    mockFiles[FILE] = 'not-json{';
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});

describe('saveSettings', () => {
  it('persists a value that loadSettings reads back (round-trip)', async () => {
    await saveSettings({ reminderLeadDays: 1 });
    expect(mockFiles[FILE]).toBe(JSON.stringify({ reminderLeadDays: 1 }));
    expect((await loadSettings()).reminderLeadDays).toBe(1);
  });

  it('round-trips every allowed preset', async () => {
    for (const d of LEAD_PRESETS) {
      await saveSettings({ reminderLeadDays: d });
      expect((await loadSettings()).reminderLeadDays).toBe(d);
    }
  });
});
