// Local deadline reminders — scheduled on-device from each receipt's derived
// return-by / warranty-expiry dates. No server or push token needed; the OS
// fires them even when the app is closed.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { addDays, derive, fmtDY, type Receipt } from './data';

// How far ahead of each deadline to remind.
const RETURN_LEAD_DAYS = 3;
const WARRANTY_LEAD_DAYS = 7;

let handlerSet = false;

/** Register the foreground handler so reminders show while the app is open. */
export function configureNotifications() {
  if (handlerSet || Platform.OS === 'web') return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Ask for notification permission (idempotent). Returns whether it's granted. */
export async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

export async function hasPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  return (await Notifications.getPermissionsAsync()).granted;
}

type Job = { at: Date; title: string; body: string };

function reminderJobs(r: Receipt): Job[] {
  const v = derive(r);
  const now = new Date();
  const jobs: Job[] = [];
  if (v.retBy) {
    const at = addDays(v.retBy, -RETURN_LEAD_DAYS);
    if (at > now) {
      jobs.push({
        at,
        title: 'Return window closing soon',
        body: `${r.merchant} — return by ${fmtDY(v.retBy)}`,
      });
    }
  }
  if (v.warTo) {
    const at = addDays(v.warTo, -WARRANTY_LEAD_DAYS);
    if (at > now) {
      jobs.push({
        at,
        title: 'Warranty ending soon',
        body: `${r.merchant} — warranty runs out ${fmtDY(v.warTo)}`,
      });
    }
  }
  return jobs;
}

/** Schedule reminders for one receipt (no-op without permission). */
export async function scheduleForReceipt(r: Receipt): Promise<number> {
  if (Platform.OS === 'web') return 0;
  if (!(await hasPermission())) return 0;
  const jobs = reminderJobs(r);
  for (const j of jobs) {
    await Notifications.scheduleNotificationAsync({
      content: { title: j.title, body: j.body, data: { receiptId: r.id } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: j.at },
    });
  }
  return jobs.length;
}

/** Cancel everything and reschedule from the current receipt set. */
export async function rescheduleAll(receipts: Receipt[]): Promise<number> {
  if (Platform.OS === 'web') return 0;
  await Notifications.cancelAllScheduledNotificationsAsync();
  let total = 0;
  for (const r of receipts) total += await scheduleForReceipt(r);
  return total;
}

export async function scheduledCount(): Promise<number> {
  if (Platform.OS === 'web') return 0;
  return (await Notifications.getAllScheduledNotificationsAsync()).length;
}
