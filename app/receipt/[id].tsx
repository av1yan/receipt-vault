import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Image, PanResponder, Pressable, ScrollView, Share, View } from 'react-native';
import { Body, Button, Heading, Icon, Kicker, Tag } from '../../components/ui';
import { derive, fmtD, fmtDY, money, statusOf } from '../../lib/data';
import { dismiss } from '../../lib/nav';
import { useVault } from '../../lib/store';
import { colors, fonts, ink, radius, shadow, scrim } from '../../lib/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function ReceiptDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { receipts, setStatus, setReimbursable, flash } = useVault();
  const receipt = receipts.find((r) => String(r.id) === String(id));

  const close = () => dismiss(router);

  // Slide-up entrance + drag-to-dismiss (handle only, so the ScrollView still scrolls).
  const translateY = useRef(new Animated.Value(60)).current;
  useEffect(() => {
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 170, mass: 0.7 }).start();
  }, [translateY]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 120 || g.vy > 0.6) {
          Animated.timing(translateY, { toValue: 800, duration: 200, useNativeDriver: true }).start(close);
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }).start();
        }
      },
    }),
  ).current;

  if (!receipt) {
    close();
    return null;
  }
  const v = derive(receipt);
  const itemsSum = receipt.items.reduce((a, li) => a + li.price, 0);
  const st = statusOf(receipt);
  const reimb = !!receipt.reimbursable;
  const kindLabel = receipt.statusKind === 'warranty' ? 'Warranty claim' : 'Return';
  const whenLabel = receipt.statusAt ? ` · ${fmtD(receipt.statusAt)}` : '';

  const share = () => {
    const lines = [
      `${receipt.merchant} — ${money(receipt.total)}`,
      `${fmtDY(receipt.date)} · ${receipt.cat}`,
      ...receipt.items.map((li) => `• ${li.name}  ${money(li.price)}`),
      v.retLeft >= 0 && v.retBy ? `Return by ${fmtDY(v.retBy)}` : '',
      v.warLeft >= 0 && v.warTo ? `Warranty until ${fmtDY(v.warTo)}` : '',
    ].filter(Boolean);
    Share.share({ message: lines.join('\n') }).catch(() => {});
  };

  return (
    <Pressable
      onPress={close}
      style={{ flex: 1, backgroundColor: scrim(0.45), justifyContent: 'flex-end' }}
    >
      <AnimatedPressable
        onPress={() => {}}
        style={{
          maxHeight: '90%',
          backgroundColor: colors.bg,
          borderTopLeftRadius: 34,
          borderTopRightRadius: 34,
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 30,
          transform: [{ translateY }],
        }}
      >
        {/* grabber (drag to dismiss) — generous touch zone */}
        <View {...pan.panHandlers} style={{ paddingTop: 6, paddingBottom: 18, marginTop: -6, alignItems: 'center' }}>
          <View style={{ width: 44, height: 5, borderRadius: 999, backgroundColor: ink(0.16) }} />
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* ── Header: photo + merchant ─────────────────────────────── */}
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            {receipt.imageUri ? (
              <Image
                source={{ uri: receipt.imageUri }}
                style={{
                  width: 74, height: 96, borderRadius: 16,
                  backgroundColor: colors.neutral[200],
                  borderWidth: 1, borderColor: ink(0.08),
                }}
                resizeMode="cover"
              />
            ) : (
              <View
                style={{
                  width: 74, height: 96, borderRadius: 16,
                  borderWidth: 1.5, borderStyle: 'dashed', borderColor: ink(0.18),
                  backgroundColor: colors.surface,
                  alignItems: 'center', justifyContent: 'center', gap: 5,
                }}
              >
                <Icon name="image" size={22} color={ink(0.32)} />
                <Body style={{ fontSize: 9, letterSpacing: 0.6, textTransform: 'uppercase', color: ink(0.4) }}>
                  No photo
                </Body>
              </View>
            )}
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <Heading style={{ fontSize: 23, lineHeight: 26 }}>{receipt.merchant}</Heading>
              <Body style={{ fontSize: 12.5, color: ink(0.55) }}>
                {fmtDY(receipt.date)} · {receipt.cat}
              </Body>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 4 }}>
                <Heading style={{ fontSize: 30, letterSpacing: -0.5 }}>{money(receipt.total)}</Heading>
                <Tag variant="outline" textStyle={{ fontSize: 10.5 }} style={{ paddingVertical: 2, marginBottom: 5 }}>
                  {receipt.pay}
                </Tag>
              </View>
            </View>
          </View>

          {/* ── Deadline status ──────────────────────────────────────── */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
            <DeadlineCard
              tone="return"
              label="Return window"
              active={v.retLeft >= 0 && st === 'open'}
              value={v.retLeft >= 0 ? `${v.retLeft}d` : 'Closed'}
              note={v.retLeft >= 0 ? (v.retBy ? `by ${fmtD(v.retBy)}` : 'open') : 'window passed'}
            />
            <DeadlineCard
              tone="warranty"
              label="Warranty"
              active={v.warLeft >= 0 && st === 'open'}
              value={v.warLeft >= 0 ? `${v.warLeft}d` : v.warTo ? 'Expired' : 'None'}
              note={
                v.warLeft >= 0
                  ? v.warTo
                    ? `until ${fmtD(v.warTo)}`
                    : 'covered'
                  : v.warTo
                    ? `ended ${fmtD(v.warTo)}`
                    : 'not covered'
              }
            />
          </View>

          {/* ── Reimbursable toggle ──────────────────────────────────── */}
          <Pressable
            onPress={() => setReimbursable(receipt.id, !reimb)}
            style={({ pressed }) => ({
              marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 11,
              backgroundColor: reimb ? colors.accent2Ramp[100] : colors.surface,
              borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 14,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <View
              style={{
                width: 22, height: 22, borderRadius: 7,
                borderWidth: 2, borderColor: reimb ? colors.accent2Ramp[600] : ink(0.25),
                backgroundColor: reimb ? colors.accent2Ramp[500] : 'transparent',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              {reimb && <Body style={{ color: '#fff', fontSize: 13, fontFamily: fonts.heading }}>✓</Body>}
            </View>
            <View style={{ flex: 1 }}>
              <Heading style={{ fontSize: 14 }}>Reimbursable</Heading>
              <Body style={{ fontSize: 11.5, color: ink(0.55) }}>Flag as a business expense to track & export.</Body>
            </View>
          </Pressable>

          {/* ── Line items (receipt block) ───────────────────────────── */}
          {receipt.items.length > 0 && (
            <View
              style={{
                marginTop: 18,
                backgroundColor: colors.surface,
                borderRadius: radius.lg * 1.1,
                paddingHorizontal: 16,
                paddingTop: 14,
                paddingBottom: 6,
                ...shadow.sm,
              }}
            >
              <Kicker style={{ color: ink(0.42), letterSpacing: 1.2, marginBottom: 6 }}>Line items</Kicker>
              {receipt.items.map((li, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    paddingVertical: 10,
                    borderBottomWidth: 1, borderStyle: 'dashed', borderBottomColor: ink(0.12),
                  }}
                >
                  <Body style={{ fontSize: 14, flex: 1, paddingRight: 12 }}>{li.name}</Body>
                  <Body style={{ fontFamily: fonts.heading, fontSize: 14.5, color: ink(0.85) }}>
                    {money(li.price)}
                  </Body>
                </View>
              ))}
              {/* total */}
              <View
                style={{
                  flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
                  paddingTop: 12, paddingBottom: 12,
                }}
              >
                <View>
                  <Heading style={{ fontSize: 15 }}>Total</Heading>
                  {Math.abs(itemsSum - receipt.total) > 0.005 && (
                    <Body style={{ fontSize: 10.5, color: ink(0.42), marginTop: 1 }}>
                      items {money(itemsSum)} + tax/fees
                    </Body>
                  )}
                </View>
                <Heading style={{ fontSize: 22, letterSpacing: -0.4 }}>{money(receipt.total)}</Heading>
              </View>
            </View>
          )}

          {/* ── Claim status ─────────────────────────────────────────── */}
          {st !== 'open' && (
            <View
              style={{
                marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 11,
                backgroundColor: st === 'resolved' ? colors.accent2Ramp[100] : colors.accentRamp[100],
                borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 14,
              }}
            >
              <Heading style={{ fontSize: 20, color: st === 'resolved' ? colors.accent2Ramp[700] : colors.accentRamp[700] }}>
                {st === 'resolved' ? '✓' : '⏳'}
              </Heading>
              <View style={{ flex: 1 }}>
                <Heading style={{ fontSize: 15, color: st === 'resolved' ? colors.accent2Ramp[800] : colors.accentRamp[800] }}>
                  {st === 'resolved' ? 'Resolved' : `${kindLabel} filed`}
                </Heading>
                <Body style={{ fontSize: 12, color: st === 'resolved' ? colors.accent2Ramp[700] : colors.accentRamp[700] }}>
                  {st === 'resolved' ? `Refunded or handled${whenLabel}` : `Awaiting the outcome${whenLabel}`}
                </Body>
              </View>
            </View>
          )}

          {/* ── Actions ──────────────────────────────────────────────── */}
          {st === 'open' && (v.retLeft >= 0 || v.warLeft >= 0) && (
            <View style={{ gap: 10, marginTop: 20 }}>
              {v.retLeft >= 0 && (
                <Button
                  title="Draft return request"
                  variant="primary"
                  block
                  onPress={() => router.push(`/claim/${receipt.id}?kind=return`)}
                />
              )}
              {v.warLeft >= 0 && (
                <Button
                  title="File a warranty claim"
                  variant={v.retLeft >= 0 ? 'secondary' : 'primary'}
                  block
                  onPress={() => router.push(`/claim/${receipt.id}?kind=warranty`)}
                />
              )}
            </View>
          )}

          {st === 'filed' && (
            <View style={{ gap: 10, marginTop: 14 }}>
              <Button
                title="Mark as resolved"
                variant="primary"
                block
                onPress={() => {
                  setStatus(receipt.id, 'resolved');
                  flash('Marked resolved — nicely handled');
                }}
              />
              <Button
                title="Reopen"
                variant="secondary"
                block
                onPress={() => {
                  setStatus(receipt.id, 'open');
                  flash('Reopened');
                }}
              />
            </View>
          )}

          {st === 'resolved' && (
            <View style={{ marginTop: 14 }}>
              <Button
                title="Reopen"
                variant="secondary"
                block
                onPress={() => {
                  setStatus(receipt.id, 'open');
                  flash('Reopened');
                }}
              />
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <Button title="Edit" variant="secondary" style={{ flex: 1 }} onPress={() => router.push(`/edit/${receipt.id}`)} />
            <Button title="Share" variant="secondary" style={{ flex: 1 }} onPress={share} />
            <Button title="Close" variant="secondary" style={{ flex: 1 }} onPress={close} />
          </View>
        </ScrollView>
      </AnimatedPressable>
    </Pressable>
  );
}

// ── Deadline mini-card ────────────────────────────────────────────────
function DeadlineCard({
  tone,
  label,
  value,
  note,
  active,
}: {
  tone: 'return' | 'warranty';
  label: string;
  value: string;
  note: string;
  active: boolean;
}) {
  const ramp = tone === 'return' ? colors.accent2Ramp : colors.accentRamp;
  const bg = active ? ramp[100] : colors.neutral[100];
  const fg = active ? ramp[800] : ink(0.5);
  const soft = active ? ramp[700] : ink(0.42);
  return (
    <View style={{ flex: 1, backgroundColor: bg, borderRadius: radius.lg, paddingVertical: 13, paddingHorizontal: 14, gap: 2 }}>
      <Kicker style={{ color: soft, fontSize: 9.5, letterSpacing: 0.8 }}>{label}</Kicker>
      <Heading style={{ fontSize: 20, color: fg }}>{value}</Heading>
      <Body style={{ fontSize: 11.5, color: soft }}>{note}</Body>
    </View>
  );
}
