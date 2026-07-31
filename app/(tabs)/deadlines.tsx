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
  countMain: string;
  countUnit: string;
  tileBg: string;
  tileFg: string;
  countColor: string;
  barColor: string;
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
        const urgent = v.retLeft <= 7;
        out.push({
          key: `ret-${r.id}`, merchant: r.merchant, kindShort: 'RET',
          sub: `Return by ${fmtDY(v.retBy)}`, left: v.retLeft,
          countMain: `${v.retLeft}`, countUnit: 'days left',
          tileBg: colors.accent2Ramp[200], tileFg: colors.accent2Ramp[700],
          countColor: urgent ? colors.accent : colors.accent2Ramp[700],
          barColor: urgent ? colors.accent : colors.accent2Ramp[500],
          pct: `${Math.max(4, Math.round((100 * v.retLeft) / r.ret))}%`,
        });
      }
      if (v.warLeft >= 0 && v.warTo) {
        out.push({
          key: `war-${r.id}`, merchant: r.merchant, kindShort: 'WAR',
          sub: `Warranty to ${fmtDY(v.warTo)}`, left: v.warLeft,
          countMain: `${Math.max(1, Math.round(v.warLeft / 30))}`, countUnit: 'mo left',
          tileBg: colors.accentRamp[200], tileFg: colors.accentRamp[700],
          countColor: colors.accentRamp[700],
          barColor: colors.accentRamp[500],
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

      {rows.length > 0 ? (
        <View style={{ gap: 10, marginTop: 4 }}>
          {rows.map((d) => (
            <Card key={d.key} style={{ gap: 12, padding: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    width: 44, height: 44, borderRadius: 13,
                    alignItems: 'center', justifyContent: 'center', backgroundColor: d.tileBg,
                  }}
                >
                  <Body style={{ fontFamily: fonts.heading, fontSize: 11, letterSpacing: 0.4, color: d.tileFg }}>
                    {d.kindShort}
                  </Body>
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Heading style={{ fontSize: 16 }}>{d.merchant}</Heading>
                  <Body style={{ fontSize: 12, color: ink(0.55) }}>{d.sub}</Body>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Heading style={{ fontSize: 23, letterSpacing: -0.5, color: d.countColor }}>{d.countMain}</Heading>
                  <Body style={{ fontSize: 10, letterSpacing: 0.3, color: ink(0.45), marginTop: -2 }}>
                    {d.countUnit}
                  </Body>
                </View>
              </View>
              <ProgressBar pct={d.pct} color={d.barColor} />
            </Card>
          ))}
        </View>
      ) : (
        <Card style={{ alignItems: 'center', gap: 8, paddingVertical: 30, marginTop: 4 }}>
          <View
            style={{
              width: 52, height: 52, borderRadius: 999,
              alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent2Ramp[200],
            }}
          >
            <Icon name="clock" size={24} color={colors.accent2Ramp[700]} />
          </View>
          <Heading style={{ fontSize: 17, marginTop: 2 }}>All clear</Heading>
          <Body style={{ fontSize: 12.5, color: ink(0.55), textAlign: 'center', paddingHorizontal: 20 }}>
            No open return windows or warranties right now. New receipts show up here automatically.
          </Body>
        </Card>
      )}
    </ScrollView>
  );
}
