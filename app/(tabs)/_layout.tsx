import { Tabs, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, IconName, Toast } from '../../components/ui';
import { useVault } from '../../lib/store';
import { colors, fonts, ink, radius, shadow } from '../../lib/theme';

const TABS: { name: string; label: string; icon: IconName }[] = [
  { name: 'index', label: 'Vault', icon: 'vault' },
  { name: 'deadlines', label: 'Deadlines', icon: 'clock' },
  { name: 'spending', label: 'Spending', icon: 'bars' },
  { name: 'budgets', label: 'Budgets', icon: 'wallet' },
];

// Colors as rgba so Animated can interpolate cleanly between them.
const PILL_ON = 'rgba(255,242,235,1)'; // accentRamp[100]
const PILL_OFF = 'rgba(255,242,235,0)';
const LABEL_ON = 'rgba(198,113,57,1)'; // accent
const LABEL_OFF = 'rgba(32,30,29,0.45)'; // ink(0.45)

function TabButton({ t, focused, onPress }: { t: (typeof TABS)[number]; focused: boolean; onPress: () => void }) {
  const v = useRef(new Animated.Value(focused ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(v, {
      toValue: focused ? 1 : 0,
      friction: 6, // lower = bouncier; overshoots slightly past the target
      tension: 140,
      useNativeDriver: false, // interpolating backgroundColor / color
    }).start();
  }, [focused, v]);

  // Clamp color/background so the spring's overshoot doesn't over-saturate them;
  // let the scale ride the overshoot for the bounce.
  const bg = v.interpolate({ inputRange: [0, 1], outputRange: [PILL_OFF, PILL_ON], extrapolate: 'clamp' });
  const label = v.interpolate({ inputRange: [0, 1], outputRange: [LABEL_OFF, LABEL_ON], extrapolate: 'clamp' });
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.09] });
  const offOpacity = v.interpolate({ inputRange: [0, 1], outputRange: [1, 0], extrapolate: 'clamp' });

  return (
    <Pressable onPress={onPress} hitSlop={6}>
      <Animated.View
        style={{
          alignItems: 'center', gap: 3, paddingVertical: 7, paddingHorizontal: 9,
          borderRadius: radius.pill, backgroundColor: bg, transform: [{ scale }],
        }}
      >
        {/* cross-fade two icon copies for a smooth color transition */}
        <View style={{ width: 21, height: 21 }}>
          <Animated.View style={{ position: 'absolute', opacity: v }}>
            <Icon name={t.icon} size={21} color={colors.accent} />
          </Animated.View>
          <Animated.View style={{ position: 'absolute', opacity: offOpacity }}>
            <Icon name={t.icon} size={21} color={ink(0.45)} />
          </Animated.View>
        </View>
        <Animated.Text style={{ fontFamily: fonts.body, fontSize: 10.5, letterSpacing: 0.3, color: label }}>
          {t.label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

function PillTabBar({ state, navigation }: { state: any; navigation: any }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View
      style={[
        {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: insets.bottom + 10,
          height: 64,
          borderRadius: radius.pill,
          backgroundColor: colors.surface,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 14,
        },
        shadow.lg,
      ]}
    >
      {TABS.map((t, i) => {
        const focused = state.index === i;
        return (
          <TabButton
            key={t.name}
            t={t}
            focused={focused}
            onPress={() => {
              const evt = navigation.emit({ type: 'tabPress', target: state.routes[i].key, canPreventDefault: true });
              if (!focused && !evt.defaultPrevented) navigation.navigate(state.routes[i].name);
            }}
          />
        );
      })}

      {/* Capture — the primary action, now docked in the nav bar */}
      <Pressable
        accessibilityLabel="New receipt"
        onPress={() => router.push('/capture')}
        style={({ pressed }) => [
          {
            width: 46,
            height: 46,
            borderRadius: radius.pill,
            backgroundColor: colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.9 : 1,
          },
          shadow.md,
        ]}
      >
        <Icon name="plus" size={24} color="#fff" />
      </Pressable>
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { toast } = useVault();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Tabs
        tabBar={(props) => <PillTabBar {...props} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="deadlines" />
        <Tabs.Screen name="spending" />
        <Tabs.Screen name="budgets" />
      </Tabs>

      <Toast message={toast} bottom={insets.bottom + 84} />
    </View>
  );
}
