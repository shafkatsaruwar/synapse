import SwiftUI
import WidgetKit

// MARK: - Deep links

private enum SynapseWidgetDestination {
  static func url(for screen: String, extras: [String: String] = [:]) -> URL {
    var components = URLComponents(string: "myapp:///")!
    var items = [URLQueryItem(name: "widgetTarget", value: screen)]
    for (key, value) in extras {
      items.append(URLQueryItem(name: key, value: value))
    }
    components.queryItems = items
    return components.url!
  }

  static func nextDoseURL(medicationId: String?, doseIndex: Int?) -> URL {
    var extras: [String: String] = [:]
    if let medicationId, !medicationId.isEmpty { extras["medId"] = medicationId }
    if let doseIndex { extras["doseIndex"] = String(doseIndex) }
    return url(for: "medications", extras: extras)
  }

  static func appointmentURL(appointmentId: String?) -> URL {
    var extras: [String: String] = [:]
    if let appointmentId, !appointmentId.isEmpty { extras["appointmentId"] = appointmentId }
    return url(for: "appointments", extras: extras)
  }

  static func caregiverActionURL(mode: String) -> URL {
    url(for: "caregiverdashboard", extras: ["mode": mode])
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

// MARK: - Snapshot model (v1 + v2 compatible)

private struct SynapseWidgetSnapshot: Codable {
  let schemaVersion: Int
  let appearance: String
  let medication: Medication?
  let appointment: Appointment?
  let myDay: MyDay?
  let sickMode: SickMode
  let caregiver: Caregiver
  let updatedAt: Date?

  // Legacy slices retained so installed widgets keep decoding.
  let prnMedication: PrnMedication?
  let hydration: Hydration
  let recovery: Recovery
  let pain: Pain
  let sleep: Sleep
  let wellness: Wellness
  let flareForecast: FlareForecast
  let medicationDay: MedicationDay
  let labs: Labs
  let report14Day: Report14Day
  let mentalHealth: MentalHealth

  enum CodingKeys: String, CodingKey {
    case schemaVersion, appearance, medication, appointment, myDay, sickMode, caregiver, updatedAt
    case prnMedication, hydration, recovery, pain, sleep, wellness, flareForecast
    case medicationDay, labs, report14Day, mentalHealth
  }

  init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    schemaVersion = try c.decodeIfPresent(Int.self, forKey: .schemaVersion) ?? 1
    appearance = try c.decodeIfPresent(String.self, forKey: .appearance) ?? "system"
    medication = try c.decodeIfPresent(Medication.self, forKey: .medication)
    appointment = try c.decodeIfPresent(Appointment.self, forKey: .appointment)
    myDay = try c.decodeIfPresent(MyDay.self, forKey: .myDay)
    sickMode = try c.decodeIfPresent(SickMode.self, forKey: .sickMode) ?? .inactive
    caregiver = try c.decodeIfPresent(Caregiver.self, forKey: .caregiver) ?? .placeholder
    updatedAt = try c.decodeIfPresent(Date.self, forKey: .updatedAt)
    prnMedication = try c.decodeIfPresent(PrnMedication.self, forKey: .prnMedication)
    hydration = try c.decodeIfPresent(Hydration.self, forKey: .hydration) ?? .empty
    recovery = try c.decodeIfPresent(Recovery.self, forKey: .recovery) ?? .empty
    pain = try c.decodeIfPresent(Pain.self, forKey: .pain) ?? .empty
    sleep = try c.decodeIfPresent(Sleep.self, forKey: .sleep) ?? .empty
    wellness = try c.decodeIfPresent(Wellness.self, forKey: .wellness) ?? .empty
    flareForecast = try c.decodeIfPresent(FlareForecast.self, forKey: .flareForecast) ?? .empty
    medicationDay = try c.decodeIfPresent(MedicationDay.self, forKey: .medicationDay) ?? .empty
    labs = try c.decodeIfPresent(Labs.self, forKey: .labs) ?? .empty
    report14Day = try c.decodeIfPresent(Report14Day.self, forKey: .report14Day) ?? .empty
    mentalHealth = try c.decodeIfPresent(MentalHealth.self, forKey: .mentalHealth) ?? .empty
  }

  struct Medication: Codable {
    let id: String?
    let doseIndex: Int?
    let name: String
    let detail: String
    let dueAt: Date?
    let windowStart: Date?
    let dueText: String
    let isTaken: Bool
    let isOverdue: Bool
    let emptyKind: String?
    let nextText: String?
    let followingName: String?
    let followingDetail: String?
    let followingTimeText: String?
    let heroTimeText: String
    let statusLabel: String
    let secondaryLine: String
    let tone: String

    enum CodingKeys: String, CodingKey {
      case id, doseIndex, name, detail, dueAt, windowStart, dueText, isTaken, isOverdue, emptyKind
      case nextText, followingName, followingDetail, followingTimeText
      case heroTimeText, statusLabel, secondaryLine, tone
    }

    init(from decoder: Decoder) throws {
      let c = try decoder.container(keyedBy: CodingKeys.self)
      id = try c.decodeIfPresent(String.self, forKey: .id)
      doseIndex = try c.decodeIfPresent(Int.self, forKey: .doseIndex)
      name = try c.decode(String.self, forKey: .name)
      detail = try c.decode(String.self, forKey: .detail)
      dueAt = try c.decodeIfPresent(Date.self, forKey: .dueAt)
      windowStart = try c.decodeIfPresent(Date.self, forKey: .windowStart)
      dueText = try c.decode(String.self, forKey: .dueText)
      isTaken = try c.decode(Bool.self, forKey: .isTaken)
      isOverdue = try c.decodeIfPresent(Bool.self, forKey: .isOverdue) ?? false
      emptyKind = try c.decodeIfPresent(String.self, forKey: .emptyKind)
      nextText = try c.decodeIfPresent(String.self, forKey: .nextText)
      followingName = try c.decodeIfPresent(String.self, forKey: .followingName)
      followingDetail = try c.decodeIfPresent(String.self, forKey: .followingDetail)
      followingTimeText = try c.decodeIfPresent(String.self, forKey: .followingTimeText)
      let taken = isTaken
      heroTimeText = try c.decodeIfPresent(String.self, forKey: .heroTimeText)
        ?? (taken ? "Done" : Self.formatTime(dueAt) ?? "Soon")
      statusLabel = try c.decodeIfPresent(String.self, forKey: .statusLabel) ?? (taken ? "Done" : "Next")
      secondaryLine = try c.decodeIfPresent(String.self, forKey: .secondaryLine)
        ?? (taken ? (nextText ?? "all set") : "dose due soon")
      tone = try c.decodeIfPresent(String.self, forKey: .tone) ?? "green"
    }

    private static func formatTime(_ date: Date?) -> String? {
      guard let date else { return nil }
      let formatter = DateFormatter()
      formatter.dateFormat = "h:mm a"
      return formatter.string(from: date)
    }
  }

  struct Appointment: Codable {
    let id: String?
    let doctorName: String
    let detail: String
    let startsAt: Date?
    let whenText: String
    let travelText: String?
    let location: String?
    let notes: String?
    let prepHint: String
    let statusLabel: String
    let tone: String
    let headline: String
    let supportText: String

    enum CodingKeys: String, CodingKey {
      case id, doctorName, detail, startsAt, whenText, travelText, location, notes, prepHint
      case statusLabel, tone, headline, supportText
    }

    init(from decoder: Decoder) throws {
      let c = try decoder.container(keyedBy: CodingKeys.self)
      id = try c.decodeIfPresent(String.self, forKey: .id)
      doctorName = try c.decode(String.self, forKey: .doctorName)
      detail = try c.decode(String.self, forKey: .detail)
      startsAt = try c.decodeIfPresent(Date.self, forKey: .startsAt)
      whenText = try c.decode(String.self, forKey: .whenText)
      travelText = try c.decodeIfPresent(String.self, forKey: .travelText)
      location = try c.decodeIfPresent(String.self, forKey: .location)
      notes = try c.decodeIfPresent(String.self, forKey: .notes)
      prepHint = try c.decodeIfPresent(String.self, forKey: .prepHint) ?? "Open Synapse"
      statusLabel = try c.decodeIfPresent(String.self, forKey: .statusLabel) ?? "Ready"
      tone = try c.decodeIfPresent(String.self, forKey: .tone) ?? "green"
      headline = try c.decodeIfPresent(String.self, forKey: .headline) ?? doctorName
      supportText = try c.decodeIfPresent(String.self, forKey: .supportText) ?? prepHint
    }
  }

  struct MyDay: Codable {
    let dateLabel: String
    let medicationLine: String?
    let appointmentLine: String?
    let attentionLine: String?
    let quietSummary: String
  }

  struct SickMode: Codable {
    let active: Bool
    let recoveryMode: Bool
    let latestTemperature: Double?
    let latestTemperatureText: String
    let statusText: String
    let statusLabel: String
    let heroAction: String
    let nextStep: String
    let inactiveSupport: String
    let tone: String
    let needsStressDose: Bool
    let stressDoseText: String
    let checkInTimer: String?
    let checkInDueAt: Date?

    enum CodingKeys: String, CodingKey {
      case active, recoveryMode, latestTemperature, latestTemperatureText, statusText, statusLabel
      case heroAction, nextStep, inactiveSupport, tone, needsStressDose, stressDoseText, checkInTimer, checkInDueAt
    }

    init(from decoder: Decoder) throws {
      let c = try decoder.container(keyedBy: CodingKeys.self)
      active = try c.decode(Bool.self, forKey: .active)
      recoveryMode = try c.decodeIfPresent(Bool.self, forKey: .recoveryMode) ?? false
      latestTemperature = try c.decodeIfPresent(Double.self, forKey: .latestTemperature)
      latestTemperatureText = try c.decodeIfPresent(String.self, forKey: .latestTemperatureText) ?? "No temp logged"
      statusText = try c.decode(String.self, forKey: .statusText)
      statusLabel = try c.decodeIfPresent(String.self, forKey: .statusLabel) ?? (active ? "Active" : "Off")
      heroAction = try c.decodeIfPresent(String.self, forKey: .heroAction) ?? (active ? "Sick Mode Active" : "Open Sick Mode")
      nextStep = try c.decodeIfPresent(String.self, forKey: .nextStep) ?? statusText
      inactiveSupport = try c.decodeIfPresent(String.self, forKey: .inactiveSupport) ?? "Extra support when you need it."
      tone = try c.decodeIfPresent(String.self, forKey: .tone) ?? "muted"
      needsStressDose = try c.decodeIfPresent(Bool.self, forKey: .needsStressDose) ?? false
      stressDoseText = try c.decodeIfPresent(String.self, forKey: .stressDoseText) ?? ""
      checkInTimer = try c.decodeIfPresent(String.self, forKey: .checkInTimer)
      if let due = try? c.decodeIfPresent(Date.self, forKey: .checkInDueAt) {
        checkInDueAt = due
      } else if let raw = try c.decodeIfPresent(String.self, forKey: .checkInDueAt) {
        checkInDueAt = SynapseWidgetStore.iso8601WithFractionalSeconds.date(from: raw)
          ?? SynapseWidgetStore.iso8601.date(from: raw)
      } else {
        checkInDueAt = nil
      }
    }

    static let inactive = SickMode(
      active: false, recoveryMode: false, latestTemperature: nil,
      latestTemperatureText: "No temp logged", statusText: "Extra support when you need it.",
      statusLabel: "Off", heroAction: "Open Sick Mode", nextStep: "Extra support when you need it.",
      inactiveSupport: "Extra support when you need it.", tone: "muted", needsStressDose: false,
      stressDoseText: "", checkInTimer: nil, checkInDueAt: nil
    )

    init(
      active: Bool, recoveryMode: Bool, latestTemperature: Double?, latestTemperatureText: String,
      statusText: String, statusLabel: String, heroAction: String, nextStep: String,
      inactiveSupport: String, tone: String, needsStressDose: Bool, stressDoseText: String,
      checkInTimer: String?, checkInDueAt: Date?
    ) {
      self.active = active; self.recoveryMode = recoveryMode; self.latestTemperature = latestTemperature
      self.latestTemperatureText = latestTemperatureText; self.statusText = statusText
      self.statusLabel = statusLabel; self.heroAction = heroAction; self.nextStep = nextStep
      self.inactiveSupport = inactiveSupport; self.tone = tone; self.needsStressDose = needsStressDose
      self.stressDoseText = stressDoseText; self.checkInTimer = checkInTimer; self.checkInDueAt = checkInDueAt
    }
  }

  struct Caregiver: Codable {
    struct Item: Codable {
      let kind: String
      let text: String
      let tone: String
    }
    let hasProfile: Bool
    let name: String
    let status: String
    let statusText: String
    let statusLabel: String
    let tone: String
    let primaryText: String
    let secondaryText: String?
    let headline: String
    let items: [Item]
    let missedCount: Int

    enum CodingKeys: String, CodingKey {
      case hasProfile, name, status, statusText, statusLabel, tone, primaryText, secondaryText, headline, items, missedCount
    }

    init(from decoder: Decoder) throws {
      let c = try decoder.container(keyedBy: CodingKeys.self)
      hasProfile = try c.decode(Bool.self, forKey: .hasProfile)
      name = try c.decode(String.self, forKey: .name)
      let decodedStatus = try c.decode(String.self, forKey: .status)
      status = decodedStatus == "needs_attention" ? "attention" : decodedStatus
      statusText = try c.decode(String.self, forKey: .statusText)
      tone = try c.decode(String.self, forKey: .tone)
      primaryText = try c.decode(String.self, forKey: .primaryText)
      secondaryText = try c.decodeIfPresent(String.self, forKey: .secondaryText)
      if let decodedItems = try? c.decode([Item].self, forKey: .items) {
        items = decodedItems
      } else {
        items = []
      }
      missedCount = try c.decodeIfPresent(Int.self, forKey: .missedCount) ?? 0
      statusLabel = try c.decodeIfPresent(String.self, forKey: .statusLabel) ?? "Check"
      headline = try c.decodeIfPresent(String.self, forKey: .headline) ?? primaryText
    }

    init(
      hasProfile: Bool, name: String, status: String, statusText: String, statusLabel: String,
      tone: String, primaryText: String, secondaryText: String?, headline: String, items: [Item], missedCount: Int
    ) {
      self.hasProfile = hasProfile; self.name = name; self.status = status; self.statusText = statusText
      self.statusLabel = statusLabel; self.tone = tone; self.primaryText = primaryText
      self.secondaryText = secondaryText; self.headline = headline; self.items = items; self.missedCount = missedCount
    }

    static let placeholder = Caregiver(
      hasProfile: false, name: "Care Circle", status: "attention", statusText: "Not linked",
      statusLabel: "Setup", tone: "muted", primaryText: "Link a person in Synapse",
      secondaryText: nil, headline: "Privacy first", items: [], missedCount: 0
    )
  }

  // Minimal legacy models for installed widgets
  struct PrnMedication: Codable {
    let id: String
    let name: String
    let detail: String
    let statusText: String
    let statusLabel: String
    let tone: String
  }
  struct Hydration: Codable {
    let totalTodayText: String
    let statusLabel: String
    let tone: String
    let secondaryLine: String
    static let empty = Hydration(totalTodayText: "—", statusLabel: "Low", tone: "muted", secondaryLine: "Open Synapse")
  }
  struct Recovery: Codable {
    let active: Bool
    let headline: String
    let supportText: String
    let statusLabel: String
    let tone: String
    static let empty = Recovery(active: false, headline: "Recovery", supportText: "Open Synapse", statusLabel: "Off", tone: "muted")
  }
  struct Pain: Codable {
    let statusText: String
    let statusLabel: String
    let tone: String
    static let empty = Pain(statusText: "No pain logged", statusLabel: "Calm", tone: "muted")
  }
  struct Sleep: Codable {
    let heroText: String
    let statusLabel: String
    let tone: String
    let primaryLine: String
    static let empty = Sleep(heroText: "—", statusLabel: "OK", tone: "muted", primaryLine: "Open Synapse")
  }
  struct Wellness: Codable {
    let headline: String
    let summaryText: String
    let statusLabel: String
    let tone: String
    static let empty = Wellness(headline: "Daily Log", summaryText: "Open Synapse", statusLabel: "Open", tone: "muted")
  }
  struct FlareForecast: Codable {
    let headline: String
    let supportText: String
    let statusLabel: String
    let tone: String
    static let empty = FlareForecast(headline: "Patterns", supportText: "Open Synapse", statusLabel: "Calm", tone: "muted")
  }
  struct MedicationDay: Codable {
    let summaryText: String
    let statusLabel: String
    let tone: String
    let headline: String
    static let empty = MedicationDay(summaryText: "—", statusLabel: "Quiet", tone: "muted", headline: "Medications")
  }
  struct Labs: Codable {
    let title: String
    let statusText: String
    let statusLabel: String
    let tone: String
    static let empty = Labs(title: "Labs", statusText: "Open Synapse", statusLabel: "Empty", tone: "muted")
  }
  struct Report14Day: Codable {
    let summaryText: String
    let statusLabel: String
    let tone: String
    let headline: String
    static let empty = Report14Day(summaryText: "Open Synapse", statusLabel: "Steady", tone: "muted", headline: "Report")
  }
  struct MentalHealth: Codable {
    let active: Bool
    let headline: String
    let supportText: String
    let statusLabel: String
    let tone: String
    static let empty = MentalHealth(active: false, headline: "Mental Health", supportText: "Open Synapse", statusLabel: "Open", tone: "muted")
  }

  static let placeholder = SynapseWidgetSnapshot(
    schemaVersion: 2,
    appearance: "system",
    medication: nil,
    appointment: nil,
    myDay: MyDay(
      dateLabel: "Today",
      medicationLine: nil,
      appointmentLine: nil,
      attentionLine: nil,
      quietSummary: "Nothing needs your attention right now."
    ),
    sickMode: .inactive,
    caregiver: .placeholder,
    updatedAt: Date(),
    prnMedication: nil,
    hydration: .empty,
    recovery: .empty,
    pain: .empty,
    sleep: .empty,
    wellness: .empty,
    flareForecast: .empty,
    medicationDay: .empty,
    labs: .empty,
    report14Day: .empty,
    mentalHealth: .empty
  )

  init(
    schemaVersion: Int, appearance: String, medication: Medication?, appointment: Appointment?,
    myDay: MyDay?, sickMode: SickMode, caregiver: Caregiver, updatedAt: Date?,
    prnMedication: PrnMedication?, hydration: Hydration, recovery: Recovery, pain: Pain,
    sleep: Sleep, wellness: Wellness, flareForecast: FlareForecast, medicationDay: MedicationDay,
    labs: Labs, report14Day: Report14Day, mentalHealth: MentalHealth
  ) {
    self.schemaVersion = schemaVersion; self.appearance = appearance; self.medication = medication
    self.appointment = appointment; self.myDay = myDay; self.sickMode = sickMode
    self.caregiver = caregiver; self.updatedAt = updatedAt; self.prnMedication = prnMedication
    self.hydration = hydration; self.recovery = recovery; self.pain = pain; self.sleep = sleep
    self.wellness = wellness; self.flareForecast = flareForecast; self.medicationDay = medicationDay
    self.labs = labs; self.report14Day = report14Day; self.mentalHealth = mentalHealth
  }
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
    var dates: [Date] = [Date()]
    if let due = snapshot.medication?.dueAt, due > Date() {
      dates.append(due.addingTimeInterval(1))
    }
    if let start = snapshot.appointment?.startsAt, start > Date() {
      dates.append(start.addingTimeInterval(1))
    }
    if let checkIn = snapshot.sickMode.checkInDueAt, checkIn > Date() {
      dates.append(checkIn.addingTimeInterval(1))
    }
    // Day boundary
    let calendar = Calendar.current
    if let tomorrow = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: Date())) {
      dates.append(tomorrow.addingTimeInterval(60))
    }
    let unique = Array(Set(dates)).sorted()
    let entries = unique.prefix(5).map { SynapseWidgetEntry(date: $0, snapshot: snapshot) }
    let refresh = unique.dropFirst().first ?? Date().addingTimeInterval(60 * 30)
    completion(Timeline(entries: Array(entries), policy: .after(refresh)))
  }
}

// MARK: - Palette (matches app appearance: system / calm / light / dark)

private struct SynapseWidgetPalette {
  let background: Color
  let surface: Color
  let ink: Color
  let muted: Color
  let accent: Color
  let green: Color
  let orange: Color
  let line: Color

  /// Soft Evergreen light tokens from the app theme (`themes/evergreen.ts`).
  static let light = SynapseWidgetPalette(
    background: Color(red: 0.969, green: 0.973, blue: 0.980), // #F7F8FA
    surface: Color.black.opacity(0.04),
    ink: Color(red: 0.125, green: 0.145, blue: 0.165), // #20252A
    muted: Color(red: 0.384, green: 0.420, blue: 0.447), // #626B72
    accent: Color(red: 0.278, green: 0.478, blue: 0.439), // #477A70
    green: Color(red: 0.184, green: 0.435, blue: 0.306), // #2F6F4E
    orange: Color(red: 0.769, green: 0.416, blue: 0.106), // #C46A1B
    line: Color.black.opacity(0.08)
  )

  static let calm = SynapseWidgetPalette(
    background: Color(red: 0.961, green: 0.925, blue: 0.886),
    surface: Color.white.opacity(0.44),
    ink: Color(red: 0.10, green: 0.10, blue: 0.10),
    muted: Color(red: 0.404, green: 0.322, blue: 0.282),
    accent: Color(red: 0.64, green: 0.05, blue: 0.14),
    green: Color(red: 0.176, green: 0.490, blue: 0.275),
    orange: Color(red: 0.80, green: 0.40, blue: 0.0),
    line: Color.white.opacity(0.55)
  )

  static let dark = SynapseWidgetPalette(
    background: Color(red: 0.10, green: 0.11, blue: 0.13),
    surface: Color.white.opacity(0.08),
    ink: Color.white.opacity(0.96),
    muted: Color.white.opacity(0.62),
    accent: Color(red: 0.95, green: 0.45, blue: 0.50),
    green: Color(red: 0.40, green: 0.84, blue: 0.58),
    orange: Color(red: 1.0, green: 0.62, blue: 0.28),
    line: Color.white.opacity(0.12)
  )
}

private func palette(for appearance: String, colorScheme: ColorScheme) -> SynapseWidgetPalette {
  switch appearance {
  case "light": return .light
  case "calm": return .calm
  case "dark": return .dark
  default: return colorScheme == .dark ? .dark : .light
  }
}

// MARK: - Shared chrome

private struct WidgetShell<Content: View>: View {
  let appearance: String
  @Environment(\.colorScheme) private var colorScheme
  @ViewBuilder var content: () -> Content

  var body: some View {
    let p = palette(for: appearance, colorScheme: colorScheme)
    if #available(iOSApplicationExtension 17.0, *) {
      content()
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .containerBackground(for: .widget) { p.background }
    } else {
      content()
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(p.background)
    }
  }
}

private struct WidgetEyebrow: View {
  let text: String
  let palette: SynapseWidgetPalette
  var body: some View {
    Text(text)
      .font(.system(size: 11, weight: .semibold))
      .tracking(0.4)
      .foregroundStyle(palette.muted)
      .lineLimit(1)
      .accessibilityAddTraits(.isHeader)
  }
}

private struct WidgetPrimary: View {
  let text: String
  let palette: SynapseWidgetPalette
  var body: some View {
    Text(text)
      .font(.system(size: 20, weight: .bold))
      .foregroundStyle(palette.ink)
      .lineLimit(2)
      .minimumScaleFactor(0.8)
  }
}

private struct WidgetSecondary: View {
  let text: String
  let palette: SynapseWidgetPalette
  var body: some View {
    Text(text)
      .font(.system(size: 13, weight: .medium))
      .foregroundStyle(palette.muted)
      .lineLimit(2)
      .minimumScaleFactor(0.85)
  }
}

private struct LegacyOpenView: View {
  let title: String
  let bodyText: String
  let appearance: String
  @Environment(\.colorScheme) private var colorScheme
  var body: some View {
    let p = palette(for: appearance, colorScheme: colorScheme)
    WidgetShell(appearance: appearance) {
      VStack(alignment: .leading, spacing: 8) {
        WidgetEyebrow(text: title, palette: p)
        WidgetPrimary(text: bodyText, palette: p)
        Spacer(minLength: 0)
        WidgetSecondary(text: "Open Synapse", palette: p)
      }
    }
  }
}

// MARK: - Widgets 2.0 views

private struct NextDoseWidgetView: View {
  let entry: SynapseWidgetEntry
  @Environment(\.widgetFamily) private var family
  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    let snap = entry.snapshot
    let p = palette(for: snap.appearance, colorScheme: colorScheme)
    let med = snap.medication
    WidgetShell(appearance: snap.appearance) {
      VStack(alignment: .leading, spacing: family == .systemMedium ? 10 : 8) {
        HStack {
          WidgetEyebrow(text: "Next Dose", palette: p)
          Spacer(minLength: 4)
          if let label = med?.statusLabel {
            Text(label)
              .font(.system(size: 11, weight: .semibold))
              .foregroundStyle(med?.isOverdue == true ? p.orange : p.muted)
          }
        }
        if let med {
          WidgetPrimary(text: med.name, palette: p)
          if !med.detail.isEmpty {
            WidgetSecondary(text: med.detail, palette: p)
          }
          Text(med.heroTimeText)
            .font(.system(size: family == .systemMedium ? 28 : 24, weight: .bold))
            .foregroundStyle(med.isOverdue ? p.orange : p.ink)
            .accessibilityLabel("Scheduled time \(med.heroTimeText)")
          if family == .systemMedium {
            if let following = med.followingName, let time = med.followingTimeText {
              WidgetSecondary(text: "Then \(following) · \(time)", palette: p)
            } else if let next = med.nextText {
              WidgetSecondary(text: next, palette: p)
            }
            WidgetSecondary(text: "Tap to review and confirm", palette: p)
          } else if let line = med.secondaryLine.isEmpty ? nil : med.secondaryLine {
            WidgetSecondary(text: line, palette: p)
          }
        } else {
          WidgetPrimary(text: "No doses scheduled", palette: p)
          WidgetSecondary(text: "Open Synapse to add medications", palette: p)
        }
        Spacer(minLength: 0)
      }
    }
    .widgetURL(SynapseWidgetDestination.nextDoseURL(medicationId: med?.id, doseIndex: med?.doseIndex))
    .accessibilityElement(children: .combine)
  }
}

private struct MyDayWidgetView: View {
  let entry: SynapseWidgetEntry
  @Environment(\.widgetFamily) private var family
  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    let snap = entry.snapshot
    let p = palette(for: snap.appearance, colorScheme: colorScheme)
    let day = snap.myDay
    WidgetShell(appearance: snap.appearance) {
      VStack(alignment: .leading, spacing: 10) {
        WidgetEyebrow(text: "Today", palette: p)
        if family == .systemLarge, let date = day?.dateLabel {
          Text(date)
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(p.ink)
        }
        if let med = day?.medicationLine {
          dayRow(title: "Medication", value: med, palette: p)
        }
        if let appt = day?.appointmentLine {
          dayRow(title: "Appointment", value: appt, palette: p)
        }
        if let attention = day?.attentionLine {
          dayRow(title: "Attention", value: attention, palette: p)
        }
        if day?.medicationLine == nil && day?.appointmentLine == nil && day?.attentionLine == nil {
          WidgetPrimary(text: day?.quietSummary ?? "Nothing needs your attention right now.", palette: p)
          WidgetSecondary(text: "No appointments scheduled today.", palette: p)
        }
        if family == .systemLarge {
          Spacer(minLength: 4)
          // Multi-link interactivity requires iOS 17+; on iOS 15 the whole widget uses widgetURL.
          if #available(iOSApplicationExtension 17.0, *) {
            HStack(spacing: 16) {
              Link(destination: SynapseWidgetDestination.url(for: "medications")) {
                Text("Medications")
                  .font(.system(size: 13, weight: .semibold))
                  .foregroundStyle(p.accent)
              }
              Link(destination: SynapseWidgetDestination.url(for: "appointments")) {
                Text("Appointments")
                  .font(.system(size: 13, weight: .semibold))
                  .foregroundStyle(p.accent)
              }
            }
            .accessibilityElement(children: .contain)
          } else {
            WidgetSecondary(text: "Medications · Appointments", palette: p)
          }
        }
        Spacer(minLength: 0)
      }
    }
    .widgetURL(SynapseWidgetDestination.url(for: "myday"))
  }

  @ViewBuilder
  private func dayRow(title: String, value: String, palette: SynapseWidgetPalette) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(title)
        .font(.system(size: 11, weight: .semibold))
        .foregroundStyle(palette.muted)
      Text(value)
        .font(.system(size: 15, weight: .semibold))
        .foregroundStyle(palette.ink)
        .lineLimit(2)
        .minimumScaleFactor(0.85)
    }
    .accessibilityElement(children: .combine)
  }
}

private struct NextAppointmentWidgetView: View {
  let entry: SynapseWidgetEntry
  @Environment(\.widgetFamily) private var family
  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    let snap = entry.snapshot
    let p = palette(for: snap.appearance, colorScheme: colorScheme)
    let appt = snap.appointment
    WidgetShell(appearance: snap.appearance) {
      VStack(alignment: .leading, spacing: 8) {
        WidgetEyebrow(text: "Next Appointment", palette: p)
        if let appt {
          WidgetPrimary(text: appt.doctorName, palette: p)
          WidgetSecondary(text: appt.whenText, palette: p)
          if family == .systemMedium {
            if let location = appt.location, !location.isEmpty {
              WidgetSecondary(text: location, palette: p)
            }
            if let notes = appt.notes, !notes.isEmpty {
              WidgetSecondary(text: notes, palette: p)
            } else if let travel = appt.travelText, !travel.isEmpty {
              WidgetSecondary(text: travel, palette: p)
            }
          } else if let location = appt.location, !location.isEmpty {
            WidgetSecondary(text: location, palette: p)
          }
        } else {
          WidgetPrimary(text: "No upcoming appointments", palette: p)
          WidgetSecondary(text: "Open Appointments", palette: p)
        }
        Spacer(minLength: 0)
      }
    }
    .widgetURL(SynapseWidgetDestination.appointmentURL(appointmentId: appt?.id))
  }
}

private struct SickModeWidgetView: View {
  let entry: SynapseWidgetEntry
  @Environment(\.widgetFamily) private var family
  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    let snap = entry.snapshot
    let p = palette(for: snap.appearance, colorScheme: colorScheme)
    let sick = snap.sickMode
    WidgetShell(appearance: snap.appearance) {
      VStack(alignment: .leading, spacing: 8) {
        WidgetEyebrow(text: "Sick Mode", palette: p)
        if sick.active {
          WidgetPrimary(text: sick.recoveryMode ? "Recovering" : "Sick Mode Active", palette: p)
          if let timer = sick.checkInTimer, !sick.recoveryMode {
            Text("Next check-in: \(timer)")
              .font(.system(size: 15, weight: .semibold))
              .foregroundStyle(p.ink)
          }
          WidgetSecondary(text: sick.nextStep, palette: p)
          if family == .systemMedium {
            WidgetSecondary(text: sick.stressDoseText.isEmpty ? "Open your care plan in Synapse" : sick.stressDoseText, palette: p)
          }
        } else {
          WidgetPrimary(text: "Sick Mode", palette: p)
          WidgetSecondary(text: sick.inactiveSupport, palette: p)
        }
        Spacer(minLength: 0)
      }
    }
    .widgetURL(SynapseWidgetDestination.url(for: "sickmode"))
  }
}

private struct CareCircleWidgetView: View {
  let entry: SynapseWidgetEntry
  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    let snap = entry.snapshot
    let p = palette(for: snap.appearance, colorScheme: colorScheme)
    let care = snap.caregiver
    WidgetShell(appearance: snap.appearance) {
      VStack(alignment: .leading, spacing: 8) {
        WidgetEyebrow(text: "Care Circle", palette: p)
        if care.hasProfile {
          WidgetPrimary(text: care.name, palette: p)
          WidgetSecondary(text: care.primaryText, palette: p)
          if let secondary = care.secondaryText {
            WidgetSecondary(text: secondary, palette: p)
          }
          if let first = care.items.first {
            WidgetSecondary(text: first.text, palette: p)
          }
        } else {
          WidgetPrimary(text: "Care Circle", palette: p)
          WidgetSecondary(text: "Link a person in Synapse to review shared updates.", palette: p)
        }
        Spacer(minLength: 0)
      }
    }
    .widgetURL(SynapseWidgetDestination.url(for: "caregiverdashboard"))
  }
}

// MARK: - Legacy installed-widget shims (safe destinations)

private struct LegacyShimView: View {
  let title: String
  let detail: String
  let appearance: String
  var body: some View {
    LegacyOpenView(title: title, bodyText: detail, appearance: appearance)
  }
}

// MARK: - Widget definitions (preserve kind identifiers)

struct SynapseMedicationWidget: Widget {
  let kind = "SynapseMedicationWidget"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SynapseProvider()) { entry in
      NextDoseWidgetView(entry: entry)
    }
    .configurationDisplayName("Next Dose")
    .description("What medication is next — confirm in Synapse before recording.")
    .supportedFamilies([.systemSmall, .systemMedium])
    .contentMarginsDisabled()
  }
}

struct SynapseOverviewWidget: Widget {
  let kind = "SynapseOverviewWidget"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SynapseProvider()) { entry in
      MyDayWidgetView(entry: entry)
    }
    .configurationDisplayName("My Day")
    .description("What matters for your health today.")
    .supportedFamilies([.systemMedium, .systemLarge])
    .contentMarginsDisabled()
  }
}

struct SynapseAppointmentWidget: Widget {
  let kind = "SynapseAppointmentWidget"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SynapseProvider()) { entry in
      NextAppointmentWidgetView(entry: entry)
    }
    .configurationDisplayName("Next Appointment")
    .description("Where you need to be, and when.")
    .supportedFamilies([.systemSmall, .systemMedium])
    .contentMarginsDisabled()
  }
}

struct SynapseSickModeWidget: Widget {
  let kind = "SynapseSickModeWidget"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SynapseProvider()) { entry in
      SickModeWidgetView(entry: entry)
    }
    .configurationDisplayName("Sick Mode")
    .description("Calm support when you are unwell. Does not activate Sick Mode.")
    .supportedFamilies([.systemSmall, .systemMedium])
    .contentMarginsDisabled()
  }
}

struct SynapseCaregiverWidget: Widget {
  let kind = "SynapseCaregiverWidget"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SynapseProvider()) { entry in
      CareCircleWidgetView(entry: entry)
    }
    .configurationDisplayName("Care Circle")
    .description("Authorized caregiver updates that may need follow-up.")
    .supportedFamilies([.systemMedium])
    .contentMarginsDisabled()
  }
}

// Legacy kinds — keep registered so installed Home Screen widgets do not vanish.
struct SynapseRecoveryWidget: Widget {
  let kind = "SynapseRecoveryWidget"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SynapseProvider()) { entry in
      LegacyShimView(title: "Recovery", detail: entry.snapshot.recovery.headline, appearance: entry.snapshot.appearance)
        .widgetURL(SynapseWidgetDestination.url(for: "recovery"))
    }
    .configurationDisplayName("Recovery Today")
    .description("Legacy widget — opens Sick Mode without activating it.")
    .supportedFamilies([.systemMedium])
    .contentMarginsDisabled()
  }
}

struct SynapseHydrationWidget: Widget {
  let kind = "SynapseHydrationWidget"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SynapseProvider()) { entry in
      LegacyShimView(title: "Hydration", detail: entry.snapshot.hydration.totalTodayText, appearance: entry.snapshot.appearance)
        .widgetURL(SynapseWidgetDestination.url(for: "hydration"))
    }
    .configurationDisplayName("Hydration")
    .description("Legacy widget.")
    .supportedFamilies([.systemSmall])
    .contentMarginsDisabled()
  }
}

struct SynapsePrnMedicationWidget: Widget {
  let kind = "SynapsePrnMedicationWidget"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SynapseProvider()) { entry in
      let prn = entry.snapshot.prnMedication
      LegacyShimView(title: "As Needed", detail: prn?.name ?? "Open Medications", appearance: entry.snapshot.appearance)
        .widgetURL(SynapseWidgetDestination.nextDoseURL(medicationId: prn?.id, doseIndex: 0))
    }
    .configurationDisplayName("As Needed")
    .description("Legacy widget — opens confirmation; does not auto-log.")
    .supportedFamilies([.systemSmall])
    .contentMarginsDisabled()
  }
}

struct SynapsePainWidget: Widget {
  let kind = "SynapsePainWidget"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SynapseProvider()) { entry in
      LegacyShimView(title: "Pain", detail: entry.snapshot.pain.statusText, appearance: entry.snapshot.appearance)
        .widgetURL(SynapseWidgetDestination.url(for: "symptoms"))
    }
    .configurationDisplayName("Pain")
    .description("Legacy widget.")
    .supportedFamilies([.systemSmall])
    .contentMarginsDisabled()
  }
}

struct SynapseSleepWidget: Widget {
  let kind = "SynapseSleepWidget"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SynapseProvider()) { entry in
      LegacyShimView(title: "Sleep", detail: entry.snapshot.sleep.primaryLine, appearance: entry.snapshot.appearance)
        .widgetURL(SynapseWidgetDestination.url(for: "daily-log"))
    }
    .configurationDisplayName("Sleep")
    .description("Legacy widget.")
    .supportedFamilies([.systemSmall])
    .contentMarginsDisabled()
  }
}

struct SynapseFlareForecastWidget: Widget {
  let kind = "SynapseFlareForecastWidget"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SynapseProvider()) { entry in
      LegacyShimView(title: "Flare Forecast", detail: entry.snapshot.flareForecast.headline, appearance: entry.snapshot.appearance)
        .widgetURL(SynapseWidgetDestination.url(for: "reports"))
    }
    .configurationDisplayName("Flare Forecast")
    .description("Legacy widget.")
    .supportedFamilies([.systemMedium])
    .contentMarginsDisabled()
  }
}

struct SynapseWellnessWidget: Widget {
  let kind = "SynapseWellnessWidget"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SynapseProvider()) { entry in
      LegacyShimView(title: "Daily Log", detail: entry.snapshot.wellness.summaryText, appearance: entry.snapshot.appearance)
        .widgetURL(SynapseWidgetDestination.url(for: "daily-log"))
    }
    .configurationDisplayName("Daily Log")
    .description("Legacy widget.")
    .supportedFamilies([.systemLarge])
    .contentMarginsDisabled()
  }
}

struct SynapseMedicationDayWidget: Widget {
  let kind = "SynapseMedicationDayWidget"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SynapseProvider()) { entry in
      LegacyShimView(title: "Medication Day", detail: entry.snapshot.medicationDay.summaryText, appearance: entry.snapshot.appearance)
        .widgetURL(SynapseWidgetDestination.url(for: "medications"))
    }
    .configurationDisplayName("Medication Day")
    .description("Legacy widget.")
    .supportedFamilies([.systemLarge])
    .contentMarginsDisabled()
  }
}

struct SynapseMentalHealthWidget: Widget {
  let kind = "SynapseMentalHealthWidget"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SynapseProvider()) { entry in
      LegacyShimView(title: "Mental Health", detail: entry.snapshot.mentalHealth.headline, appearance: entry.snapshot.appearance)
        .widgetURL(SynapseWidgetDestination.url(for: "mentalhealth"))
    }
    .configurationDisplayName("Mental Health")
    .description("Legacy widget.")
    .supportedFamilies([.systemMedium])
    .contentMarginsDisabled()
  }
}

struct SynapseLabsWidget: Widget {
  let kind = "SynapseLabsWidget"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SynapseProvider()) { entry in
      LegacyShimView(title: "Labs", detail: entry.snapshot.labs.statusText, appearance: entry.snapshot.appearance)
        .widgetURL(SynapseWidgetDestination.url(for: "labwork"))
    }
    .configurationDisplayName("Labs")
    .description("Legacy widget.")
    .supportedFamilies([.systemMedium])
    .contentMarginsDisabled()
  }
}

struct SynapseReportWidget: Widget {
  let kind = "SynapseReportWidget"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SynapseProvider()) { entry in
      LegacyShimView(title: "14-Day Report", detail: entry.snapshot.report14Day.summaryText, appearance: entry.snapshot.appearance)
        .widgetURL(SynapseWidgetDestination.url(for: "reports"))
    }
    .configurationDisplayName("14-Day Report")
    .description("Legacy widget.")
    .supportedFamilies([.systemLarge])
    .contentMarginsDisabled()
  }
}
