import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Card, Chip, Heading, Icon, Input, Kicker, Tag, TornReceiptCard } from '../../components/ui';
import { derive, fmtD, isActive, money, statusOf } from '../../lib/data';
import { useVault } from '../../lib/store';
import { colors, fonts, ink, radius, shadow } from '../../lib/theme';

const FILTERS = ['All', 'Returns open', 'Under warranty', 'Reimbursable', 'This month'];

export default function VaultScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { receipts } = useVault();
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');

  const yearTotal = useMemo(() => receipts.reduce((a, r) => a + r.total, 0), [receipts]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return receipts.filter((r) => {
      const v = derive(r);
      if (filter === 'Returns open' && (!isActive(r) || v.retLeft < 0)) return false;
      if (filter === 'Under warranty' && v.warLeft < 0) return false;
      if (filter === 'Reimbursable' && !r.reimbursable) return false;
      if (filter === 'This month' && r.date.getMonth() !== 6) return false;
      if (q) {
        const hay = `${r.merchant} ${r.cat} ${r.total}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [receipts, filter, query]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: 132, paddingHorizontal: 20, gap: 16 }}
      showsVerticalScrollIndicator={false}
    >
      {/* header with decorative blobs */}
      <View style={{ position: 'relative', paddingTop: 4, paddingBottom: 2 }}>
        <View
          style={{
            position: 'absolute', right: -26, top: -34, width: 132, height: 132,
            borderRadius: 999, backgroundColor: colors.accent2Ramp[200], opacity: 0.7,
          }}
        />
        <View
          style={{
            position: 'absolute', right: 44, top: 38, width: 52, height: 52,
            borderRadius: 999, backgroundColor: colors.accentRamp[200], opacity: 0.8,
          }}
        />
        <Pressable
          onPress={() => router.push('/settings')}
          accessibilityLabel="Settings"
          style={({ pressed }) => [
            {
              position: 'absolute', right: 0, top: 0, zIndex: 5,
              width: 44, height: 44, borderRadius: radius.pill,
              backgroundColor: colors.surface,
              alignItems: 'center', justifyContent: 'center',
              opacity: pressed ? 0.85 : 1,
            },
            shadow.sm,
          ]}
        >
          <Icon name="sliders" size={21} color={colors.accent} />
        </Pressable>

        <View>
          <Kicker style={{ color: colors.accentRamp[700] }}>Every scrap, kept</Kicker>
          <Heading style={{ fontSize: 38, marginTop: 2, marginBottom: 6 }}>Vault</Heading>
          <Body style={{ fontSize: 12.5, color: ink(0.6) }}>
            <Body style={{ fontFamily: fonts.heading }}>{receipts.length}</Body> receipts ·{' '}
            <Body style={{ fontFamily: fonts.heading }}>{money(yearTotal)}</Body> this year
          </Body>
        </View>
      </View>

      <Input placeholder="Search merchant, item, amount…" value={query} onChangeText={setQuery} />

      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <Chip key={f} label={f} active={f === filter} onPress={() => setFilter(f)} />
        ))}
      </View>

      {list.length > 0 && (
        <Kicker style={{ color: ink(0.5), letterSpacing: 1 }}>{filter === 'All' ? 'Recent' : filter}</Kicker>
      )}

      {list.length === 0 &&
        (receipts.length === 0 ? (
          <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 30, marginTop: 8 }}>
            <View
              style={{
                width: 56, height: 56, borderRadius: 999,
                alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentRamp[100],
              }}
            >
              <Icon name="vault" size={26} color={colors.accent} />
            </View>
            <Heading style={{ fontSize: 18, marginTop: 2 }}>Your vault is empty</Heading>
            <Body style={{ fontSize: 12.5, color: ink(0.55), textAlign: 'center', paddingHorizontal: 24 }}>
              Snap a receipt and we'll read the merchant, total, and dates — then track every return &
              warranty for you.
            </Body>
            <Button title="Add your first receipt" variant="primary" style={{ marginTop: 6 }} onPress={() => router.push('/capture')} />
          </Card>
        ) : (
          <Card style={{ alignItems: 'center', gap: 8, paddingVertical: 26, marginTop: 8 }}>
            <Heading style={{ fontSize: 16 }}>No matches</Heading>
            <Body style={{ fontSize: 12.5, color: ink(0.55), textAlign: 'center', paddingHorizontal: 24 }}>
              {query.trim()
                ? `Nothing here matches “${query.trim()}”.`
                : `No receipts in “${filter}” right now.`}
            </Body>
            {(query.trim() || filter !== 'All') && (
              <Button
                title="Clear filters"
                variant="secondary"
                style={{ marginTop: 4 }}
                onPress={() => {
                  setQuery('');
                  setFilter('All');
                }}
              />
            )}
          </Card>
        ))}

      <View style={{ gap: 10 }}>
        {list.map((r) => {
          const v = derive(r);
          const st = statusOf(r);
          let badge: { label: string; variant: 'accent' | 'accent-2' } | null = null;
          if (st === 'resolved') badge = { label: 'Resolved', variant: 'accent-2' };
          else if (st === 'filed') badge = { label: 'Filed', variant: 'accent' };
          else if (v.retLeft >= 0) badge = { label: `Return ${v.retLeft}d`, variant: 'accent-2' };
          else if (v.warLeft >= 0) badge = { label: 'Warranty', variant: 'accent' };
          return (
            <TornReceiptCard key={r.id} onPress={() => router.push(`/receipt/${r.id}`)}>
              {r.imageUri ? (
                <Image
                  source={{ uri: r.imageUri }}
                  style={{
                    width: 46, height: 58, borderRadius: 12, marginRight: 14,
                    backgroundColor: colors.neutral[200], borderWidth: 1, borderColor: ink(0.08),
                  }}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={{
                    width: 46, height: 58, borderRadius: 12, marginRight: 14,
                    backgroundColor: colors.accent2Ramp[200],
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Heading style={{ fontSize: 20, color: colors.accent2Ramp[800] }}>{r.merchant[0]}</Heading>
                </View>
              )}
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <Heading style={{ fontSize: 16, lineHeight: 18 }} >{r.merchant}</Heading>
                <Body style={{ fontSize: 12, color: ink(0.55) }}>
                  {fmtD(r.date)} · {r.cat}
                </Body>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 5, paddingLeft: 10 }}>
                <Heading style={{ fontSize: 19, letterSpacing: -0.4 }}>{money(r.total)}</Heading>
                {badge && (
                  <Tag variant={badge.variant} textStyle={{ fontSize: 10 }} style={{ paddingVertical: 2, paddingHorizontal: 8 }}>
                    {badge.label}
                  </Tag>
                )}
              </View>
            </TornReceiptCard>
          );
        })}
      </View>
    </ScrollView>
  );
}
