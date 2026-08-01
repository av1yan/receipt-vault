import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { loadBudgets, saveBudgets, type Budgets } from './budgets';
import { SEED, type Receipt, type ReceiptStatus, type StatusKind } from './data';
import { initDb, insertReceipt, loadReceipts } from './db';
import { rescheduleAll, scheduleForReceipt } from './notifications';
import { colors } from './theme';

type NewReceipt = Omit<Receipt, 'id'>;

type VaultCtx = {
  receipts: Receipt[];
  addReceipt: (r: NewReceipt) => void;
  updateReceipt: (r: Receipt) => void;
  mergeReceipts: (remote: Receipt[]) => void;
  setStatus: (id: number, status: ReceiptStatus, kind?: StatusKind | null) => void;
  setReimbursable: (id: number, value: boolean) => void;
  budgets: Budgets;
  setBudget: (cat: string, amount: number) => void;
  toast: string;
  flash: (msg: string) => void;
};

const Ctx = createContext<VaultCtx | null>(null);

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [budgets, setBudgets] = useState<Budgets>({});
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Whether writes should hit SQLite. Flipped off if the DB can't open.
  const persist = useRef(true);
  // Always-current receipts, so mutators can compute the next array outside the
  // state updater (updaters must be pure / may run twice).
  const receiptsRef = useRef<Receipt[]>([]);
  receiptsRef.current = receipts;
  // Monotonic id source so two receipts added in the same millisecond can't collide.
  const lastId = useRef(0);

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

  const setReimbursable = useCallback((id: number, value: boolean) => {
    const next = receiptsRef.current.map((r) => (r.id === id ? { ...r, reimbursable: value } : r));
    setReceipts(next);
    const updated = next.find((r) => r.id === id);
    if (updated && persist.current) {
      insertReceipt(updated).catch((e) => console.warn('[receipt-vault] reimbursable persist failed', e));
    }
  }, []);

  // Category budgets live in a small on-disk JSON file.
  useEffect(() => {
    loadBudgets().then(setBudgets).catch(() => {});
  }, []);

  const setBudget = useCallback((cat: string, amount: number) => {
    setBudgets((prev) => {
      const next = { ...prev };
      if (amount > 0) next[cat] = amount;
      else delete next[cat];
      saveBudgets(next);
      return next;
    });
  }, []);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2400);
  }, []);

  const addReceipt = useCallback((r: NewReceipt) => {
    const id = Math.max(Date.now(), lastId.current + 1);
    lastId.current = id;
    const receipt: Receipt = { ...r, id };
    setReceipts((prev) => [receipt, ...prev]); // optimistic
    if (persist.current) {
      insertReceipt(receipt).catch((e) => console.warn('[receipt-vault] insert failed', e));
    }
    // Schedule its deadline reminders (no-op until the user grants permission).
    scheduleForReceipt(receipt).catch((e) => console.warn('[receipt-vault] schedule failed', e));
  }, []);

  // Replace an edited receipt (same id) and re-persist + reschedule.
  const updateReceipt = useCallback((updated: Receipt) => {
    const next = receiptsRef.current.map((r) => (r.id === updated.id ? updated : r));
    setReceipts(next);
    if (persist.current) {
      insertReceipt(updated).catch((e) => console.warn('[receipt-vault] update failed', e));
    }
    rescheduleAll(next).catch(() => {});
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
      // Persist sequentially — insertReceipt wraps each write in its own
      // transaction on the shared connection, so overlapping them can fail.
      (async () => {
        for (const r of remote) {
          try {
            await insertReceipt(r);
          } catch (e) {
            console.warn('[receipt-vault] merge persist failed', e);
          }
        }
      })();
    }
  }, []);

  // Advance a receipt's claim lifecycle (open → filed → resolved, or reopen).
  const setStatus = useCallback((id: number, status: ReceiptStatus, kind: StatusKind | null = null) => {
    const at = new Date();
    const next = receiptsRef.current.map((r) =>
      r.id === id
        ? { ...r, status, statusKind: status === 'open' ? null : (kind ?? r.statusKind ?? null), statusAt: at }
        : r,
    );
    setReceipts(next);
    const updated = next.find((r) => r.id === id);
    if (updated && persist.current) {
      insertReceipt(updated).catch((e) => console.warn('[receipt-vault] status persist failed', e));
    }
    // Filed/resolved receipts should stop firing reminders (best-effort).
    rescheduleAll(next).catch(() => {});
  }, []);

  const value = useMemo(
    () => ({ receipts, addReceipt, updateReceipt, mergeReceipts, setStatus, setReimbursable, budgets, setBudget, toast, flash }),
    [receipts, addReceipt, updateReceipt, mergeReceipts, setStatus, setReimbursable, budgets, setBudget, toast, flash],
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
