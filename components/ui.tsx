import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors, fonts, ink, radius, shadow, space } from '../lib/theme';

// ── Text helpers ─────────────────────────────────────────────────────────────
export function Heading({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[{ fontFamily: fonts.heading, color: colors.text }, style]}>{children}</Text>;
}
export function Body({
  children,
  style,
  selectable,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  selectable?: boolean;
}) {
  return (
    <Text selectable={selectable} style={[{ fontFamily: fonts.body, color: colors.text }, style]}>
      {children}
    </Text>
  );
}
export function Kicker({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <Text
      style={[
        { fontFamily: fonts.body, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

// ── Tag ──────────────────────────────────────────────────────────────────────
export type TagVariant = 'accent' | 'accent-2' | 'neutral' | 'outline';
const TAG_STYLE: Record<TagVariant, { bg?: string; fg: string; border?: string }> = {
  accent: { bg: colors.accentRamp[100], fg: colors.accentRamp[800] },
  'accent-2': { bg: colors.accent2Ramp[100], fg: colors.accent2Ramp[800] },
  neutral: { bg: colors.neutral[100], fg: colors.neutral[800] },
  outline: { fg: colors.accent, border: colors.accent },
};
export function Tag({
  children,
  variant = 'neutral',
  style,
  textStyle,
}: {
  children: React.ReactNode;
  variant?: TagVariant;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const t = TAG_STYLE[variant];
  return (
    <View
      style={[
        {
          alignSelf: 'flex-start',
          backgroundColor: t.bg ?? 'transparent',
          borderColor: t.border,
          borderWidth: t.border ? 1 : 0,
          borderRadius: radius.pill,
          paddingVertical: 3,
          paddingHorizontal: 10,
        },
        style,
      ]}
    >
      <Text style={[{ fontFamily: fonts.body, fontSize: 11, letterSpacing: 0.2, color: t.fg }, textStyle]}>
        {children}
      </Text>
    </View>
  );
}

// ── Pressable tag / chip (selectable) ────────────────────────────────────────
export function Chip({
  label,
  active,
  onPress,
  style,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const t = active ? TAG_STYLE.accent : TAG_STYLE.outline;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: t.bg ?? 'transparent',
          borderColor: t.border,
          borderWidth: t.border ? 1 : 0,
          borderRadius: radius.pill,
          paddingVertical: 6,
          paddingHorizontal: 13,
          opacity: pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      <Text style={{ fontFamily: fonts.body, fontSize: 12, color: t.fg }}>{label}</Text>
    </Pressable>
  );
}

// ── Button ───────────────────────────────────────────────────────────────────
export function Button({
  title,
  onPress,
  variant = 'primary',
  block,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  block?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const base: ViewStyle = {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    paddingVertical: space[2],
    paddingHorizontal: space[3] * 1.2,
    borderWidth: 1,
    borderColor: 'transparent',
  };
  let fg: string = colors.text;
  const v: ViewStyle = {};
  if (variant === 'primary') {
    v.backgroundColor = colors.accent;
    fg = colors.bg;
  } else if (variant === 'secondary') {
    v.borderColor = colors.divider;
  } else if (variant === 'ghost') {
    fg = colors.accent;
    v.paddingHorizontal = space[1];
    v.paddingVertical = space[1];
  }
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [base, v, block && { width: '100%' }, pressed && { opacity: 0.85 }, style]}
    >
      <Text style={{ fontFamily: fonts.heading, fontSize: 14, color: fg }}>{title}</Text>
    </Pressable>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────
export function Card({
  children,
  style,
  elevation = 'sm',
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  elevation?: 'sm' | 'md' | 'lg' | 'none';
}) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg * 1.15,
          padding: space[3],
          gap: space[2],
        },
        elevation !== 'none' && shadow[elevation],
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ── Field (label + input) ────────────────────────────────────────────────────
export function Field({
  label,
  children,
  style,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={style}>
      <View style={{ marginBottom: 5 }}>
        {typeof label === 'string' ? (
          <Text style={{ fontFamily: fonts.body, fontSize: 12, color: ink(0.7) }}>{label}</Text>
        ) : (
          label
        )}
      </View>
      {children}
    </View>
  );
}

export function Input({
  value,
  onChangeText,
  placeholder,
  borderColor,
  style,
  keyboardType,
}: {
  value?: string;
  onChangeText?: (t: string) => void;
  placeholder?: string;
  borderColor?: string;
  style?: StyleProp<TextStyle>;
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad';
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={ink(0.4)}
      keyboardType={keyboardType}
      style={[
        {
          minHeight: 36,
          paddingVertical: 6,
          paddingHorizontal: 14,
          fontSize: 14,
          fontFamily: fonts.body,
          color: colors.text,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: borderColor ?? colors.divider,
          borderRadius: radius.pill,
        },
        style,
      ]}
    />
  );
}

// ── Progress bar ─────────────────────────────────────────────────────────────
export function ProgressBar({ pct, color, height = 6 }: { pct: string; color: string; height?: number }) {
  return (
    <View style={{ height, borderRadius: radius.pill, backgroundColor: ink(0.08), overflow: 'hidden' }}>
      <View style={{ height: '100%', borderRadius: radius.pill, width: pct as any, backgroundColor: color }} />
    </View>
  );
}

// ── Torn receipt card ────────────────────────────────────────────────────────
// Approximates the CSS scalloped-mask bottom edge with a row of bg-colored
// notches biting into the card's bottom.
export function TornReceiptCard({
  children,
  onPress,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const NOTCH = 12;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.985 : 1 }] }]}
    >
      <View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.md,
            borderTopRightRadius: radius.md,
            paddingTop: 14,
            paddingBottom: 20,
            paddingHorizontal: 16,
          },
          shadow.sm,
          style,
        ]}
      >
        {children}
      </View>
      {/* scalloped tear */}
      <View
        style={{
          flexDirection: 'row',
          marginTop: -NOTCH / 2,
          height: NOTCH / 2,
          overflow: 'hidden',
          justifyContent: 'space-between',
          paddingHorizontal: 3,
        }}
        pointerEvents="none"
      >
        {Array.from({ length: 26 }).map((_, i) => (
          <View
            key={i}
            style={{ width: NOTCH, height: NOTCH, borderRadius: NOTCH / 2, backgroundColor: colors.bg }}
          />
        ))}
      </View>
    </Pressable>
  );
}

// ── Icons (stroke, currentColor-style) ───────────────────────────────────────
export function Icon({ name, size = 21, color = colors.text }: { name: IconName; size?: number; color?: string }) {
  const p = { stroke: color, strokeWidth: 2.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'vault' && (
        <>
          <Rect x={3} y={4} width={18} height={5} rx={2} {...p} />
          <Path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9" {...p} />
          <Path d="M10 13h4" {...p} />
        </>
      )}
      {name === 'clock' && (
        <>
          <Circle cx={12} cy={12} r={9} {...p} />
          <Path d="M12 7v5l3 2" {...p} />
        </>
      )}
      {name === 'bars' && (
        <>
          <Path d="M5 19V11" {...p} />
          <Path d="M12 19V5" {...p} />
          <Path d="M19 19v-6" {...p} />
        </>
      )}
      {name === 'plus' && (
        <>
          <Path d="M12 5v14" {...p} />
          <Path d="M5 12h14" {...p} />
        </>
      )}
      {name === 'bell' && (
        <>
          <Path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" {...p} />
          <Path d="M13.7 21a2 2 0 0 1-3.4 0" {...p} />
        </>
      )}
      {name === 'cloud' && <Path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" {...p} />}
      {name === 'image' && (
        <>
          <Rect x={3} y={4} width={18} height={16} rx={3} {...p} />
          <Circle cx={8.5} cy={9.5} r={1.5} {...p} />
          <Path d="M4 17l5-5 3.5 3.5L16 12l4 4.5" {...p} />
        </>
      )}
      {name === 'share' && (
        <>
          <Circle cx={6} cy={12} r={2.4} {...p} />
          <Circle cx={17} cy={6} r={2.4} {...p} />
          <Circle cx={17} cy={18} r={2.4} {...p} />
          <Path d="M8.1 10.9l6.8-3.8M8.1 13.1l6.8 3.8" {...p} />
        </>
      )}
      {name === 'gear' && (
        <>
          <Circle cx={12} cy={12} r={3.2} {...p} />
          <Path
            d="M12 2.6v2.6M12 18.8v2.6M21.4 12h-2.6M5.2 12H2.6M18.6 5.4l-1.8 1.8M7.2 16.8l-1.8 1.8M18.6 18.6l-1.8-1.8M7.2 7.2L5.4 5.4"
            {...p}
          />
        </>
      )}
      {name === 'chevron' && <Path d="M9 6l6 6-6 6" {...p} />}
      {name === 'wallet' && (
        <>
          <Rect x={3} y={6.5} width={18} height={12} rx={2.6} {...p} />
          <Path d="M3 10.5h18" {...p} />
          <Circle cx={16.6} cy={14.6} r={1.3} {...p} />
        </>
      )}
    </Svg>
  );
}
export type IconName =
  | 'vault' | 'clock' | 'bars' | 'plus' | 'bell' | 'cloud' | 'image' | 'share' | 'gear' | 'chevron' | 'wallet';

// ── Toast ────────────────────────────────────────────────────────────────────
export function Toast({ message, bottom = 108 }: { message: string; bottom?: number }) {
  if (!message) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end' }]} pointerEvents="none">
      <View style={{ position: 'absolute', left: 20, right: 20, bottom }}>
        <View
          style={[
            {
              backgroundColor: colors.accent2Ramp[800],
              borderRadius: radius.pill,
              paddingVertical: 11,
              paddingHorizontal: 18,
            },
            shadow.lg,
          ]}
        >
          <Text style={{ color: colors.accent2Ramp[100], fontFamily: fonts.body, fontSize: 13, textAlign: 'center' }}>
            {message}
          </Text>
        </View>
      </View>
    </View>
  );
}
