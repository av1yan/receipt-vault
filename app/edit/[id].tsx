import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Chip, Field, Heading, Input } from '../../components/ui';
import { CATS, fmtDY, type Receipt } from '../../lib/data';
import { dismiss } from '../../lib/nav';
import { useVault } from '../../lib/store';
import { colors, fonts, ink } from '../../lib/theme';

const RETURN_OPTS: [string, number][] = [['None', 0], ['14 days', 14], ['30 days', 30], ['60 days', 60], ['90 days', 90]];
const WARRANTY_OPTS: [string, number][] = [['None', 0], ['1 year', 12], ['2 years', 24], ['3 years', 36]];
const MON3 = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// Lenient date parser: accepts "Jul 28, 2026" or "2026-07-28"; else keeps the old date.
function parseDate(s: string, fallback: Date): Date {
  const t = s.trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  const m = /([A-Za-z]{3})[A-Za-z]*\s+(\d{1,2}),?\s+(\d{4})/.exec(t);
  if (m) {
    const mi = MON3.indexOf(m[1].toLowerCase());
    if (mi >= 0) return new Date(+m[3], mi, +m[2]);
  }
  return fallback;
}

export default function EditReceipt() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { receipts, updateReceipt, flash } = useVault();
  const receipt = receipts.find((r) => String(r.id) === String(id));

  const [merchant, setMerchant] = useState(receipt?.merchant ?? '');
  const [total, setTotal] = useState(receipt ? String(receipt.total) : '');
  const [dateStr, setDateStr] = useState(receipt ? fmtDY(receipt.date) : '');
  const [cat, setCat] = useState(receipt?.cat ?? 'Groceries');
  const [ret, setRet] = useState(receipt?.ret ?? 0);
  const [war, setWar] = useState(receipt?.war ?? 0);
  const [pay, setPay] = useState(receipt?.pay ?? '');

  if (!receipt) {
    dismiss(router);
    return null;
  }

  const save = () => {
    const totalNum = parseFloat(total.replace(/[^0-9.]/g, '')) || 0;
    const updated: Receipt = {
      ...receipt,
      merchant: merchant.trim() || 'Untitled receipt',
      total: totalNum,
      date: parseDate(dateStr, receipt.date),
      cat,
      ret,
      war,
      pay: pay.trim() || receipt.pay,
    };
    updateReceipt(updated);
    flash('Receipt updated');
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
        <Button title="Cancel" variant="ghost" onPress={() => dismiss(router)} />
        <Heading style={{ fontSize: 16 }}>Edit receipt</Heading>
        <View style={{ width: 56 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 20, gap: 14 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Field label="Merchant">
          <Input value={merchant} onChangeText={setMerchant} />
        </Field>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Field style={{ flex: 1 }} label="Total">
            <Input value={total} onChangeText={setTotal} keyboardType="decimal-pad" />
          </Field>
          <Field style={{ flex: 1 }} label="Date">
            <Input value={dateStr} onChangeText={setDateStr} />
          </Field>
        </View>

        <Field label="Category">
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
            {CATS.map((c) => (
              <Chip key={c} label={c} active={c === cat} onPress={() => setCat(c)} />
            ))}
          </View>
        </Field>

        <Field label="Return window">
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            {RETURN_OPTS.map(([n, val]) => (
              <Chip key={n} label={n} active={val === ret} onPress={() => setRet(val)} />
            ))}
          </View>
        </Field>

        <Field label="Warranty">
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            {WARRANTY_OPTS.map(([n, val]) => (
              <Chip key={n} label={n} active={val === war} onPress={() => setWar(val)} />
            ))}
          </View>
        </Field>

        <Field label="Payment">
          <Input value={pay} onChangeText={setPay} placeholder="e.g. Visa ·4417" />
        </Field>

        <Body style={{ fontSize: 11.5, color: ink(0.45), fontFamily: fonts.body }}>
          Line items and the photo stay as they are. Changes sync on your next backup.
        </Body>
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 16, backgroundColor: colors.bg }}>
        <Button title="Save changes" variant="primary" block onPress={save} />
      </View>
    </View>
  );
}
