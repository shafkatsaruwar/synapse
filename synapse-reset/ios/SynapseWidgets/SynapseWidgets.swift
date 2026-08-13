import SwiftUI
import WidgetKit

// MARK: - Deep links

private enum SynapseWidgetDestination {
  static func url(for screen: String) -> URL {
    var components = URLComponents(string: "myapp:///")!
    components.queryItems = [URLQueryItem(name: "widgetTarget", value: screen)]
    return components.url!
  }

  static func caregiverActionURL(mode: String) -> URL {
    var components = URLComponents(string: "myapp:///")!
    components.queryItems = [
      URLQueryItem(name: "widgetTarget", value: "caregiverdashboard"),
      URLQueryItem(name: "mode", value: mode),
    ]
    return components.url!
  }

  static func hydrationQuickSipURL() -> URL {
    var components = URLComponents(string: "myapp:///")!
    components.queryItems = [
      URLQueryItem(name: "widgetTarget", value: "hydration"),
      URLQueryItem(name: "mode", value: "quick-sip"),
    ]
    return components.url!
  }

  static func prnLogURL(for medicationId: String) -> URL {
    var components = URLComponents(string: "myapp:///")!
    components.queryItems = [
      URLQueryItem(name: "widgetTarget", value: "prnlog"),
      URLQueryItem(name: "medId", value: medicationId),
    ]
    return components.url!
  }
}

// MARK: - Snapshot store

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

// MARK: - Snapshot model

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
    let travelText: String?
    let location: String?
    let notes: String?
    let prepHint: String

    enum CodingKeys: String, CodingKey {
      case doctorName, detail, startsAt, whenText, travelText, location, notes, prepHint
    }

    init(
      doctorName: String,
      detail: String,
      startsAt: Date?,
      whenText: String,
      travelText: String?,
      location: String?,
      notes: String?,
      prepHint: String
    ) {
      self.doctorName = doctorName
      self.detail = detail
      self.startsAt = startsAt
      self.whenText = whenText
      self.travelText = travelText
      self.location = location
      self.notes = notes
      self.prepHint = prepHint
    }

    init(from decoder: Decoder) throws {
      let c = try decoder.container(keyedBy: CodingKeys.self)
      doctorName = try c.decode(String.self, forKey: .doctorName)
      detail = try c.decode(String.self, forKey: .detail)
      startsAt = try c.decodeIfPresent(Date.self, forKey: .startsAt)
      whenText = try c.decode(String.self, forKey: .whenText)
      travelText = try c.decodeIfPresent(String.self, forKey: .travelText)
      location = try c.decodeIfPresent(String.self, forKey: .location)
      notes = try c.decodeIfPresent(String.self, forKey: .notes)
      prepHint = try c.decodeIfPresent(String.self, forKey: .prepHint) ?? "Open Synapse to prep"
    }
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

  struct Caregiver: Codable {
    struct Item: Codable {
      let kind: String
      let text: String
      let tone: String
    }

    let hasProfile: Bool
    let name: String
    let age: Int?
    let relation: String?
    let status: String
    let statusText: String
    let tone: String
    let primaryText: String
    let secondaryText: String?
    let actionText: String?
    let items: [Item]
    let missedCount: Int

    enum CodingKeys: String, CodingKey {
      case hasProfile, name, age, relation, status, statusText, tone
      case primaryText, secondaryText, actionText, items, missedCount
    }

    init(
      hasProfile: Bool,
      name: String,
      age: Int?,
      relation: String?,
      status: String,
      statusText: String,
      tone: String,
      primaryText: String,
      secondaryText: String?,
      actionText: String?,
      items: [Item],
      missedCount: Int
    ) {
      self.hasProfile = hasProfile
      self.name = name
      self.age = age
      self.relation = relation
      self.status = status
      self.statusText = statusText
      self.tone = tone
      self.primaryText = primaryText
      self.secondaryText = secondaryText
      self.actionText = actionText
      self.items = items
      self.missedCount = missedCount
    }

    init(from decoder: Decoder) throws {
      let c = try decoder.container(keyedBy: CodingKeys.self)
      hasProfile = try c.decode(Bool.self, forKey: .hasProfile)
      name = try c.decode(String.self, forKey: .name)
      age = try c.decodeIfPresent(Int.self, forKey: .age)
      relation = try c.decodeIfPresent(String.self, forKey: .relation)
      let decodedStatus = try c.decode(String.self, forKey: .status)
      status = decodedStatus == "needs_attention" ? "attention" : decodedStatus
      statusText = try c.decode(String.self, forKey: .statusText)
      tone = try c.decode(String.self, forKey: .tone)
      primaryText = try c.decode(String.self, forKey: .primaryText)
      secondaryText = try c.decodeIfPresent(String.self, forKey: .secondaryText)
      actionText = try c.decodeIfPresent(String.self, forKey: .actionText)
      if let decodedItems = try? c.decode([Item].self, forKey: .items) {
        items = decodedItems
      } else {
        let legacy = (try? c.decode([String].self, forKey: .items)) ?? []
        items = legacy.map { Item(kind: "legacy", text: $0, tone: "muted") }
      }
      missedCount = try c.decode(Int.self, forKey: .missedCount)
    }

    static let placeholder = Caregiver(
      hasProfile: false,
      name: "Managed person",
      age: nil,
      relation: nil,
      status: "attention",
      statusText: "Set up profile",
      tone: "yellow",
      primaryText: "Profile needed",
      secondaryText: "Open Synapse",
      actionText: "Open Synapse",
      items: [Item(kind: "setup", text: "Managed person missing", tone: "yellow")],
      missedCount: 0
    )
  }

  struct Recovery: Codable {
    let active: Bool
    let title: String
    let statusText: String
    let tone: String
    let focusText: String?
    let nextAction: String

    static let empty = Recovery(
      active: false,
      title: "Recovery Today",
      statusText: "No recovery focus",
      tone: "blue",
      focusText: nil,
      nextAction: "Open recovery when you need it"
    )
  }

  struct Pain: Codable {
    let hasPain: Bool
    let name: String
    let severity: Int?
    let statusText: String
    let tone: String
    let nextAction: String

    static let empty = Pain(
      hasPain: false,
      name: "Pain",
      severity: nil,
      statusText: "Nothing flagged",
      tone: "green",
      nextAction: "Log if something hurts"
    )
  }

  struct MedicationDay: Codable {
    struct Dose: Codable {
      let name: String
      let detail: String
      let timeText: String
      let taken: Bool
    }

    let taken: Int
    let expected: Int
    let summaryText: String
    let nextAction: String
    let doses: [Dose]

    static let empty = MedicationDay(
      taken: 0,
      expected: 0,
      summaryText: "No scheduled doses today",
      nextAction: "Add meds in Synapse",
      doses: []
    )
  }

  struct Labs: Codable {
    struct Item: Codable {
      let name: String
      let detail: String
      let pending: Bool
    }

    let hasItems: Bool
    let title: String
    let statusText: String
    let tone: String
    let nextAction: String
    let items: [Item]

    static let empty = Labs(
      hasItems: false,
      title: "Labs",
      statusText: "No labs yet",
      tone: "blue",
      nextAction: "Add or scan a result",
      items: []
    )
  }

  struct Report14Day: Codable {
    let statusLabel: String
    let summaryText: String
    let tone: String
    let adherenceText: String
    let nextAction: String
    let insights: [String]

    static let empty = Report14Day(
      statusLabel: "Steady",
      summaryText: "Pattern over the last 14 days",
      tone: "blue",
      adherenceText: "No med schedule today",
      nextAction: "Open 14-day report",
      insights: []
    )
  }

  let medication: Medication?
  let appointment: Appointment?
  let prnMedication: PrnMedication?
  let wellness: Wellness
  let hydration: Hydration
  let sickMode: SickMode
  let mentalHealth: MentalHealth
  let caregiver: Caregiver
  let recovery: Recovery
  let pain: Pain
  let medicationDay: MedicationDay
  let labs: Labs
  let report14Day: Report14Day
  let updatedAt: Date

  enum CodingKeys: String, CodingKey {
    case appearance, medication, appointment, prnMedication, wellness, hydration
    case sickMode, mentalHealth, caregiver, recovery, pain, medicationDay, labs, report14Day, updatedAt
  }

  init(
    appearance: String,
    medication: Medication?,
    appointment: Appointment?,
    prnMedication: PrnMedication?,
    wellness: Wellness,
    hydration: Hydration,
    sickMode: SickMode,
    mentalHealth: MentalHealth,
    caregiver: Caregiver,
    recovery: Recovery,
    pain: Pain,
    medicationDay: MedicationDay,
    labs: Labs,
    report14Day: Report14Day,
    updatedAt: Date
  ) {
    self.appearance = appearance
    self.medication = medication
    self.appointment = appointment
    self.prnMedication = prnMedication
    self.wellness = wellness
    self.hydration = hydration
    self.sickMode = sickMode
    self.mentalHealth = mentalHealth
    self.caregiver = caregiver
    self.recovery = recovery
    self.pain = pain
    self.medicationDay = medicationDay
    self.labs = labs
    self.report14Day = report14Day
    self.updatedAt = updatedAt
  }

  init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    appearance = try c.decode(String.self, forKey: .appearance)
    medication = try c.decodeIfPresent(Medication.self, forKey: .medication)
    appointment = try c.decodeIfPresent(Appointment.self, forKey: .appointment)
    prnMedication = try c.decodeIfPresent(PrnMedication.self, forKey: .prnMedication)
    wellness = try c.decode(Wellness.self, forKey: .wellness)
    hydration = try c.decode(Hydration.self, forKey: .hydration)
    sickMode = try c.decode(SickMode.self, forKey: .sickMode)
    mentalHealth = try c.decode(MentalHealth.self, forKey: .mentalHealth)
    caregiver = try c.decodeIfPresent(Caregiver.self, forKey: .caregiver) ?? .placeholder
    recovery = try c.decodeIfPresent(Recovery.self, forKey: .recovery) ?? .empty
    pain = try c.decodeIfPresent(Pain.self, forKey: .pain) ?? .empty
    medicationDay = try c.decodeIfPresent(MedicationDay.self, forKey: .medicationDay) ?? .empty
    labs = try c.decodeIfPresent(Labs.self, forKey: .labs) ?? .empty
    report14Day = try c.decodeIfPresent(Report14Day.self, forKey: .report14Day) ?? .empty
    updatedAt = try c.decode(Date.self, forKey: .updatedAt)
  }

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
      whenText: "Add one in Synapse",
      travelText: nil,
      location: nil,
      notes: nil,
      prepHint: "Open Synapse to prep"
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
    caregiver: .placeholder,
    recovery: .empty,
    pain: .empty,
    medicationDay: .empty,
    labs: .empty,
    report14Day: .empty,
    updatedAt: Date()
  )
}

// MARK: - Timeline

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
    if snapshot.sickMode.active || snapshot.mentalHealth.active || snapshot.recovery.active {
      return Date().addingTimeInterval(60)
    }
    return Date().addingTimeInterval(60 * 30)
  }
}

// MARK: - Palette

private struct SynapseWidgetPalette {
  let background: Color
  let surface: Color
  let ink: Color
  let muted: Color
  let red: Color
  let blue: Color
  let green: Color
  let orange: Color
  let yellow: Color
  let purple: Color
  let line: Color
  let track: Color

  static let light = SynapseWidgetPalette(
    background: Color.white.opacity(0.92),
    surface: Color.white.opacity(0.72),
    ink: Color(red: 0.10, green: 0.13, blue: 0.18),
    muted: Color(red: 0.40, green: 0.45, blue: 0.54),
    red: Color(red: 0.78, green: 0.20, blue: 0.24),
    blue: Color(red: 0.22, green: 0.48, blue: 0.86),
    green: Color(red: 0.18, green: 0.62, blue: 0.42),
    orange: Color(red: 0.90, green: 0.48, blue: 0.12),
    yellow: Color(red: 0.82, green: 0.58, blue: 0.08),
    purple: Color(red: 0.48, green: 0.36, blue: 0.78),
    line: Color.black.opacity(0.08),
    track: Color.black.opacity(0.06)
  )

  static let dark = SynapseWidgetPalette(
    background: Color(red: 0.10, green: 0.11, blue: 0.13).opacity(0.96),
    surface: Color.white.opacity(0.08),
    ink: Color.white.opacity(0.96),
    muted: Color.white.opacity(0.62),
    red: Color(red: 0.95, green: 0.36, blue: 0.40),
    blue: Color(red: 0.48, green: 0.68, blue: 1.0),
    green: Color(red: 0.40, green: 0.84, blue: 0.58),
    orange: Color(red: 1.0, green: 0.62, blue: 0.28),
    yellow: Color(red: 0.96, green: 0.76, blue: 0.28),
    purple: Color(red: 0.72, green: 0.58, blue: 1.0),
    line: Color.white.opacity(0.12),
    track: Color.white.opacity(0.10)
  )
}

private func palette(for appearance: String, colorScheme: ColorScheme) -> SynapseWidgetPalette {
  switch appearance {
  case "light":
    return .light
  case "dark":
    return .dark
  default:
    return colorScheme == .dark ? .dark : .light
  }
}

private func toneColor(_ tone: String, palette: SynapseWidgetPalette) -> Color {
  switch tone.lowercased() {
  case "green":
    return palette.green
  case "blue":
    return palette.blue
  case "orange":
    return palette.orange
  case "red":
    return palette.red
  case "purple":
    return palette.purple
  case "yellow":
    return palette.yellow
  default:
    return palette.muted
  }
}

// MARK: - Shared helpers

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
  let formatter = DateFormatter()
  formatter.dateFormat = "h:mm a"
  let exactTime = formatter.string(from: dueAt)
  let seconds = Int(dueAt.timeIntervalSinceNow.rounded())
  if seconds <= 60 { return "Due now · \(exactTime)" }
  let minutes = Int(ceil(Double(seconds) / 60.0))
  if minutes < 60 { return "In \(minutes) min · \(exactTime)" }
  let hours = Int(ceil(Double(minutes) / 60.0))
  if hours < 24 { return "In \(hours) hr\(hours == 1 ? "" : "s") · \(exactTime)" }
  return "Tomorrow · \(exactTime)"
}

private func overallWellnessLabel(_ value: Int?) -> String {
  guard let value else { return "Ready for today" }
  if value >= 8 { return "Strong day" }
  if value >= 6 { return "Doing okay" }
  if value >= 4 { return "Take it easy" }
  return "Needs support"
}

private func wellnessAccent(_ value: Int?, palette: SynapseWidgetPalette) -> Color {
  guard let value else { return palette.muted }
  if value >= 8 { return palette.green }
  if value >= 5 { return palette.blue }
  if value >= 3 { return palette.orange }
  return palette.red
}

private func caregiverPersonText(_ caregiver: SynapseWidgetSnapshot.Caregiver, includeRelation: Bool) -> String {
  var details: [String] = []
  if let age = caregiver.age {
    details.append("\(age)y")
  }
  if includeRelation, let relation = caregiver.relation, !relation.isEmpty {
    details.append(relation)
  }
  return details.isEmpty ? caregiver.name : "\(caregiver.name) · \(details.joined(separator: " · "))"
}

private struct Eyebrow: View {
  let text: String
  let palette: SynapseWidgetPalette

  var body: some View {
    Text(text)
      .font(.system(size: 11, weight: .semibold))
      .foregroundStyle(palette.muted)
      .lineLimit(1)
  }
}

private struct HeroTitle: View {
  let text: String
  let palette: SynapseWidgetPalette
  var size: CGFloat = 20

  var body: some View {
    Text(text)
      .font(.system(size: size, weight: .bold))
      .foregroundStyle(palette.ink)
      .lineLimit(2)
      .minimumScaleFactor(0.78)
  }
}

private struct StatusChip: View {
  let text: String
  let color: Color
  var compact: Bool = false

  var body: some View {
    Text(text)
      .font(.system(size: compact ? 10 : 11, weight: .bold))
      .foregroundStyle(color)
      .lineLimit(1)
      .minimumScaleFactor(0.8)
      .padding(.vertical, compact ? 4 : 5)
      .padding(.horizontal, compact ? 7 : 9)
      .background(color.opacity(0.14))
      .clipShape(Capsule())
  }
}

private struct SoftCard<Content: View>: View {
  let palette: SynapseWidgetPalette
  let content: Content

  init(palette: SynapseWidgetPalette, @ViewBuilder content: () -> Content) {
    self.palette = palette
    self.content = content()
  }

  var body: some View {
    content
      .padding(.vertical, 10)
      .padding(.horizontal, 11)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(palette.surface)
      .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
  }
}

private struct ActionCapsule: View {
  let title: String
  let color: Color
  var systemImage: String? = nil
  var compact: Bool = false

  var body: some View {
    HStack(spacing: compact ? 4 : 6) {
      if let systemImage {
        Image(systemName: systemImage)
          .font(.system(size: compact ? 12 : 13, weight: .semibold))
      }
      Text(title)
        .font(.system(size: compact ? 11 : 12, weight: .semibold))
        .lineLimit(1)
    }
    .foregroundStyle(Color.white)
    .frame(maxWidth: .infinity)
    .padding(.vertical, compact ? 7 : 8)
    .background(color)
    .clipShape(Capsule())
  }
}

private struct AccentBar: View {
  let color: Color

  var body: some View {
    RoundedRectangle(cornerRadius: 2, style: .continuous)
      .fill(color)
      .frame(width: 3)
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

// MARK: - Widget views

private struct RecoveryWidgetView: View {
  let entry: SynapseProvider.Entry
  @Environment(\.colorScheme) private var colorScheme
  @Environment(\.widgetFamily) private var family

  var body: some View {
    let palette = palette(for: entry.snapshot.appearance, colorScheme: colorScheme)
    let recovery = entry.snapshot.recovery
    let accent = toneColor(recovery.tone, palette: palette)
    let compact = family == .systemSmall

    WidgetCard(palette: palette) {
      HStack(alignment: .top, spacing: 10) {
        AccentBar(color: accent)
        VStack(alignment: .leading, spacing: compact ? 6 : 8) {
          Eyebrow(text: recovery.title, palette: palette)
          HeroTitle(text: recovery.statusText, palette: palette, size: compact ? 17 : 22)
          if let focus = recovery.focusText, !focus.isEmpty, !compact {
            Text(focus)
              .font(.system(size: 13, weight: .medium))
              .foregroundStyle(palette.muted)
              .lineLimit(2)
          }
          StatusChip(text: recovery.active ? "Active" : "Quiet", color: accent, compact: compact)
          Spacer(minLength: 0)
          Text(recovery.nextAction)
            .font(.system(size: compact ? 11 : 12, weight: .semibold))
            .foregroundStyle(accent)
            .lineLimit(2)
            .minimumScaleFactor(0.85)
        }
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
  }
}

private struct HydrationWidgetView: View {
  let entry: SynapseProvider.Entry
  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    let palette = palette(for: entry.snapshot.appearance, colorScheme: colorScheme)
    let hydration = entry.snapshot.hydration

    WidgetCard(palette: palette) {
      VStack(alignment: .leading, spacing: 8) {
        Eyebrow(text: "Hydration", palette: palette)
        HeroTitle(text: hydration.presetLabel, palette: palette, size: 18)
        Text(hydration.sipAmountText)
          .font(.system(size: 13, weight: .semibold))
          .foregroundStyle(palette.blue)
        Text(hydration.totalTodayText)
          .font(.system(size: 11, weight: .regular))
          .foregroundStyle(palette.muted)
          .lineLimit(2)
        Spacer(minLength: 0)
        Link(destination: SynapseWidgetDestination.hydrationQuickSipURL()) {
          ActionCapsule(title: hydration.launchHint, color: palette.blue, systemImage: "drop.fill", compact: true)
        }
        .buttonStyle(.plain)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
  }
}

private struct PrnMedicationWidgetView: View {
  let entry: SynapseProvider.Entry
  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    let palette = palette(for: entry.snapshot.appearance, colorScheme: colorScheme)

    WidgetCard(palette: palette) {
      if let prn = entry.snapshot.prnMedication {
        VStack(alignment: .leading, spacing: 7) {
          Link(destination: SynapseWidgetDestination.url(for: "medications")) {
            VStack(alignment: .leading, spacing: 4) {
              Eyebrow(text: "As needed", palette: palette)
              HeroTitle(text: prn.name, palette: palette, size: 16)
              Text(prn.detail)
                .font(.system(size: 12, weight: .regular))
                .foregroundStyle(palette.muted)
                .lineLimit(1)
              Text(prn.statusText)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(palette.green)
                .lineLimit(1)
              Text(prn.countText)
                .font(.system(size: 10, weight: .regular))
                .foregroundStyle(palette.muted)
                .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
          }
          .buttonStyle(.plain)

          Spacer(minLength: 0)

          Link(destination: SynapseWidgetDestination.prnLogURL(for: prn.id)) {
            ActionCapsule(title: "Log", color: palette.green, systemImage: "plus.circle.fill", compact: true)
          }
          .buttonStyle(.plain)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
      } else {
        VStack(alignment: .leading, spacing: 6) {
          Eyebrow(text: "As needed", palette: palette)
          HeroTitle(text: "No PRN meds", palette: palette, size: 16)
          Text("Add one in Synapse")
            .font(.system(size: 12, weight: .regular))
            .foregroundStyle(palette.muted)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
      }
    }
  }
}

private struct MedicationWidgetView: View {
  let entry: SynapseProvider.Entry
  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    let palette = palette(for: entry.snapshot.appearance, colorScheme: colorScheme)
    let medication = entry.snapshot.medication

    WidgetCard(palette: palette) {
      VStack(alignment: .leading, spacing: 8) {
        Eyebrow(text: "Next med", palette: palette)
        if let medication {
          HeroTitle(text: medication.name, palette: palette, size: 17)
          Text(medication.detail)
            .font(.system(size: 12, weight: .regular))
            .foregroundStyle(palette.muted)
            .lineLimit(1)

          if medication.isTaken {
            StatusChip(text: medication.dueText, color: palette.green, compact: true)
            if let nextText = medication.nextText {
              Text(nextText)
                .font(.system(size: 11, weight: .regular))
                .foregroundStyle(palette.muted)
                .lineLimit(1)
            }
          } else {
            ZStack(alignment: .leading) {
              Capsule().fill(palette.track).frame(height: 4)
              Capsule()
                .fill(palette.orange)
                .frame(width: max(6, 110 * medicationProgress(medication)), height: 4)
            }
            .frame(width: 110, alignment: .leading)

            Text(compactRelativeMedicationText(medication.dueAt))
              .font(.system(size: 12, weight: .semibold))
              .foregroundStyle(palette.orange)
              .lineLimit(1)
              .minimumScaleFactor(0.85)
          }
        } else {
          HeroTitle(text: "No medication due", palette: palette, size: 16)
          Text("Stay on track")
            .font(.system(size: 12, weight: .regular))
            .foregroundStyle(palette.muted)
        }
        Spacer(minLength: 0)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
  }
}

private struct PainWidgetView: View {
  let entry: SynapseProvider.Entry
  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    let palette = palette(for: entry.snapshot.appearance, colorScheme: colorScheme)
    let pain = entry.snapshot.pain
    let accent = toneColor(pain.tone, palette: palette)

    WidgetCard(palette: palette) {
      VStack(alignment: .leading, spacing: 8) {
        Eyebrow(text: "Pain", palette: palette)
        HeroTitle(text: pain.name, palette: palette, size: 17)
        if let severity = pain.severity {
          Text("\(severity)/10")
            .font(.system(size: 28, weight: .bold))
            .foregroundStyle(accent)
            .lineLimit(1)
        }
        StatusChip(text: pain.statusText, color: accent, compact: true)
        Spacer(minLength: 0)
        Text(pain.nextAction)
          .font(.system(size: 11, weight: .semibold))
          .foregroundStyle(palette.muted)
          .lineLimit(2)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
  }
}

private struct SickModeWidgetView: View {
  let entry: SynapseProvider.Entry
  @Environment(\.colorScheme) private var colorScheme
  @Environment(\.widgetFamily) private var family

  var body: some View {
    let palette = palette(for: entry.snapshot.appearance, colorScheme: colorScheme)
    let sick = entry.snapshot.sickMode
    let escalate = sick.needsStressDose || (sick.active && !sick.recoveryMode)
    let statusColor: Color = {
      if escalate { return palette.red }
      if sick.recoveryMode { return palette.green }
      return palette.blue
    }()
    let compact = family == .systemSmall

    WidgetCard(palette: palette) {
      VStack(alignment: .leading, spacing: compact ? 6 : 9) {
        HStack {
          Eyebrow(text: "Sick mode", palette: palette)
          Spacer()
          StatusChip(
            text: sick.recoveryMode ? "Recovery" : (sick.active ? "Active" : "Off"),
            color: statusColor,
            compact: true
          )
        }

        HeroTitle(text: sick.latestTemperatureText, palette: palette, size: compact ? 20 : 26)
        Text(sick.statusText)
          .font(.system(size: compact ? 11 : 13, weight: .semibold))
          .foregroundStyle(statusColor)
          .lineLimit(2)

        if !compact {
          HStack(spacing: 10) {
            SoftCard(palette: palette) {
              VStack(alignment: .leading, spacing: 3) {
                Text("Stress dose")
                  .font(.system(size: 10, weight: .semibold))
                  .foregroundStyle(palette.muted)
                Text(sick.stressDoseText)
                  .font(.system(size: 12, weight: .semibold))
                  .foregroundStyle(sick.needsStressDose ? palette.red : palette.green)
                  .lineLimit(2)
              }
            }
            SoftCard(palette: palette) {
              VStack(alignment: .leading, spacing: 3) {
                Text("Check-in")
                  .font(.system(size: 10, weight: .semibold))
                  .foregroundStyle(palette.muted)
                Text(sick.checkInTimer ?? "No timer")
                  .font(.system(size: 12, weight: .semibold))
                  .foregroundStyle(palette.ink)
                  .lineLimit(1)
              }
            }
          }
        } else {
          Text(sick.stressDoseText)
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(sick.needsStressDose ? palette.red : palette.muted)
            .lineLimit(2)
        }
        Spacer(minLength: 0)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
  }
}

private struct DailyLogWidgetView: View {
  let entry: SynapseProvider.Entry
  @Environment(\.colorScheme) private var colorScheme
  @Environment(\.widgetFamily) private var family

  var body: some View {
    let palette = palette(for: entry.snapshot.appearance, colorScheme: colorScheme)
    let wellness = entry.snapshot.wellness
    let overall = wellness.overallFeeling
    let accent = wellnessAccent(overall, palette: palette)

    WidgetCard(palette: palette) {
      if family == .systemLarge {
        VStack(alignment: .leading, spacing: 12) {
          Eyebrow(text: "Daily Log", palette: palette)
          HeroTitle(text: wellness.summaryText, palette: palette, size: 24)

          SoftCard(palette: palette) {
            HStack(alignment: .firstTextBaseline) {
              VStack(alignment: .leading, spacing: 4) {
                Text("Overall")
                  .font(.system(size: 11, weight: .semibold))
                  .foregroundStyle(palette.muted)
                Text(overall.map(String.init) ?? "--")
                  .font(.system(size: 40, weight: .bold))
                  .foregroundStyle(accent)
              }
              Spacer()
              VStack(alignment: .trailing, spacing: 6) {
                StatusChip(text: overallWellnessLabel(overall), color: accent)
                Text(wellness.secondaryText)
                  .font(.system(size: 12, weight: .regular))
                  .foregroundStyle(palette.muted)
                  .multilineTextAlignment(.trailing)
                  .lineLimit(2)
              }
            }
          }

          HStack(spacing: 8) {
            metricCell("Energy", wellness.energy, palette)
            metricCell("Mood", wellness.mood, palette)
            metricCell("Sleep", wellness.sleep, palette)
          }

          VStack(alignment: .leading, spacing: 6) {
            Text("Next")
              .font(.system(size: 11, weight: .semibold))
              .foregroundStyle(palette.muted)
            Text(wellness.hasTodayLog ? "Review symptoms or update later" : "Log energy, mood, and sleep")
              .font(.system(size: 14, weight: .semibold))
              .foregroundStyle(palette.ink)
              .lineLimit(2)
            if wellness.symptomCountToday > 0 {
              Text(wellness.symptomCountToday == 1 ? "1 symptom noted" : "\(wellness.symptomCountToday) symptoms noted")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(palette.orange)
            }
          }
          Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
      } else {
        HStack(spacing: 14) {
          VStack(alignment: .leading, spacing: 8) {
            Eyebrow(text: "Daily Log", palette: palette)
            HeroTitle(text: wellness.summaryText, palette: palette, size: 18)
            if wellness.hasTodayLog {
              Text(overall.map(String.init) ?? "--")
                .font(.system(size: 34, weight: .bold))
                .foregroundStyle(accent)
              StatusChip(text: overallWellnessLabel(overall), color: accent, compact: true)
            } else {
              Text(wellness.secondaryText)
                .font(.system(size: 12, weight: .regular))
                .foregroundStyle(palette.muted)
                .lineLimit(3)
            }
            Spacer(minLength: 0)
          }
          .frame(maxWidth: .infinity, alignment: .topLeading)

          VStack(alignment: .leading, spacing: 8) {
            metricCell("Energy", wellness.energy, palette)
            metricCell("Mood", wellness.mood, palette)
            metricCell("Sleep", wellness.sleep, palette)
          }
          .frame(width: 88)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
      }
    }
  }

  private func metricCell(_ label: String, _ value: Int?, _ palette: SynapseWidgetPalette) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(label)
        .font(.system(size: 10, weight: .semibold))
        .foregroundStyle(palette.muted)
      Text(value.map { "\($0)" } ?? "--")
        .font(.system(size: 16, weight: .bold))
        .foregroundStyle(wellnessAccent(value, palette: palette))
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(.vertical, 8)
    .padding(.horizontal, 8)
    .background(palette.surface)
    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
  }
}

private struct MedicationDayWidgetView: View {
  let entry: SynapseProvider.Entry
  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    let palette = palette(for: entry.snapshot.appearance, colorScheme: colorScheme)
    let day = entry.snapshot.medicationDay
    let rows = Array(day.doses.prefix(6))

    WidgetCard(palette: palette) {
      VStack(alignment: .leading, spacing: 10) {
        HStack(alignment: .firstTextBaseline) {
          VStack(alignment: .leading, spacing: 4) {
            Eyebrow(text: "Medication day", palette: palette)
            HeroTitle(text: day.summaryText, palette: palette, size: 22)
          }
          Spacer()
          StatusChip(
            text: day.expected == 0 ? "None" : "\(day.taken)/\(day.expected)",
            color: day.taken >= day.expected && day.expected > 0 ? palette.green : palette.blue
          )
        }

        if rows.isEmpty {
          SoftCard(palette: palette) {
            Text(day.nextAction)
              .font(.system(size: 14, weight: .semibold))
              .foregroundStyle(palette.muted)
          }
        } else {
          VStack(spacing: 6) {
            ForEach(Array(rows.enumerated()), id: \.offset) { _, dose in
              HStack(spacing: 10) {
                RoundedRectangle(cornerRadius: 2, style: .continuous)
                  .fill(dose.taken ? palette.green : palette.orange)
                  .frame(width: 3, height: 28)
                VStack(alignment: .leading, spacing: 2) {
                  Text(dose.name)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(palette.ink)
                    .lineLimit(1)
                  Text(dose.detail)
                    .font(.system(size: 11, weight: .regular))
                    .foregroundStyle(palette.muted)
                    .lineLimit(1)
                }
                Spacer(minLength: 4)
                Text(dose.taken ? "Taken" : dose.timeText)
                  .font(.system(size: 12, weight: .semibold))
                  .foregroundStyle(dose.taken ? palette.green : palette.orange)
                  .lineLimit(1)
              }
              .padding(.vertical, 4)
            }
          }
        }

        Spacer(minLength: 0)
        Text(day.nextAction)
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(palette.blue)
          .lineLimit(1)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
  }
}

private struct AppointmentWidgetView: View {
  let entry: SynapseProvider.Entry
  @Environment(\.colorScheme) private var colorScheme
  @Environment(\.widgetFamily) private var family

  var body: some View {
    let palette = palette(for: entry.snapshot.appearance, colorScheme: colorScheme)
    let appointment = entry.snapshot.appointment
    let compact = family == .systemSmall

    WidgetCard(palette: palette) {
      VStack(alignment: .leading, spacing: compact ? 6 : 8) {
        Eyebrow(text: "Appointment prep", palette: palette)
        if let appointment {
          HeroTitle(text: appointment.doctorName, palette: palette, size: compact ? 16 : 20)
          Text(appointment.detail)
            .font(.system(size: compact ? 11 : 13, weight: .regular))
            .foregroundStyle(palette.muted)
            .lineLimit(1)
          Text(appointment.whenText)
            .font(.system(size: compact ? 12 : 14, weight: .semibold))
            .foregroundStyle(palette.blue)
            .lineLimit(1)

          if !compact {
            if let location = appointment.location, !location.isEmpty {
              Text(location)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(palette.ink)
                .lineLimit(1)
            }
            if let travel = appointment.travelText, !travel.isEmpty {
              Text(travel)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(palette.orange)
                .lineLimit(1)
            }
            if let notes = appointment.notes, !notes.isEmpty {
              Text(notes)
                .font(.system(size: 11, weight: .regular))
                .foregroundStyle(palette.muted)
                .lineLimit(2)
            }
          }

          Spacer(minLength: 0)
          Text(appointment.prepHint)
            .font(.system(size: compact ? 11 : 12, weight: .semibold))
            .foregroundStyle(palette.blue)
            .lineLimit(2)
        } else {
          HeroTitle(text: "No upcoming visit", palette: palette, size: compact ? 16 : 18)
          Text("Add one in Synapse")
            .font(.system(size: 12, weight: .regular))
            .foregroundStyle(palette.muted)
          Spacer(minLength: 0)
        }
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
  }
}

private struct CaregiverWidgetView: View {
  let entry: SynapseProvider.Entry
  @Environment(\.colorScheme) private var colorScheme
  @Environment(\.widgetFamily) private var family

  var body: some View {
    let palette = palette(for: entry.snapshot.appearance, colorScheme: colorScheme)
    let caregiver = entry.snapshot.caregiver
    let accent = toneColor(caregiver.tone, palette: palette)

    WidgetCard(palette: palette) {
      if family == .systemMedium {
        VStack(alignment: .leading, spacing: 10) {
          HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 4) {
              Eyebrow(text: "Caregiver", palette: palette)
              HeroTitle(text: caregiverPersonText(caregiver, includeRelation: true), palette: palette, size: 18)
            }
            Spacer()
            StatusChip(text: caregiver.statusText, color: accent)
          }

          VStack(alignment: .leading, spacing: 7) {
            ForEach(Array(caregiver.items.prefix(3).enumerated()), id: \.offset) { _, item in
              HStack(spacing: 8) {
                AccentBar(color: toneColor(item.tone, palette: palette))
                Text(item.text)
                  .font(.system(size: 13, weight: item.tone == "red" ? .semibold : .regular))
                  .foregroundStyle(toneColor(item.tone == "muted" ? "blue" : item.tone, palette: palette))
                  .lineLimit(1)
                  .minimumScaleFactor(0.8)
              }
            }
            if caregiver.items.isEmpty {
              Text(caregiver.secondaryText ?? "All caught up")
                .font(.system(size: 13, weight: .regular))
                .foregroundStyle(palette.muted)
            }
          }

          Spacer(minLength: 0)

          HStack(spacing: 8) {
            Link(destination: SynapseWidgetDestination.caregiverActionURL(mode: "log-med")) {
              ActionCapsule(title: "Log Med", color: palette.blue, compact: true)
            }
            .buttonStyle(.plain)
            Link(destination: SynapseWidgetDestination.caregiverActionURL(mode: "add-note")) {
              ActionCapsule(title: "Add Note", color: palette.green.opacity(0.85), compact: true)
            }
            .buttonStyle(.plain)
          }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
      } else {
        VStack(alignment: .leading, spacing: 7) {
          Eyebrow(text: caregiverPersonText(caregiver, includeRelation: false), palette: palette)
          HeroTitle(text: caregiver.primaryText, palette: palette, size: 16)
          StatusChip(text: caregiver.statusText, color: accent, compact: true)
          ForEach(Array(caregiver.items.prefix(2).enumerated()), id: \.offset) { _, item in
            HStack(spacing: 6) {
              AccentBar(color: toneColor(item.tone, palette: palette))
              Text(item.text)
                .font(.system(size: 11, weight: .regular))
                .foregroundStyle(toneColor(item.tone == "muted" ? "blue" : item.tone, palette: palette))
                .lineLimit(1)
            }
          }
          Spacer(minLength: 0)
          if let action = caregiver.actionText {
            Text(action)
              .font(.system(size: 11, weight: .semibold))
              .foregroundStyle(palette.muted)
              .lineLimit(1)
          }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
      }
    }
  }
}

private struct MentalHealthWidgetView: View {
  let entry: SynapseProvider.Entry
  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    let palette = palette(for: entry.snapshot.appearance, colorScheme: colorScheme)
    let mental = entry.snapshot.mentalHealth

    WidgetCard(palette: palette) {
      HStack(alignment: .top, spacing: 8) {
        AccentBar(color: palette.purple)
        VStack(alignment: .leading, spacing: 7) {
          Eyebrow(text: "Mental health", palette: palette)
          HeroTitle(text: mental.active ? "Support day" : "Start support", palette: palette, size: 16)
          StatusChip(
            text: mental.active ? "Active" : "Available",
            color: palette.purple,
            compact: true
          )
          Text(mental.statusText)
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(palette.purple)
            .lineLimit(2)
          Spacer(minLength: 0)
          Text("Next check-in")
            .font(.system(size: 10, weight: .semibold))
            .foregroundStyle(palette.muted)
          Text(mental.nextCheckInText)
            .font(.system(size: 13, weight: .bold))
            .foregroundStyle(palette.ink)
            .lineLimit(1)
            .minimumScaleFactor(0.85)
        }
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
  }
}

private struct LabsWidgetView: View {
  let entry: SynapseProvider.Entry
  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    let palette = palette(for: entry.snapshot.appearance, colorScheme: colorScheme)
    let labs = entry.snapshot.labs
    let accent = toneColor(labs.tone, palette: palette)

    WidgetCard(palette: palette) {
      HStack(alignment: .top, spacing: 12) {
        VStack(alignment: .leading, spacing: 8) {
          Eyebrow(text: labs.title, palette: palette)
          HeroTitle(text: labs.statusText, palette: palette, size: 20)
          StatusChip(text: labs.hasItems ? "On file" : "Empty", color: accent, compact: true)
          Spacer(minLength: 0)
          Text(labs.nextAction)
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(accent)
            .lineLimit(2)
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)

        VStack(alignment: .leading, spacing: 6) {
          ForEach(Array(labs.items.prefix(3).enumerated()), id: \.offset) { _, item in
            SoftCard(palette: palette) {
              VStack(alignment: .leading, spacing: 2) {
                Text(item.name)
                  .font(.system(size: 12, weight: .semibold))
                  .foregroundStyle(palette.ink)
                  .lineLimit(1)
                Text(item.detail)
                  .font(.system(size: 10, weight: .regular))
                  .foregroundStyle(item.pending ? palette.orange : palette.muted)
                  .lineLimit(1)
              }
            }
          }
          if labs.items.isEmpty {
            SoftCard(palette: palette) {
              Text("No results yet")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(palette.muted)
            }
          }
        }
        .frame(maxWidth: .infinity)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
  }
}

private struct ReportWidgetView: View {
  let entry: SynapseProvider.Entry
  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    let palette = palette(for: entry.snapshot.appearance, colorScheme: colorScheme)
    let report = entry.snapshot.report14Day
    let accent = toneColor(report.tone, palette: palette)

    WidgetCard(palette: palette) {
      VStack(alignment: .leading, spacing: 12) {
        HStack(alignment: .firstTextBaseline) {
          VStack(alignment: .leading, spacing: 4) {
            Eyebrow(text: "14-day report", palette: palette)
            HeroTitle(text: report.statusLabel, palette: palette, size: 26)
          }
          Spacer()
          StatusChip(text: report.adherenceText, color: accent)
        }

        SoftCard(palette: palette) {
          Text(report.summaryText)
            .font(.system(size: 15, weight: .medium))
            .foregroundStyle(palette.ink)
            .lineLimit(3)
        }

        VStack(alignment: .leading, spacing: 8) {
          ForEach(Array(report.insights.prefix(2).enumerated()), id: \.offset) { _, insight in
            HStack(alignment: .top, spacing: 8) {
              AccentBar(color: accent)
              Text(insight)
                .font(.system(size: 13, weight: .regular))
                .foregroundStyle(palette.ink)
                .lineLimit(2)
            }
          }
          if report.insights.isEmpty {
            Text("Open Synapse for the full pattern view.")
              .font(.system(size: 13, weight: .regular))
              .foregroundStyle(palette.muted)
          }
        }

        Spacer(minLength: 0)
        Text(report.nextAction)
          .font(.system(size: 13, weight: .semibold))
          .foregroundStyle(accent)
          .lineLimit(1)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
  }
}

private struct OverviewWidgetView: View {
  let entry: SynapseProvider.Entry
  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    let palette = palette(for: entry.snapshot.appearance, colorScheme: colorScheme)
    let medication = entry.snapshot.medication
    let appointment = entry.snapshot.appointment

    WidgetCard(palette: palette) {
      HStack(spacing: 14) {
        Link(destination: SynapseWidgetDestination.url(for: "medications")) {
          VStack(alignment: .leading, spacing: 7) {
            Eyebrow(text: "Meds", palette: palette)
            if let medication {
              HeroTitle(text: medication.name, palette: palette, size: 17)
              Text(medication.detail)
                .font(.system(size: 12, weight: .regular))
                .foregroundStyle(palette.muted)
                .lineLimit(1)
              if medication.isTaken {
                StatusChip(text: medication.dueText, color: palette.green, compact: true)
              } else {
                Text(compactRelativeMedicationText(medication.dueAt))
                  .font(.system(size: 12, weight: .semibold))
                  .foregroundStyle(palette.orange)
                  .lineLimit(1)
              }
            } else {
              HeroTitle(text: "No dose due", palette: palette, size: 16)
              Text("Stay on track")
                .font(.system(size: 12, weight: .regular))
                .foregroundStyle(palette.muted)
            }
            Spacer(minLength: 0)
          }
          .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
          .contentShape(Rectangle())
        }
        .buttonStyle(.plain)

        Rectangle()
          .fill(palette.line)
          .frame(width: 1)
          .padding(.vertical, 2)

        Link(destination: SynapseWidgetDestination.url(for: "appointments")) {
          VStack(alignment: .leading, spacing: 7) {
            Eyebrow(text: "Visit", palette: palette)
            if let appointment {
              HeroTitle(text: appointment.doctorName, palette: palette, size: 17)
              Text(appointment.detail)
                .font(.system(size: 12, weight: .regular))
                .foregroundStyle(palette.muted)
                .lineLimit(1)
              Text(appointment.whenText)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(palette.blue)
                .lineLimit(1)
              Text(appointment.prepHint)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(palette.muted)
                .lineLimit(2)
            } else {
              HeroTitle(text: "No visit soon", palette: palette, size: 16)
              Text("Add one in Synapse")
                .font(.system(size: 12, weight: .regular))
                .foregroundStyle(palette.muted)
            }
            Spacer(minLength: 0)
          }
          .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
          .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
      }
    }
  }
}

// MARK: - Widget definitions

struct SynapseRecoveryWidget: Widget {
  let kind = "SynapseRecoveryWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SynapseProvider()) { entry in
      RecoveryWidgetView(entry: entry)
        .widgetURL(SynapseWidgetDestination.url(for: "sickmode"))
    }
    .configurationDisplayName("Recovery Today")
    .description("See your recovery focus and next gentle step.")
    .supportedFamilies([.systemSmall, .systemMedium])
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

struct SynapsePrnMedicationWidget: Widget {
  let kind = "SynapsePrnMedicationWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SynapseProvider()) { entry in
      PrnMedicationWidgetView(entry: entry)
    }
    .configurationDisplayName("As Needed")
    .description("Log an as-needed medication from your Home Screen.")
    .supportedFamilies([.systemSmall])
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

struct SynapsePainWidget: Widget {
  let kind = "SynapsePainWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SynapseProvider()) { entry in
      PainWidgetView(entry: entry)
        .widgetURL(SynapseWidgetDestination.url(for: "symptoms"))
    }
    .configurationDisplayName("Pain")
    .description("See today’s pain status and open Symptoms.")
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
    .configurationDisplayName("Sick Mode")
    .description("Temperature, stress-dose status, and next check-in.")
    .supportedFamilies([.systemSmall, .systemMedium])
    .contentMarginsDisabled()
  }
}

struct SynapseWellnessWidget: Widget {
  let kind = "SynapseWellnessWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SynapseProvider()) { entry in
      DailyLogWidgetView(entry: entry)
        .widgetURL(SynapseWidgetDestination.url(for: "daily-log"))
    }
    .configurationDisplayName("Daily Log")
    .description("Overall wellness and next actions for today.")
    .supportedFamilies([.systemMedium, .systemLarge])
    .contentMarginsDisabled()
  }
}

struct SynapseMedicationDayWidget: Widget {
  let kind = "SynapseMedicationDayWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SynapseProvider()) { entry in
      MedicationDayWidgetView(entry: entry)
        .widgetURL(SynapseWidgetDestination.url(for: "medications"))
    }
    .configurationDisplayName("Medication Day")
    .description("See today’s scheduled doses and what’s left.")
    .supportedFamilies([.systemLarge])
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
    .configurationDisplayName("Appointment Prep")
    .description("Next visit with location, notes, and prep hint.")
    .supportedFamilies([.systemSmall, .systemMedium])
    .contentMarginsDisabled()
  }
}

struct SynapseCaregiverWidget: Widget {
  let kind = "SynapseCaregiverWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SynapseProvider()) { entry in
      CaregiverWidgetView(entry: entry)
        .widgetURL(SynapseWidgetDestination.url(for: "caregiverdashboard"))
    }
    .configurationDisplayName("Caregiver")
    .description("Status for the person you support—without the clutter.")
    .supportedFamilies([.systemSmall, .systemMedium])
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
    .configurationDisplayName("Mental Health")
    .description("Start or check a mental health day and next check-in.")
    .supportedFamilies([.systemSmall])
    .contentMarginsDisabled()
  }
}

struct SynapseLabsWidget: Widget {
  let kind = "SynapseLabsWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SynapseProvider()) { entry in
      LabsWidgetView(entry: entry)
        .widgetURL(SynapseWidgetDestination.url(for: "labwork"))
    }
    .configurationDisplayName("Labs")
    .description("Pending reviews and latest lab results.")
    .supportedFamilies([.systemMedium])
    .contentMarginsDisabled()
  }
}

struct SynapseReportWidget: Widget {
  let kind = "SynapseReportWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SynapseProvider()) { entry in
      ReportWidgetView(entry: entry)
        .widgetURL(SynapseWidgetDestination.url(for: "reports"))
    }
    .configurationDisplayName("14-Day Report")
    .description("Trend summary, adherence, and top insights.")
    .supportedFamilies([.systemLarge])
    .contentMarginsDisabled()
  }
}

struct SynapseOverviewWidget: Widget {
  let kind = "SynapseOverviewWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SynapseProvider()) { entry in
      OverviewWidgetView(entry: entry)
    }
    .configurationDisplayName("Synapse Overview")
    .description("Next medication and next appointment side by side.")
    .supportedFamilies([.systemMedium])
    .contentMarginsDisabled()
  }
}
