// Cloud sync client. Each device holds a private "vault key" in the secure
// keychain; receipts sync through the `sync` edge function which scopes storage
// by sha256(vaultKey). Enter the same key on another device to share a vault.
//
// Syncs receipt data + line items AND photo binaries: each photo is uploaded to
// a private Storage bucket via a signed URL and pulled back on other devices.

import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';
import type { Receipt } from './data';
import {
  downloadPhoto,
  loadCloudPhotoIds,
  localPhotoExists,
  markCloudPhoto,
  uploadPhoto,
} from './photoSync';

const KEY_STORE = 'receiptVaultSyncKey';

// What the server returns per receipt (metadata + a "photo is in the cloud" flag).
type CloudReceipt = {
  id: number;
  merchant: string;
  cat: string;
  date: number; // epoch millis
  total: number;
  pay: string;
  ret: number;
  war: number;
  hasPhoto: boolean;
  items: { name: string; price: number }[];
};

export async function getVaultKey(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    return await SecureStore.getItemAsync(KEY_STORE);
  } catch {
    return null;
  }
}

/** Get the device's vault key, generating a fresh one on first use. */
export async function ensureVaultKey(): Promise<string> {
  const existing = await getVaultKey();
  if (existing) return existing;
  const bytes = await Crypto.getRandomBytesAsync(20);
  const key = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  await SecureStore.setItemAsync(KEY_STORE, key);
  return key;
}

/** Adopt a vault key shared from another device (for restore/sharing). */
export async function setVaultKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(KEY_STORE, key.trim().toLowerCase());
}

async function callSync(payload: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/sync`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`sync HTTP ${res.status}`);
  return res.json();
}

/**
 * Push local receipts + their photos and pull the merged set back.
 * Returns remote receipts with each `imageUri` resolved for THIS device
 * (kept local when present, downloaded from the cloud otherwise).
 */
export async function syncNow(local: Receipt[]): Promise<Receipt[]> {
  const vaultKey = await ensureVaultKey();
  const inCloud = await loadCloudPhotoIds();

  // 1. Upload any local photo that isn't in the cloud yet.
  for (const r of local) {
    if (inCloud.has(r.id) || !(await localPhotoExists(r.imageUri))) continue;
    try {
      const { signedUrl } = await callSync({ vaultKey, op: 'signUpload', id: r.id });
      if (signedUrl && (await uploadPhoto(signedUrl, r.imageUri!))) {
        await markCloudPhoto(r.id);
        inCloud.add(r.id);
      }
    } catch (e) {
      console.warn('[receipt-vault] photo upload failed', r.id, e);
    }
  }

  // 2. Push metadata (with per-receipt hasImage) + pull the merged set.
  const data = await callSync({
    vaultKey,
    op: 'both',
    receipts: local.map((r) => toCloud(r, inCloud.has(r.id) || !!r.imageUri)),
  });
  const remote: CloudReceipt[] = data.receipts ?? [];

  // 3. Fetch signed download URLs for cloud photos we don't have locally.
  const localById = new Map(local.map((r) => [r.id, r] as const));
  const missing = remote.filter(
    (c) => c.hasPhoto && !inCloud.has(c.id) && !localById.get(c.id)?.imageUri,
  );
  let urls: Record<string, string> = {};
  if (missing.length) {
    try {
      const resp = await callSync({ vaultKey, op: 'signDownload', ids: missing.map((c) => c.id) });
      urls = resp.urls ?? {};
    } catch (e) {
      console.warn('[receipt-vault] signDownload failed', e);
    }
  }

  // 4. Resolve each receipt's photo for this device.
  const out: Receipt[] = [];
  for (const c of remote) {
    const localR = localById.get(c.id);
    let imageUri: string | null = null;
    if (await localPhotoExists(localR?.imageUri)) {
      imageUri = localR!.imageUri!; // already have it on this device
    } else if (c.hasPhoto && urls[c.id]) {
      const saved = await downloadPhoto(urls[c.id], c.id);
      if (saved) {
        imageUri = saved;
        await markCloudPhoto(c.id);
      }
    }
    out.push(fromCloud(c, imageUri));
  }
  return out;
}

function toCloud(r: Receipt, hasImage: boolean) {
  return {
    id: r.id,
    merchant: r.merchant,
    cat: r.cat,
    date: r.date.getTime(),
    total: r.total,
    pay: r.pay,
    ret: r.ret,
    war: r.war,
    hasImage,
    items: r.items,
  };
}

function fromCloud(c: CloudReceipt, imageUri: string | null): Receipt {
  return {
    id: c.id,
    merchant: c.merchant,
    cat: c.cat,
    date: new Date(c.date),
    total: c.total,
    pay: c.pay,
    ret: c.ret,
    war: c.war,
    imageUri,
    items: Array.isArray(c.items) ? c.items : [],
  };
}
