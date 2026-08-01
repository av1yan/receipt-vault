// Photo-binary sync helpers. Receipt photos live locally under
// documentDirectory/receipts/. On cloud sync each one is uploaded to a private
// Supabase Storage bucket via a short-lived signed URL, and pulled back on other
// devices the same way. A small on-disk manifest tracks which receipt ids have
// their photo confirmed in the cloud, so we never re-upload the same file.

import * as FileSystem from 'expo-file-system/legacy';

const DIR = FileSystem.documentDirectory + 'receipts/';
const MANIFEST = FileSystem.documentDirectory + 'cloud-photos.json';

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
}

/** Receipt ids whose photo is confirmed present in cloud storage. */
export async function loadCloudPhotoIds(): Promise<Set<number>> {
  try {
    const info = await FileSystem.getInfoAsync(MANIFEST);
    if (!info.exists) return new Set();
    const arr = JSON.parse(await FileSystem.readAsStringAsync(MANIFEST));
    return new Set(Array.isArray(arr) ? arr.map(Number) : []);
  } catch {
    return new Set();
  }
}

async function saveCloudPhotoIds(set: Set<number>) {
  try {
    await FileSystem.writeAsStringAsync(MANIFEST, JSON.stringify([...set]));
  } catch (e) {
    console.warn('[receipt-vault] saveCloudPhotoIds failed', e);
  }
}

/** Mark a receipt's photo as present in the cloud (idempotent). */
export async function markCloudPhoto(id: number) {
  const s = await loadCloudPhotoIds();
  if (!s.has(id)) {
    s.add(id);
    await saveCloudPhotoIds(s);
  }
}

/** Delete a receipt's local photo file and drop it from the cloud manifest. */
export async function deletePhotoFor(receipt: { id: number; imageUri?: string | null }): Promise<void> {
  if (receipt.imageUri && receipt.imageUri.startsWith('file')) {
    try {
      await FileSystem.deleteAsync(receipt.imageUri, { idempotent: true });
    } catch (e) {
      console.warn('[receipt-vault] deletePhotoFor failed', e);
    }
  }
  try {
    const s = await loadCloudPhotoIds();
    if (s.has(receipt.id)) {
      s.delete(receipt.id);
      await saveCloudPhotoIds(s);
    }
  } catch {
    /* ignore */
  }
}

/** True if the given file:// URI still points at a real local file. */
export async function localPhotoExists(uri?: string | null): Promise<boolean> {
  if (!uri || !uri.startsWith('file')) return false;
  try {
    return (await FileSystem.getInfoAsync(uri)).exists;
  } catch {
    return false;
  }
}

/** PUT a local photo file to a signed upload URL. Returns success. */
export async function uploadPhoto(signedUrl: string, fileUri: string): Promise<boolean> {
  try {
    const mime = fileUri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
    const res = await FileSystem.uploadAsync(signedUrl, fileUri, {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: { 'content-type': mime, 'x-upsert': 'true' },
    });
    return res.status >= 200 && res.status < 300;
  } catch (e) {
    console.warn('[receipt-vault] uploadPhoto failed', e);
    return false;
  }
}

/** Download a cloud photo to permanent local storage. Returns the file:// URI. */
export async function downloadPhoto(signedUrl: string, id: number): Promise<string | null> {
  try {
    await ensureDir();
    const dest = `${DIR}${id}.jpg`;
    const res = await FileSystem.downloadAsync(signedUrl, dest);
    if (res.status >= 200 && res.status < 300) return dest;
    return null;
  } catch (e) {
    console.warn('[receipt-vault] downloadPhoto failed', e);
    return null;
  }
}
