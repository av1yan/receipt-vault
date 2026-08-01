import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Card, Chip, Heading, Icon, IconName, Kicker } from '../components/ui';
import { useAppearance } from '../lib/appearance';
import { biometricLabel, canUseAppLock } from '../lib/applock';
import { exportReceiptsCsv } from '../lib/export';
import { dismiss } from '../lib/nav';
import {
  ensurePermission,
  hasPermission,
  rescheduleAll,
  scheduledCount,
  sendTestReminder,
  setReminderLeadDays,
} from '../lib/notifications';
import { LEAD_PRESETS, loadSettings, THEME_OPTIONS, ThemePref, updateSettings } from '../lib/settings';
import { useVault } from '../lib/store';
import { colors, fonts, ink, radius, shadow, statusBarStyle } from '../lib/theme';

const THEME_LABEL: Record<ThemePref, string> = { system: 'System', light: 'Light', dark: 'Dark' };

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { receipts, clearAll, flash } = useVault();
  const { pref, setPref } = useAppearance();

  const [remindersOn, setRemindersOn] = useState(false);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [lead, setLead] = useState(3);
  const [exporting, setExporting] = useState(false);
  const [appLock, setAppLock] = useState(false);
  const [bioLabel, setBioLabel] = useState('Face ID');

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await loadSettings();
      if (alive) {
        setLead(s.reminderLeadDays);
        setAppLock(s.appLock);
      }
      biometricLabel().then((l) => alive && setBioLabel(l));
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

  const changeLead = async (days: number) => {
    setLead(days);
    setReminderLeadDays(days);
    await updateSettings({ reminderLeadDays: days });
    if (remindersOn) setCount(await rescheduleAll(receipts));
    flash(`Reminding ${days} day${days > 1 ? 's' : ''} ahead`);
  };

  const doTest = async () => {
    const ok = await sendTestReminder();
    flash(ok ? 'Test reminder on its way' : 'Enable notifications first');
  };

  const toggleAppLock = async () => {
    if (appLock) {
      setAppLock(false);
      await updateSettings({ appLock: false });
      flash('App Lock off');
      return;
    }
    if (!(await canUseAppLock())) {
      flash(`Set up ${bioLabel} or a passcode first`);
      return;
    }
    setAppLock(true);
    await updateSettings({ appLock: true });
    flash('App Lock on');
  };

  const doExport = async () => {
    setExporting(true);
    try {
      const res = await exportReceiptsCsv(receipts);
      if (res === 'empty') flash('No receipts to export');
      else if (res === 'unavailable') flash('Sharing unavailable here');
      else if (res === 'error') flash('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const doErase = () => {
    if (receipts.length === 0) {
      flash('Vault is already empty');
      return;
    }
    Alert.alert(
      'Erase all data?',
      `This permanently deletes all ${receipts.length} receipts, photos, and budgets from this device (and removes them from the cloud on next sync). This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase everything',
          style: 'destructive',
          onPress: () => {
            clearAll();
            flash('Vault erased');
          },
        },
      ],
    );
  };

  const version = Constants.expoConfig?.version ?? '1.0.0';

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
        </View>

        <View style={{ gap: 10 }}>
          <Kicker style={{ color: ink(0.5), letterSpacing: 1 }}>Appearance</Kicker>
          <Card style={{ padding: 14, gap: 10 }}>
            <Body style={{ fontSize: 12.5, color: ink(0.7) }}>Theme</Body>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {THEME_OPTIONS.map((opt) => (
                <Chip
                  key={opt}
                  label={THEME_LABEL[opt]}
                  active={pref === opt}
                  onPress={() => setPref(opt)}
                  style={{ flex: 1, alignItems: 'center' }}
                />
              ))}
            </View>
          </Card>
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

          <Card style={{ padding: 14, gap: 10 }}>
            <Body style={{ fontSize: 12.5, color: ink(0.7) }}>Remind me before a deadline</Body>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              {LEAD_PRESETS.map((d) => (
                <Chip
                  key={d}
                  label={d === 1 ? '1 day' : `${d} days`}
                  active={lead === d}
                  onPress={() => changeLead(d)}
                />
              ))}
              <View style={{ flex: 1 }} />
              <Button title="Send test" variant="secondary" onPress={doTest} />
            </View>
          </Card>
        </View>

        <View style={{ gap: 10 }}>
          <Kicker style={{ color: ink(0.5), letterSpacing: 1 }}>Security</Kicker>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
            <Tile icon="lock" active={appLock} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Heading style={{ fontSize: 15 }}>App Lock</Heading>
              <Body style={{ fontSize: 12, color: ink(0.55) }}>
                {appLock ? `On · ${bioLabel} or passcode to open` : `Require ${bioLabel} to open the vault`}
              </Body>
            </View>
            <Pressable
              onPress={toggleAppLock}
              style={({ pressed }) => ({
                paddingVertical: 8, paddingHorizontal: 16, borderRadius: radius.pill,
                backgroundColor: appLock ? colors.accent2Ramp[200] : colors.accent, opacity: pressed ? 0.7 : 1,
              })}
            >
              <Body style={{ fontFamily: fonts.heading, fontSize: 13, color: appLock ? colors.accent2Ramp[800] : '#fff' }}>
                {appLock ? 'On' : 'Turn on'}
              </Body>
            </Pressable>
          </Card>
        </View>

        <View style={{ gap: 10 }}>
          <Kicker style={{ color: ink(0.5), letterSpacing: 1 }}>Data</Kicker>
          <NavRow
            icon="share"
            title="Export CSV"
            subtitle={exporting ? 'Preparing…' : 'Spreadsheet of every receipt'}
            onPress={exporting ? () => {} : doExport}
            trailing="none"
          />
          <NavRow
            icon="trash"
            title="Erase all data"
            subtitle="Delete every receipt, photo & budget"
            onPress={doErase}
            danger
            trailing="none"
          />
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

function Tile({ icon, active, danger }: { icon: IconName; active?: boolean; danger?: boolean }) {
  const bg = danger ? '#f6ddd3' : active ? colors.accent2Ramp[200] : colors.accentRamp[100];
  const fg = danger ? '#b23b28' : active ? colors.accent2Ramp[700] : colors.accent;
  return (
    <View
      style={{
        width: 40, height: 40, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: bg,
      }}
    >
      <Icon name={icon} size={20} color={fg} />
    </View>
  );
}

function NavRow({
  icon, title, subtitle, onPress, danger, trailing = 'chevron',
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  onPress: () => void;
  danger?: boolean;
  trailing?: 'chevron' | 'none';
}) {
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
        <Tile icon={icon} danger={danger} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Heading style={{ fontSize: 15, color: danger ? '#b23b28' : colors.text }}>{title}</Heading>
          <Body style={{ fontSize: 12, color: ink(0.55) }}>{subtitle}</Body>
        </View>
        {trailing === 'chevron' && <Icon name="chevron" size={18} color={ink(0.3)} />}
      </View>
    </Pressable>
  );
}
