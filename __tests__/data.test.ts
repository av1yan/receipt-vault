import {
  addDays,
  addMonths,
  daysLeft,
  derive,
  isActive,
  money,
  nextDeadline,
  sameMonth,
  statusOf,
  TODAY,
  type Receipt,
} from '../lib/data';

const base = (over: Partial<Receipt> = {}): Receipt => ({
  id: 1, merchant: 'M', cat: 'Home', date: TODAY, total: 10, pay: 'x', ret: 0, war: 0, items: [], ...over,
});

describe('money', () => {
  it('formats with thousands separators + 2dp', () => {
    expect(money(1076.5)).toBe('$1,076.50');
    expect(money(0)).toBe('$0.00');
    expect(money(999999.99)).toBe('$999,999.99');
    expect(money(63.4)).toBe('$63.40');
  });
});

describe('addDays / addMonths', () => {
  it('adds days', () => {
    expect(addDays(new Date(2026, 0, 1), 5)).toEqual(new Date(2026, 0, 6));
    expect(addDays(new Date(2026, 0, 1), -1)).toEqual(new Date(2025, 11, 31));
  });
  it('adds months', () => {
    expect(addMonths(new Date(2026, 0, 15), 2)).toEqual(new Date(2026, 2, 15));
    expect(addMonths(new Date(2026, 11, 1), 1)).toEqual(new Date(2027, 0, 1));
  });
});

describe('daysLeft', () => {
  it('is 0 today, positive future, negative past', () => {
    expect(daysLeft(TODAY)).toBe(0);
    expect(daysLeft(addDays(TODAY, 5))).toBe(5);
    expect(daysLeft(addDays(TODAY, -3))).toBe(-3);
  });
});

describe('sameMonth', () => {
  it('matches month + year only', () => {
    expect(sameMonth(new Date(2026, 6, 1), new Date(2026, 6, 28))).toBe(true);
    expect(sameMonth(new Date(2026, 6, 1), new Date(2026, 5, 28))).toBe(false);
    expect(sameMonth(new Date(2025, 6, 1), new Date(2026, 6, 1))).toBe(false);
  });
});

describe('derive', () => {
  it('computes return-by and warranty windows + days left', () => {
    const r = base({ date: addDays(TODAY, -2), ret: 14, war: 12 });
    const v = derive(r);
    expect(v.retBy).toEqual(addDays(r.date, 14));
    expect(v.retLeft).toBe(12); // 14-day window, purchased 2 days ago
    expect(v.warTo).toEqual(addMonths(r.date, 12));
    expect(v.warLeft).toBeGreaterThan(300);
  });
  it('returns null/-1 when there is no window', () => {
    const v = derive(base({ ret: 0, war: 0 }));
    expect(v.retBy).toBeNull();
    expect(v.warTo).toBeNull();
    expect(v.retLeft).toBe(-1);
    expect(v.warLeft).toBe(-1);
  });
});

describe('statusOf / isActive', () => {
  it('defaults to open/active and excludes filed/resolved', () => {
    expect(statusOf(base())).toBe('open');
    expect(isActive(base())).toBe(true);
    expect(isActive(base({ status: 'filed' }))).toBe(false);
    expect(isActive(base({ status: 'resolved' }))).toBe(false);
  });
});

describe('nextDeadline', () => {
  it('returns the soonest active deadline', () => {
    const a = base({ id: 1, merchant: 'A', date: TODAY, ret: 10 });
    const b = base({ id: 2, merchant: 'B', date: TODAY, ret: 3 });
    const nd = nextDeadline([a, b]);
    expect(nd?.receiptId).toBe(2);
    expect(nd?.kind).toBe('return');
    expect(nd?.daysLeft).toBe(3);
  });
  it('skips filed/resolved receipts and expired windows', () => {
    const filed = base({ id: 1, date: TODAY, ret: 5, status: 'filed' });
    const past = base({ id: 2, date: addDays(TODAY, -30), ret: 5 });
    expect(nextDeadline([filed, past])).toBeNull();
  });
});
