import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { Body, Button, Card, Heading, Kicker, ProgressBar, Tag } from '../components/ui';
import { money } from '../lib/data';
import { exportReceiptsCsv } from '../lib/export';
import { haptics } from '../lib/haptics';
import { recurringMerchants, topMerchants } from '../lib/insights';
import { dismiss } from '../lib/nav';
import { useVault } from '../lib/store';
import { CAT_COLOR, colors, fonts, ink, statusBarStyle } from '../lib/theme';

// Resolve a slice/legend color for a category — known categories use the shared
// CAT_COLOR map; anything custom falls back to a rotating brand palette.
function catColor(cat: string, i: number): string {
  if (CAT_COLOR[cat]) return CAT_COLOR[cat];
  const fb = [colors.accentRamp[500], colors.accent2Ramp[500], colors.accentRamp[300], colors.accent2Ramp[700], colors.neutral[500], colors.accentRamp[700]];
  return fb[i % fb.length];
}

// Minimal donut: each slice is a stroked arc drawn with a dash gap, offset by
// the running total so slices sit end-to-end. The extra quarter-circle offset
// starts the first slice at 12 o'clock (avoids a group rotation, which emits an
// invalid transform-origin on web).
function DonutChart({ slices, size = 148, stroke = 24 }: { slices: { color: string; frac: number }[]; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const quarter = c / 4;
  let acc = 0;
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={ink(0.08)} strokeWidth={stroke} fill="none" />
      {slices.map((s, i) => {
        const dash = Math.max(0, s.frac * c);
        const node = (
          <Circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={s.color}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${dash} ${c - dash}`}
            strokeDashoffset={quarter - acc * c}
          />
        );
        acc += s.frac;
        return node;
      })}
    </Svg>
  );
}

export default function InsightsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { receipts, flash } = useVault();

  const merchants = useMemo(() => topMerchants(receipts, 5), [receipts]);
  const recurring = useMemo(() => recurringMerchants(receipts), [receipts]);

  const reimb = useMemo(() => receipts.filter((r) => r.reimbursable), [receipts]);
  const reimbTotal = reimb.reduce((a, r) => a + r.total, 0);

  const maxMerchant = Math.max(1, ...merchants.map((m) => m.total));

  // Spending split by category, largest first — feeds the donut + legend.
  const cats = useMemo(() => {
    const by = new Map<string, number>();
    for (const r of receipts) by.set(r.cat, (by.get(r.cat) ?? 0) + r.total);
    return [...by.entries()].map(([cat, total]) => ({ cat, total })).sort((a, b) => b.total - a.total);
  }, [receipts]);
  const catSum = cats.reduce((a, c) => a + c.total, 0);

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
      <StatusBar style={statusBarStyle()} />
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
        {/* ── Spending by category (donut) ──────────────────────────── */}
        {cats.length > 0 && (
          <Card style={{ padding: 16, gap: 14 }}>
            <Kicker style={{ color: ink(0.45), letterSpacing: 1 }}>By category</Kicker>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
              <View style={{ width: 148, height: 148, alignItems: 'center', justifyContent: 'center' }}>
                <DonutChart slices={cats.map((c, i) => ({ color: catColor(c.cat, i), frac: c.total / catSum }))} />
                <View style={{ position: 'absolute', alignItems: 'center' }}>
                  <Heading style={{ fontSize: 16, letterSpacing: -0.4 }}>{money(catSum)}</Heading>
                  <Body style={{ fontSize: 10, color: ink(0.45), letterSpacing: 0.5 }}>total</Body>
                </View>
              </View>
              <View style={{ flex: 1, gap: 9 }}>
                {cats.map((c, i) => (
                  <View key={c.cat} style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: catColor(c.cat, i) }} />
                    <Body style={{ flex: 1, fontSize: 12.5 }} numberOfLines={1}>{c.cat}</Body>
                    <Body style={{ fontSize: 12, color: ink(0.55), fontFamily: fonts.bodySemi }}>
                      {Math.round((100 * c.total) / catSum)}%
                    </Body>
                  </View>
                ))}
              </View>
            </View>
          </Card>
        )}

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
