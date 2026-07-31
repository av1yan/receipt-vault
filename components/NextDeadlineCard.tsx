import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { fmtD, nextDeadline } from '../lib/data';
import { useVault } from '../lib/store';
import { colors, fonts, radius, shadow } from '../lib/theme';
import { Body, Heading, Kicker } from './ui';

// A "widget-style" hero showing the single soonest deadline — mirrors what the
// native home-screen widget displays. Urgent (≤7 days) turns terracotta.
export function NextDeadlineCard() {
  const { receipts } = useVault();
  const router = useRouter();
  const nd = useMemo(() => nextDeadline(receipts), [receipts]);

  if (!nd) return null;

  const urgent = nd.daysLeft <= 7;
  const ramp = urgent ? colors.accentRamp : colors.accent2Ramp;
  const label = nd.kind === 'return' ? 'Return window' : 'Warranty';

  return (
    <Pressable
      onPress={() => router.push(`/receipt/${nd.receiptId}`)}
      style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.99 : 1 }] }]}
    >
      <View
        style={[
          {
            backgroundColor: ramp[800],
            borderRadius: radius.lg * 1.15,
            padding: 18,
            overflow: 'hidden',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          },
          shadow.md,
        ]}
      >
        <View
          style={{
            position: 'absolute', right: -30, top: -30, width: 120, height: 120,
            borderRadius: 999, backgroundColor: ramp[700],
          }}
        />
        <View style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <Kicker style={{ color: ramp[200], letterSpacing: 1.4 }}>Next deadline</Kicker>
          <Heading style={{ fontSize: 20, color: ramp[100], marginTop: 3 }} >{nd.merchant}</Heading>
          <Body style={{ fontSize: 12.5, color: ramp[200], marginTop: 2 }}>
            {label} · by {fmtD(nd.date)}
          </Body>
        </View>
        <View style={{ alignItems: 'center', position: 'relative', paddingLeft: 6 }}>
          <Heading style={{ fontSize: 34, lineHeight: 36, color: ramp[100], letterSpacing: -0.5 }}>
            {nd.daysLeft}
          </Heading>
          <Body style={{ fontSize: 10.5, color: ramp[200], fontFamily: fonts.body, letterSpacing: 0.3 }}>
            {nd.daysLeft === 1 ? 'day left' : 'days left'}
          </Body>
        </View>
      </View>
    </Pressable>
  );
}
