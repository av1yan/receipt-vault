import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Card, Heading, Kicker, ProgressBar } from '../../components/ui';
import { money } from '../../lib/data';
import { exportReceiptsCsv } from '../../lib/export';
import { haptics } from '../../lib/haptics';
import { useVault } from '../../lib/store';
import { CAT_COLOR, colors, fonts, ink } from '../../lib/theme';

export default function SpendingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { receipts, flash, budgets } = useVault();

  const { monthTotal, monthCount, cats } = useMemo(() => {
    const july = receipts.filter((r) => r.date.getMonth() === 6);
    const sum = july.reduce((a, r) => a + r.total, 0);
    const byCat: Record<string, number> = {};
    july.forEach((r) => {
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
    return { monthTotal: money(sum), monthCount: july.length, cats: catList };
  }, [receipts, budgets]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: 132, paddingHorizontal: 20, gap: 16 }}
      showsVerticalScrollIndicator={false}
    >
      <Heading style={{ fontSize: 34 }}>Spending</Heading>

      {/* month hero */}
      <Card elevation="md" style={{ padding: 22, gap: 4, backgroundColor: colors.accentRamp[800], overflow: 'hidden' }}>
        <View
          style={{
            position: 'absolute', right: -38, top: -38, width: 150, height: 150,
            borderRadius: 999, backgroundColor: colors.accentRamp[700],
          }}
        />
        <View
          style={{
            position: 'absolute', right: 26, bottom: -30, width: 70, height: 70,
            borderRadius: 999, backgroundColor: colors.accent2Ramp[700], opacity: 0.6,
          }}
        />
        <Kicker style={{ color: colors.accentRamp[100], opacity: 0.75, letterSpacing: 1 }}>July 2026</Kicker>
        <Heading style={{ fontSize: 46, lineHeight: 47, letterSpacing: -0.9, color: colors.accentRamp[100] }}>
          {monthTotal}
        </Heading>
        <Body style={{ fontSize: 12, color: colors.accentRamp[100], opacity: 0.8 }}>
          across {monthCount} receipts · +8% vs June
        </Body>
      </Card>

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
