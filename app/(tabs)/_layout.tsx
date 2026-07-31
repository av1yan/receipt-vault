import { Tabs, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, IconName, Toast } from '../../components/ui';
import { useVault } from '../../lib/store';
import { colors, fonts, ink, radius, shadow } from '../../lib/theme';

const TABS: { name: string; label: string; icon: IconName }[] = [
  { name: 'index', label: 'Vault', icon: 'vault' },
  { name: 'deadlines', label: 'Deadlines', icon: 'clock' },
  { name: 'spending', label: 'Spending', icon: 'bars' },
];

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
          paddingHorizontal: 22,
        },
        shadow.lg,
      ]}
    >
      {TABS.map((t, i) => {
        const focused = state.index === i;
        const fg = focused ? colors.accent : ink(0.45);
        return (
          <Pressable
            key={t.name}
            onPress={() => {
              const evt = navigation.emit({ type: 'tabPress', target: state.routes[i].key, canPreventDefault: true });
              if (!focused && !evt.defaultPrevented) navigation.navigate(state.routes[i].name);
            }}
            style={{
              alignItems: 'center',
              gap: 3,
              paddingVertical: 7,
              paddingHorizontal: 12,
              borderRadius: radius.pill,
              backgroundColor: focused ? colors.accentRamp[100] : 'transparent',
            }}
          >
            <Icon name={t.icon} color={fg} />
            <Text style={{ fontFamily: fonts.body, fontSize: 10.5, letterSpacing: 0.3, color: fg }}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}

      {/* Capture — the primary action, now docked in the nav bar */}
      <Pressable
        accessibilityLabel="New receipt"
        onPress={() => router.push('/capture')}
        style={({ pressed }) => [
          {
            width: 50,
            height: 50,
            borderRadius: radius.pill,
            backgroundColor: colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.9 : 1,
          },
          shadow.md,
        ]}
      >
        <Icon name="plus" size={26} color="#fff" />
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
      </Tabs>

      <Toast message={toast} bottom={insets.bottom + 84} />
    </View>
  );
}
