import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Card, Heading, Icon, Kicker, ProgressBar, Tag } from '../../components/ui';
import { derive, fmtD, fmtDY, isActive, nextDeadline, statusOf } from '../../lib/data';
import { haptics } from '../../lib/haptics';
import { ensurePermission, hasPermission, rescheduleAll, scheduledCount } from '../../lib/notifications';
import { useVault } from '../../lib/store';
import { colors, fonts, ink, radius } from '../../lib/theme';

type Row = {
  key: string;
  receiptId: number;
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
  const router = useRouter();
  const { receipts } = useVault();

  const [remindersOn, setRemindersOn] = useState(false);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);

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
        setDenied(false);
        setCount(n);
        haptics.success();
      } else {
        setDenied(true);
      }
    } finally {
      setBusy(false);
    }
  };

  const inProgress = useMemo(() => receipts.filter((r) => statusOf(r) === 'filed'), [receipts]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    receipts.forEach((r) => {
      if (!isActive(r)) return; // filed/resolved receipts leave the countdown
      const v = derive(r);
      if (v.retLeft >= 0 && v.retBy) {
        const urgent = v.retLeft <= 7;
        out.push({
          key: `ret-${r.id}`, receiptId: r.id, merchant: r.merchant, kindShort: 'RET',
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
          key: `war-${r.id}`, receiptId: r.id, merchant: r.merchant, kindShort: 'WAR',
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

  const next = useMemo(() => nextDeadline(receipts), [receipts]);
  const retCount = rows.filter((d) => d.kindShort === 'RET').length;
  const warCount = rows.filter((d) => d.kindShort === 'WAR').length;

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

      {/* ── Hero: soonest deadline (or all clear) ─────────────────────── */}
      {next ? (
        (() => {
          const urgent = next.daysLeft <= 7;
          const ramp = urgent ? colors.accentRamp : colors.accent2Ramp;
          return (
            <Pressable
              onPress={() => router.push(`/receipt/${next.receiptId}`)}
              style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
            >
              <View style={{ backgroundColor: ramp[800], borderRadius: radius.lg * 1.15, padding: 18, overflow: 'hidden' }}>
                <View style={{ position: 'absolute', right: -34, top: -34, width: 140, height: 140, borderRadius: 999, backgroundColor: ramp[700] }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Kicker style={{ color: ramp[100], opacity: 0.85, letterSpacing: 1 }}>
                      {urgent ? 'Closing soon' : 'Next deadline'}
                    </Kicker>
                    <Heading style={{ fontSize: 22, color: ramp[100], marginTop: 2 }}>{next.merchant}</Heading>
                    <Body style={{ fontSize: 12.5, color: ramp[100], opacity: 0.85, marginTop: 2 }}>
                      {next.kind === 'return' ? 'Return window' : 'Warranty'} · by {fmtDY(next.date)}
                    </Body>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Heading style={{ fontSize: 40, letterSpacing: -1, color: ramp[100] }}>{next.daysLeft}</Heading>
                    <Body style={{ fontSize: 11, color: ramp[100], opacity: 0.85, marginTop: -3 }}>days left</Body>
                  </View>
                </View>
                {retCount + warCount > 1 && (
                  <Body style={{ fontSize: 12, color: ramp[100], opacity: 0.8, marginTop: 12 }}>
                    {retCount} return{retCount === 1 ? '' : 's'} · {warCount} warrant{warCount === 1 ? 'y' : 'ies'} open
                  </Body>
                )}
              </View>
            </Pressable>
          );
        })()
      ) : (
        <View style={{ backgroundColor: colors.accent2Ramp[800], borderRadius: radius.lg * 1.15, padding: 20, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', right: -30, top: -30, width: 120, height: 120, borderRadius: 999, backgroundColor: colors.accent2Ramp[700] }} />
          <Kicker style={{ color: colors.accent2Ramp[100], opacity: 0.85, letterSpacing: 1 }}>Deadlines</Kicker>
          <Heading style={{ fontSize: 26, color: colors.accent2Ramp[100], marginTop: 2 }}>All clear</Heading>
          <Body style={{ fontSize: 12.5, color: colors.accent2Ramp[100], opacity: 0.85, marginTop: 2 }}>
            No open return windows or warranties right now.
          </Body>
        </View>
      )}

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

      {denied && (
        <View
          style={{
            flexDirection: 'row', gap: 9, alignItems: 'flex-start',
            backgroundColor: colors.accentRamp[100], borderRadius: radius.md,
            padding: 12, marginTop: -6,
          }}
        >
          <Body style={{ fontSize: 14 }}>⚠️</Body>
          <Body style={{ flex: 1, fontSize: 12.5, color: colors.accentRamp[800] }}>
            Notifications are turned off for Receipt Vault. Enable them in{' '}
            <Body style={{ fontFamily: fonts.bodySemi, color: colors.accentRamp[800] }}>Settings › Notifications</Body>{' '}
            to get deadline reminders — your countdowns still work here either way.
          </Body>
        </View>
      )}

      {rows.length > 0 && (
        <View style={{ gap: 10, marginTop: 4 }}>
          {rows.map((d) => (
            <Pressable
              key={d.key}
              onPress={() => router.push(`/receipt/${d.receiptId}`)}
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            >
              <Card style={{ gap: 12, padding: 14 }}>
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
            </Pressable>
          ))}
        </View>
      )}

      {inProgress.length > 0 && (
        <View style={{ gap: 10, marginTop: 4 }}>
          <Kicker style={{ color: ink(0.5), letterSpacing: 1 }}>In progress</Kicker>
          {inProgress.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => router.push(`/receipt/${r.id}`)}
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            >
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
                <View
                  style={{
                    width: 44, height: 44, borderRadius: 13,
                    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentRamp[100],
                  }}
                >
                  <Body style={{ fontSize: 18 }}>⏳</Body>
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Heading style={{ fontSize: 16 }}>{r.merchant}</Heading>
                  <Body style={{ fontSize: 12, color: ink(0.55) }}>
                    {(r.statusKind === 'warranty' ? 'Warranty claim' : 'Return')} filed
                    {r.statusAt ? ` · ${fmtD(r.statusAt)}` : ''}
                  </Body>
                </View>
                <Tag variant="accent" textStyle={{ fontSize: 10.5 }}>Filed</Tag>
              </Card>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
