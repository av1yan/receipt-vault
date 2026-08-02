import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { deleteAttachmentFilesFor } from './attachments';
import { loadBudgets, saveBudgets, type Budgets } from './budgets';
import { loadCategories, normalizeCat, saveCategories } from './categories';
import { CATS, SEED, type Receipt, type ReceiptStatus, type StatusKind } from './data';
import { deleteReceipt as dbDeleteReceipt, initDb, insertReceipt, loadReceipts } from './db';
import { rescheduleAll, scheduleForReceipt } from './notifications';
import { deletePhotoFor } from './photoSync';
import { loadGoals, saveGoals, type SavingsGoal } from './savings';
import { colors } from './theme';
import { loadTombstones, saveTombstones } from './tombstones';

type NewReceipt = Omit<Receipt, 'id'>;

type VaultCtx = {
  receipts: Receipt[];
  addReceipt: (r: NewReceipt) => void;
  updateReceipt: (r: Receipt) => void;
  deleteReceipt: (id: number) => void;
  clearAll: () => void;
  mergeReceipts: (remote: Receipt[], removedIds?: number[]) => void;
  setStatus: (id: number, status: ReceiptStatus, kind?: StatusKind | null) => void;
  setReimbursable: (id: number, value: boolean) => void;
  touchReceipt: (id: number) => void;
  setInsured: (id: number, value: boolean) => void;
  setSerial: (id: number, value: string) => void;
  budgets: Budgets;
  setBudget: (cat: string, amount: number) => void;
  customCats: string[];
  allCats: string[];
  addCategory: (name: string) => void;
  removeCategory: (name: string) => void;
  savingsGoals: SavingsGoal[];
  addGoal: (name: string, target: number) => void;
  contributeGoal: (id: number, amount: number) => void;
  removeGoal: (id: number) => void;
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
  // Ids of deleted receipts, so a pull can't re-add them (loaded from disk).
  const tombstones = useRef<Set<number>>(new Set());
  useEffect(() => {
    loadTombstones().then((ids) => {
      tombstones.current = new Set(ids);
    });
  }, []);

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
    const next = receiptsRef.current.map((r) => (r.id === id ? { ...r, reimbursable: value, updatedAt: Date.now() } : r));
    setReceipts(next);
    const updated = next.find((r) => r.id === id);
    if (updated && persist.current) {
      insertReceipt(updated).catch((e) => console.warn('[receipt-vault] reimbursable persist failed', e));
    }
  }, []);

  // Bump a receipt's edit time (used when its attachments change) so the change syncs.
  const touchReceipt = useCallback((id: number) => {
    const next = receiptsRef.current.map((r) => (r.id === id ? { ...r, updatedAt: Date.now() } : r));
    setReceipts(next);
    const updated = next.find((r) => r.id === id);
    if (updated && persist.current) {
      insertReceipt(updated).catch((e) => console.warn('[receipt-vault] touch persist failed', e));
    }
  }, []);

  const setInsured = useCallback((id: number, value: boolean) => {
    const next = receiptsRef.current.map((r) => (r.id === id ? { ...r, insured: value, updatedAt: Date.now() } : r));
    setReceipts(next);
    const updated = next.find((r) => r.id === id);
    if (updated && persist.current) {
      insertReceipt(updated).catch((e) => console.warn('[receipt-vault] insured persist failed', e));
    }
  }, []);

  const setSerial = useCallback((id: number, value: string) => {
    const serial = value.trim();
    const next = receiptsRef.current.map((r) => (r.id === id ? { ...r, serial, updatedAt: Date.now() } : r));
    setReceipts(next);
    const updated = next.find((r) => r.id === id);
    if (updated && persist.current) {
      insertReceipt(updated).catch((e) => console.warn('[receipt-vault] serial persist failed', e));
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

  // User-defined categories (layered on top of the built-in CATS).
  const [customCats, setCustomCats] = useState<string[]>([]);
  useEffect(() => {
    loadCategories().then(setCustomCats).catch(() => {});
  }, []);
  const allCats = useMemo(() => [...CATS, ...customCats], [customCats]);

  const addCategory = useCallback((name: string) => {
    const n = normalizeCat(name);
    if (!n) return;
    const key = n.toLowerCase();
    if (CATS.some((c) => c.toLowerCase() === key)) return; // already a built-in
    setCustomCats((prev) => {
      if (prev.some((c) => c.toLowerCase() === key)) return prev;
      const next = [...prev, n];
      saveCategories(next);
      return next;
    });
  }, []);

  const removeCategory = useCallback((name: string) => {
    const key = name.toLowerCase();
    setCustomCats((prev) => {
      const next = prev.filter((c) => c.toLowerCase() !== key);
      if (next.length !== prev.length) saveCategories(next);
      return next;
    });
    setBudget(name, 0); // drop any budget tied to it
  }, [setBudget]);

  // Savings goals (named targets the user contributes toward).
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  useEffect(() => {
    loadGoals().then(setSavingsGoals).catch(() => {});
  }, []);

  const addGoal = useCallback((name: string, target: number) => {
    const n = name.trim();
    if (!n) return;
    const id = Math.max(Date.now(), lastId.current + 1);
    lastId.current = id;
    setSavingsGoals((prev) => {
      const next = [...prev, { id, name: n, target: Math.max(0, target || 0), saved: 0 }];
      saveGoals(next);
      return next;
    });
  }, []);

  const contributeGoal = useCallback((id: number, amount: number) => {
    if (!amount) return;
    setSavingsGoals((prev) => {
      const next = prev.map((g) => (g.id === id ? { ...g, saved: Math.max(0, g.saved + amount) } : g));
      saveGoals(next);
      return next;
    });
  }, []);

  const removeGoal = useCallback((id: number) => {
    setSavingsGoals((prev) => {
      const next = prev.filter((g) => g.id !== id);
      saveGoals(next);
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
    const receipt: Receipt = { ...r, id, updatedAt: Date.now() };
    setReceipts((prev) => [receipt, ...prev]); // optimistic
    if (persist.current) {
      insertReceipt(receipt).catch((e) => console.warn('[receipt-vault] insert failed', e));
    }
    // Schedule its deadline reminders (no-op until the user grants permission).
    scheduleForReceipt(receipt).catch((e) => console.warn('[receipt-vault] schedule failed', e));
  }, []);

  // Replace an edited receipt (same id) and re-persist + reschedule.
  const updateReceipt = useCallback((updated: Receipt) => {
    const stamped: Receipt = { ...updated, updatedAt: Date.now() };
    const next = receiptsRef.current.map((r) => (r.id === stamped.id ? stamped : r));
    setReceipts(next);
    if (persist.current) {
      insertReceipt(stamped).catch((e) => console.warn('[receipt-vault] update failed', e));
    }
    rescheduleAll(next).catch(() => {});
  }, []);

  // Permanently remove a receipt: drop it locally, tombstone it (so a pull can't
  // re-add it and the delete propagates on next sync), delete its photo, reschedule.
  const deleteReceipt = useCallback((id: number) => {
    const target = receiptsRef.current.find((r) => r.id === id);
    const next = receiptsRef.current.filter((r) => r.id !== id);
    setReceipts(next);
    tombstones.current.add(id);
    saveTombstones([...tombstones.current]).catch(() => {});
    deleteAttachmentFilesFor(id).catch(() => {});
    if (persist.current) {
      dbDeleteReceipt(id).catch((e) => console.warn('[receipt-vault] delete failed', e));
    }
    if (target) deletePhotoFor(target).catch(() => {});
    rescheduleAll(next).catch(() => {});
  }, []);

  // Wipe every receipt: tombstone them all (so the erase propagates to the cloud
  // and nothing gets re-pulled), clear the local DB + photos + budgets, and cancel
  // all scheduled reminders.
  const clearAll = useCallback(() => {
    const targets = receiptsRef.current.slice();
    for (const r of targets) tombstones.current.add(r.id);
    if (targets.length) saveTombstones([...tombstones.current]).catch(() => {});
    setReceipts([]);
    if (persist.current) {
      (async () => {
        for (const r of targets) {
          try {
            await dbDeleteReceipt(r.id);
          } catch (e) {
            console.warn('[receipt-vault] clearAll delete failed', e);
          }
        }
      })();
    }
    for (const r of targets) {
      deletePhotoFor(r).catch(() => {});
      deleteAttachmentFilesFor(r.id).catch(() => {});
    }
    setBudgets({});
    saveBudgets({}).catch(() => {});
    rescheduleAll([]).catch(() => {});
  }, []);

  // Merge receipts pulled from the cloud (remote wins on id conflict), and remove
  // ids the server reports deleted (or tombstoned locally).
  const mergeReceipts = useCallback((remote: Receipt[], removedIds: number[] = []) => {
    for (const id of removedIds) tombstones.current.add(id);
    if (removedIds.length) saveTombstones([...tombstones.current]).catch(() => {});

    const byId = new Map(receiptsRef.current.map((r) => [r.id, r]));
    for (const r of remote) if (!tombstones.current.has(r.id)) byId.set(r.id, r);
    for (const id of tombstones.current) byId.delete(id);
    const next = [...byId.values()].sort(
      (a, b) => b.date.getTime() - a.date.getTime() || b.id - a.id,
    );
    setReceipts(next);

    if (persist.current) {
      // Sequential — each insert/delete is its own transaction on one connection.
      (async () => {
        for (const r of remote) {
          if (tombstones.current.has(r.id)) continue;
          try {
            await insertReceipt(r);
          } catch (e) {
            console.warn('[receipt-vault] merge persist failed', e);
          }
        }
        for (const id of removedIds) {
          try {
            await dbDeleteReceipt(id);
          } catch (e) {
            console.warn('[receipt-vault] merge delete failed', e);
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
        ? { ...r, status, statusKind: status === 'open' ? null : (kind ?? r.statusKind ?? null), statusAt: at, updatedAt: at.getTime() }
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
    () => ({ receipts, addReceipt, updateReceipt, deleteReceipt, clearAll, mergeReceipts, setStatus, setReimbursable, setInsured, setSerial, touchReceipt, budgets, setBudget, customCats, allCats, addCategory, removeCategory, savingsGoals, addGoal, contributeGoal, removeGoal, toast, flash }),
    [receipts, addReceipt, updateReceipt, deleteReceipt, clearAll, mergeReceipts, setStatus, setReimbursable, setInsured, setSerial, touchReceipt, budgets, setBudget, customCats, allCats, addCategory, removeCategory, savingsGoals, addGoal, contributeGoal, removeGoal, toast, flash],
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
