// Pushes the next deadline into the iOS App Group so the native WidgetKit
// widget (targets/widget/index.swift) can display it.
//
// IMPORTANT: this file is intentionally NOT imported anywhere yet, so it does
// not affect the Expo Go bundle (which has no @bacons/apple-targets native
// module). Wire it up as part of the native build — see WIDGET.md. It no-ops
// safely everywhere the module is absent.

import { Platform } from 'react-native';
import { fmtDY, nextDeadline, type Receipt } from './data';

const APP_GROUP = 'group.com.av1yan.receiptvault';

export async function updateNextDeadlineWidget(receipts: Receipt[]): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    // Only present in a native build with @bacons/apple-targets installed.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ExtensionStorage } = require('@bacons/apple-targets');
    const storage = new ExtensionStorage(APP_GROUP);

    const nd = nextDeadline(receipts);
    if (nd) {
      const y = nd.date.getFullYear();
      const m = String(nd.date.getMonth() + 1).padStart(2, '0');
      const d = String(nd.date.getDate()).padStart(2, '0');
      storage.set(
        'nextDeadline',
        JSON.stringify({
          merchant: nd.merchant,
          kind: nd.kind,
          targetISO: `${y}-${m}-${d}`,
          dateLabel: fmtDY(nd.date),
        }),
      );
    } else {
      storage.set('nextDeadline', null);
    }
    ExtensionStorage.reloadWidget();
  } catch {
    // Module not available (Expo Go, web, not yet installed) — no-op.
  }
}
