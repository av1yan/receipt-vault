import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Heading, Icon, Kicker } from '../components/ui';
import { fmtDY, money, type Receipt } from '../lib/data';
import { exportReceiptsCsv } from '../lib/export';
import { dismiss } from '../lib/nav';
import { useVault } from '../lib/store';
import { CAT_COLOR, colors, fonts, ink, radius, shadow, statusBarStyle } from '../lib/theme';

export default function InventoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { receipts, flash } = useVault();
  const [exporting, setExporting] = useState(false);

  const { items, total } = useMemo(() => {
    const list = receipts
      .filter((r) => r.insured)
      .sort((a, b) => b.total - a.total);
    return { items: list, total: list.reduce((a, r) => a + r.total, 0) };
  }, [receipts]);

  const doExport = async () => {
    if (!items.length) return;
    setExporting(true);
    try {
      const res = await exportReceiptsCsv(items, 'home-inventory');
      if (res === 'unavailable') flash('Sharing unavailable here');
      else if (res === 'error') flash('Export failed');
    } finally {
      setExporting(false);
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
        <Heading style={{ fontSize: 16 }}>Home inventory</Heading>
        <View style={{ width: 56 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, gap: 16 }} showsVerticalScrollIndicator={false}>
        {/* ── Insured value hero ─────────────────────────────────────── */}
        <View style={[{ borderRadius: radius.lg * 1.15, overflow: 'hidden' }, shadow.md]}>
          <View style={{ backgroundColor: colors.accent2Ramp[800], paddingHorizontal: 18, paddingTop: 18, paddingBottom: 20, gap: 8 }}>
            <View style={{ position: 'absolute', right: -34, top: -34, width: 132, height: 132, borderRadius: 999, backgroundColor: colors.accent2Ramp[700] }} />
            <Kicker style={{ color: colors.accent2Ramp[100], opacity: 0.85, letterSpacing: 1 }}>Insured value</Kicker>
            <Heading style={{ fontSize: 40, letterSpacing: -0.9, color: colors.accent2Ramp[100] }}>{money(total)}</Heading>
            <Body style={{ fontSize: 12.5, color: colors.accent2Ramp[100], opacity: 0.85 }}>
              {items.length > 0
                ? `${items.length} item${items.length === 1 ? '' : 's'} · proof of purchase for insurance & claims`
                : 'Mark receipts as "Insured item" to build your inventory'}
            </Body>
          </View>
        </View>

        {items.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 40, gap: 12 }}>
            <View style={[{ width: 64, height: 64, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }, shadow.sm]}>
              <Icon name="vault" size={30} color={colors.accent} />
            </View>
            <Body style={{ fontSize: 13, color: ink(0.55), textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 }}>
              Open a receipt and toggle <Body style={{ fontFamily: fonts.heading }}>Insured item</Body> to keep proof of ownership here — handy for a theft, loss, or damage claim.
            </Body>
          </View>
        ) : (
          <>
            <Kicker style={{ color: ink(0.5), letterSpacing: 1 }}>Valuables</Kicker>
            <View style={{ gap: 10 }}>
              {items.map((r) => (
                <InventoryRow key={r.id} r={r} onPress={() => router.push(`/receipt/${r.id}`)} />
              ))}
            </View>
            <Button
              title={exporting ? 'Preparing…' : 'Export inventory (CSV)'}
              variant="secondary"
              block
              onPress={exporting ? undefined : doExport}
              style={{ marginTop: 4 }}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function InventoryRow({ r, onPress }: { r: Receipt; onPress: () => void }) {
  const dot = CAT_COLOR[r.cat] || colors.accent;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.lg * 1.1, padding: 12 }, shadow.sm]}>
        {r.imageUri ? (
          <Image source={{ uri: r.imageUri }} style={{ width: 52, height: 52, borderRadius: 12 }} />
        ) : (
          <View style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: colors.accent2Ramp[200], alignItems: 'center', justifyContent: 'center' }}>
            <Heading style={{ fontSize: 20, color: colors.accent2Ramp[700] }}>{r.merchant.slice(0, 1).toUpperCase()}</Heading>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Heading style={{ fontSize: 15 }} >{r.merchant}</Heading>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 }}>
            <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: dot }} />
            <Body style={{ fontSize: 11.5, color: ink(0.55) }}>{r.cat} · {fmtDY(r.date)}</Body>
          </View>
          {!!r.serial && <Body style={{ fontSize: 11, color: ink(0.45), marginTop: 1 }}>SN: {r.serial}</Body>}
        </View>
        <Heading style={{ fontSize: 16 }}>{money(r.total)}</Heading>
      </View>
    </Pressable>
  );
}
