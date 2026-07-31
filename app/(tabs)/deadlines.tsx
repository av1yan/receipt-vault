import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Card, Heading, Icon, ProgressBar, Tag } from '../../components/ui';
import { derive, fmtDY } from '../../lib/data';
import { ensurePermission, hasPermission, rescheduleAll, scheduledCount } from '../../lib/notifications';
import { useVault } from '../../lib/store';
import { colors, fonts, ink, radius } from '../../lib/theme';

type Row = {
  key: string;
  merchant: string;
  kindShort: string;
  sub: string;
  left: number;
  pill: string;
  pillVariant: 'accent' | 'accent-2' | 'outline';
  dotBg: string;
  dotFg: string;
  pct: string;
};

export default function DeadlinesScreen() {
  const insets = useSafeAreaInsets();
  const { receipts } = useVault();

  const [remindersOn, setRemindersOn] = useState(false);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);

  // Reflect current permission + scheduled count (refreshes as receipts change).
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

  const turnOn = async () => {
    setBusy(true);
    try {
      if (await ensurePermission()) {
        const n = await rescheduleAll(receipts);
        setRemindersOn(true);
        setCount(n);
      }
    } finally {
      setBusy(false);
    }
  };

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    receipts.forEach((r) => {
      const v = derive(r);
      if (v.retLeft >= 0 && v.retBy) {
        out.push({
          key: `ret-${r.id}`, merchant: r.merchant, kindShort: 'RET',
          sub: `Return by ${fmtDY(v.retBy)}`, left: v.retLeft,
          pill: `${v.retLeft} days left`, pillVariant: v.retLeft <= 7 ? 'accent' : 'accent-2',
          dotBg: colors.accent2Ramp[200], dotFg: colors.accent2Ramp[600],
          pct: `${Math.max(4, Math.round((100 * v.retLeft) / r.ret))}%`,
        });
      }
      if (v.warLeft >= 0 && v.warTo) {
        out.push({
          key: `war-${r.id}`, merchant: r.merchant, kindShort: 'WAR',
          sub: `Warranty to ${fmtDY(v.warTo)}`, left: v.warLeft,
          pill: `${Math.round(v.warLeft / 30)} mo left`, pillVariant: 'outline',
          dotBg: colors.accentRamp[200], dotFg: colors.accentRamp[600],
          pct: `${Math.max(4, Math.round((100 * v.warLeft) / (r.war * 30)))}%`,
        });
      }
    });
    return out.sort((a, b) => a.left - b.left);
  }, [receipts]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: 132, paddingHorizontal: 20, gap: 16 }}
      showsVerticalScrollIndicator={false}
    >
      <Heading style={{ fontSize: 34 }}>Deadlines</Heading>
      <Body style={{ fontSize: 13, color: ink(0.6), marginTop: -8 }}>
        Nothing lapses on our watch. Counted down from today.
      </Body>

      {/* Reminders control */}
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
        <View
          style={{
            width: 38, height: 38, borderRadius: 999,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: remindersOn ? colors.accent2Ramp[200] : colors.accentRamp[100],
          }}
        >
          <Icon name="bell" size={19} color={remindersOn ? colors.accent2Ramp[700] : colors.accent} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Heading style={{ fontSize: 16 }}>Reminders</Heading>
          <Body style={{ fontSize: 12, color: ink(0.55) }}>
            {remindersOn
              ? `${count} scheduled · we'll nudge you before each lapses`
              : 'Get notified before returns & warranties lapse'}
          </Body>
        </View>
        {remindersOn ? (
          <Tag variant="accent-2" textStyle={{ fontSize: 11 }}>On</Tag>
        ) : (
          <Pressable
            onPress={turnOn}
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

      <View style={{ gap: 10, marginTop: 4 }}>
        {rows.map((d) => (
          <Card key={d.key} style={{ gap: 10, padding: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
              <View
                style={{
                  width: 38, height: 38, borderRadius: 999,
                  alignItems: 'center', justifyContent: 'center', backgroundColor: d.dotBg,
                }}
              >
                <Body style={{ fontFamily: fonts.heading, fontSize: 11, color: d.dotFg }}>{d.kindShort}</Body>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Heading style={{ fontSize: 16 }}>{d.merchant}</Heading>
                <Body style={{ fontSize: 12, color: ink(0.55) }}>{d.sub}</Body>
              </View>
              <Tag variant={d.pillVariant} textStyle={{ fontSize: 11 }}>{d.pill}</Tag>
            </View>
            <ProgressBar pct={d.pct} color={d.dotFg} />
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}
