// Warranty documents / manuals / proof-of-purchase attached to a receipt.
// Files are copied into the app's document directory (so they persist) and
// tracked in the `attachments` table. They sync to the cloud like receipt
// photos — files via signed URLs, metadata riding the receipt (see lib/sync.ts).

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

// ── Cloud sync helpers (files ride signed URLs; metadata rides the receipt). ──

const MANIFEST = FileSystem.documentDirectory + 'cloud-attachments.json';

/** Ids of attachment files already uploaded to the cloud. */
export async function loadUploadedAttIds(): Promise<Set<string>> {
  try {
    const info = await FileSystem.getInfoAsync(MANIFEST);
    if (!info.exists) return new Set();
    const arr = JSON.parse(await FileSystem.readAsStringAsync(MANIFEST));
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
}

async function saveUploadedAttIds(ids: Set<string>) {
  try {
    await FileSystem.writeAsStringAsync(MANIFEST, JSON.stringify([...ids]));
  } catch (e) {
    console.warn('[receipt-vault] saveUploadedAttIds failed', e);
  }
}

export async function markAttUploaded(id: string): Promise<void> {
  const ids = await loadUploadedAttIds();
  ids.add(id);
  await saveUploadedAttIds(ids);
}

export async function localAttachmentExists(uri: string | null | undefined): Promise<boolean> {
  if (!uri) return false;
  try {
    return (await FileSystem.getInfoAsync(uri)).exists;
  } catch {
    return false;
  }
}

function mimeFor(kind: Attachment['kind'], name: string): string {
  if (kind === 'pdf') return 'application/pdf';
  const n = name.toLowerCase();
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.heic') || n.endsWith('.heif')) return 'image/heic';
  if (n.endsWith('.webp')) return 'image/webp';
  if (n.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

/** PUT an attachment file to a signed upload URL. Returns success. */
export async function uploadAttachmentFile(signedUrl: string, a: Attachment): Promise<boolean> {
  try {
    const res = await FileSystem.uploadAsync(signedUrl, a.uri, {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: { 'content-type': mimeFor(a.kind, a.name), 'x-upsert': 'true' },
    });
    return res.status >= 200 && res.status < 300;
  } catch (e) {
    console.warn('[receipt-vault] uploadAttachmentFile failed', a.id, e);
    return false;
  }
}

/** Download a cloud attachment to the local dir and record it. Returns it, or null. */
export async function saveDownloadedAttachment(
  meta: { id: string; name: string; kind: Attachment['kind']; receiptId: number },
  signedUrl: string,
): Promise<Attachment | null> {
  try {
    await ensureDir();
    const ext = meta.name.includes('.') ? meta.name.slice(meta.name.lastIndexOf('.')) : '';
    const dest = `${DIR}${meta.id}${ext}`;
    const res = await FileSystem.downloadAsync(signedUrl, dest);
    if (res.status < 200 || res.status >= 300) return null;
    const att: Attachment = { id: meta.id, receiptId: meta.receiptId, name: meta.name, uri: dest, kind: meta.kind, addedAt: Date.now() };
    await insertAttachment(att);
    return att;
  } catch (e) {
    console.warn('[receipt-vault] saveDownloadedAttachment failed', meta.id, e);
    return null;
  }
}
