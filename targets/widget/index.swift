// Receipt Vault — "Next deadline" home/lock-screen widget (WidgetKit + SwiftUI).
//
// Reads the next deadline the app writes into the shared App Group
// (UserDefaults suite "group.com.av1yan.receiptvault", key "nextDeadline"):
//   { "merchant": String, "kind": "return"|"warranty",
//     "targetISO": "YYYY-MM-DD", "dateLabel": String }
//
// See WIDGET.md for how to build this (it requires a native/EAS build — it
// cannot run in Expo Go).

import WidgetKit
import SwiftUI

private let APP_GROUP = "group.com.av1yan.receiptvault"

// Organic palette
private let cream = Color(red: 0.96, green: 0.92, blue: 0.85)
private let terracotta = Color(red: 0.78, green: 0.44, blue: 0.22)
private let sage = Color(red: 0.34, green: 0.38, blue: 0.25)

struct DeadlineEntry: TimelineEntry {
  let date: Date
  let merchant: String
  let kindLabel: String
  let dateLabel: String
  let target: Date?
  let empty: Bool
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> DeadlineEntry {
    DeadlineEntry(date: Date(), merchant: "Northline Electronics", kindLabel: "Return window",
                  dateLabel: "Aug 29", target: Calendar.current.date(byAdding: .day, value: 12, to: Date()), empty: false)
  }

  func getSnapshot(in context: Context, completion: @escaping (DeadlineEntry) -> Void) {
    completion(load())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<DeadlineEntry>) -> Void) {
    // Refresh just after midnight so the day-count stays fresh.
    let next = Calendar.current.nextDate(after: Date(),
      matching: DateComponents(hour: 0, minute: 5), matchingPolicy: .nextTime)
      ?? Date().addingTimeInterval(6 * 3600)
    completion(Timeline(entries: [load()], policy: .after(next)))
  }

  private func load() -> DeadlineEntry {
    let defaults = UserDefaults(suiteName: APP_GROUP)
    guard let raw = defaults?.string(forKey: "nextDeadline"),
          let data = raw.data(using: .utf8),
          let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let merchant = obj["merchant"] as? String else {
      return DeadlineEntry(date: Date(), merchant: "", kindLabel: "", dateLabel: "", target: nil, empty: true)
    }
    let kindLabel = (obj["kind"] as? String) == "warranty" ? "Warranty" : "Return window"
    let dateLabel = (obj["dateLabel"] as? String) ?? ""
    var target: Date? = nil
    if let iso = obj["targetISO"] as? String {
      let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
      target = f.date(from: iso)
    }
    return DeadlineEntry(date: Date(), merchant: merchant, kindLabel: kindLabel,
                         dateLabel: dateLabel, target: target, empty: false)
  }
}

private func daysLeft(_ target: Date?) -> Int? {
  guard let t = target else { return nil }
  let cal = Calendar.current
  return cal.dateComponents([.day], from: cal.startOfDay(for: Date()), to: cal.startOfDay(for: t)).day
}

struct NextDeadlineWidgetView: View {
  var entry: DeadlineEntry
  @Environment(\.widgetFamily) private var family

  var body: some View {
    if entry.empty {
      emptyView
    } else if family == .accessoryRectangular {
      lockScreenView
    } else {
      homeView
    }
  }

  private var days: Int { daysLeft(entry.target) ?? 0 }
  private var urgent: Bool { days <= 7 }
  private var accent: Color { urgent ? terracotta : sage }

  private var homeView: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text("NEXT DEADLINE")
        .font(.system(size: 10, weight: .semibold)).tracking(1.2)
        .foregroundColor(cream.opacity(0.8))
      Spacer(minLength: 2)
      Text("\(days)")
        .font(.system(size: 40, weight: .bold)).foregroundColor(cream)
      Text(days == 1 ? "day left" : "days left")
        .font(.system(size: 12)).foregroundColor(cream.opacity(0.85))
      Spacer(minLength: 4)
      Text(entry.merchant).font(.system(size: 14, weight: .semibold)).foregroundColor(cream).lineLimit(1)
      Text("\(entry.kindLabel) · by \(entry.dateLabel)")
        .font(.system(size: 11)).foregroundColor(cream.opacity(0.8)).lineLimit(1)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .padding(16)
    .background(accent)
  }

  private var lockScreenView: some View {
    VStack(alignment: .leading, spacing: 1) {
      Text("\(days)d · \(entry.merchant)").font(.system(size: 14, weight: .semibold)).lineLimit(1)
      Text("\(entry.kindLabel) by \(entry.dateLabel)").font(.system(size: 12)).lineLimit(1)
    }
  }

  private var emptyView: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text("RECEIPT VAULT")
        .font(.system(size: 10, weight: .semibold)).tracking(1.2).foregroundColor(.secondary)
      Spacer()
      Text("All caught up").font(.system(size: 16, weight: .semibold))
      Text("No upcoming deadlines").font(.system(size: 11)).foregroundColor(.secondary)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .padding(16)
    .background(cream)
  }
}

@main
struct NextDeadlineWidget: Widget {
  let kind = "NextDeadlineWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider()) { entry in
      if #available(iOS 17.0, *) {
        NextDeadlineWidgetView(entry: entry).containerBackground(.clear, for: .widget)
      } else {
        NextDeadlineWidgetView(entry: entry)
      }
    }
    .configurationDisplayName("Next Deadline")
    .description("The soonest return or warranty deadline from your receipts.")
    .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
  }
}
