import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Card, Heading, Kicker, ProgressBar } from '../../components/ui';
import { fmtMonthYear, money, monthShort, sameMonth, TODAY } from '../../lib/data';
import { exportReceiptsCsv } from '../../lib/export';
import { haptics } from '../../lib/haptics';
import { useVault } from '../../lib/store';
import { CAT_COLOR, colors, fonts, ink, radius, shadow } from '../../lib/theme';

export default function SpendingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { receipts, flash, budgets } = useVault();

  const { monthTotal, monthSum, monthCount, cats } = useMemo(() => {
    const thisMonth = receipts.filter((r) => sameMonth(r.date, TODAY));
    const sum = thisMonth.reduce((a, r) => a + r.total, 0);
    const byCat: Record<string, number> = {};
    thisMonth.forEach((r) => {
      byCat[r.cat] = (byCat[r.cat] || 0) + r.total;
    });
    const max = Math.max(1, ...Object.values(byCat));
    // Show categories that have spend this month OR a budget set (excluding the
    // reserved overall-goal key, which is managed on the Budgets tab).
    const names = new Set<string>([
      ...Object.keys(byCat),
      ...Object.keys(budgets).filter((k) => !k.startsWith('__')),
    ]);
    const catList = [...names]
      .map((k) => {
        const spend = byCat[k] || 0;
        const budget = budgets[k] || 0;
        const over = budget > 0 && spend > budget;
        return {
          name: k,
          spend,
          amount: money(spend),
          budgetLabel: budget > 0 ? ` of ${money(budget)}` : '',
          note: budget > 0 ? (over ? `Over by ${money(spend - budget)}` : `${money(budget - spend)} left`) : '',
          over,
          dot: CAT_COLOR[k] || colors.accentRamp[500],
          bar: over ? colors.accent : CAT_COLOR[k] || colors.accentRamp[500],
          pct:
            budget > 0
              ? `${Math.min(100, Math.round((100 * spend) / budget))}%`
              : `${Math.round((100 * spend) / max)}%`,
        };
      })
      .sort((a, b) => b.spend - a.spend);
    return { monthTotal: money(sum), monthSum: sum, monthCount: thisMonth.length, cats: catList };
  }, [receipts, budgets]);

  const monthLabel = fmtMonthYear(TODAY);
  // First of the prior month — built from year/month so end-of-month "today"
  // (e.g. Jul 31) doesn't roll over via date arithmetic.
  const prevMonth = new Date(TODAY.getFullYear(), TODAY.getMonth() - 1, 1);
  const prevLabel = monthShort(prevMonth);

  // Real change vs the prior month, and the monthly goal from Budgets.
  const change = useMemo(() => {
    const prev = receipts.filter((r) => sameMonth(r.date, prevMonth)).reduce((a, r) => a + r.total, 0);
    if (prev <= 0) return null;
    const ratio = monthSum / prev;
    if (ratio >= 2) return `${ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1)}× vs ${prevLabel}`;
    const p = Math.round((ratio - 1) * 100);
    return `${p >= 0 ? '▲' : '▼'} ${Math.abs(p)}% vs ${prevLabel}`;
  }, [receipts, monthSum, prevMonth, prevLabel]);

  const goal = budgets['__monthly'] || 0;
  const overGoal = goal > 0 && monthSum > goal;
  const goalPct = goal > 0 ? `${Math.min(100, Math.round((100 * monthSum) / goal))}%` : '0%';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: 132, paddingHorizontal: 20, gap: 16 }}
      showsVerticalScrollIndicator={false}
    >
      <Heading style={{ fontSize: 34 }}>Spending</Heading>

      {/* month hero */}
      <View style={[{ borderRadius: radius.lg * 1.15, overflow: 'hidden' }, shadow.md]}>
        <View style={{ backgroundColor: colors.accentRamp[800], paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20, gap: 6 }}>
          <View style={{ position: 'absolute', right: -38, top: -38, width: 150, height: 150, borderRadius: 999, backgroundColor: colors.accentRamp[700] }} />
          <Kicker style={{ color: colors.accentRamp[100], opacity: 0.8, letterSpacing: 1 }}>{monthLabel}</Kicker>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Heading style={{ fontSize: 44, lineHeight: 46, letterSpacing: -0.9, color: colors.accentRamp[100] }}>
              {monthTotal}
            </Heading>
            {change && (
              <View style={{ backgroundColor: colors.accentRamp[700], borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3, marginBottom: 4 }}>
                <Body style={{ fontSize: 11, fontFamily: fonts.bodySemi, color: colors.accentRamp[100] }}>{change}</Body>
              </View>
            )}
          </View>
          <Body style={{ fontSize: 12.5, color: colors.accentRamp[100], opacity: 0.85 }}>
            across {monthCount} receipt{monthCount === 1 ? '' : 's'} this month
          </Body>
          {goal > 0 && (
            <View style={{ marginTop: 8, gap: 6 }}>
              <View style={{ height: 7, borderRadius: 999, backgroundColor: colors.accentRamp[700], overflow: 'hidden' }}>
                <View style={{ height: '100%', width: goalPct as any, borderRadius: 999, backgroundColor: colors.accentRamp[200] }} />
              </View>
              <Body style={{ fontSize: 12, color: colors.accentRamp[100], opacity: 0.9 }}>
                {overGoal
                  ? `${money(monthSum - goal)} over your ${money(goal)} goal`
                  : `${money(goal - monthSum)} left of your ${money(goal)} goal`}
              </Body>
            </View>
          )}
        </View>
      </View>

      <Card style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14, gap: 0 }}>
        <Kicker style={{ color: ink(0.42), letterSpacing: 1.2, marginBottom: 2 }}>By category</Kicker>
        {cats.map((c, i) => (
          <View
            key={c.name}
            style={{
              paddingVertical: 12, gap: 8,
              borderTopWidth: i === 0 ? 0 : 1, borderStyle: 'dashed', borderTopColor: ink(0.12),
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
              <View style={{ width: 9, height: 9, borderRadius: 999, backgroundColor: c.dot }} />
              <Body style={{ flex: 1, fontSize: 13.5 }}>{c.name}</Body>
              <Body style={{ fontFamily: fonts.heading, fontSize: 14, color: ink(0.85) }}>
                {c.amount}
                {c.budgetLabel ? (
                  <Body style={{ fontFamily: fonts.body, fontSize: 12, color: ink(0.4) }}>{c.budgetLabel}</Body>
                ) : null}
              </Body>
            </View>
            <ProgressBar pct={c.pct} color={c.bar} height={8} />
            {c.note ? (
              <Body style={{ fontSize: 11, textAlign: 'right', color: c.over ? colors.accent : ink(0.45) }}>
                {c.note}
              </Body>
            ) : null}
          </View>
        ))}
      </Card>

      <Button title="View insights" variant="secondary" block style={{ marginTop: 12 }} onPress={() => router.push('/insights')} />

      <Button
        title="Export CSV"
        variant="secondary"
        block
        onPress={async () => {
          const res = await exportReceiptsCsv(receipts);
          if (res === 'shared') {
            haptics.success();
            flash(`Exported ${receipts.length} receipts`);
          } else if (res === 'empty') {
            flash('No receipts to export yet');
          } else if (res === 'unavailable') {
            flash('Sharing isn’t available on this device');
          } else {
            flash('Export failed — please try again');
          }
        }}
      />
    </ScrollView>
  );
}
