// SQLite persistence for receipts + line items.
//
// Dates are stored as epoch millis (INTEGER) and rebuilt with `new Date(ms)`,
// which round-trips the local Y/M/D the rest of the app relies on.
//
// On platforms where expo-sqlite can't open a database (e.g. some web dev
// setups), callers fall back to in-memory seed data — see lib/store.tsx.

import * as SQLite from 'expo-sqlite';
import { SEED, type Attachment, type Receipt } from './data';

const DB_NAME = 'receipts.db';
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb() {
  if (!dbPromise) dbPromise = SQLite.openDatabaseAsync(DB_NAME);
  return dbPromise;
}

/** Create tables (idempotent) and seed the six demo receipts on first run. */
export async function initDb(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS receipts (
      id         INTEGER PRIMARY KEY NOT NULL,
      merchant   TEXT    NOT NULL,
      cat        TEXT    NOT NULL,
      date       INTEGER NOT NULL,
      total      REAL    NOT NULL,
      pay        TEXT    NOT NULL,
      ret        INTEGER NOT NULL,
      war        INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      image_uri  TEXT,
      status     TEXT,
      status_kind TEXT,
      status_at  INTEGER,
      reimbursable INTEGER,
      insured    INTEGER,
      serial     TEXT,
      updated_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS line_items (
      id         INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      receipt_id INTEGER NOT NULL,
      name       TEXT    NOT NULL,
      price      REAL    NOT NULL,
      position   INTEGER NOT NULL,
      FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS attachments (
      id         TEXT    PRIMARY KEY NOT NULL,
      receipt_id INTEGER NOT NULL,
      name       TEXT    NOT NULL,
      uri        TEXT    NOT NULL,
      kind       TEXT    NOT NULL,
      added_at   INTEGER NOT NULL,
      FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE
    );
  `);

  // Migration: add image_uri to databases created before photos existed.
  const cols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(receipts)');
  if (!cols.some((c) => c.name === 'image_uri')) {
    await db.execAsync('ALTER TABLE receipts ADD COLUMN image_uri TEXT');
  }
  // Migration: add claim-status columns to databases created before tracking.
  if (!cols.some((c) => c.name === 'status')) {
    await db.execAsync('ALTER TABLE receipts ADD COLUMN status TEXT');
    await db.execAsync('ALTER TABLE receipts ADD COLUMN status_kind TEXT');
    await db.execAsync('ALTER TABLE receipts ADD COLUMN status_at INTEGER');
  }
  // Migration: add reimbursable flag.
  if (!cols.some((c) => c.name === 'reimbursable')) {
    await db.execAsync('ALTER TABLE receipts ADD COLUMN reimbursable INTEGER');
  }
  // Migration: add home-inventory fields (insured flag + serial number).
  if (!cols.some((c) => c.name === 'insured')) {
    await db.execAsync('ALTER TABLE receipts ADD COLUMN insured INTEGER');
    await db.execAsync('ALTER TABLE receipts ADD COLUMN serial TEXT');
  }
  // Migration: add updated_at (client edit time) for sync conflict resolution.
  if (!cols.some((c) => c.name === 'updated_at')) {
    await db.execAsync('ALTER TABLE receipts ADD COLUMN updated_at INTEGER');
  }

  // Seed the demo receipts exactly once, on a genuinely fresh database — guarded
  // by user_version so emptying the vault later doesn't resurrect the demo data.
  const ver = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if ((ver?.user_version ?? 0) < 1) {
    const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM receipts');
    if ((row?.n ?? 0) === 0) {
      for (const r of SEED) await insertReceipt(r);
    }
    await db.execAsync('PRAGMA user_version = 1');
  }
}

type ReceiptRow = {
  id: number;
  merchant: string;
  cat: string;
  date: number;
  total: number;
  pay: string;
  ret: number;
  war: number;
  image_uri: string | null;
  status: string | null;
  status_kind: string | null;
  status_at: number | null;
  reimbursable: number | null;
  insured: number | null;
  serial: string | null;
  updated_at: number | null;
};
type ItemRow = { receipt_id: number; name: string; price: number };

/** Load every receipt (newest first) with its line items attached. */
export async function loadReceipts(): Promise<Receipt[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ReceiptRow>(
    'SELECT id, merchant, cat, date, total, pay, ret, war, image_uri, status, status_kind, status_at, reimbursable, insured, serial, updated_at FROM receipts ORDER BY date DESC, id DESC',
  );
  const items = await db.getAllAsync<ItemRow>(
    'SELECT receipt_id, name, price FROM line_items ORDER BY receipt_id, position ASC',
  );

  const byReceipt = new Map<number, { name: string; price: number }[]>();
  for (const it of items) {
    const list = byReceipt.get(it.receipt_id) ?? [];
    list.push({ name: it.name, price: it.price });
    byReceipt.set(it.receipt_id, list);
  }

  return rows.map((r) => ({
    id: r.id,
    merchant: r.merchant,
    cat: r.cat,
    date: new Date(r.date),
    total: r.total,
    pay: r.pay,
    ret: r.ret,
    war: r.war,
    imageUri: r.image_uri,
    status: (r.status as Receipt['status']) ?? 'open',
    statusKind: (r.status_kind as Receipt['statusKind']) ?? null,
    statusAt: r.status_at != null ? new Date(r.status_at) : null,
    reimbursable: !!r.reimbursable,
    insured: !!r.insured,
    serial: r.serial ?? undefined,
    updatedAt: r.updated_at ?? 0,
    items: byReceipt.get(r.id) ?? [],
  }));
}

/** Insert a receipt and its line items atomically. */
export async function insertReceipt(r: Receipt): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT OR REPLACE INTO receipts (id, merchant, cat, date, total, pay, ret, war, created_at, image_uri, status, status_kind, status_at, reimbursable, insured, serial, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        r.id, r.merchant, r.cat, r.date.getTime(), r.total, r.pay, r.ret, r.war, Date.now(),
        r.imageUri ?? null, r.status ?? 'open', r.statusKind ?? null,
        r.statusAt ? r.statusAt.getTime() : null, r.reimbursable ? 1 : 0,
        r.insured ? 1 : 0, r.serial ?? null, r.updatedAt ?? 0,
      ],
    );
    await db.runAsync('DELETE FROM line_items WHERE receipt_id = ?', [r.id]);
    for (let i = 0; i < r.items.length; i++) {
      const it = r.items[i];
      await db.runAsync(
        'INSERT INTO line_items (receipt_id, name, price, position) VALUES (?, ?, ?, ?)',
        [r.id, it.name, it.price, i],
      );
    }
  });
}

/** Remove a receipt (line items + attachments cascade). */
export async function deleteReceipt(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM receipts WHERE id = ?', [id]);
}

// ── Attachments (warranty docs / manuals / proof of purchase) ────────────────
type AttachmentRow = { id: string; receipt_id: number; name: string; uri: string; kind: string; added_at: number };

function mapAtt(r: AttachmentRow): Attachment {
  return { id: r.id, receiptId: r.receipt_id, name: r.name, uri: r.uri, kind: r.kind as Attachment['kind'], addedAt: r.added_at };
}

export async function loadAttachmentsFor(receiptId: number): Promise<Attachment[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<AttachmentRow>(
    'SELECT id, receipt_id, name, uri, kind, added_at FROM attachments WHERE receipt_id = ? ORDER BY added_at ASC',
    [receiptId],
  );
  return rows.map(mapAtt);
}

/** Every attachment across all receipts (for building the sync map). */
export async function loadAllAttachments(): Promise<Attachment[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<AttachmentRow>('SELECT id, receipt_id, name, uri, kind, added_at FROM attachments');
  return rows.map(mapAtt);
}

export async function insertAttachment(a: Attachment): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO attachments (id, receipt_id, name, uri, kind, added_at) VALUES (?, ?, ?, ?, ?, ?)',
    [a.id, a.receiptId, a.name, a.uri, a.kind, a.addedAt],
  );
}

export async function deleteAttachmentRow(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM attachments WHERE id = ?', [id]);
}
