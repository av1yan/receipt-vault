import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Card, Heading, Kicker, Tag } from '../../components/ui';
import { generateClaim, type Claim, type ClaimKind } from '../../lib/claim';
import { useVault } from '../../lib/store';
import { colors, fonts, ink } from '../../lib/theme';

export default function ClaimScreen() {
  const { id, kind: kindParam } = useLocalSearchParams<{ id: string; kind?: string }>();
  const kind: ClaimKind = kindParam === 'warranty' ? 'warranty' : 'return';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { receipts } = useVault();
  const receipt = receipts.find((r) => String(r.id) === String(id));

  const [claim, setClaim] = useState<Claim | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!receipt) {
      router.back();
      return;
    }
    generateClaim(receipt, kind).then((c) => {
      if (alive) setClaim(c);
    });
    return () => {
      alive = false;
    };
  }, [receipt?.id, kind]);

  if (!receipt) return null;

  const title = kind === 'return' ? 'Return request' : 'Warranty claim';
  const fullText = claim ? `${claim.subject}\n\n${claim.body}` : '';

  const onCopy = async () => {
    await Clipboard.setStringAsync(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  const onShare = () => Share.share({ message: fullText }).catch(() => {});

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="dark" />
      <View
        style={{
          paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 10,
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        }}
      >
        <Button title="Close" variant="ghost" onPress={() => router.back()} />
        <Heading style={{ fontSize: 16 }}>{title}</Heading>
        <View style={{ width: 56 }} />
      </View>

      {!claim ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <ActivityIndicator color={colors.accent} />
          <Body style={{ color: ink(0.6) }}>Drafting your {kind} request…</Body>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 14 }}
            showsVerticalScrollIndicator={false}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Body style={{ fontSize: 13, color: ink(0.6) }}>
                To: {receipt.merchant} customer support
              </Body>
              <Tag variant={claim.source === 'ai' ? 'accent' : 'neutral'} textStyle={{ fontSize: 9.5 }} style={{ paddingVertical: 1, paddingHorizontal: 7 }}>
                {claim.source === 'ai' ? 'AI-drafted' : 'Template'}
              </Tag>
            </View>

            {claim.note && (
              <Card elevation="none" style={{ backgroundColor: colors.accentRamp[100], padding: 12 }}>
                <Body style={{ fontSize: 13, color: colors.accentRamp[800] }}>{claim.note}</Body>
              </Card>
            )}

            <View>
              <Kicker style={{ color: ink(0.5), letterSpacing: 1, marginBottom: 6 }}>Subject</Kicker>
              <Card style={{ padding: 14 }}>
                <Body style={{ fontSize: 14 }} selectable>{claim.subject}</Body>
              </Card>
            </View>

            <View>
              <Kicker style={{ color: ink(0.5), letterSpacing: 1, marginBottom: 6 }}>Message</Kicker>
              <Card style={{ padding: 14 }}>
                <Body style={{ fontSize: 14, lineHeight: 21 }} selectable>{claim.body}</Body>
              </Card>
            </View>

            <View>
              <Kicker style={{ color: ink(0.5), letterSpacing: 1, marginBottom: 6 }}>What you'll need</Kicker>
              <Card style={{ padding: 14, gap: 8 }}>
                {claim.checklist.map((c, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                    <Body style={{ color: colors.accent2Ramp[600], fontFamily: fonts.heading, fontSize: 14, lineHeight: 20 }}>✓</Body>
                    <Body style={{ flex: 1, fontSize: 13.5, lineHeight: 20 }}>{c}</Body>
                  </View>
                ))}
              </Card>
            </View>
          </ScrollView>

          <View
            style={{
              flexDirection: 'row', gap: 10,
              paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 16,
              backgroundColor: colors.bg,
            }}
          >
            <Button title={copied ? 'Copied ✓' : 'Copy'} variant="secondary" style={{ flex: 1 }} onPress={onCopy} />
            <Button title="Share" variant="primary" style={{ flex: 1 }} onPress={onShare} />
          </View>
        </>
      )}
    </View>
  );
}
