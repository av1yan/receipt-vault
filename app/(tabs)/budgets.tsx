import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Card, Heading, Input, Kicker, ProgressBar } from '../../components/ui';
import { CATS, money } from '../../lib/data';
import { useVault } from '../../lib/store';
import { CAT_COLOR, colors, fonts, ink } from '../../lib/theme';

// Reserved budgets key for the overall monthly goal (excluded from categories).
const MONTHLY = '__monthly';

export default function BudgetsTab() {
  const insets = useSafeAreaInsets();
  const { receipts, budgets, setBudget } = useVault();

  const [goalVal, setGoalVal] = useState(budgets[MONTHLY] ? String(budgets[MONTHLY]) : '');
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(CATS.map((c) => [c, budgets[c] ? String(budgets[c]) : ''])),
  );

  // Backfill inputs once budgets finish loading from disk (in case this tab
  // mounted before the async load) — only fills empty fields, never clobbers
  // a value being typed.
  useEffect(() => {
    if (budgets[MONTHLY]) setGoalVal((v) => (v === '' ? String(budgets[MONTHLY]) : v));
    setVals((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const c of CATS) {
        if ((next[c] ?? '') === '' && budgets[c]) {
          next[c] = String(budgets[c]);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [budgets]);

  const { byCat, monthSpend, monthCount } = useMemo(() => {
    const july = receipts.filter((r) => r.date.getMonth() === 6);
    const bc: Record<string, number> = {};
    july.forEach((r) => {
      bc[r.cat] = (bc[r.cat] || 0) + r.total;
    });
    return { byCat: bc, monthSpend: july.reduce((a, r) => a + r.total, 0), monthCount: july.length };
  }, [receipts]);

  const goal = budgets[MONTHLY] || 0;
  const remaining = goal - monthSpend;
  const overGoal = goal > 0 && monthSpend > goal;
  const goalPct = goal > 0 ? `${Math.min(100, Math.round((100 * monthSpend) / goal))}%` : '0%';
  const overCats = CATS.filter((c) => (budgets[c] || 0) > 0 && (byCat[c] || 0) > (budgets[c] || 0)).length;

  const setGoal = (t: string) => {
    setGoalVal(t);
    setBudget(MONTHLY, parseFloat(t.replace(/[^0-9.]/g, '')) || 0);
  };
  const setCat = (c: string, t: string) => {
    setVals((v) => ({ ...v, [c]: t }));
    setBudget(c, parseFloat(t.replace(/[^0-9.]/g, '')) || 0);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: 132, paddingHorizontal: 20, gap: 16 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Heading style={{ fontSize: 34 }}>Budgets</Heading>
      <Body style={{ fontSize: 13, color: ink(0.6), marginTop: -8 }}>
        A monthly goal and per-category limits — tracked live against July.
      </Body>

      {/* ── Monthly goal (editable + status) ─────────────────────────── */}
      <Card style={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Kicker style={{ color: ink(0.45), letterSpacing: 1 }}>Monthly goal · July</Kicker>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
              <Body style={{ fontFamily: fonts.heading, fontSize: 26, color: goal > 0 ? colors.text : ink(0.4) }}>$</Body>
              <Input
                value={goalVal}
                onChangeText={setGoal}
                placeholder="0"
                keyboardType="decimal-pad"
                borderColor="transparent"
                style={{
                  minWidth: 84, paddingHorizontal: 2, paddingVertical: 0,
                  backgroundColor: 'transparent', borderColor: 'transparent',
                  fontFamily: fonts.heading, fontSize: 26, color: colors.text,
                }}
              />
            </View>
          </View>
          <View style={{ alignItems: 'flex-end', paddingTop: 4 }}>
            {goal > 0 ? (
              <>
                <Heading style={{ fontSize: 20, color: overGoal ? colors.accent : colors.accent2Ramp[700] }}>
                  {overGoal ? `+${money(monthSpend - goal)}` : money(remaining)}
                </Heading>
                <Body style={{ fontSize: 11, color: ink(0.45) }}>{overGoal ? 'over goal' : 'left'}</Body>
              </>
            ) : (
              <Body style={{ fontSize: 12, color: ink(0.45) }}>set a goal</Body>
            )}
          </View>
        </View>
        {goal > 0 && <ProgressBar pct={goalPct} color={overGoal ? colors.accent : colors.accent2Ramp[500]} height={9} />}
        <Body style={{ fontSize: 11.5, color: ink(0.5) }}>
          {money(monthSpend)} spent across {monthCount} receipts this month.
        </Body>
      </Card>

      {/* ── Category budgets (editable + live) ───────────────────────── */}
      <Kicker style={{ color: ink(0.5), letterSpacing: 1 }}>
        By category{overCats > 0 ? ` · ${overCats} over` : ''}
      </Kicker>
      <View style={{ gap: 10 }}>
        {CATS.map((c) => {
          const spend = byCat[c] || 0;
          const b = budgets[c] || 0;
          const over = b > 0 && spend > b;
          const pct = b > 0 ? `${Math.min(100, Math.round((100 * spend) / b))}%` : '0%';
          return (
            <Card key={c} style={{ padding: 14, gap: b > 0 ? 10 : 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: CAT_COLOR[c] || colors.accent }} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Heading style={{ fontSize: 15 }}>{c}</Heading>
                  <Body style={{ fontSize: 11.5, color: over ? colors.accent : ink(0.5) }}>
                    {b > 0
                      ? over
                        ? `${money(spend)} · over by ${money(spend - b)}`
                        : `${money(spend)} · ${money(b - spend)} left`
                      : `${money(spend)} spent`}
                  </Body>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Body style={{ fontSize: 14, color: ink(0.5) }}>$</Body>
                  <Input
                    value={vals[c]}
                    onChangeText={(t) => setCat(c, t)}
                    placeholder="0"
                    keyboardType="decimal-pad"
                    style={{ width: 78, textAlign: 'right', fontFamily: fonts.heading }}
                  />
                </View>
              </View>
              {b > 0 && <ProgressBar pct={pct} color={over ? colors.accent : CAT_COLOR[c] || colors.accent2Ramp[500]} height={7} />}
            </Card>
          );
        })}
      </View>
    </ScrollView>
  );
}
