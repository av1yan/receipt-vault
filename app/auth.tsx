import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Heading, Icon, Input, Kicker } from '../components/ui';
import { signIn, signUp } from '../lib/auth';
import { dismiss } from '../lib/nav';
import { useVault } from '../lib/store';
import { colors, fonts, ink, radius, shadow, statusBarStyle } from '../lib/theme';

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { flash } = useVault();

  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmMsg, setConfirmMsg] = useState('');

  const canSubmit = /\S+@\S+\.\S+/.test(email) && password.length >= 6 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    setConfirmMsg('');
    const res = mode === 'in' ? await signIn(email, password) : await signUp(email, password);
    setBusy(false);
    if (!res.ok) {
      setError(res.error || 'Something went wrong');
      return;
    }
    if (res.needsConfirm) {
      setConfirmMsg('Check your email to confirm your account, then sign in.');
      setMode('in');
      return;
    }
    flash('Signed in');
    dismiss(router);
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
        <Heading style={{ fontSize: 16 }}>Account</Heading>
        <View style={{ width: 56 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, gap: 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: 'center', gap: 10, marginTop: 8, marginBottom: 4 }}>
          <View style={[{ width: 60, height: 60, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }, shadow.sm]}>
            <Icon name="cloud" size={30} color={colors.accent} />
          </View>
          <Heading style={{ fontSize: 22 }}>{mode === 'in' ? 'Sign in' : 'Create account'}</Heading>
          <Body style={{ fontSize: 13, color: ink(0.55), textAlign: 'center', lineHeight: 19 }}>
            An account syncs your vault across devices — no sync code to copy. Optional; the sync code still works without one.
          </Body>
        </View>

        {/* mode toggle */}
        <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.pill, padding: 4 }}>
          {(['in', 'up'] as const).map((m) => (
            <Pressable
              key={m}
              onPress={() => { setMode(m); setError(''); }}
              style={{
                flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.pill,
                backgroundColor: mode === m ? colors.accent : 'transparent',
              }}
            >
              <Body style={{ fontFamily: fonts.heading, fontSize: 13, color: mode === m ? '#fff' : ink(0.6) }}>
                {m === 'in' ? 'Sign in' : 'Create account'}
              </Body>
            </Pressable>
          ))}
        </View>

        <View style={{ gap: 10 }}>
          <Kicker style={{ color: ink(0.5), letterSpacing: 1 }}>Email</Kicker>
          <Input
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <Kicker style={{ color: ink(0.5), letterSpacing: 1, marginTop: 4 }}>Password</Kicker>
          <Input
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            secureTextEntry
            autoCapitalize="none"
            autoComplete={mode === 'in' ? 'password' : 'new-password'}
          />
        </View>

        {!!error && <Body style={{ fontSize: 12.5, color: colors.accent }}>{error}</Body>}
        {!!confirmMsg && <Body style={{ fontSize: 12.5, color: colors.accent2Ramp[700] }}>{confirmMsg}</Body>}

        <Pressable
          onPress={submit}
          disabled={!canSubmit}
          style={({ pressed }) => ({
            alignItems: 'center', paddingVertical: 13, borderRadius: radius.pill,
            backgroundColor: colors.accent, opacity: canSubmit ? (pressed ? 0.85 : 1) : 0.4, marginTop: 4,
          })}
        >
          <Body style={{ fontFamily: fonts.heading, fontSize: 15, color: '#fff' }}>
            {busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}
          </Body>
        </Pressable>

        <Body style={{ fontSize: 11.5, color: ink(0.45), textAlign: 'center', lineHeight: 17 }}>
          Your receipts stay end‑to‑end scoped to a private vault key tied to your account. We only store your email for sign‑in.
        </Body>
      </ScrollView>
    </View>
  );
}
