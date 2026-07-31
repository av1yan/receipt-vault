import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { SEED, type Receipt, type ReceiptStatus, type StatusKind } from './data';
import { initDb, insertReceipt, loadReceipts } from './db';
import { rescheduleAll, scheduleForReceipt } from './notifications';
import { colors } from './theme';

type NewReceipt = Omit<Receipt, 'id'>;

type VaultCtx = {
  receipts: Receipt[];
  addReceipt: (r: NewReceipt) => void;
  mergeReceipts: (remote: Receipt[]) => void;
  setStatus: (id: number, status: ReceiptStatus, kind?: StatusKind | null) => void;
  toast: string;
  flash: (msg: string) => void;
};

const Ctx = createContext<VaultCtx | null>(null);

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Whether writes should hit SQLite. Flipped off if the DB can't open.
  const persist = useRef(true);

  // Load from SQLite once; fall back to in-memory seed if unavailable.
  useEffect(() => {
    let alive = true;
    // Web (preview only) has no reliable file-backed SQLite — its wasm worker
    // can hang openDatabaseAsync — so use in-memory seed data there. Native
    // uses the real persistent database.
    if (Platform.OS === 'web') {
      persist.current = false;
      setReceipts(SEED);
      setReady(true);
      return;
    }
    (async () => {
      try {
        await initDb();
        const rows = await loadReceipts();
        if (alive) setReceipts(rows);
      } catch (e) {
        console.warn('[receipt-vault] SQLite unavailable, using in-memory data', e);
        persist.current = false;
        if (alive) setReceipts(SEED);
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2400);
  }, []);

  const addReceipt = useCallback((r: NewReceipt) => {
    const receipt: Receipt = { ...r, id: Date.now() };
    setReceipts((prev) => [receipt, ...prev]); // optimistic
    if (persist.current) {
      insertReceipt(receipt).catch((e) => console.warn('[receipt-vault] insert failed', e));
    }
    // Schedule its deadline reminders (no-op until the user grants permission).
    scheduleForReceipt(receipt).catch((e) => console.warn('[receipt-vault] schedule failed', e));
  }, []);

  // Merge receipts pulled from the cloud (remote wins on id conflict).
  const mergeReceipts = useCallback((remote: Receipt[]) => {
    if (remote.length === 0) return;
    setReceipts((prev) => {
      const byId = new Map(prev.map((r) => [r.id, r]));
      for (const r of remote) byId.set(r.id, r);
      return [...byId.values()].sort(
        (a, b) => b.date.getTime() - a.date.getTime() || b.id - a.id,
      );
    });
    if (persist.current) {
      for (const r of remote) insertReceipt(r).catch((e) => console.warn('[receipt-vault] merge persist failed', e));
    }
  }, []);

  // Advance a receipt's claim lifecycle (open → filed → resolved, or reopen).
  const setStatus = useCallback((id: number, status: ReceiptStatus, kind: StatusKind | null = null) => {
    setReceipts((prev) => {
      const next = prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status,
              statusKind: status === 'open' ? null : (kind ?? r.statusKind ?? null),
              statusAt: new Date(),
            }
          : r,
      );
      const updated = next.find((r) => r.id === id);
      if (updated && persist.current) {
        insertReceipt(updated).catch((e) => console.warn('[receipt-vault] status persist failed', e));
      }
      // Filed/resolved receipts should stop firing reminders (best-effort).
      rescheduleAll(next).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ receipts, addReceipt, mergeReceipts, setStatus, toast, flash }),
    [receipts, addReceipt, mergeReceipts, setStatus, toast, flash],
  );

  // Hold the UI on a plain background until the first load settles, so the
  // vault never flashes empty before its rows arrive.
  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useVault() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useVault must be used within VaultProvider');
  return ctx;
}
