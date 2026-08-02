import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Card, Heading, Icon, Input, Kicker, ProgressBar } from '../components/ui';
import { fmtMonthYear, money, sameMonth, TODAY } from '../lib/data';
import { dismiss } from '../lib/nav';
import { useVault } from '../lib/store';
import { colors, fonts, ink, radius, shadow, statusBarStyle } from '../lib/theme';

const MONTHLY = '__monthly';

export default function SavingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { receipts, budgets, savingsGoals, addGoal, contributeGoal, removeGoal } = useVault();

  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [openId, setOpenId] = useState<number | null>(null); // which goal's contribute input is open
  const [amt, setAmt] = useState('');

  const { underBudget, monthSpend, goal, reimbTotal, reimbCount } = useMemo(() => {
    const g = budgets[MONTHLY] || 0;
    const spend = receipts.filter((r) => sameMonth(r.date, TODAY)).reduce((a, r) => a + r.total, 0);
    const reimb = receipts.filter((r) => r.reimbursable);
    return {
      goal: g,
      monthSpend: spend,
      underBudget: g > 0 ? Math.max(0, g - spend) : 0,
      reimbTotal: reimb.reduce((a, r) => a + r.total, 0),
      reimbCount: reimb.length,
    };
  }, [receipts, budgets]);

  const doAdd = () => {
    const n = name.trim();
    if (!n) return;
    addGoal(n, parseFloat(target.replace(/[^0-9.]/g, '')) || 0);
    setName('');
    setTarget('');
  };

  // Toggle a goal's inline contribution input (cross-platform — no Alert.prompt).
  const toggleAdd = (id: number) => {
    setOpenId((cur) => (cur === id ? null : id));
    setAmt('');
  };
  const contributeAmt = parseFloat(amt.replace(/[^0-9.]/g, '')) || 0;
  const submitContribute = (id: number) => {
    if (contributeAmt > 0) contributeGoal(id, contributeAmt);
    setAmt('');
    setOpenId(null);
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
        <Heading style={{ fontSize: 16 }}>Savings</Heading>
        <View style={{ width: 56 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, gap: 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Under-budget hero ──────────────────────────────────────── */}
        <View style={[{ borderRadius: radius.lg * 1.15, overflow: 'hidden' }, shadow.md]}>
          <View style={{ backgroundColor: colors.accent2Ramp[800], paddingHorizontal: 18, paddingTop: 18, paddingBottom: 20, gap: 8 }}>
            <View style={{ position: 'absolute', right: -34, top: -34, width: 132, height: 132, borderRadius: 999, backgroundColor: colors.accent2Ramp[700] }} />
            <Kicker style={{ color: colors.accent2Ramp[100], opacity: 0.85, letterSpacing: 1 }}>
              Under budget · {fmtMonthYear(TODAY)}
            </Kicker>
            <Heading style={{ fontSize: 40, letterSpacing: -0.9, color: colors.accent2Ramp[100] }}>{money(underBudget)}</Heading>
            <Body style={{ fontSize: 12.5, color: colors.accent2Ramp[100], opacity: 0.85 }}>
              {goal > 0
                ? `${money(monthSpend)} of ${money(goal)} spent — money you didn't spend this month`
                : 'Set a monthly goal in Budgets to track under-budget savings'}
            </Body>
          </View>
        </View>

        {/* ── Owed back to you ───────────────────────────────────────── */}
        <Card style={{ padding: 16, gap: 4 }}>
          <Kicker style={{ color: ink(0.5), letterSpacing: 1 }}>Owed back to you</Kicker>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
            <Heading style={{ fontSize: 28, color: colors.accent2Ramp[700] }}>{money(reimbTotal)}</Heading>
            <Body style={{ fontSize: 12.5, color: ink(0.55), marginBottom: 5 }}>
              {reimbCount > 0 ? `${reimbCount} reimbursable receipt${reimbCount === 1 ? '' : 's'}` : 'flag receipts as reimbursable to track'}
            </Body>
          </View>
        </Card>

        {/* ── Savings goals ──────────────────────────────────────────── */}
        <Kicker style={{ color: ink(0.5), letterSpacing: 1 }}>Goals</Kicker>
        <View style={{ gap: 10 }}>
          {savingsGoals.length === 0 && (
            <Body style={{ fontSize: 12.5, color: ink(0.5) }}>
              No goals yet — set one below (e.g. "Vacation", $2,000) and log what you set aside.
            </Body>
          )}
          {savingsGoals.map((g) => {
            const pct = g.target > 0 ? Math.min(100, Math.round((100 * g.saved) / g.target)) : 0;
            const done = g.target > 0 && g.saved >= g.target;
            return (
              <Card key={g.id} style={{ padding: 14, gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Heading style={{ fontSize: 15 }}>{g.name}</Heading>
                    <Body style={{ fontSize: 11.5, color: done ? colors.accent2Ramp[700] : ink(0.5) }}>
                      {g.target > 0
                        ? done
                          ? `${money(g.saved)} — goal reached 🎉`
                          : `${money(g.saved)} of ${money(g.target)} · ${money(g.target - g.saved)} to go`
                        : `${money(g.saved)} saved`}
                    </Body>
                  </View>
                  <Pressable
                    onPress={() => toggleAdd(g.id)}
                    style={({ pressed }) => ({
                      flexDirection: 'row', alignItems: 'center', gap: 4,
                      paddingVertical: 7, paddingHorizontal: 13, borderRadius: radius.pill,
                      backgroundColor: openId === g.id ? colors.accent2Ramp[300] : colors.accent2Ramp[200],
                      opacity: pressed ? 0.75 : 1,
                    })}
                  >
                    <Icon name={openId === g.id ? 'chevron' : 'plus'} size={14} color={colors.accent2Ramp[800]} />
                    <Body style={{ fontFamily: fonts.heading, fontSize: 12.5, color: colors.accent2Ramp[800] }}>Add</Body>
                  </Pressable>
                  <Pressable onPress={() => removeGoal(g.id)} hitSlop={8} style={({ pressed }) => ({ padding: 4, opacity: pressed ? 0.5 : 1 })}>
                    <Icon name="trash" size={16} color={ink(0.4)} />
                  </Pressable>
                </View>
                {g.target > 0 && (
                  <ProgressBar pct={`${pct}%`} color={done ? colors.accent2Ramp[600] : colors.accent} />
                )}
                {openId === g.id && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Input
                        value={amt}
                        onChangeText={setAmt}
                        placeholder="Amount to set aside"
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <Pressable
                      onPress={() => submitContribute(g.id)}
                      disabled={contributeAmt <= 0}
                      style={({ pressed }) => ({
                        paddingVertical: 9, paddingHorizontal: 18, borderRadius: radius.pill,
                        backgroundColor: colors.accent2,
                        opacity: contributeAmt > 0 ? (pressed ? 0.8 : 1) : 0.4,
                      })}
                    >
                      <Body style={{ fontFamily: fonts.heading, fontSize: 13, color: '#fff' }}>Save</Body>
                    </Pressable>
                  </View>
                )}
              </Card>
            );
          })}

          {/* add a goal */}
          <Card style={{ padding: 14, gap: 10 }}>
            <Input value={name} onChangeText={setName} placeholder="Goal name (e.g. Vacation)" />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Input value={target} onChangeText={setTarget} placeholder="Target $ (optional)" keyboardType="decimal-pad" />
              </View>
              <Pressable
                onPress={doAdd}
                disabled={!name.trim()}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                  paddingVertical: 9, paddingHorizontal: 16, borderRadius: radius.pill,
                  backgroundColor: colors.accent, opacity: name.trim() ? (pressed ? 0.8 : 1) : 0.4,
                })}
              >
                <Icon name="plus" size={16} color="#fff" />
                <Body style={{ fontFamily: fonts.heading, fontSize: 13, color: '#fff' }}>Goal</Body>
              </Pressable>
            </View>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}
