import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Card, Chip, Field, Heading, Input, Kicker, Tag } from '../components/ui';
import { addDays, addMonths, fmtD, fmtDY, TODAY } from '../lib/data';
import { extractReceipt, type ExtractedItem } from '../lib/extraction';
import { persistImage } from '../lib/images';
import { useVault } from '../lib/store';
import { colors, fonts, ink, radius } from '../lib/theme';

const SHOW_CONFIDENCE = true;
const DEFAULT_RETURN_DAYS = 30;
const DARK = '#1a1613';
const CREAM = '#f3e6d2';

type Cap = 'shoot' | 'scan' | 'review';
type Form = {
  merchant: string;
  total: string;
  date: string; // display string
  dateValue: Date; // stored purchase date
  cat: string;
  ret: number;
  war: number;
  totalEdited: boolean;
  manual: boolean;
  photo?: string | null;
  items: ExtractedItem[];
};

// Parse an ISO YYYY-MM-DD (locally, no timezone shift). Falls back to today.
function parseISO(iso: string | null): Date {
  if (iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  return TODAY;
}

const CATS = ['Groceries', 'Electronics', 'Home', 'Dining', 'Travel'];
const RETURN_OPTS: [string, number][] = [['None', 0], ['14 days', 14], ['30 days', 30], ['90 days', 90]];
const WARRANTY_OPTS: [string, number][] = [['None', 0], ['1 year', 12], ['2 years', 24], ['3 years', 36]];

export default function Capture() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addReceipt, flash } = useVault();

  const [cap, setCap] = useState<Cap>('shoot');
  const [f, setF] = useState<Form>({
    merchant: '', total: '', date: '', dateValue: TODAY, cat: 'Groceries',
    ret: DEFAULT_RETURN_DAYS, war: 0, totalEdited: false, manual: false, photo: null, items: [],
  });
  const alive = useRef(true);

  useEffect(() => () => { alive.current = false; }, []);

  const close = () => router.back();

  // Shared path for a captured OR library-picked photo: relocate it to
  // permanent storage, send it to Claude vision for extraction, then land on
  // review with whatever was read (or an empty form if extraction failed).
  const beginCapture = async (rawUri: string) => {
    setCap('scan');
    let photo = rawUri;
    try {
      photo = await persistImage(rawUri, Date.now());
    } catch {
      // keep rawUri
    }

    const r = await extractReceipt(photo);
    if (!alive.current) return;

    const failed = r.confidence === 0;
    const cat = r.category && CATS.includes(r.category) ? r.category : 'Groceries';
    const dateValue = parseISO(r.purchaseDate);

    setF({
      merchant: r.merchant ?? '',
      total: r.total != null ? String(r.total) : '',
      date: fmtDY(dateValue),
      dateValue,
      cat,
      ret: DEFAULT_RETURN_DAYS,
      war: cat === 'Electronics' ? 24 : 0,
      // Mark confirmed when the read was confident; otherwise flag for review.
      totalEdited: failed ? true : r.confidence >= 0.85,
      manual: failed,
      photo,
      items: r.items,
    });
    setCap('review');
  };

  const manualEntry = () => {
    setCap('review');
    setF({
      merchant: '', total: '', date: fmtDY(TODAY), dateValue: TODAY, cat: 'Groceries',
      ret: DEFAULT_RETURN_DAYS, war: 0, totalEdited: true, manual: true, photo: null, items: [],
    });
  };

  const save = () => {
    const total = parseFloat(String(f.total).replace(/[^0-9.]/g, '')) || 0;
    const items =
      f.items.length > 0
        ? f.items.map((it) => ({ name: it.name, price: it.price ?? 0 }))
        : [{ name: 'Scanned total', price: total }];
    addReceipt({
      merchant: f.merchant || 'Untitled receipt', cat: f.cat, date: f.dateValue,
      total, pay: 'Visa ·4417', ret: f.ret, war: f.war, imageUri: f.photo ?? null,
      items,
    });
    flash('Saved · ' + (f.ret ? 'return reminder set for ' + fmtD(addDays(f.dateValue, f.ret)) : 'filed to vault'));
    router.dismissTo('/');
  };

  if (cap === 'shoot') return <ShootScreen insets={insets} onCancel={close} onManual={manualEntry} onCaptured={beginCapture} />;
  if (cap === 'scan') return <ScanScreen photo={f.photo} />;

  // review
  const parts: string[] = [];
  if (f.ret) parts.push('Return by ' + fmtDY(addDays(f.dateValue, f.ret)));
  if (f.war) parts.push('warranty runs to ' + fmtDY(addMonths(f.dateValue, f.war)));
  const derivedLine = parts.length ? parts.join(' · ') : 'No deadlines on this one — it just gets filed.';
  const confirmed = !SHOW_CONFIDENCE || f.totalEdited;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="dark" />
      <View
        style={{
          paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 10,
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        }}
      >
        <Button title="Cancel" variant="ghost" onPress={close} />
        <Heading style={{ fontSize: 16 }}>Review</Heading>
        <View style={{ width: 56 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 20, gap: 14 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          {f.photo ? (
            <Image source={{ uri: f.photo }} style={{ width: 56, height: 74, borderRadius: 12, backgroundColor: colors.neutral[200] }} />
          ) : (
            <View style={{ width: 56, height: 74, borderRadius: 12, backgroundColor: colors.neutral[200] }} />
          )}
          <Body style={{ flex: 1, fontSize: 12.5, color: ink(0.6) }}>
            {f.manual ? 'Manual entry — fill in what you have, photo optional.' : 'Read from the photo. Check anything flagged, then save.'}
          </Body>
        </View>

        <Field label="Merchant">
          <Input value={f.merchant} onChangeText={(t) => setF({ ...f, merchant: t })} />
        </Field>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Field
            style={{ flex: 1 }}
            label={
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.body, fontSize: 12, color: ink(0.7) }}>Total</Text>
                <Tag variant={confirmed ? 'accent-2' : 'accent'} textStyle={{ fontSize: 9.5 }} style={{ paddingVertical: 1, paddingHorizontal: 7 }}>
                  {confirmed ? 'confirmed' : 'check this'}
                </Tag>
              </View>
            }
          >
            <Input
              value={f.total}
              onChangeText={(t) => setF({ ...f, total: t, totalEdited: true })}
              borderColor={confirmed ? colors.divider : colors.accentRamp[500]}
            />
          </Field>
          <Field style={{ flex: 1 }} label="Date">
            <Input value={f.date} onChangeText={(t) => setF({ ...f, date: t })} />
          </Field>
        </View>

        <Field label="Category">
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
            {CATS.map((c) => (
              <Chip key={c} label={c} active={c === f.cat} onPress={() => setF({ ...f, cat: c })} />
            ))}
          </View>
        </Field>

        <Field label="Return window">
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            {RETURN_OPTS.map(([n, val]) => (
              <Chip key={n} label={n} active={val === f.ret} onPress={() => setF({ ...f, ret: val })} />
            ))}
          </View>
        </Field>

        <Field label="Warranty">
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            {WARRANTY_OPTS.map(([n, val]) => (
              <Chip key={n} label={n} active={val === f.war} onPress={() => setF({ ...f, war: val })} />
            ))}
          </View>
        </Field>

        <Card elevation="none" style={{ backgroundColor: colors.accent2Ramp[100], gap: 4, padding: 14 }}>
          <Kicker style={{ color: colors.accent2Ramp[800], letterSpacing: 1 }}>We'll remind you</Kicker>
          <Body style={{ fontSize: 13.5, color: colors.accent2Ramp[900] }}>{derivedLine}</Body>
        </Card>
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 16, backgroundColor: colors.bg }}>
        <Button title="Save to vault" variant="primary" block onPress={save} />
      </View>
    </View>
  );
}

function ShootScreen({
  insets, onCancel, onManual, onCaptured,
}: {
  insets: { top: number; bottom: number };
  onCancel: () => void;
  onManual: () => void;
  onCaptured: (uri: string) => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);
  const granted = permission?.granted ?? false;

  const takePhoto = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const pic = await cameraRef.current?.takePictureAsync({ quality: 0.6 });
      if (pic?.uri) onCaptured(pic.uri);
    } catch (e) {
      console.warn('[receipt-vault] takePicture failed', e);
    } finally {
      setBusy(false);
    }
  };

  const pickFromLibrary = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
      if (!res.canceled && res.assets?.[0]?.uri) onCaptured(res.assets[0].uri);
    } catch (e) {
      console.warn('[receipt-vault] library pick failed', e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: DARK }}>
      <StatusBar style="light" />
      <View
        style={{
          paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 12,
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        }}
      >
        <Pressable onPress={onCancel} hitSlop={10}>
          <Text style={{ color: CREAM, fontSize: 14, fontFamily: fonts.body }}>Cancel</Text>
        </Pressable>
        <Text style={{ color: CREAM, fontSize: 15, fontFamily: fonts.heading }}>New receipt</Text>
        <Pressable onPress={onManual} hitSlop={10}>
          <Text style={{ color: CREAM, fontSize: 14, fontFamily: fonts.body }}>Manual</Text>
        </Pressable>
      </View>

      {/* viewfinder */}
      <View
        style={{
          flex: 1, marginHorizontal: 20, marginTop: 8, borderRadius: 26, overflow: 'hidden',
          borderWidth: 2, borderColor: 'rgba(243,230,210,0.35)', borderStyle: 'dashed',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        {granted ? (
          <CameraView ref={cameraRef} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} facing="back" />
        ) : (
          <View style={{ alignItems: 'center', paddingHorizontal: 30, gap: 14 }}>
            <View style={{ width: 150, height: 220, borderRadius: 12, backgroundColor: 'rgba(243,230,210,0.12)' }} />
            <Text style={{ color: 'rgba(243,230,210,0.75)', fontSize: 13, textAlign: 'center', fontFamily: fonts.body }}>
              {permission ? 'Camera access is off. Enable it, or add a photo from your library.' : 'Getting the camera ready…'}
            </Text>
            {permission && !permission.granted && (
              <Pressable
                onPress={requestPermission}
                style={{ paddingVertical: 8, paddingHorizontal: 18, borderRadius: radius.pill, backgroundColor: colors.accent }}
              >
                <Text style={{ color: '#fff', fontFamily: fonts.heading, fontSize: 14 }}>Enable camera</Text>
              </Pressable>
            )}
          </View>
        )}
        <Text style={{ position: 'absolute', bottom: 18, color: 'rgba(243,230,210,0.7)', fontSize: 12, fontFamily: fonts.body }}>
          Whole receipt in frame — crumples are fine
        </Text>
      </View>

      {/* controls: library · shutter · balance */}
      <View
        style={{
          paddingTop: 22, paddingBottom: insets.bottom + 24, paddingHorizontal: 44,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <Pressable onPress={pickFromLibrary} hitSlop={12} style={{ width: 54, alignItems: 'center', gap: 4 }}>
          <View style={{ width: 34, height: 34, borderRadius: 9, borderWidth: 2, borderColor: 'rgba(243,230,210,0.7)' }} />
          <Text style={{ color: 'rgba(243,230,210,0.75)', fontSize: 10.5, fontFamily: fonts.body }}>Library</Text>
        </Pressable>

        <Pressable
          onPress={granted ? takePhoto : (permission ? requestPermission : undefined)}
          disabled={busy}
          style={({ pressed }) => ({
            width: 76, height: 76, borderRadius: 999, borderWidth: 4,
            borderColor: 'rgba(243,230,210,0.8)', backgroundColor: colors.accent,
            opacity: pressed || busy ? 0.7 : 1,
          })}
        />

        <View style={{ width: 54 }} />
      </View>
    </View>
  );
}

function ScanScreen({ photo }: { photo?: string | null }) {
  const sweep = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(sweep, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [sweep]);

  const translateY = sweep.interpolate({ inputRange: [0, 1], outputRange: [-105, 250] });

  return (
    <View style={{ flex: 1, backgroundColor: DARK, alignItems: 'center', justifyContent: 'center', gap: 22 }}>
      <StatusBar style="light" />
      <View style={{ width: 170, height: 250, borderRadius: 14, overflow: 'hidden', position: 'relative', backgroundColor: 'rgba(243,230,210,0.14)' }}>
        {photo ? <Image source={{ uri: photo }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} resizeMode="cover" /> : null}
        <Animated.View
          style={{
            position: 'absolute', left: 0, right: 0, height: 52,
            backgroundColor: 'rgba(198,113,57,0.55)', transform: [{ translateY }],
          }}
        />
      </View>
      <Text style={{ color: CREAM, fontFamily: fonts.heading, fontSize: 19 }}>Reading the squiggles…</Text>
      <Text style={{ color: 'rgba(243,230,210,0.6)', fontFamily: fonts.body, fontSize: 12.5 }}>
        merchant · date · total · line items
      </Text>
    </View>
  );
}
