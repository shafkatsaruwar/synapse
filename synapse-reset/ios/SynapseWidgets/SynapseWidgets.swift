import SwiftUI
import WidgetKit

private enum SynapseWidgetDestination {
  static func url(for screen: String) -> URL {
    URL(string: "myapp://widget/\(screen)")!
  }
}

private enum SynapseWidgetStore {
  static let suiteName = "group.com.mohammedsaruwar.synapse"
  static let snapshotKey = "synapse_widget_snapshot"
  static let iso8601WithFractionalSeconds: ISO8601DateFormatter = {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter
  }()
  static let iso8601: ISO8601DateFormatter = {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime]
    return formatter
  }()

  static func loadSnapshot() -> SynapseWidgetSnapshot {
    guard
      let defaults = UserDefaults(suiteName: suiteName),
      let raw = defaults.string(forKey: snapshotKey),
      let data = raw.data(using: .utf8)
    else {
      return .placeholder
    }

    let decoder = JSONDecoder()
    decoder.dateDecodingStrategy = .custom { decoder in
      let container = try decoder.singleValueContainer()
      let value = try container.decode(String.self)

      if let date = Self.iso8601WithFractionalSeconds.date(from: value) ?? Self.iso8601.date(from: value) {
        return date
      }

      throw DecodingError.dataCorruptedError(in: container, debugDescription: "Invalid ISO8601 date: \(value)")
    }

    guard let decoded = try? decoder.decode(SynapseWidgetSnapshot.self, from: data) else {
      return .placeholder
    }

    return decoded
  }
}

private struct SynapseWidgetSnapshot: Codable {
  let appearance: String

  struct Medication: Codable {
    let name: String
    let detail: String
    let dueAt: Date?
    let windowStart: Date?
    let dueText: String
  }

  struct Appointment: Codable {
    let doctorName: String
    let detail: String
    let startsAt: Date?
    let whenText: String
  }

  let medication: Medication?
  let appointment: Appointment?
  let updatedAt: Date

  static let placeholder = SynapseWidgetSnapshot(
    appearance: "system",
    medication: Medication(
      name: "Next medication",
      detail: "No medication due yet",
      dueAt: nil,
      windowStart: nil,
      dueText: "Stay on track"
    ),
    appointment: Appointment(
      doctorName: "Next appointment",
      detail: "No appointment scheduled",
      startsAt: nil,
      whenText: "Add one in Synapse"
    ),
    updatedAt: Date()
  )
}

private struct SynapseWidgetEntry: TimelineEntry {
  let date: Date
  let snapshot: SynapseWidgetSnapshot
}

private struct SynapseProvider: TimelineProvider {
  func placeholder(in context: Context) -> SynapseWidgetEntry {
    SynapseWidgetEntry(date: Date(), snapshot: .placeholder)
  }

  func getSnapshot(in context: Context, completion: @escaping (SynapseWidgetEntry) -> Void) {
    completion(SynapseWidgetEntry(date: Date(), snapshot: SynapseWidgetStore.loadSnapshot()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<SynapseWidgetEntry>) -> Void) {
    let snapshot = SynapseWidgetStore.loadSnapshot()
    let refreshDate = nextRefreshDate(for: snapshot)
    let entry = SynapseWidgetEntry(date: Date(), snapshot: snapshot)
    completion(Timeline(entries: [entry], policy: .after(refreshDate)))
  }

  private func nextRefreshDate(for snapshot: SynapseWidgetSnapshot) -> Date {
    if let dueAt = snapshot.medication?.dueAt {
      return min(Date().addingTimeInterval(60), dueAt.addingTimeInterval(1))
    }
    if let startsAt = snapshot.appointment?.startsAt {
      return min(Date().addingTimeInterval(60 * 30), startsAt.addingTimeInterval(1))
    }
    return Date().addingTimeInterval(60 * 30)
  }
}

private struct SynapseWidgetPalette {
  let skyTop: Color
  let skyBottom: Color
  let card: Color
  let ink: Color
  let muted: Color
  let red: Color
  let blue: Color
  let line: Color

  static let calm = SynapseWidgetPalette(
    skyTop: Color(red: 0.86, green: 0.91, blue: 1.0),
    skyBottom: Color(red: 0.79, green: 0.93, blue: 0.92),
    card: Color.white.opacity(0.92),
    ink: Color(red: 0.09, green: 0.10, blue: 0.14),
    muted: Color(red: 0.41, green: 0.45, blue: 0.53),
    red: Color(red: 0.70, green: 0.05, blue: 0.18),
    blue: Color(red: 0.25, green: 0.46, blue: 0.87),
    line: Color.white.opacity(0.45)
  )

  static let light = SynapseWidgetPalette(
    skyTop: Color(red: 0.97, green: 0.98, blue: 1.0),
    skyBottom: Color(red: 0.92, green: 0.96, blue: 1.0),
    card: Color.white.opacity(0.97),
    ink: Color(red: 0.10, green: 0.12, blue: 0.16),
    muted: Color(red: 0.43, green: 0.47, blue: 0.56),
    red: Color(red: 0.70, green: 0.05, blue: 0.18),
    blue: Color(red: 0.25, green: 0.46, blue: 0.87),
    line: Color.black.opacity(0.08)
  )

  static let dark = SynapseWidgetPalette(
    skyTop: Color(red: 0.09, green: 0.11, blue: 0.16),
    skyBottom: Color(red: 0.10, green: 0.16, blue: 0.20),
    card: Color.white.opacity(0.08),
    ink: Color.white.opacity(0.95),
    muted: Color.white.opacity(0.65),
    red: Color(red: 0.92, green: 0.28, blue: 0.35),
    blue: Color(red: 0.53, green: 0.70, blue: 1.0),
    line: Color.white.opacity(0.14)
  )
}

private func palette(for appearance: String, colorScheme: ColorScheme) -> SynapseWidgetPalette {
  switch appearance {
  case "light":
    return .light
  case "dark":
    return .dark
  case "system":
    return colorScheme == .dark ? .dark : .light
  default:
    return .calm
  }
}

private struct SynapseWidgetBackground: View {
  let palette: SynapseWidgetPalette

  var body: some View {
    LinearGradient(
      colors: [palette.skyTop, palette.skyBottom],
      startPoint: .topLeading,
      endPoint: .bottomTrailing
    )
  }
}

private struct MedicationProgressBar: View {
  let progress: Double
  let compact: Bool
  let palette: SynapseWidgetPalette

  var body: some View {
    ZStack(alignment: .leading) {
      Capsule()
        .fill(palette.line)
        .frame(height: compact ? 6 : 8)
      Capsule()
        .fill(palette.red)
        .frame(width: max(compact ? 6 : 8, (compact ? 92 : 120) * progress), height: compact ? 6 : 8)
    }
    .frame(width: compact ? 92 : 120, alignment: .leading)
  }
}

private func medicationProgress(_ medication: SynapseWidgetSnapshot.Medication?) -> Double {
  guard
    let medication,
    let dueAt = medication.dueAt,
    let windowStart = medication.windowStart
  else {
    return 0.05
  }
  let total = dueAt.timeIntervalSince(windowStart)
  guard total > 0 else { return 1 }
  let elapsed = Date().timeIntervalSince(windowStart)
  return min(max(elapsed / total, 0.02), 1)
}

private struct MedBlock: View {
  let medication: SynapseWidgetSnapshot.Medication?
  let compact: Bool
  let palette: SynapseWidgetPalette

  var body: some View {
    VStack(alignment: .leading, spacing: compact ? 8 : 10) {
      Text("Next med")
        .font(.caption.weight(.semibold))
        .foregroundStyle(palette.muted)
      if let medication {
        Text(medication.name)
          .font(compact ? .headline : .headline.weight(.bold))
          .foregroundStyle(palette.ink)
          .lineLimit(compact ? 2 : 2)
          .minimumScaleFactor(0.8)
        Text(medication.detail)
          .font(compact ? .caption2 : .caption)
          .foregroundStyle(palette.muted)
          .lineLimit(2)
        HStack(spacing: 8) {
          MedicationProgressBar(progress: medicationProgress(medication), compact: compact, palette: palette)
          Spacer(minLength: 0)
        }
        if let dueAt = medication.dueAt {
          Text(dueAt, style: .timer)
            .font(compact ? .caption.weight(.bold) : .subheadline.weight(.bold))
            .foregroundStyle(palette.red)
          Text("until due")
            .font(.caption2)
            .foregroundStyle(palette.muted)
        } else {
          Text(medication.dueText)
            .font(compact ? .caption.weight(.bold) : .subheadline.weight(.bold))
            .foregroundStyle(palette.red)
            .lineLimit(1)
            .minimumScaleFactor(0.85)
        }
      } else {
        Text("No medication due")
          .font(compact ? .headline : .headline.weight(.bold))
          .foregroundStyle(palette.ink)
        Text("Stay on track")
          .font(compact ? .caption.weight(.bold) : .subheadline.weight(.bold))
          .foregroundStyle(palette.red)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }
}

private struct AppointmentBlock: View {
  let appointment: SynapseWidgetSnapshot.Appointment?
  let compact: Bool
  let palette: SynapseWidgetPalette

  var body: some View {
    VStack(alignment: .leading, spacing: compact ? 8 : 10) {
      Text("Next appointment")
        .font(.caption.weight(.semibold))
        .foregroundStyle(palette.muted)
      if let appointment {
        Text(appointment.doctorName)
          .font(compact ? .headline : .headline.weight(.bold))
          .foregroundStyle(palette.ink)
          .lineLimit(compact ? 2 : 2)
          .minimumScaleFactor(0.75)
        Text(appointment.detail)
          .font(compact ? .caption2 : .caption)
          .foregroundStyle(palette.muted)
          .lineLimit(compact ? 2 : 1)
        Text(appointment.whenText)
          .font(compact ? .caption.weight(.bold) : .footnote.weight(.bold))
          .foregroundStyle(palette.blue)
          .lineLimit(2)
          .minimumScaleFactor(0.75)
      } else {
        Text("No upcoming appointment")
          .font(compact ? .headline : .headline.weight(.bold))
          .foregroundStyle(palette.ink)
          .lineLimit(2)
        Text("Add one in Synapse")
          .font(compact ? .caption.weight(.bold) : .footnote.weight(.bold))
          .foregroundStyle(palette.blue)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }
}

private struct CombinedWidgetView: View {
  let entry: SynapseProvider.Entry
  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    let palette = palette(for: entry.snapshot.appearance, colorScheme: colorScheme)
    ZStack {
      SynapseWidgetBackground(palette: palette)
      HStack(spacing: 14) {
        Link(destination: SynapseWidgetDestination.url(for: "medications")) {
          MedBlock(medication: entry.snapshot.medication, compact: false, palette: palette)
            .frame(maxWidth: .infinity, alignment: .topLeading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        Rectangle()
          .fill(palette.line.opacity(0.85))
          .frame(width: 1)
          .padding(.vertical, 4)
        Link(destination: SynapseWidgetDestination.url(for: "appointments")) {
          AppointmentBlock(appointment: entry.snapshot.appointment, compact: false, palette: palette)
            .frame(width: 120, alignment: .topLeading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
      }
      .padding(.horizontal, 18)
      .padding(.vertical, 16)
      .background(
        RoundedRectangle(cornerRadius: 24, style: .continuous)
          .fill(palette.card)
      )
      .padding(12)
    }
  }
}

private struct MedicationWidgetView: View {
  let entry: SynapseProvider.Entry
  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    let palette = palette(for: entry.snapshot.appearance, colorScheme: colorScheme)
    ZStack {
      SynapseWidgetBackground(palette: palette)
      MedBlock(medication: entry.snapshot.medication, compact: true, palette: palette)
        .padding(16)
    }
  }
}

private struct AppointmentWidgetView: View {
  let entry: SynapseProvider.Entry
  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    let palette = palette(for: entry.snapshot.appearance, colorScheme: colorScheme)
    ZStack {
      SynapseWidgetBackground(palette: palette)
      AppointmentBlock(appointment: entry.snapshot.appointment, compact: true, palette: palette)
        .padding(16)
    }
  }
}

struct SynapseOverviewWidget: Widget {
  let kind = "SynapseOverviewWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SynapseProvider()) { entry in
      CombinedWidgetView(entry: entry)
    }
    .configurationDisplayName("Synapse Overview")
    .description("See your next medication and next appointment at a glance.")
    .supportedFamilies([.systemMedium])
  }
}

struct SynapseMedicationWidget: Widget {
  let kind = "SynapseMedicationWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SynapseProvider()) { entry in
      MedicationWidgetView(entry: entry)
        .widgetURL(SynapseWidgetDestination.url(for: "medications"))
    }
    .configurationDisplayName("Next Medication")
    .description("Track your next dose with a live countdown.")
    .supportedFamilies([.systemSmall])
  }
}

struct SynapseAppointmentWidget: Widget {
  let kind = "SynapseAppointmentWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SynapseProvider()) { entry in
      AppointmentWidgetView(entry: entry)
        .widgetURL(SynapseWidgetDestination.url(for: "appointments"))
    }
    .configurationDisplayName("Next Appointment")
    .description("See your next appointment at a glance.")
    .supportedFamilies([.systemSmall])
  }
}
