import SwiftUI
import WidgetKit

private enum SynapseWidgetDestination {
  static func url(for screen: String) -> URL {
    URL(string: "myapp://widget/\(screen)")!
  }

  static func hydrationQuickSipURL() -> URL {
    var components = URLComponents(string: "myapp://widget/hydration")!
    components.queryItems = [URLQueryItem(name: "mode", value: "quick-sip")]
    return components.url!
  }

  static func prnLogURL(for medicationId: String) -> URL {
    var components = URLComponents(string: "myapp://widget/prnlog")!
    components.queryItems = [URLQueryItem(name: "medId", value: medicationId)]
    return components.url!
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
    let isTaken: Bool
    let nextText: String?
  }

  struct Appointment: Codable {
    let doctorName: String
    let detail: String
    let startsAt: Date?
    let whenText: String
  }

  struct PrnMedication: Codable {
    let id: String
    let name: String
    let detail: String
    let lastLoggedAt: Date?
    let statusText: String
    let countText: String
  }

  struct Wellness: Codable {
    let hasTodayLog: Bool
    let energy: Int?
    let mood: Int?
    let sleep: Int?
    let overallFeeling: Int?
    let detailHighlights: [String]
    let summaryText: String
    let secondaryText: String
    let symptomCountToday: Int
    let topSymptomName: String?
    let isFastingToday: Bool
  }

  struct Hydration: Codable {
    let presetLabel: String
    let sipAmountText: String
    let totalTodayMl: Int
    let totalTodayText: String
    let hasEntriesToday: Bool
    let launchHint: String
  }

  struct SickMode: Codable {
    let active: Bool
    let recoveryMode: Bool
    let latestTemperature: Double?
    let latestTemperatureText: String
    let statusText: String
    let needsStressDose: Bool
    let stressDoseText: String
    let checkInTimer: String?
  }

  struct MentalHealth: Codable {
    let active: Bool
    let statusText: String
    let nextCheckInText: String
    let checkInTimer: String?
  }

  let medication: Medication?
  let appointment: Appointment?
  let prnMedication: PrnMedication?
  let wellness: Wellness
  let hydration: Hydration
  let sickMode: SickMode
  let mentalHealth: MentalHealth
  let updatedAt: Date

  static let placeholder = SynapseWidgetSnapshot(
    appearance: "system",
    medication: Medication(
      name: "Next medication",
      detail: "No medication due yet",
      dueAt: nil,
      windowStart: nil,
      dueText: "Stay on track",
      isTaken: false,
      nextText: nil
    ),
    appointment: Appointment(
      doctorName: "Next appointment",
      detail: "No appointment scheduled",
      startsAt: nil,
      whenText: "Add one in Synapse"
    ),
    prnMedication: nil,
    wellness: Wellness(
      hasTodayLog: false,
      energy: nil,
      mood: nil,
      sleep: nil,
      overallFeeling: nil,
      detailHighlights: [],
      summaryText: "Check in today",
      secondaryText: "Log energy, mood, and sleep",
      symptomCountToday: 0,
      topSymptomName: nil,
      isFastingToday: false
    ),
    hydration: Hydration(
      presetLabel: "Water",
      sipAmountText: "8 oz",
      totalTodayMl: 0,
      totalTodayText: "Nothing logged yet",
      hasEntriesToday: false,
      launchHint: "Take a Sip"
    ),
    sickMode: SickMode(
      active: false,
      recoveryMode: false,
      latestTemperature: nil,
      latestTemperatureText: "No temp logged",
      statusText: "Tap to start sick mode",
      needsStressDose: false,
      stressDoseText: "No stress-dose meds",
      checkInTimer: nil
    ),
    mentalHealth: MentalHealth(
      active: false,
      statusText: "Tap to start mental health day",
      nextCheckInText: "No check-in scheduled",
      checkInTimer: nil
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
    if snapshot.prnMedication?.lastLoggedAt != nil {
      return Date().addingTimeInterval(60)
    }
    if snapshot.sickMode.active || snapshot.mentalHealth.active {
      return Date().addingTimeInterval(60)
    }
    return Date().addingTimeInterval(60 * 30)
  }
}

private struct SynapseWidgetPalette {
  let background: Color
  let ink: Color
  let muted: Color
  let red: Color
  let blue: Color
  let green: Color
  let line: Color
  let track: Color

  static let calm = SynapseWidgetPalette(
    background: Color(red: 0.98, green: 0.94, blue: 0.88),
    ink: Color(red: 0.12, green: 0.12, blue: 0.14),
    muted: Color(red: 0.42, green: 0.42, blue: 0.47),
    red: Color(red: 0.72, green: 0.17, blue: 0.20),
    blue: Color(red: 0.25, green: 0.46, blue: 0.87),
    green: Color(red: 0.20, green: 0.62, blue: 0.35),
    line: Color.black.opacity(0.08),
    track: Color.black.opacity(0.08)
  )

  static let light = SynapseWidgetPalette(
    background: Color.white,
    ink: Color(red: 0.10, green: 0.12, blue: 0.16),
    muted: Color(red: 0.43, green: 0.47, blue: 0.56),
    red: Color(red: 0.72, green: 0.17, blue: 0.20),
    blue: Color(red: 0.25, green: 0.46, blue: 0.87),
    green: Color(red: 0.20, green: 0.62, blue: 0.35),
    line: Color.black.opacity(0.08),
    track: Color.black.opacity(0.08)
  )

  static let dark = SynapseWidgetPalette(
    background: Color(red: 0.08, green: 0.08, blue: 0.09),
    ink: Color.white.opacity(0.96),
    muted: Color.white.opacity(0.70),
    red: Color(red: 0.92, green: 0.28, blue: 0.35),
    blue: Color(red: 0.53, green: 0.70, blue: 1.0),
    green: Color(red: 0.43, green: 0.87, blue: 0.53),
    line: Color.white.opacity(0.12),
    track: Color.white.opacity(0.14)
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

private struct MedicationProgressBar: View {
  let progress: Double
  let palette: SynapseWidgetPalette

  var body: some View {
    ZStack(alignment: .leading) {
      Capsule()
        .fill(palette.track)
        .frame(height: 4)
      Capsule()
        .fill(palette.red)
        .frame(width: max(6, 124 * progress), height: 4)
    }
    .frame(width: 124, alignment: .leading)
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

private func compactRelativeMedicationText(_ dueAt: Date?) -> String {
  guard let dueAt else { return "Stay on track" }
  let seconds = Int(dueAt.timeIntervalSinceNow.rounded())
  if seconds <= 60 { return "due now" }
  let minutes = Int(ceil(Double(seconds) / 60.0))
  if minutes < 60 { return "in \(minutes) min" }
  let hours = Int(ceil(Double(minutes) / 60.0))
  if hours < 24 { return "in \(hours) hr" }
  return "tomorrow"
}

private func wellnessAccent(_ value: Int?, palette: SynapseWidgetPalette) -> Color {
  guard let value else { return palette.muted }
  if value >= 8 { return palette.green }
  if value >= 5 { return palette.blue }
  if value >= 3 { return palette.red }
  return palette.red
}

private func overallWellnessLabel(_ value: Int?) -> String {
  guard let value else { return "Ready for today" }
  if value >= 8 { return "Strong day" }
  if value >= 6 { return "Doing okay" }
  if value >= 4 { return "Take it easy" }
  return "Needs support"
}

private struct WellnessDetailChip: View {
  let text: String
  let palette: SynapseWidgetPalette

  var body: some View {
    Text(text)
      .font(.system(size: 12, weight: .semibold))
      .foregroundStyle(palette.ink)
      .lineLimit(1)
      .padding(.vertical, 8)
      .padding(.horizontal, 10)
      .background(palette.track)
      .clipShape(Capsule())
  }
}

private struct WellnessMetricPill: View {
  let label: String
  let shortLabel: String
  let value: Int?
  let palette: SynapseWidgetPalette
  let compact: Bool

  var body: some View {
    VStack(alignment: compact ? .center : .leading, spacing: compact ? 3 : 4) {
      Text(compact ? shortLabel : label)
        .font(.system(size: compact ? 10 : 11, weight: .semibold))
        .foregroundStyle(palette.muted)
        .lineLimit(1)
        .minimumScaleFactor(0.9)
      Text(value.map { compact ? "\($0)" : "\($0)/10" } ?? "--")
        .font(.system(size: compact ? 17 : 15, weight: .bold))
        .foregroundStyle(wellnessAccent(value, palette: palette))
        .lineLimit(1)
        .minimumScaleFactor(0.85)
    }
    .frame(maxWidth: .infinity, alignment: compact ? .center : .leading)
    .padding(.vertical, compact ? 9 : 10)
    .padding(.horizontal, compact ? 6 : 10)
    .background(palette.track)
    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
  }
}

private struct WellnessWidgetView: View {
  let entry: SynapseProvider.Entry
  @Environment(\.colorScheme) private var colorScheme
  @Environment(\.widgetFamily) private var family

  var body: some View {
    let palette = palette(for: entry.snapshot.appearance, colorScheme: colorScheme)
    let compact = family == .systemSmall
    WidgetCard(palette: palette) {
      if family == .systemMedium {
        HStack(spacing: 16) {
          Link(destination: SynapseWidgetDestination.url(for: "daily-log")) {
            WellnessBlock(wellness: entry.snapshot.wellness, compact: false, palette: palette)
              .frame(maxWidth: .infinity, alignment: .topLeading)
              .contentShape(Rectangle())
          }
          .buttonStyle(.plain)

          Rectangle()
            .fill(palette.line)
            .frame(width: 1)
            .padding(.vertical, 2)

          Link(destination: SynapseWidgetDestination.url(for: "appointments")) {
            AppointmentBlock(appointment: entry.snapshot.appointment, compact: false, showHeader: true, palette: palette)
              .frame(maxWidth: .infinity, alignment: .topLeading)
              .contentShape(Rectangle())
          }
          .buttonStyle(.plain)
        }
      } else {
        WellnessBlock(wellness: entry.snapshot.wellness, compact: compact, palette: palette)
      }
    }
  }
}

private struct WellnessBlock: View {
  let wellness: SynapseWidgetSnapshot.Wellness
  let compact: Bool
  let palette: SynapseWidgetPalette

  var body: some View {
    VStack(alignment: .leading, spacing: compact ? 6 : 10) {
      if !compact {
        Text("Daily Check-In")
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(palette.muted)
          .lineLimit(1)
      }

      Text(wellness.summaryText)
        .font(.system(size: compact ? 15 : 18, weight: .bold))
        .foregroundStyle(palette.ink)
        .lineLimit(1)
        .minimumScaleFactor(0.86)

      if wellness.hasTodayLog {
        VStack(alignment: .leading, spacing: compact ? 6 : 8) {
          Text("Overall today")
            .font(.system(size: compact ? 10 : 11, weight: .semibold))
            .foregroundStyle(palette.muted)
            .lineLimit(1)

          Text(wellness.overallFeeling.map(String.init) ?? "--")
            .font(.system(size: compact ? 42 : 34, weight: .bold))
            .foregroundStyle(palette.red)
            .lineLimit(1)
            .minimumScaleFactor(0.82)

          if !compact && !wellness.detailHighlights.isEmpty {
            HStack(spacing: 6) {
              ForEach(Array(wellness.detailHighlights.prefix(3).enumerated()), id: \.offset) { _, item in
                WellnessDetailChip(text: item, palette: palette)
              }
            }
          }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, compact ? 12 : 10)
        .padding(.horizontal, 12)
        .background(palette.track)
        .clipShape(RoundedRectangle(cornerRadius: compact ? 18 : 16, style: .continuous))
      }

      if !compact || !wellness.hasTodayLog {
        Text(wellness.secondaryText)
          .font(.system(size: compact ? 10 : 12, weight: .regular))
          .foregroundStyle(palette.muted)
          .lineLimit(2)
          .minimumScaleFactor(0.82)
      }

      if !compact && (wellness.symptomCountToday > 0 || wellness.isFastingToday) {
        HStack(spacing: 8) {
          if wellness.symptomCountToday > 0 {
            Label(
              wellness.symptomCountToday == 1 ? "1 symptom" : "\(wellness.symptomCountToday) symptoms",
              systemImage: "waveform.path.ecg"
            )
            .font(.system(size: 10, weight: .regular))
            .foregroundStyle(palette.red)
            .lineLimit(1)
          }

          if wellness.isFastingToday {
            Label("Fasting", systemImage: "moon.stars.fill")
              .font(.system(size: 10, weight: .regular))
              .foregroundStyle(palette.blue)
              .lineLimit(1)
          }
        }
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }
}

private func smallTitleFont() -> Font {
  .system(size: 12, weight: .semibold)
}

private func mainFont(compact: Bool) -> Font {
  .system(size: compact ? 16 : 18, weight: .bold)
}

private func secondaryFont(compact: Bool) -> Font {
  .system(size: compact ? 12 : 13, weight: .regular)
}

private func metaFont() -> Font {
  .system(size: 11, weight: .regular)
}

private struct MedBlock: View {
  let medication: SynapseWidgetSnapshot.Medication?
  let compact: Bool
  let showHeader: Bool
  let palette: SynapseWidgetPalette

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      Spacer(minLength: compact ? 0 : 6)
      VStack(alignment: .leading, spacing: compact ? 8 : 10) {
        if showHeader {
          Text("Next Medication")
            .font(smallTitleFont())
            .foregroundStyle(palette.muted)
        }
        if let medication {
          Text(medication.name)
            .font(mainFont(compact: compact))
            .foregroundStyle(palette.ink)
            .lineLimit(2)
            .minimumScaleFactor(0.8)
          Text(medication.detail)
            .font(secondaryFont(compact: compact))
            .foregroundStyle(palette.muted)
            .lineLimit(1)

          if medication.isTaken {
            Text(medication.dueText)
              .font(secondaryFont(compact: compact).weight(.semibold))
              .foregroundStyle(palette.green)
              .lineLimit(1)
            if let nextText = medication.nextText {
              Text(nextText)
                .font(metaFont())
                .foregroundStyle(palette.muted)
                .lineLimit(1)
            }
          } else {
            MedicationProgressBar(progress: medicationProgress(medication), palette: palette)
              .padding(.top, compact ? 2 : 4)
            Text(compactRelativeMedicationText(medication.dueAt))
              .font(secondaryFont(compact: compact).weight(.semibold))
              .foregroundStyle(palette.red)
              .lineLimit(1)
              .minimumScaleFactor(0.85)
          }
        } else {
          Text("No medication due")
            .font(mainFont(compact: compact))
            .foregroundStyle(palette.ink)
          Text("Stay on track")
            .font(secondaryFont(compact: compact))
            .foregroundStyle(palette.muted)
        }
      }
      Spacer(minLength: compact ? 0 : 2)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
  }
}

private struct PrnMedicationBlock: View {
  let prnMedication: SynapseWidgetSnapshot.PrnMedication?
  let compact: Bool
  let showHeader: Bool
  let palette: SynapseWidgetPalette

  var body: some View {
    VStack(alignment: .leading, spacing: compact ? 7 : 8) {
      if showHeader && !compact {
        Text("As Needed")
          .font(smallTitleFont())
          .foregroundStyle(palette.muted)
          .lineLimit(1)
          .minimumScaleFactor(0.85)
      }

      if let prnMedication {
        VStack(alignment: .leading, spacing: compact ? 7 : 8) {
          Link(destination: SynapseWidgetDestination.url(for: "medications")) {
            VStack(alignment: .leading, spacing: compact ? 3 : 5) {
              Text(prnMedication.name)
                .font(mainFont(compact: compact))
                .foregroundStyle(palette.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.82)
              Text(prnMedication.detail)
                .font(secondaryFont(compact: compact))
                .foregroundStyle(palette.muted)
                .lineLimit(1)
                .minimumScaleFactor(0.82)
              Text(prnMedication.statusText)
                .font(.system(size: compact ? 11 : 13, weight: .semibold))
                .foregroundStyle(palette.green)
                .lineLimit(1)
                .minimumScaleFactor(0.82)
              Text(prnMedication.countText)
                .font(.system(size: compact ? 10 : 11, weight: .regular))
                .foregroundStyle(palette.muted)
                .lineLimit(1)
                .minimumScaleFactor(0.82)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
          }
          .buttonStyle(.plain)

          Link(destination: SynapseWidgetDestination.prnLogURL(for: prnMedication.id)) {
            HStack(spacing: compact ? 4 : 5) {
              Image(systemName: "plus.circle.fill")
                .font(.system(size: compact ? 14 : 15, weight: .semibold))
              Text("Log")
            }
            .font(.system(size: compact ? 11 : 13, weight: .semibold))
            .foregroundStyle(Color.white)
            .frame(maxWidth: compact ? .infinity : 152)
            .padding(.vertical, compact ? 7 : 8)
            .background(palette.red)
            .clipShape(Capsule())
          }
          .buttonStyle(.plain)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
      } else {
        Text("No As Needed meds")
          .font(mainFont(compact: compact))
          .foregroundStyle(palette.ink)
        Text("Add one in Synapse")
          .font(secondaryFont(compact: compact))
          .foregroundStyle(palette.muted)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }
}

private struct AppointmentBlock: View {
  let appointment: SynapseWidgetSnapshot.Appointment?
  let compact: Bool
  let showHeader: Bool
  let palette: SynapseWidgetPalette

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      Spacer(minLength: compact ? 0 : 6)
      VStack(alignment: .leading, spacing: compact ? 8 : 10) {
        if showHeader {
          Text("Next Visit")
            .font(smallTitleFont())
            .foregroundStyle(palette.muted)
        }
        if let appointment {
          Text(appointment.doctorName)
            .font(mainFont(compact: compact))
            .foregroundStyle(palette.ink)
            .lineLimit(2)
            .minimumScaleFactor(0.8)
          Text(appointment.detail)
            .font(secondaryFont(compact: compact))
            .foregroundStyle(palette.muted)
            .lineLimit(1)
          Text(appointment.whenText)
            .font(secondaryFont(compact: compact).weight(.semibold))
            .foregroundStyle(palette.blue)
            .lineLimit(1)
            .minimumScaleFactor(0.85)
        } else {
          Text("No upcoming visit")
            .font(mainFont(compact: compact))
            .foregroundStyle(palette.ink)
            .lineLimit(2)
          Text("Add one in Synapse")
            .font(secondaryFont(compact: compact))
            .foregroundStyle(palette.muted)
        }
      }
      Spacer(minLength: compact ? 0 : 2)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
  }
}

private struct WidgetCard<Content: View>: View {
  let palette: SynapseWidgetPalette
  let content: Content

  init(palette: SynapseWidgetPalette, @ViewBuilder content: () -> Content) {
    self.palette = palette
    self.content = content()
  }

  var body: some View {
    let baseCard = ZStack {
      palette.background
        .frame(maxWidth: .infinity, maxHeight: .infinity)
      content
        .padding(14)
    }

    if #available(iOSApplicationExtension 17.0, *) {
      baseCard
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(palette.background)
        .clipShape(ContainerRelativeShape())
        .containerBackground(for: .widget) {
          palette.background
        }
    } else {
      baseCard
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(palette.background)
        .clipShape(ContainerRelativeShape())
    }
  }
}

private struct CombinedWidgetView: View {
  let entry: SynapseProvider.Entry
  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    let palette = palette(for: entry.snapshot.appearance, colorScheme: colorScheme)
    WidgetCard(palette: palette) {
      HStack(spacing: 16) {
        Link(destination: SynapseWidgetDestination.url(for: "medications")) {
          MedBlock(medication: entry.snapshot.medication, compact: false, showHeader: false, palette: palette)
            .frame(maxWidth: .infinity, alignment: .topLeading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        Rectangle()
          .fill(palette.line)
          .frame(width: 1)
          .padding(.vertical, 2)
        Link(destination: SynapseWidgetDestination.url(for: "appointments")) {
          AppointmentBlock(appointment: entry.snapshot.appointment, compact: false, showHeader: false, palette: palette)
            .frame(maxWidth: .infinity, alignment: .topLeading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
      }
    }
  }
}

private struct MedicationWidgetView: View {
  let entry: SynapseProvider.Entry
  @Environment(\.colorScheme) private var colorScheme
  @Environment(\.widgetFamily) private var family

  var body: some View {
    let palette = palette(for: entry.snapshot.appearance, colorScheme: colorScheme)
    WidgetCard(palette: palette) {
      MedBlock(
        medication: entry.snapshot.medication,
        compact: family == .systemSmall,
        showHeader: true,
        palette: palette
      )
    }
  }
}

private struct AppointmentWidgetView: View {
  let entry: SynapseProvider.Entry
  @Environment(\.colorScheme) private var colorScheme
  @Environment(\.widgetFamily) private var family

  var body: some View {
    let palette = palette(for: entry.snapshot.appearance, colorScheme: colorScheme)
    WidgetCard(palette: palette) {
      if family == .systemMedium {
        HStack(spacing: 16) {
          Link(destination: SynapseWidgetDestination.url(for: "appointments")) {
            AppointmentBlock(
              appointment: entry.snapshot.appointment,
              compact: false,
              showHeader: true,
              palette: palette
            )
            .frame(maxWidth: .infinity, alignment: .topLeading)
            .contentShape(Rectangle())
          }
          .buttonStyle(.plain)

          Rectangle()
            .fill(palette.line)
            .frame(width: 1)
            .padding(.vertical, 2)

          Link(destination: SynapseWidgetDestination.url(for: "hydration")) {
            HydrationBlock(hydration: entry.snapshot.hydration, palette: palette)
              .frame(maxWidth: .infinity, alignment: .topLeading)
              .contentShape(Rectangle())
          }
          .buttonStyle(.plain)
        }
      } else {
        AppointmentBlock(
          appointment: entry.snapshot.appointment,
          compact: true,
          showHeader: true,
          palette: palette
        )
      }
    }
  }
}

private struct PrnMedicationWidgetView: View {
  let entry: SynapseProvider.Entry
  @Environment(\.colorScheme) private var colorScheme
  @Environment(\.widgetFamily) private var family

  var body: some View {
    let palette = palette(for: entry.snapshot.appearance, colorScheme: colorScheme)
    WidgetCard(palette: palette) {
      PrnMedicationBlock(
        prnMedication: entry.snapshot.prnMedication,
        compact: family == .systemSmall,
        showHeader: true,
        palette: palette
      )
    }
  }
}

private struct HydrationWidgetView: View {
  let entry: SynapseProvider.Entry
  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    let palette = palette(for: entry.snapshot.appearance, colorScheme: colorScheme)
    WidgetCard(palette: palette) {
      if #available(iOSApplicationExtension 17.0, *) {
        ZStack(alignment: .topLeading) {
          Link(destination: SynapseWidgetDestination.url(for: "hydration")) {
            Color.clear
              .frame(maxWidth: .infinity, maxHeight: .infinity)
              .contentShape(Rectangle())
          }
          .buttonStyle(.plain)

          HydrationBlock(hydration: entry.snapshot.hydration, palette: palette)
        }
      } else {
        HydrationBlock(hydration: entry.snapshot.hydration, palette: palette)
      }
    }
  }
}

private struct HydrationBlock: View {
  let hydration: SynapseWidgetSnapshot.Hydration
  let palette: SynapseWidgetPalette

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      Text("Hydration")
        .font(smallTitleFont())
        .foregroundStyle(palette.muted)
      Text(hydration.presetLabel)
        .font(.system(size: 18, weight: .bold))
        .foregroundStyle(palette.ink)
        .lineLimit(1)
      Text(hydration.sipAmountText)
        .font(.system(size: 13, weight: .semibold))
        .foregroundStyle(palette.red)
        .lineLimit(1)
      Text(hydration.totalTodayText)
        .font(.system(size: 12, weight: .regular))
        .foregroundStyle(palette.muted)
        .lineLimit(2)
      Spacer(minLength: 0)
      Link(destination: SynapseWidgetDestination.hydrationQuickSipURL()) {
        HStack(spacing: 6) {
          Image(systemName: "drop.fill")
            .font(.system(size: 13, weight: .semibold))
          Text(hydration.launchHint)
        }
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(Color.white)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(palette.red)
        .clipShape(Capsule())
      }
      .buttonStyle(.plain)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }
}

private struct SickModeWidgetView: View {
  let entry: SynapseProvider.Entry
  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    let palette = palette(for: entry.snapshot.appearance, colorScheme: colorScheme)
    let sickMode = entry.snapshot.sickMode
    WidgetCard(palette: palette) {
      VStack(alignment: .leading, spacing: 10) {
        HStack {
          Text("I am Sick")
            .font(smallTitleFont())
            .foregroundStyle(palette.muted)
          Spacer()
          Text(sickMode.recoveryMode ? "Recovery" : "Active")
            .font(.system(size: 11, weight: .bold))
            .foregroundStyle(sickMode.recoveryMode ? palette.green : palette.red)
        }

        Text(sickMode.latestTemperatureText)
          .font(.system(size: 24, weight: .bold))
          .foregroundStyle(palette.ink)
          .lineLimit(1)

        Text(sickMode.statusText)
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(sickMode.recoveryMode ? palette.green : palette.red)
          .lineLimit(1)

        HStack(spacing: 10) {
          VStack(alignment: .leading, spacing: 3) {
            Text("Stress dose")
              .font(.system(size: 10, weight: .semibold))
              .foregroundStyle(palette.muted)
            Text(sickMode.stressDoseText)
              .font(.system(size: 12, weight: .semibold))
              .foregroundStyle(sickMode.needsStressDose ? palette.red : palette.green)
              .lineLimit(2)
          }
          Spacer()
          VStack(alignment: .trailing, spacing: 3) {
            Text("Check-in")
              .font(.system(size: 10, weight: .semibold))
              .foregroundStyle(palette.muted)
            Text(sickMode.checkInTimer ?? "No timer")
              .font(.system(size: 12, weight: .semibold))
              .foregroundStyle(palette.ink)
              .lineLimit(1)
          }
        }
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
  }
}

private struct MentalHealthWidgetView: View {
  let entry: SynapseProvider.Entry
  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    let palette = palette(for: entry.snapshot.appearance, colorScheme: colorScheme)
    let mentalHealth = entry.snapshot.mentalHealth
    WidgetCard(palette: palette) {
      VStack(alignment: .leading, spacing: 10) {
        Text("I'm not okay")
          .font(smallTitleFont())
          .foregroundStyle(palette.muted)
        Text(mentalHealth.active ? "Mental health day" : "Start support")
          .font(.system(size: 18, weight: .bold))
          .foregroundStyle(palette.ink)
          .lineLimit(2)
        Text(mentalHealth.statusText)
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(palette.red)
          .lineLimit(2)
        Spacer(minLength: 0)
        Text("Next check-in")
          .font(.system(size: 10, weight: .semibold))
          .foregroundStyle(palette.muted)
        Text(mentalHealth.nextCheckInText)
          .font(.system(size: 16, weight: .bold))
          .foregroundStyle(palette.ink)
          .lineLimit(1)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
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
    .contentMarginsDisabled()
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
    .contentMarginsDisabled()
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
    .supportedFamilies([.systemSmall, .systemMedium])
    .contentMarginsDisabled()
  }
}

struct SynapseWellnessWidget: Widget {
  let kind = "SynapseWellnessWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SynapseProvider()) { entry in
      WellnessWidgetView(entry: entry)
        .widgetURL(SynapseWidgetDestination.url(for: "daily-log"))
    }
    .configurationDisplayName("Daily Check-In")
    .description("See today’s wellness summary and jump into your daily check-in.")
    .supportedFamilies([.systemSmall, .systemMedium])
    .contentMarginsDisabled()
  }
}

struct SynapsePrnMedicationWidget: Widget {
  let kind = "SynapsePrnMedicationWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SynapseProvider()) { entry in
      PrnMedicationWidgetView(entry: entry)
    }
    .configurationDisplayName("As Needed Medication")
    .description("Log an As Needed medication and see how many times you’ve taken it today.")
    .supportedFamilies([.systemSmall])
    .contentMarginsDisabled()
  }
}

struct SynapseHydrationWidget: Widget {
  let kind = "SynapseHydrationWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SynapseProvider()) { entry in
      HydrationWidgetView(entry: entry)
    }
    .configurationDisplayName("Hydration")
    .description("Take a quick sip and jump into your hydration log.")
    .supportedFamilies([.systemSmall])
    .contentMarginsDisabled()
  }
}

struct SynapseSickModeWidget: Widget {
  let kind = "SynapseSickModeWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SynapseProvider()) { entry in
      SickModeWidgetView(entry: entry)
        .widgetURL(SynapseWidgetDestination.url(for: "sickmode"))
    }
    .configurationDisplayName("I am Sick")
    .description("See stress-dose status, your latest temperature, and the next check-in.")
    .supportedFamilies([.systemMedium])
    .contentMarginsDisabled()
  }
}

struct SynapseMentalHealthWidget: Widget {
  let kind = "SynapseMentalHealthWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SynapseProvider()) { entry in
      MentalHealthWidgetView(entry: entry)
        .widgetURL(SynapseWidgetDestination.url(for: "mentalhealth"))
    }
    .configurationDisplayName("I'm not okay")
    .description("Start or check your mental health day and the next hourly check-in.")
    .supportedFamilies([.systemSmall])
    .contentMarginsDisabled()
  }
}
