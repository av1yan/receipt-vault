// App Lock — biometric / passcode gate for opening the vault. Uses
// expo-local-authentication (bundled in Expo Go, no custom build needed).

import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

/** True when the device can actually gate on Face ID / Touch ID / passcode. */
export async function canUseAppLock(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return hasHardware && enrolled;
  } catch {
    return false;
  }
}

/** Human label for the device's biometric type (for the toggle subtitle). */
export async function biometricLabel(): Promise<string> {
  if (Platform.OS === 'web') return 'passcode';
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'Face ID';
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'Touch ID';
    return 'passcode';
  } catch {
    return 'passcode';
  }
}

/** Prompt for auth. Returns whether it succeeded. */
export async function authenticate(): Promise<boolean> {
  if (Platform.OS === 'web') return true;
  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Receipt Vault',
      fallbackLabel: 'Use passcode',
    });
    return res.success;
  } catch {
    return false;
  }
}
