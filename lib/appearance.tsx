// Theme controller. Holds the user's Light/Dark/System preference, resolves it
// against the OS scheme, points the theme module at the active palette, and —
// because it lives near the root — re-renders the whole tree when it changes,
// so every inline `colors.x` read picks up the new palette.

import { StatusBar } from 'expo-status-bar';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { loadSettings, updateSettings, type ThemePref } from './settings';
import { setActiveScheme } from './theme';

type AppearanceCtx = {
  pref: ThemePref;
  effective: 'light' | 'dark';
  setPref: (p: ThemePref) => void;
};

const Ctx = createContext<AppearanceCtx | null>(null);

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme(); // 'light' | 'dark' | null
  const [pref, setPrefState] = useState<ThemePref>('system');

  useEffect(() => {
    loadSettings().then((s) => setPrefState(s.themePref)).catch(() => {});
  }, []);

  const effective: 'light' | 'dark' = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;
  // Point the theme module at the active palette before children render.
  setActiveScheme(effective);

  const setPref = (p: ThemePref) => {
    setPrefState(p);
    updateSettings({ themePref: p }).catch(() => {});
  };

  return (
    <Ctx.Provider value={{ pref, effective, setPref }}>
      {/* Lives here (not in RootLayout) so the bar restyles when the theme flips. */}
      <StatusBar style={effective === 'dark' ? 'light' : 'dark'} />
      {children}
    </Ctx.Provider>
  );
}

export function useAppearance(): AppearanceCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAppearance must be used within AppearanceProvider');
  return c;
}
