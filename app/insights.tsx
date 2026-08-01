import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Card, Heading, Kicker, ProgressBar, Tag } from '../components/ui';
import { money } from '../lib/data';
import { exportReceiptsCsv } from '../lib/export';
import { haptics } from '../lib/haptics';
import { monthlyTotals, recurringMerchants, topMerchants } from '../lib/insights';
import { dismiss } from '../lib/nav';
import { useVault } from '../lib/store';
import { colors, fonts, ink, radius, shadow } from '../lib/theme';

const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function InsightsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { receipts, flash } = useVault();

  const months = useMemo(() => monthlyTotals(receipts, 6), [receipts]);
  const merchants = useMemo(() => topMerchants(receipts, 5), [receipts]);
  const recurring = useMemo(() => recurringMerchants(receipts), [receipts]);

  const reimb = useMemo(() => receipts.filter((r) => r.reimbursable), [receipts]);
  const reimbTotal = reimb.reduce((a, r) => a + r.total, 0);

  const maxMonth = Math.max(1, ...months.map((m) => m.total));
  const maxMerchant = Math.max(1, ...merchants.map((m) => m.total));

  // Headline = the most recent month, with a change vs the prior month.
  const cur = months.length ? months[months.length - 1] : null;
  const prev = months.length > 1 ? months[months.length - 2] : null;
  const curCount = cur
    ? receipts.filter((r) => `${r.date.getFullYear()}-${String(r.date.getMonth() + 1).padStart(2, '0')}` === cur.key).length
    : 0;
  // vs-prior-month change: a percent for modest swings, a multiplier for big ones
  // (avoids absurd "1020%" when the prior month barely had any spend).
  const change = useMemo(() => {
    if (!cur || !prev || prev.total <= 0) return null;
    const ratio = cur.total / prev.total;
    if (ratio >= 2) return `${ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1)}× vs ${prev.label}`;
    const p = Math.round((ratio - 1) * 100);
    return `${p >= 0 ? '▲' : '▼'} ${Math.abs(p)}% vs ${prev.label}`;
  }, [cur, prev]);
  const curTitle = cur ? `${MONTHS_FULL[Number(cur.key.slice(5, 7)) - 1]} ${cur.key.slice(0, 4)}` : '';

  const exportReimb = async () => {
    const res = await exportReceiptsCsv(reimb, 'receipt-vault-reimbursable');
    if (res === 'shared') {
      haptics.success();
      flash(`Exported ${reimb.length} reimbursable receipts`);
    } else if (res === 'unavailable') {
      flash('Sharing isn’t available on this device');
    } else if (res !== 'empty') {
      flash('Export failed — please try again');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="dark" />
      <View
        style={{
          paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 10,
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        }}
      >
        <Button title="Close" variant="ghost" onPress={() => dismiss(router)} />
        <Heading style={{ fontSize: 16 }}>Insights</Heading>
        <View style={{ width: 56 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 28, gap: 16 }} showsVerticalScrollIndicator={false}>
        {/* ── Spending hero (headline + inline trend) ───────────────── */}
        <View style={[{ borderRadius: radius.lg * 1.15, overflow: 'hidden' }, shadow.md]}>
          <View style={{ backgroundColor: colors.accentRamp[800], paddingHorizontal: 18, paddingTop: 18, paddingBottom: 18, gap: 6 }}>
            <View style={{ position: 'absolute', right: -36, top: -36, width: 140, height: 140, borderRadius: 999, backgroundColor: colors.accentRamp[700] }} />
            <Kicker style={{ color: colors.accentRamp[100], opacity: 0.8, letterSpacing: 1 }}>
              Spending · {curTitle || 'this month'}
            </Kicker>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Heading style={{ fontSize: 42, letterSpacing: -0.9, color: colors.accentRamp[100] }}>
                {money(cur?.total ?? 0)}
              </Heading>
              {change && (
                <View style={{ backgroundColor: colors.accentRamp[700], borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3, marginBottom: 4 }}>
                  <Body style={{ fontSize: 11, fontFamily: fonts.bodySemi, color: colors.accentRamp[100] }}>{change}</Body>
                </View>
              )}
            </View>
            <Body style={{ fontSize: 12.5, color: colors.accentRamp[100], opacity: 0.85 }}>
              across {curCount} receipt{curCount === 1 ? '' : 's'} this month
            </Body>

            {/* inline mini trend */}
            {months.length > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 78, marginTop: 8 }}>
                {months.map((m, i) => {
                  const isLast = i === months.length - 1;
                  const h = Math.max(5, Math.round((m.total / maxMonth) * 58));
                  return (
                    <View key={m.key} style={{ flex: 1, alignItems: 'center', gap: 5 }}>
                      <View style={{ flex: 1, justifyContent: 'flex-end', width: '100%' }}>
                        <View style={{ height: h, borderRadius: 6, backgroundColor: isLast ? colors.accentRamp[100] : colors.accentRamp[400] }} />
                      </View>
                      <Body style={{ fontSize: 10, color: colors.accentRamp[100], opacity: isLast ? 1 : 0.6 }}>{m.label}</Body>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </View>

        {/* ── Top merchants ─────────────────────────────────────────── */}
        <Card style={{ padding: 16, gap: 12 }}>
          <Kicker style={{ color: ink(0.45), letterSpacing: 1 }}>Top merchants</Kicker>
          {merchants.map((m) => (
            <View key={m.merchant} style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Body style={{ flex: 1, fontSize: 13.5, paddingRight: 10 }}>{m.merchant}</Body>
                <Body style={{ fontFamily: fonts.heading, fontSize: 13.5, color: ink(0.85) }}>{money(m.total)}</Body>
              </View>
              <ProgressBar pct={`${Math.round((100 * m.total) / maxMerchant)}%`} color={colors.accent2Ramp[500]} height={7} />
            </View>
          ))}
        </Card>

        {/* ── Recurring / subscriptions ─────────────────────────────── */}
        <Card style={{ padding: 16, gap: 12 }}>
          <Kicker style={{ color: ink(0.45), letterSpacing: 1 }}>Recurring</Kicker>
          {recurring.length === 0 ? (
            <Body style={{ fontSize: 12.5, color: ink(0.5) }}>
              Nothing recurring yet — merchants you buy from more than once show up here.
            </Body>
          ) : (
            recurring.map((r) => (
              <View key={r.merchant} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Heading style={{ fontSize: 15 }}>{r.merchant}</Heading>
                    {r.likely && <Tag variant="accent" textStyle={{ fontSize: 9.5 }} style={{ paddingVertical: 1, paddingHorizontal: 7 }}>Subscription?</Tag>}
                  </View>
                  <Body style={{ fontSize: 12, color: ink(0.55) }}>{r.count} purchases · avg {money(r.avg)}</Body>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Heading style={{ fontSize: 15, color: colors.accent2Ramp[700] }}>~{money(r.monthly)}</Heading>
                  <Body style={{ fontSize: 10.5, color: ink(0.45) }}>per month</Body>
                </View>
              </View>
            ))
          )}
        </Card>

        {/* ── Reimbursable ──────────────────────────────────────────── */}
        <Card elevation="md" style={{ padding: 18, gap: 12, backgroundColor: colors.accent2Ramp[800], overflow: 'hidden' }}>
          <View style={{ position: 'absolute', right: -30, top: -30, width: 120, height: 120, borderRadius: 999, backgroundColor: colors.accent2Ramp[700] }} />
          <View>
            <Kicker style={{ color: colors.accent2Ramp[100], opacity: 0.8, letterSpacing: 1 }}>Reimbursable</Kicker>
            <Heading style={{ fontSize: 34, letterSpacing: -0.6, color: colors.accent2Ramp[100] }}>{money(reimbTotal)}</Heading>
            <Body style={{ fontSize: 12.5, color: colors.accent2Ramp[100], opacity: 0.85 }}>
              {reimb.length > 0
                ? `${reimb.length} receipt${reimb.length === 1 ? '' : 's'} flagged · owed back to you`
                : 'Flag receipts as reimbursable on their detail screen.'}
            </Body>
          </View>
          {reimb.length > 0 && (
            <Button title="Export report (CSV)" variant="primary" block onPress={exportReimb} />
          )}
        </Card>
      </ScrollView>
    </View>
  );
}
