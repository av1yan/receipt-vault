// Optional accounts. Sign-in is layered ON TOP of the account-free sync-code
// model: an account owns a random vault key stored server-side in the
// RLS-protected rv_user_vaults table. Signing in fetches (or creates) that key
// and makes it the active vault key, so the account's vault syncs across devices
// without copying a code. Signing out restores the device's own vault key.
//
// Uses the GoTrue + PostgREST REST endpoints directly (no extra dependency),
// matching the raw-fetch style of lib/sync.ts.

import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { errMsg, toSession, type Session } from './authParse';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';
import { getVaultKey, setVaultKey } from './sync';

const SESSION = 'rv-session';
const DEVICE_KEY_BACKUP = 'rv-device-vault-key';

export type { Session } from './authParse';
export type AuthResult = { ok: boolean; needsConfirm?: boolean; error?: string };

const baseHeaders = { apikey: SUPABASE_ANON_KEY, 'content-type': 'application/json' };

export async function getSession(): Promise<Session | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify({ email: email.trim(), password }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: errMsg(data, 'Sign-in failed') };
    const session = toSession(data);
    if (!session) return { ok: false, error: 'Sign-in failed' };
    await onSignedIn(session);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Network error' };
  }
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify({ email: email.trim(), password }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: errMsg(data, 'Sign-up failed') };
    const session = toSession(data);
    if (session) {
      await onSignedIn(session);
      return { ok: true };
    }
    // No session returned → the project requires email confirmation.
    return { ok: true, needsConfirm: true };
  } catch {
    return { ok: false, error: 'Network error' };
  }
}

export async function signOut(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION);
  // Restore the device's own vault key so local (non-account) syncing resumes.
  try {
    const backup = await SecureStore.getItemAsync(DEVICE_KEY_BACKUP);
    if (backup) await setVaultKey(backup);
  } catch {
    /* leave the current key if restore fails */
  }
}

async function onSignedIn(session: Session) {
  // Back up the device vault key once, so sign-out can restore it later.
  try {
    const current = await getVaultKey();
    const backup = await SecureStore.getItemAsync(DEVICE_KEY_BACKUP);
    if (current && !backup) await SecureStore.setItemAsync(DEVICE_KEY_BACKUP, current);
  } catch {
    /* non-fatal */
  }
  await SecureStore.setItemAsync(SESSION, JSON.stringify(session));
  await activateAccountVaultKey(session);
}

/** Fetch the account's vault key (creating a random one on first sign-in) and make it active. */
async function activateAccountVaultKey(session: Session) {
  let key = await fetchVaultKey(session.accessToken);
  if (!key) {
    const bytes = await Crypto.getRandomBytesAsync(20);
    key = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
    await fetch(`${SUPABASE_URL}/rest/v1/rv_user_vaults`, {
      method: 'POST',
      headers: { ...baseHeaders, Authorization: `Bearer ${session.accessToken}`, Prefer: 'return=minimal' },
      body: JSON.stringify({ user_id: session.userId, vault_key: key }),
    });
  }
  if (key) await setVaultKey(key);
}

async function fetchVaultKey(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rv_user_vaults?select=vault_key`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows[0]?.vault_key ? String(rows[0].vault_key) : null;
  } catch {
    return null;
  }
}
