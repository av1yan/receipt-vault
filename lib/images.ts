// Moves a freshly captured/picked image out of the cache (which the OS can
// evict) into a permanent per-app folder, so the saved receipt keeps its photo.

import * as FileSystem from 'expo-file-system/legacy';

const DIR = FileSystem.documentDirectory + 'receipts/';

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
}

/**
 * Copy `srcUri` into permanent storage and return the new file:// URI.
 * On any failure (e.g. web), falls back to the original URI so the flow
 * still works — the photo just isn't relocated.
 */
export async function persistImage(srcUri: string, id: number): Promise<string> {
  try {
    await ensureDir();
    const ext = srcUri.split('.').pop()?.split('?')[0] || 'jpg';
    const dest = `${DIR}${id}.${ext}`;
    await FileSystem.copyAsync({ from: srcUri, to: dest });
    return dest;
  } catch (e) {
    console.warn('[receipt-vault] persistImage failed, using source uri', e);
    return srcUri;
  }
}
