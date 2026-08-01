import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Card, Heading, Icon, Input, Kicker } from '../../components/ui';
import { CATS, monthName, money, sameMonth, TODAY } from '../../lib/data';
import { useVault } from '../../lib/store';
import { CAT_COLOR, colors, fonts, ink, radius, shadow } from '../../lib/theme';

// Reserved budgets key for the overall monthly goal (excluded from categories).
const MONTHLY = '__monthly';
const GOAL_PRESETS = [500, 1000, 1500, 2000];

export default function BudgetsTab() {
  const insets = useSafeAreaInsets();
  const { receipts, budgets, setBudget, allCats, addCategory, removeCategory } = useVault();

  const [goalVal, setGoalVal] = useState(budgets[MONTHLY] ? String(budgets[MONTHLY]) : '');
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(CATS.map((c) => [c, budgets[c] ? String(budgets[c]) : ''])),
  );
  const [newCat, setNewCat] = useState('');

  // Backfill inputs once budgets finish loading (in case this tab mounted before
  // the async load) — only fills empty fields, never clobbers what's being typed.
  useEffect(() => {
    if (budgets[MONTHLY]) setGoalVal((v) => (v === '' ? String(budgets[MONTHLY]) : v));
    setVals((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const c of allCats) {
        if ((next[c] ?? '') === '' && budgets[c]) {
          next[c] = String(budgets[c]);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [budgets, allCats]);

  const { byCat, monthSpend, monthCount } = useMemo(() => {
    const thisMonth = receipts.filter((r) => sameMonth(r.date, TODAY));
    const bc: Record<string, number> = {};
    thisMonth.forEach((r) => {
      bc[r.cat] = (bc[r.cat] || 0) + r.total;
    });
    return { byCat: bc, monthSpend: thisMonth.reduce((a, r) => a + r.total, 0), monthCount: thisMonth.length };
  }, [receipts]);

  const goal = budgets[MONTHLY] || 0;
  const remaining = goal - monthSpend;
  const overGoal = goal > 0 && monthSpend > goal;
  const goalPct = goal > 0 ? `${Math.min(100, Math.round((100 * monthSpend) / goal))}%` : '0%';
  const overCats = allCats.filter((c) => (budgets[c] || 0) > 0 && (byCat[c] || 0) > (budgets[c] || 0)).length;

  const doAddCategory = () => {
    const n = newCat.trim();
    if (!n) return;
    addCategory(n);
    setNewCat('');
  };

  const setGoal = (t: string) => {
    setGoalVal(t);
    setBudget(MONTHLY, parseFloat(t.replace(/[^0-9.]/g, '')) || 0);
  };
  const setCat = (c: string, t: string) => {
    setVals((v) => ({ ...v, [c]: t }));
    setBudget(c, parseFloat(t.replace(/[^0-9.]/g, '')) || 0);
  };

  // Goal-card palette: sage while under (or unset), terracotta when over.
  const ramp = overGoal ? colors.accentRamp : colors.accent2Ramp;
  const bandInk = ramp[100];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: 132, paddingHorizontal: 20, gap: 16 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Heading style={{ fontSize: 34 }}>Budgets</Heading>
      <Body style={{ fontSize: 13, color: ink(0.6), marginTop: -8 }}>
        Set a monthly goal and per-category limits — tracked live against {monthName(TODAY)}.
      </Body>

      {/* ── Monthly goal hero ───────────────────────────────────────── */}
      <View style={[{ borderRadius: radius.lg * 1.15, overflow: 'hidden' }, shadow.md]}>
        {/* colored status band */}
        <View style={{ backgroundColor: ramp[800], paddingHorizontal: 18, paddingTop: 18, paddingBottom: 20, gap: 10 }}>
          <View style={{ position: 'absolute', right: -34, top: -34, width: 132, height: 132, borderRadius: 999, backgroundColor: ramp[700] }} />
          <Kicker style={{ color: bandInk, opacity: 0.85, letterSpacing: 1 }}>Monthly goal · {monthName(TODAY)}</Kicker>
          {goal > 0 ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
                <Heading style={{ fontSize: 40, letterSpacing: -0.9, color: bandInk }}>
                  {overGoal ? `+${money(monthSpend - goal)}` : money(remaining)}
                </Heading>
                <Body style={{ fontSize: 13, color: bandInk, opacity: 0.85, marginBottom: 8 }}>
                  {overGoal ? 'over goal' : 'left'}
                </Body>
              </View>
              <View style={{ height: 9, borderRadius: 999, backgroundColor: ramp[700], overflow: 'hidden' }}>
                <View style={{ height: '100%', width: goalPct as any, borderRadius: 999, backgroundColor: ramp[300] }} />
              </View>
              <Body style={{ fontSize: 12.5, color: bandInk, opacity: 0.85 }}>
                {money(monthSpend)} of {money(goal)} · {monthCount} receipts this month
              </Body>
            </>
          ) : (
            <>
              <Heading style={{ fontSize: 24, color: bandInk }}>Set a monthly goal</Heading>
              <Body style={{ fontSize: 12.5, color: bandInk, opacity: 0.85 }}>
                You've spent {money(monthSpend)} across {monthCount} receipts this month.
              </Body>
            </>
          )}
        </View>

        {/* manual input + quick-set presets */}
        <View style={{ backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 14, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Body style={{ fontSize: 13, color: ink(0.6) }}>Your goal</Body>
            <View
              style={{
                flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4,
                backgroundColor: colors.bg, borderRadius: radius.pill,
                borderWidth: 1.5, borderColor: goal > 0 ? ramp[400] : colors.divider,
                paddingHorizontal: 14, paddingVertical: 8,
              }}
            >
              <Body style={{ fontFamily: fonts.heading, fontSize: 18, color: ink(0.5) }}>$</Body>
              <Input
                value={goalVal}
                onChangeText={setGoal}
                placeholder="0"
                keyboardType="decimal-pad"
                borderColor="transparent"
                style={{
                  flex: 1, backgroundColor: 'transparent', borderColor: 'transparent',
                  paddingHorizontal: 0, paddingVertical: 0, fontFamily: fonts.heading, fontSize: 18, color: colors.text,
                }}
              />
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {GOAL_PRESETS.map((p) => {
              const active = goal === p;
              return (
                <Pressable
                  key={p}
                  onPress={() => setGoal(String(p))}
                  style={({ pressed }) => ({
                    paddingVertical: 7, paddingHorizontal: 14, borderRadius: radius.pill,
                    backgroundColor: active ? colors.accent2Ramp[200] : colors.bg,
                    borderWidth: 1, borderColor: active ? colors.accent2Ramp[400] : colors.divider,
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <Body style={{ fontFamily: fonts.bodySemi, fontSize: 12.5, color: active ? colors.accent2Ramp[800] : ink(0.65) }}>
                    {money(p)}
                  </Body>
                </Pressable>
              );
            })}
            {goal > 0 && (
              <Pressable onPress={() => setGoal('')} style={({ pressed }) => ({ paddingVertical: 7, paddingHorizontal: 12, opacity: pressed ? 0.6 : 1 })}>
                <Body style={{ fontSize: 12.5, color: colors.accent }}>Clear</Body>
              </Pressable>
            )}
          </View>
        </View>
      </View>

      {/* ── Category budgets ────────────────────────────────────────── */}
      <Kicker style={{ color: ink(0.5), letterSpacing: 1 }}>
        By category{overCats > 0 ? ` · ${overCats} over` : ''}
      </Kicker>
      <View style={{ gap: 10 }}>
        {allCats.map((c) => {
          const spend = byCat[c] || 0;
          const b = budgets[c] || 0;
          const over = b > 0 && spend > b;
          const pct = b > 0 ? Math.min(100, Math.round((100 * spend) / b)) : 0;
          const dot = CAT_COLOR[c] || colors.accent;
          const custom = !(CATS as readonly string[]).includes(c);
          return (
            <Card key={c} style={{ padding: 14, gap: b > 0 ? 10 : 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
                <View style={{ width: 11, height: 11, borderRadius: 999, backgroundColor: dot }} />
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
                <View
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 3,
                    backgroundColor: colors.bg, borderRadius: radius.pill,
                    borderWidth: 1, borderColor: b > 0 ? dot : colors.divider,
                    paddingHorizontal: 12, paddingVertical: 6,
                  }}
                >
                  <Body style={{ fontSize: 14, color: ink(0.5) }}>$</Body>
                  <Input
                    value={vals[c]}
                    onChangeText={(t) => setCat(c, t)}
                    placeholder="0"
                    keyboardType="decimal-pad"
                    borderColor="transparent"
                    style={{
                      width: 56, textAlign: 'right', backgroundColor: 'transparent', borderColor: 'transparent',
                      paddingHorizontal: 0, paddingVertical: 0, fontFamily: fonts.heading, fontSize: 15,
                    }}
                  />
                </View>
                {custom && (
                  <Pressable
                    onPress={() => removeCategory(c)}
                    hitSlop={8}
                    style={({ pressed }) => ({ padding: 4, opacity: pressed ? 0.5 : 1 })}
                  >
                    <Icon name="trash" size={16} color={ink(0.4)} />
                  </Pressable>
                )}
              </View>
              {b > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ flex: 1, height: 7, borderRadius: 999, backgroundColor: ink(0.08), overflow: 'hidden' }}>
                    <View style={{ height: '100%', width: `${pct}%`, borderRadius: 999, backgroundColor: over ? colors.accent : dot }} />
                  </View>
                  <Body style={{ fontSize: 11, fontFamily: fonts.bodySemi, color: over ? colors.accent : ink(0.5), width: 34, textAlign: 'right' }}>
                    {pct}%
                  </Body>
                </View>
              )}
            </Card>
          );
        })}

        {/* Add a custom category */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
          <View style={{ flex: 1 }}>
            <Input
              value={newCat}
              onChangeText={setNewCat}
              placeholder="New category (e.g. Pets, Health)"
            />
          </View>
          <Pressable
            onPress={doAddCategory}
            disabled={!newCat.trim()}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: 5,
              paddingVertical: 9, paddingHorizontal: 15, borderRadius: radius.pill,
              backgroundColor: colors.accent, opacity: newCat.trim() ? (pressed ? 0.8 : 1) : 0.4,
            })}
          >
            <Icon name="plus" size={16} color="#fff" />
            <Body style={{ fontFamily: fonts.heading, fontSize: 13, color: '#fff' }}>Add</Body>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}
