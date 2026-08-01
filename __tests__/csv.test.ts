import { esc, receiptsToCsv } from '../lib/csv';
import { type Receipt } from '../lib/data';

describe('esc', () => {
  it('leaves plain values untouched', () => {
    expect(esc('Hello')).toBe('Hello');
    expect(esc('82.15')).toBe('82.15');
    expect(esc(42)).toBe('42');
  });
  it('quotes commas, quotes, and newlines', () => {
    expect(esc('a,b')).toBe('"a,b"');
    expect(esc('say "hi"')).toBe('"say ""hi"""');
    expect(esc('line1\nline2')).toBe('"line1\nline2"');
  });
  it('neutralizes spreadsheet formula injection', () => {
    expect(esc('+cmd')).toBe("'+cmd");
    expect(esc('@foo')).toBe("'@foo");
    expect(esc('-5')).toBe("'-5");
    expect(esc('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
  });
});

describe('receiptsToCsv', () => {
  const r = (over: Partial<Receipt> = {}): Receipt => ({
    id: 1, merchant: 'Shop', cat: 'Home', date: new Date(2026, 6, 28), total: 63.4,
    pay: 'Visa', ret: 0, war: 0, items: [{ name: 'X', price: 6.5 }], ...over,
  });

  it('always has the header row', () => {
    expect(receiptsToCsv([]).split('\n')[0]).toBe(
      'Date,Merchant,Category,Total,Payment,Return by,Warranty until,Status,Items',
    );
  });

  it('formats a receipt row (total 2dp, items joined)', () => {
    const rows = receiptsToCsv([r()]).split('\n');
    expect(rows).toHaveLength(2);
    expect(rows[1]).toContain('Shop');
    expect(rows[1]).toContain('63.40');
    expect(rows[1]).toContain('X (6.50)');
    expect(rows[1]).toContain('open');
  });

  it('escapes injection coming from a merchant name', () => {
    expect(receiptsToCsv([r({ merchant: '=SUM(A1)' })])).toContain("'=SUM(A1)");
  });

  it('sorts oldest first (ledger order)', () => {
    const older = r({ id: 1, merchant: 'Older', date: new Date(2026, 0, 1) });
    const newer = r({ id: 2, merchant: 'Newer', date: new Date(2026, 6, 1) });
    const rows = receiptsToCsv([newer, older]).split('\n');
    expect(rows[1]).toContain('Older');
    expect(rows[2]).toContain('Newer');
  });
});
