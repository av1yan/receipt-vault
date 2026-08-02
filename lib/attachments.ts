// Warranty documents / manuals / proof-of-purchase attached to a receipt.
// Files are copied into the app's document directory (so they persist) and
// tracked in the `attachments` table. Local to the device — the receipt photo
// syncs to the cloud, but documents stay on-device for now.

import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { Attachment } from './data';
import { deleteAttachmentRow, insertAttachment, loadAttachmentsFor } from './db';

const DIR = FileSystem.documentDirectory + 'attachments/';

export const listAttachments = loadAttachmentsFor;

async function ensureDir() {
  try {
    const info = await FileSystem.getInfoAsync(DIR);
    if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
  } catch {
    /* best-effort */
  }
}

function kindFor(name: string, mime?: string | null): Attachment['kind'] {
  const n = name.toLowerCase();
  if (n.endsWith('.pdf') || mime === 'application/pdf') return 'pdf';
  if (/\.(png|jpe?g|heic|heif|gif|webp)$/.test(n) || (mime ?? '').startsWith('image/')) return 'image';
  return 'file';
}

/** Pick a PDF or image and attach it to the receipt. Returns it, or null if cancelled. */
export async function pickAndAttach(receiptId: number): Promise<Attachment | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets?.length) return null;
  const asset = res.assets[0];
  const name = asset.name || 'document';
  const kind = kindFor(name, asset.mimeType);

  await ensureDir();
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
  const id = Crypto.randomUUID();
  const dest = `${DIR}${id}${ext}`;
  try {
    await FileSystem.copyAsync({ from: asset.uri, to: dest });
  } catch {
    return null;
  }

  const att: Attachment = { id, receiptId, name, uri: dest, kind, addedAt: Date.now() };
  await insertAttachment(att);
  return att;
}

/** Open an attachment in the OS viewer / share sheet. */
export async function openAttachment(a: Attachment): Promise<void> {
  if (Platform.OS === 'web') return;
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(a.uri);
}

/** Remove a single attachment (row + file). */
export async function removeAttachment(a: Attachment): Promise<void> {
  await deleteAttachmentRow(a.id);
  try {
    await FileSystem.deleteAsync(a.uri, { idempotent: true });
  } catch {
    /* file already gone */
  }
}

/** Delete the files for all of a receipt's attachments (rows cascade with the receipt). */
export async function deleteAttachmentFilesFor(receiptId: number): Promise<void> {
  const list = await loadAttachmentsFor(receiptId);
  for (const a of list) {
    try {
      await FileSystem.deleteAsync(a.uri, { idempotent: true });
    } catch {
      /* best-effort */
    }
  }
}
