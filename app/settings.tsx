import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Card, Heading, Icon, IconName, Kicker } from '../components/ui';
import { dismiss } from '../lib/nav';
import { ensurePermission, hasPermission, rescheduleAll, scheduledCount } from '../lib/notifications';
import { useVault } from '../lib/store';
import { colors, fonts, ink, radius, shadow } from '../lib/theme';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { receipts, flash } = useVault();

  const [remindersOn, setRemindersOn] = useState(false);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (await hasPermission()) {
        const n = await scheduledCount();
        if (alive) {
          setRemindersOn(true);
          setCount(n);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [receipts]);

  const turnOnReminders = async () => {
    setBusy(true);
    try {
      if (await ensurePermission()) {
        const n = await rescheduleAll(receipts);
        setRemindersOn(true);
        setCount(n);
        flash('Reminders on');
      } else {
        flash('Enable notifications in Settings › Notifications');
      }
    } finally {
      setBusy(false);
    }
  };

  const version = Constants.expoConfig?.version ?? '1.0.0';

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
        <Heading style={{ fontSize: 16 }}>Settings</Heading>
        <View style={{ width: 56 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 28, gap: 16 }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 10 }}>
          <Kicker style={{ color: ink(0.5), letterSpacing: 1 }}>Sync & data</Kicker>
          <NavRow
            icon="cloud"
            title="Cloud backup"
            subtitle="Sync, sync code & email import"
            onPress={() => router.push('/sync')}
          />
          <NavRow
            icon="bars"
            title="Category budgets"
            subtitle="Monthly limits per category"
            onPress={() => router.push('/budgets')}
          />
        </View>

        <View style={{ gap: 10 }}>
          <Kicker style={{ color: ink(0.5), letterSpacing: 1 }}>Reminders</Kicker>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
            <Tile icon="bell" active={remindersOn} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Heading style={{ fontSize: 15 }}>Deadline reminders</Heading>
              <Body style={{ fontSize: 12, color: ink(0.55) }}>
                {remindersOn ? `On · ${count} scheduled` : 'Get nudged before returns & warranties lapse'}
              </Body>
            </View>
            {remindersOn ? (
              <Body style={{ fontFamily: fonts.heading, fontSize: 13, color: colors.accent2Ramp[700] }}>On</Body>
            ) : (
              <Pressable
                onPress={turnOnReminders}
                disabled={busy}
                style={({ pressed }) => ({
                  paddingVertical: 8, paddingHorizontal: 16, borderRadius: radius.pill,
                  backgroundColor: colors.accent, opacity: pressed || busy ? 0.7 : 1,
                })}
              >
                <Body style={{ fontFamily: fonts.heading, fontSize: 13, color: '#fff' }}>Turn on</Body>
              </Pressable>
            )}
          </Card>
        </View>

        <View style={{ gap: 10 }}>
          <Kicker style={{ color: ink(0.5), letterSpacing: 1 }}>About</Kicker>
          <Card style={{ padding: 16, gap: 4 }}>
            <Heading style={{ fontSize: 18 }}>Receipt Vault</Heading>
            <Body style={{ fontSize: 12.5, color: ink(0.55) }}>Version {version}</Body>
            <Body style={{ fontSize: 12.5, color: ink(0.55) }}>
              {receipts.length} receipts · kept on this device, synced when you choose.
            </Body>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

function Tile({ icon, active }: { icon: IconName; active: boolean }) {
  return (
    <View
      style={{
        width: 40, height: 40, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: active ? colors.accent2Ramp[200] : colors.accentRamp[100],
      }}
    >
      <Icon name={icon} size={20} color={active ? colors.accent2Ramp[700] : colors.accent} />
    </View>
  );
}

function NavRow({ icon, title, subtitle, onPress }: { icon: IconName; title: string; subtitle: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <View
        style={[
          {
            flexDirection: 'row', alignItems: 'center', gap: 12,
            backgroundColor: colors.surface, borderRadius: radius.lg * 1.15, padding: 14,
          },
          shadow.sm,
        ]}
      >
        <Tile icon={icon} active={false} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Heading style={{ fontSize: 15 }}>{title}</Heading>
          <Body style={{ fontSize: 12, color: ink(0.55) }}>{subtitle}</Body>
        </View>
        <Icon name="chevron" size={18} color={ink(0.3)} />
      </View>
    </Pressable>
  );
}
