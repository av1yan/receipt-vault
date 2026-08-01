// Tombstones for deleted receipts. Deleting a receipt records its id here so
// (a) the delete is pushed to the cloud on the next sync, and (b) a pull can't
// re-add it. Persisted as a small JSON id list on device.

import * as FileSystem from 'expo-file-system/legacy';

const FILE = FileSystem.documentDirectory + 'deleted-ids.json';

export async function loadTombstones(): Promise<number[]> {
  try {
    const info = await FileSystem.getInfoAsync(FILE);
    if (!info.exists) return [];
    const arr = JSON.parse(await FileSystem.readAsStringAsync(FILE));
    return Array.isArray(arr) ? arr.map(Number).filter(Number.isFinite) : [];
  } catch {
    return [];
  }
}

export async function saveTombstones(ids: number[]): Promise<void> {
  try {
    await FileSystem.writeAsStringAsync(FILE, JSON.stringify([...new Set(ids)]));
  } catch (e) {
    console.warn('[receipt-vault] saveTombstones failed', e);
  }
}
