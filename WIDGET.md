# Next Deadline — iOS home/lock-screen widget

The in-app "Next deadline" card (top of the Vault) works today. This doc covers
the **native WidgetKit widget** that shows the same thing on the home screen and
lock screen. It requires a **native build** — it cannot run in Expo Go.

## What's already here (scaffolded)

- `targets/widget/index.swift` — the WidgetKit widget (SwiftUI). Reads the next
  deadline from the shared App Group and renders `systemSmall`, `systemMedium`,
  and `accessoryRectangular` (lock screen).
- `targets/widget/expo-target.config.js` — the widget target definition for
  `@bacons/apple-targets` (App Group entitlement included).
- `lib/widget.ts` — `updateNextDeadlineWidget(receipts)` writes the next deadline
  into the App Group and reloads the widget. **Not imported anywhere yet** (so it
  can't affect the Expo Go bundle); wire it in during the steps below.
- `lib/data.ts` → `nextDeadline(receipts)` — the shared "soonest deadline" logic
  used by both the card and the widget writer.

## Enabling it (one-time)

1. **Install the target plugin + storage bridge**

   ```bash
   npx expo install @bacons/apple-targets
   ```

2. **Add the plugin** to `app.json` `expo.plugins` (alongside the others):

   ```json
   ["@bacons/apple-targets", { "appleTeamId": "YOUR_TEAM_ID" }]
   ```

3. **Give the app the same App Group.** In `app.json`:

   ```json
   "ios": {
     "supportsTablet": true,
     "entitlements": {
       "com.apple.security.application-groups": ["group.com.av1yan.receiptvault"]
     }
   }
   ```

   Keep this group id identical in `app.json`, `expo-target.config.js`, and the
   `APP_GROUP` constants in `index.swift` and `lib/widget.ts`.

4. **Wire the writer** so the widget updates when receipts change. In
   `lib/store.tsx`, after the receipts load and inside `addReceipt`, call:

   ```ts
   import { updateNextDeadlineWidget } from './widget';
   // ...after setReceipts(rows) in the initial load, and after each add:
   updateNextDeadlineWidget(nextReceipts).catch(() => {});
   ```

5. **Build natively** (this machine's Ruby/CocoaPods can't; use EAS or a Mac with
   a working CocoaPods/Xcode):

   ```bash
   eas build --profile development --platform ios
   # or, on a properly-configured Mac:
   npx expo run:ios
   ```

6. On device/simulator: long-press the home screen → **+** → search "Receipt
   Vault" / "Next Deadline" → add the widget. For the lock screen, edit the lock
   screen and add the rectangular Receipt Vault widget.

## Notes

- The widget refreshes just after midnight so the day-count stays current; it
  also refreshes whenever the app calls `ExtensionStorage.reloadWidget()`.
- `index.swift` is standard WidgetKit and was written without a local Xcode build
  available — sanity-check it compiles on first `expo run:ios`/EAS build; the
  logic and data contract are correct, but Swift/SDK versions may want minor
  tweaks.
- The palette in `index.swift` (cream/terracotta/sage) mirrors the app's Organic
  theme; urgent (≤ 7 days) shows terracotta, otherwise sage.
