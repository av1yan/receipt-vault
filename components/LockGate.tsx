// App Lock gate. When enabled, covers the app with a lock screen until the user
// passes Face ID / Touch ID / passcode — on cold start and whenever the app
// returns from the background.

import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authenticate } from '../lib/applock';
import { loadSettings } from '../lib/settings';
import { colors, fonts, ink, radius, shadow, statusBarStyle } from '../lib/theme';
import { Body, Button, Heading, Icon } from './ui';

export function LockGate({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [enabled, setEnabled] = useState(false);
  const [locked, setLocked] = useState(true); // assume locked until settings load
  const [ready, setReady] = useState(false);
  const [prompting, setPrompting] = useState(false);
  const enabledRef = useRef(false);

  const tryUnlock = useCallback(async () => {
    setPrompting(true);
    const ok = await authenticate();
    setPrompting(false);
    if (ok) setLocked(false);
  }, []);

  // Load the setting once; lock (and immediately prompt) if App Lock is on.
  useEffect(() => {
    let alive = true;
    loadSettings().then((s) => {
      if (!alive) return;
      enabledRef.current = s.appLock;
      setEnabled(s.appLock);
      setLocked(s.appLock);
      setReady(true);
      if (s.appLock) tryUnlock();
    });
    return () => {
      alive = false;
    };
  }, [tryUnlock]);

  // Re-lock when the app leaves the foreground; when it returns, re-read the
  // setting (so toggling App Lock in Settings takes effect) and re-prompt.
  useEffect(() => {
    let prev: AppStateStatus = AppState.currentState;
    const sub = AppState.addEventListener('change', (next) => {
      if (next.match(/inactive|background/)) {
        if (enabledRef.current) setLocked(true);
      } else if (next === 'active' && prev.match(/inactive|background/)) {
        loadSettings().then((s) => {
          enabledRef.current = s.appLock;
          setEnabled(s.appLock);
          if (s.appLock) {
            setLocked(true);
            tryUnlock();
          } else {
            setLocked(false);
          }
        });
      }
      prev = next;
    });
    return () => sub.remove();
  }, [tryUnlock]);

  return (
    <View style={{ flex: 1 }}>
      {children}
      {ready && enabled && locked && (
        <View
          style={{
            ...StyleSheetAbsolute,
            backgroundColor: colors.bg,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 32,
            paddingBottom: insets.bottom + 40,
          }}
        >
          <StatusBar style={statusBarStyle()} />
          <View style={[{ width: 84, height: 84, borderRadius: 26, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }, shadow.md]}>
            <Icon name="lock" size={38} color={colors.accent} />
          </View>
          <Heading style={{ fontSize: 24, marginTop: 22 }}>Vault locked</Heading>
          <Body style={{ fontSize: 13.5, color: ink(0.55), textAlign: 'center', marginTop: 8, lineHeight: 20 }}>
            Your receipts are private. Unlock to continue.
          </Body>
          <Button
            title={prompting ? 'Unlocking…' : 'Unlock'}
            onPress={prompting ? undefined : tryUnlock}
            style={{ marginTop: 26, paddingHorizontal: 40, borderRadius: radius.pill }}
          />
        </View>
      )}
    </View>
  );
}

const StyleSheetAbsolute = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };
