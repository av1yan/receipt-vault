import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Card, Heading, Icon, Input, Kicker, Tag } from '../components/ui';
import { useVault } from '../lib/store';
import { getVaultKey, setVaultKey, syncNow } from '../lib/sync';
import { colors, fonts, ink, radius } from '../lib/theme';

export default function SyncScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { receipts, mergeReceipts, flash } = useVault();

  const [key, setKey] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastCount, setLastCount] = useState<number | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getVaultKey().then(setKey);
  }, []);

  const synced = key !== null;

  const doSync = async () => {
    setBusy(true);
    try {
      const remote = await syncNow(receipts);
      mergeReceipts(remote);
      setLastCount(remote.length);
      setKey(await getVaultKey());
      flash(`Backed up · ${remote.length} receipts in the cloud`);
    } catch (e) {
      flash('Sync failed — check your connection');
      console.warn('[receipt-vault] sync failed', e);
    } finally {
      setBusy(false);
    }
  };

  const doRestore = async () => {
    const code = codeInput.trim();
    if (code.length < 16) {
      flash('That sync code looks too short');
      return;
    }
    setBusy(true);
    try {
      await setVaultKey(code);
      const remote = await syncNow(receipts);
      mergeReceipts(remote);
      setLastCount(remote.length);
      setKey(await getVaultKey());
      setCodeInput('');
      flash(`Restored · ${remote.length} receipts pulled in`);
    } catch (e) {
      flash('Restore failed — check the code & connection');
      console.warn('[receipt-vault] restore failed', e);
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    if (!key) return;
    await Clipboard.setStringAsync(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const masked = key ? key.slice(0, 4) + '••••••••••••' + key.slice(-4) : '';

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
        <Heading style={{ fontSize: 16 }}>Cloud backup</Heading>
        <View style={{ width: 56 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 16 }} showsVerticalScrollIndicator={false}>
        {/* status hero */}
        <View
          style={{
            backgroundColor: synced ? colors.accent2Ramp[800] : colors.accentRamp[800],
            borderRadius: radius.lg * 1.15, padding: 20, overflow: 'hidden',
          }}
        >
          <View style={{ position: 'absolute', right: -30, top: -30, width: 120, height: 120, borderRadius: 999, backgroundColor: synced ? colors.accent2Ramp[700] : colors.accentRamp[700] }} />
          <View style={{ position: 'relative', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Icon name="cloud" size={26} color={synced ? colors.accent2Ramp[100] : colors.accentRamp[100]} />
            <View style={{ flex: 1 }}>
              <Heading style={{ fontSize: 20, color: synced ? colors.accent2Ramp[100] : colors.accentRamp[100] }}>
                {synced ? 'Backed up' : 'Not backed up yet'}
              </Heading>
              <Body style={{ fontSize: 12.5, color: synced ? colors.accent2Ramp[200] : colors.accentRamp[200], marginTop: 2 }}>
                {lastCount !== null
                  ? `${lastCount} receipts in the cloud · just now`
                  : synced
                    ? 'Tap below to sync your latest'
                    : 'Back up to protect your receipts'}
              </Body>
            </View>
          </View>
        </View>

        <Button title={busy ? 'Syncing…' : synced ? 'Sync now' : 'Back up & sync now'} variant="primary" block onPress={doSync} />

        {/* sync code */}
        {synced && (
          <View style={{ gap: 8 }}>
            <Kicker style={{ color: ink(0.5), letterSpacing: 1 }}>Your sync code</Kicker>
            <Card style={{ padding: 14, gap: 10 }}>
              <Body style={{ fontFamily: fonts.body, fontSize: 15, letterSpacing: 0.5, color: colors.text }} selectable>
                {revealed ? key : masked}
              </Body>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button title={revealed ? 'Hide' : 'Reveal'} variant="secondary" style={{ flex: 1 }} onPress={() => setRevealed((v) => !v)} />
                <Button title={copied ? 'Copied ✓' : 'Copy'} variant="secondary" style={{ flex: 1 }} onPress={copyCode} />
              </View>
              <Body style={{ fontSize: 12, color: ink(0.55) }}>
                Enter this code on another device to see the same receipts. Keep it private — anyone with it can read your vault.
              </Body>
            </Card>
          </View>
        )}

        {/* restore from another device */}
        <View style={{ gap: 8 }}>
          <Kicker style={{ color: ink(0.5), letterSpacing: 1 }}>Restore from another device</Kicker>
          <Card style={{ padding: 14, gap: 10 }}>
            <Input placeholder="Paste a sync code…" value={codeInput} onChangeText={setCodeInput} />
            <Button title="Use this code" variant="secondary" block onPress={doRestore} />
            <Body style={{ fontSize: 12, color: ink(0.55) }}>
              This replaces your device's sync code and pulls that vault's receipts in.
            </Body>
          </Card>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }}>
          <Tag variant="neutral" textStyle={{ fontSize: 9.5 }} style={{ paddingVertical: 1, paddingHorizontal: 7 }}>Note</Tag>
          <Body style={{ flex: 1, fontSize: 12, color: ink(0.5) }}>
            Receipts, line items, and photos all sync. Photos upload to your private cloud vault and
            download automatically on your other devices.
          </Body>
        </View>
      </ScrollView>
    </View>
  );
}
