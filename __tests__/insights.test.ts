import { type Receipt } from '../lib/data';
import { monthlyTotals, recurringMerchants, topMerchants } from '../lib/insights';

const r = (over: Partial<Receipt> = {}): Receipt => ({
  id: 1, merchant: 'M', cat: 'Home', date: new Date(2026, 6, 1), total: 10, pay: 'x', ret: 0, war: 0, items: [], ...over,
});

describe('monthlyTotals', () => {
  it('groups by month, oldest first', () => {
    const data = [
      r({ id: 1, date: new Date(2026, 4, 10), total: 20 }), // May
      r({ id: 2, date: new Date(2026, 5, 5), total: 30 }), // Jun
      r({ id: 3, date: new Date(2026, 5, 20), total: 70 }), // Jun
    ];
    expect(monthlyTotals(data, 6)).toEqual([
      { key: '2026-05', label: 'May', total: 20 },
      { key: '2026-06', label: 'Jun', total: 100 },
    ]);
  });

  it('limits to the last N months', () => {
    const data = Array.from({ length: 8 }, (_, i) => r({ id: i, date: new Date(2026, i, 1), total: 1 }));
    expect(monthlyTotals(data, 6)).toHaveLength(6);
  });

  it('adds a 2-digit year to labels when the window spans years', () => {
    const data = [r({ id: 1, date: new Date(2025, 6, 1), total: 5 }), r({ id: 2, date: new Date(2026, 6, 1), total: 5 })];
    const m = monthlyTotals(data, 6);
    expect(m[0].label).toBe("Jul '25");
    expect(m[1].label).toBe("Jul '26");
  });
});

describe('topMerchants', () => {
  it('aggregates and sorts by total desc', () => {
    const data = [r({ merchant: 'A', total: 10 }), r({ merchant: 'B', total: 50 }), r({ merchant: 'A', total: 5 })];
    const top = topMerchants(data, 5);
    expect(top[0]).toEqual({ merchant: 'B', total: 50, count: 1 });
    expect(top[1]).toEqual({ merchant: 'A', total: 15, count: 2 });
  });
});

describe('recurringMerchants', () => {
  it('flags 2+ purchases with a monthly estimate and subscription guess', () => {
    const data = [
      r({ merchant: 'Sub', total: 10, date: new Date(2026, 4, 1) }),
      r({ merchant: 'Sub', total: 10, date: new Date(2026, 5, 1) }),
      r({ merchant: 'Sub', total: 10, date: new Date(2026, 6, 1) }),
      r({ merchant: 'Once', total: 99, date: new Date(2026, 6, 1) }),
    ];
    const rec = recurringMerchants(data);
    expect(rec).toHaveLength(1);
    expect(rec[0]).toMatchObject({ merchant: 'Sub', count: 3, total: 30, avg: 10, monthly: 10, likely: true });
  });

  it('does not flag single purchases', () => {
    expect(recurringMerchants([r({ merchant: 'X' })])).toEqual([]);
  });

  it('does not flag as subscription when amounts vary a lot', () => {
    const data = [
      r({ merchant: 'Var', total: 10, date: new Date(2026, 4, 1) }),
      r({ merchant: 'Var', total: 200, date: new Date(2026, 5, 1) }),
      r({ merchant: 'Var', total: 30, date: new Date(2026, 6, 1) }),
    ];
    expect(recurringMerchants(data)[0].likely).toBe(false);
  });
});
