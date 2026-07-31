import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Card, Heading, Input } from '../components/ui';
import { CATS } from '../lib/data';
import { dismiss } from '../lib/nav';
import { useVault } from '../lib/store';
import { CAT_COLOR, colors, fonts, ink } from '../lib/theme';

export default function BudgetsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { budgets, setBudget, flash } = useVault();

  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(CATS.map((c) => [c, budgets[c] ? String(budgets[c]) : ''])),
  );

  const save = () => {
    for (const c of CATS) {
      const n = parseFloat((vals[c] || '').replace(/[^0-9.]/g, '')) || 0;
      setBudget(c, n);
    }
    flash('Budgets saved');
    dismiss(router);
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
        <Heading style={{ fontSize: 16 }}>Category budgets</Heading>
        <View style={{ width: 56 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 14 }} showsVerticalScrollIndicator={false}>
        <Body style={{ fontSize: 12.5, color: ink(0.6) }}>
          Set a monthly limit per category. Leave one blank for no limit — the Spending screen tracks
          progress against these.
        </Body>

        <Card style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 6, gap: 0 }}>
          {CATS.map((c, i) => (
            <View
              key={c}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10,
                borderTopWidth: i === 0 ? 0 : 1, borderStyle: 'dashed', borderTopColor: ink(0.12),
              }}
            >
              <View style={{ width: 9, height: 9, borderRadius: 999, backgroundColor: CAT_COLOR[c] || colors.accent }} />
              <Body style={{ flex: 1, fontSize: 14 }}>{c}</Body>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Body style={{ fontSize: 14, color: ink(0.5) }}>$</Body>
                <Input
                  value={vals[c]}
                  onChangeText={(t) => setVals((v) => ({ ...v, [c]: t }))}
                  placeholder="0"
                  keyboardType="decimal-pad"
                  style={{ width: 92, textAlign: 'right', fontFamily: fonts.heading }}
                />
              </View>
            </View>
          ))}
        </Card>
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 16, backgroundColor: colors.bg }}>
        <Button title="Save budgets" variant="primary" block onPress={save} />
      </View>
    </View>
  );
}
