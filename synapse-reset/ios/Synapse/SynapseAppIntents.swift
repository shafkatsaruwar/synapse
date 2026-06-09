import Foundation

#if canImport(AppIntents)
import AppIntents

@available(iOS 16.0, *)
private enum SynapseIntentQueue {
  static let suiteName = "group.com.mohammedsaruwar.synapse"
  static let key = "synapse_pending_app_intent_actions"

  static func enqueue(type: String, payload: [String: Any]) throws {
    guard let defaults = UserDefaults(suiteName: suiteName) else {
      throw SynapseIntentError.appGroupUnavailable
    }

    var actions = existingActions(from: defaults)
    actions.append([
      "id": UUID().uuidString,
      "type": type,
      "createdAt": ISO8601DateFormatter().string(from: Date()),
      "payload": payload,
    ])

    let data = try JSONSerialization.data(withJSONObject: actions, options: [])
    defaults.set(String(data: data, encoding: .utf8) ?? "[]", forKey: key)
  }

  private static func existingActions(from defaults: UserDefaults) -> [[String: Any]] {
    guard let raw = defaults.string(forKey: key),
      let data = raw.data(using: .utf8),
      let parsed = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]
    else {
      return []
    }
    return parsed
  }
}

@available(iOS 16.0, *)
private enum SynapseIntentError: Error, CustomLocalizedStringResourceConvertible {
  case appGroupUnavailable

  var localizedStringResource: LocalizedStringResource {
    switch self {
    case .appGroupUnavailable:
      return "Synapse could not access shared app storage."
    }
  }
}

@available(iOS 16.0, *)
struct LogMedicationIntent: AppIntent {
  static var title: LocalizedStringResource = "Log Medication"
  static var description = IntentDescription("Mark a Synapse medication as taken.")
  static var openAppWhenRun = false

  @Parameter(title: "Medication Name", requestValueDialog: "Which medication?")
  var medicationName: String

  init() {
    medicationName = ""
  }

  init(medicationName: String) {
    self.medicationName = medicationName
  }

  func perform() async throws -> some IntentResult {
    let name = medicationName.trimmingCharacters(in: .whitespacesAndNewlines)
    try SynapseIntentQueue.enqueue(
      type: "logMedication",
      payload: ["medicationName": name]
    )
    return .result(dialog: "Logged \(name.isEmpty ? "your medication" : name).")
  }
}

@available(iOS 16.0, *)
struct StartSickModeIntent: AppIntent {
  static var title: LocalizedStringResource = "Start Sick Mode"
  static var description = IntentDescription("Activate Sick Mode in Synapse.")
  static var openAppWhenRun = true

  func perform() async throws -> some IntentResult {
    try SynapseIntentQueue.enqueue(type: "startSickMode", payload: [:])
    return .result(dialog: "Sick Mode is on.")
  }
}

@available(iOS 16.0, *)
struct LogHydrationIntent: AppIntent {
  static var title: LocalizedStringResource = "Log Hydration"
  static var description = IntentDescription("Add a hydration entry in Synapse.")
  static var openAppWhenRun = false

  @Parameter(title: "Amount", requestValueDialog: "How much water?")
  var amount: Double

  @Parameter(title: "Unit", requestValueDialog: "What unit?")
  var unit: String

  init() {
    amount = 8
    unit = "oz"
  }

  init(amount: Double, unit: String) {
    self.amount = amount
    self.unit = unit
  }

  func perform() async throws -> some IntentResult {
    let safeAmount = amount > 0 ? amount : 8
    let safeUnit = unit.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "oz" : unit
    try SynapseIntentQueue.enqueue(
      type: "logHydration",
      payload: [
        "amount": safeAmount,
        "unit": safeUnit,
        "what": "Water",
      ]
    )
    return .result(dialog: "Logged \(safeAmount.formatted()) \(safeUnit) of water.")
  }
}

@available(iOS 16.0, *)
struct AddAppointmentIntent: AppIntent {
  static var title: LocalizedStringResource = "Add Appointment"
  static var description = IntentDescription("Create a basic appointment in Synapse.")
  static var openAppWhenRun = true

  @Parameter(title: "Title", requestValueDialog: "What should the appointment be called?")
  var title: String

  @Parameter(title: "Date and Time", requestValueDialog: "When is the appointment?")
  var date: Date

  @Parameter(title: "Location")
  var location: String?

  init() {
    title = "Appointment"
    date = Date().addingTimeInterval(60 * 60)
    location = nil
  }

  init(title: String, date: Date, location: String? = nil) {
    self.title = title
    self.date = date
    self.location = location
  }

  func perform() async throws -> some IntentResult {
    try SynapseIntentQueue.enqueue(
      type: "addAppointment",
      payload: [
        "title": title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Appointment" : title,
        "dateISO": ISO8601DateFormatter().string(from: date),
        "location": location?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "",
      ]
    )
    return .result(dialog: "Appointment added.")
  }
}

@available(iOS 16.0, *)
struct ScanMedicalInfoIntent: AppIntent {
  static var title: LocalizedStringResource = "Scan Medical Info"
  static var description = IntentDescription("Open Synapse to scan medication labels, appointment cards, or lab results.")
  static var openAppWhenRun = true

  func perform() async throws -> some IntentResult {
    try SynapseIntentQueue.enqueue(type: "scanMedicalInfo", payload: [:])
    return .result(dialog: "Opening scan.")
  }
}

@available(iOS 16.0, *)
struct SynapseAppShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: LogMedicationIntent(),
      phrases: [
        "Log medication in \(.applicationName)",
        "Log my medicine in \(.applicationName)",
      ],
      shortTitle: "Log Medication",
      systemImageName: "pills"
    )

    AppShortcut(
      intent: StartSickModeIntent(),
      phrases: [
        "I'm sick in \(.applicationName)",
        "Start Sick Mode in \(.applicationName)",
      ],
      shortTitle: "Sick Mode",
      systemImageName: "cross.case"
    )

    AppShortcut(
      intent: LogHydrationIntent(),
      phrases: [
        "Log water in \(.applicationName)",
        "Log hydration in \(.applicationName)",
      ],
      shortTitle: "Log Water",
      systemImageName: "drop"
    )

    AppShortcut(
      intent: AddAppointmentIntent(),
      phrases: [
        "Add appointment in \(.applicationName)",
        "Create appointment in \(.applicationName)",
      ],
      shortTitle: "Add Appointment",
      systemImageName: "calendar.badge.plus"
    )

    AppShortcut(
      intent: ScanMedicalInfoIntent(),
      phrases: [
        "Scan medical info in \(.applicationName)",
        "Scan medication in \(.applicationName)",
      ],
      shortTitle: "Scan",
      systemImageName: "viewfinder"
    )
  }
}
#endif
