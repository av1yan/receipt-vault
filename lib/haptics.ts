// Thin haptics wrapper — best-effort, silently no-ops on web or if the module
// isn't available. Keeps call sites clean (no try/catch everywhere).

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const on = Platform.OS === 'ios' || Platform.OS === 'android';

export const haptics = {
  /** A committed action landed (save, sync complete). */
  success() {
    if (on) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  /** Something went wrong. */
  error() {
    if (on) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  },
  /** A deliberate tap — shutter, primary button. */
  tap() {
    if (on) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  },
  /** A light selection tick. */
  light() {
    if (on) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
};
