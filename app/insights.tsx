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
import { colors, fonts, ink } from '../lib/theme';

export default function InsightsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { receipts, flash } = useVault();

  const months = useMemo(() => monthlyTotals(receipts, 6), [receipts]);
  const merchants = useMemo(() => topMerchants(receipts, 5), [receipts]);
  const recurring = useMemo(() => recurringMerchants(receipts), [receipts]);

  const reimb = useMemo(() => receipts.filter((r) => r.reimbursable), [receipts]);
  const reimbTotal = reimb.reduce((a, r) => a + r.total, 0);

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

  const maxMonth = Math.max(1, ...months.map((m) => m.total));
  const maxMerchant = Math.max(1, ...merchants.map((m) => m.total));

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

        {/* ── Monthly trend ─────────────────────────────────────────── */}
        <Card style={{ padding: 16, gap: 12 }}>
          <Kicker style={{ color: ink(0.45), letterSpacing: 1 }}>Monthly spend</Kicker>
          {months.length === 0 ? (
            <Body style={{ fontSize: 12.5, color: ink(0.5) }}>Add a few receipts to see your trend.</Body>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 128 }}>
              {months.map((m, i) => {
                const isLast = i === months.length - 1;
                const h = Math.max(6, Math.round((m.total / maxMonth) * 96));
                return (
                  <View key={m.key} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                    <Body style={{ fontSize: 10, color: ink(0.5) }}>{shortMoney(m.total)}</Body>
                    <View style={{ flex: 1, justifyContent: 'flex-end', width: '100%' }}>
                      <View
                        style={{
                          height: h, borderRadius: 8,
                          backgroundColor: isLast ? colors.accent : colors.accent2Ramp[400],
                        }}
                      />
                    </View>
                    <Body style={{ fontSize: 11, color: isLast ? colors.accent : ink(0.55), fontFamily: isLast ? fonts.heading : fonts.body }}>
                      {m.label}
                    </Body>
                  </View>
                );
              })}
            </View>
          )}
        </Card>

        {/* ── Top merchants ─────────────────────────────────────────── */}
        <Card style={{ padding: 16, gap: 12 }}>
          <Kicker style={{ color: ink(0.45), letterSpacing: 1 }}>Top merchants</Kicker>
          {merchants.map((m) => (
            <View key={m.merchant} style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Body style={{ flex: 1, fontSize: 13.5, paddingRight: 10 }} >{m.merchant}</Body>
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
              <View
                key={r.merchant}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Heading style={{ fontSize: 15 }} >{r.merchant}</Heading>
                    {r.likely && <Tag variant="accent" textStyle={{ fontSize: 9.5 }} style={{ paddingVertical: 1, paddingHorizontal: 7 }}>Subscription?</Tag>}
                  </View>
                  <Body style={{ fontSize: 12, color: ink(0.55) }}>
                    {r.count} purchases · avg {money(r.avg)}
                  </Body>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Heading style={{ fontSize: 15, color: colors.accent2Ramp[700] }}>~{money(r.monthly)}</Heading>
                  <Body style={{ fontSize: 10.5, color: ink(0.45) }}>per month</Body>
                </View>
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

// Compact money for tight chart labels: $1.1k / $940.
function shortMoney(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}
