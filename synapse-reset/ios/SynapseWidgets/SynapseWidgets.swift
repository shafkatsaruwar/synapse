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

  struct GridCell: Codable {
    let title: String
    let detail: String
  }

  struct ActionRow: Codable {
    let tone: String
    let title: String
    let subtitle: String
    let trailing: String
  }

  struct Medication: Codable {
    let name: String
    let detail: String
    let dueAt: Date?
    let windowStart: Date?
    let dueText: String
    let isTaken: Bool
    let nextText: String?
    let heroTimeText: String
    let statusLabel: String
    let secondaryLine: String
    let tone: String

    enum CodingKeys: String, CodingKey {
      case name, detail, dueAt, windowStart, dueText, isTaken, nextText
      case heroTimeText, statusLabel, secondaryLine, tone
    }

    init(
      name: String, detail: String, dueAt: Date?, windowStart: Date?, dueText: String,
      isTaken: Bool, nextText: String?, heroTimeText: String, statusLabel: String,
      secondaryLine: String, tone: String
    ) {
      self.name = name; self.detail = detail; self.dueAt = dueAt; self.windowStart = windowStart
      self.dueText = dueText; self.isTaken = isTaken; self.nextText = nextText
      self.heroTimeText = heroTimeText; self.statusLabel = statusLabel
      self.secondaryLine = secondaryLine; self.tone = tone
    }

    init(from decoder: Decoder) throws {
      let c = try decoder.container(keyedBy: CodingKeys.self)
      name = try c.decode(String.self, forKey: .name)
      detail = try c.decode(String.self, forKey: .detail)
      dueAt = try c.decodeIfPresent(Date.self, forKey: .dueAt)
      windowStart = try c.decodeIfPresent(Date.self, forKey: .windowStart)
      dueText = try c.decode(String.self, forKey: .dueText)
      isTaken = try c.decode(Bool.self, forKey: .isTaken)
      nextText = try c.decodeIfPresent(String.self, forKey: .nextText)
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
    let rows: [ActionRow]

    enum CodingKeys: String, CodingKey {
      case doctorName, detail, startsAt, whenText, travelText, location, notes, prepHint
      case statusLabel, tone, headline, supportText, rows
    }

    init(
      doctorName: String, detail: String, startsAt: Date?, whenText: String,
      travelText: String?, location: String?, notes: String?, prepHint: String,
      statusLabel: String, tone: String, headline: String, supportText: String, rows: [ActionRow]
    ) {
      self.doctorName = doctorName; self.detail = detail; self.startsAt = startsAt
      self.whenText = whenText; self.travelText = travelText; self.location = location
      self.notes = notes; self.prepHint = prepHint; self.statusLabel = statusLabel
      self.tone = tone; self.headline = headline; self.supportText = supportText; self.rows = rows
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
      statusLabel = try c.decodeIfPresent(String.self, forKey: .statusLabel) ?? "Ready"
      tone = try c.decodeIfPresent(String.self, forKey: .tone) ?? "green"
      headline = try c.decodeIfPresent(String.self, forKey: .headline) ?? "Prep looks ready."
      supportText = try c.decodeIfPresent(String.self, forKey: .supportText) ?? prepHint
      rows = try c.decodeIfPresent([ActionRow].self, forKey: .rows) ?? [
        ActionRow(tone: "blue", title: doctorName, subtitle: whenText, trailing: ""),
        ActionRow(tone: "orange", title: "Report packet", subtitle: prepHint, trailing: "prep"),
      ]
    }
  }

  struct PrnMedication: Codable {
    let id: String
    let name: String
    let detail: String
    let lastLoggedAt: Date?
    let statusText: String
    let countText: String
    let hoursSinceLastText: String
    let windowText: String
    let statusLabel: String
    let tone: String

    enum CodingKeys: String, CodingKey {
      case id, name, detail, lastLoggedAt, statusText, countText
      case hoursSinceLastText, windowText, statusLabel, tone
    }

    init(
      id: String, name: String, detail: String, lastLoggedAt: Date?, statusText: String,
      countText: String, hoursSinceLastText: String, windowText: String, statusLabel: String, tone: String
    ) {
      self.id = id; self.name = name; self.detail = detail; self.lastLoggedAt = lastLoggedAt
      self.statusText = statusText; self.countText = countText
      self.hoursSinceLastText = hoursSinceLastText; self.windowText = windowText
      self.statusLabel = statusLabel; self.tone = tone
    }

    init(from decoder: Decoder) throws {
      let c = try decoder.container(keyedBy: CodingKeys.self)
      id = try c.decode(String.self, forKey: .id)
      name = try c.decode(String.self, forKey: .name)
      detail = try c.decode(String.self, forKey: .detail)
      lastLoggedAt = try c.decodeIfPresent(Date.self, forKey: .lastLoggedAt)
      statusText = try c.decode(String.self, forKey: .statusText)
      countText = try c.decode(String.self, forKey: .countText)
      if let explicit = try c.decodeIfPresent(String.self, forKey: .hoursSinceLastText) {
        hoursSinceLastText = explicit
      } else if let last = lastLoggedAt {
        let hours = Int(Date().timeIntervalSince(last) / 3600)
        hoursSinceLastText = hours < 1 ? "\(max(1, Int(Date().timeIntervalSince(last) / 60)))m" : "\(hours)h"
      } else {
        hoursSinceLastText = "—"
      }
      windowText = try c.decodeIfPresent(String.self, forKey: .windowText) ?? "safe window clear"
      statusLabel = try c.decodeIfPresent(String.self, forKey: .statusLabel) ?? "Clear"
      tone = try c.decodeIfPresent(String.self, forKey: .tone) ?? "green"
    }
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
    let statusLabel: String
    let tone: String
    let headline: String
    let gridCells: [GridCell]
    let actionRows: [ActionRow]

    enum CodingKeys: String, CodingKey {
      case hasTodayLog, energy, mood, sleep, overallFeeling, detailHighlights
      case summaryText, secondaryText, symptomCountToday, topSymptomName, isFastingToday
      case statusLabel, tone, headline, gridCells, actionRows
    }

    init(
      hasTodayLog: Bool, energy: Int?, mood: Int?, sleep: Int?, overallFeeling: Int?,
      detailHighlights: [String], summaryText: String, secondaryText: String,
      symptomCountToday: Int, topSymptomName: String?, isFastingToday: Bool,
      statusLabel: String, tone: String, headline: String,
      gridCells: [GridCell], actionRows: [ActionRow]
    ) {
      self.hasTodayLog = hasTodayLog; self.energy = energy; self.mood = mood; self.sleep = sleep
      self.overallFeeling = overallFeeling; self.detailHighlights = detailHighlights
      self.summaryText = summaryText; self.secondaryText = secondaryText
      self.symptomCountToday = symptomCountToday; self.topSymptomName = topSymptomName
      self.isFastingToday = isFastingToday; self.statusLabel = statusLabel; self.tone = tone
      self.headline = headline; self.gridCells = gridCells; self.actionRows = actionRows
    }

    init(from decoder: Decoder) throws {
      let c = try decoder.container(keyedBy: CodingKeys.self)
      hasTodayLog = try c.decode(Bool.self, forKey: .hasTodayLog)
      energy = try c.decodeIfPresent(Int.self, forKey: .energy)
      mood = try c.decodeIfPresent(Int.self, forKey: .mood)
      sleep = try c.decodeIfPresent(Int.self, forKey: .sleep)
      overallFeeling = try c.decodeIfPresent(Int.self, forKey: .overallFeeling)
      detailHighlights = try c.decodeIfPresent([String].self, forKey: .detailHighlights) ?? []
      summaryText = try c.decode(String.self, forKey: .summaryText)
      secondaryText = try c.decode(String.self, forKey: .secondaryText)
      symptomCountToday = try c.decodeIfPresent(Int.self, forKey: .symptomCountToday) ?? 0
      topSymptomName = try c.decodeIfPresent(String.self, forKey: .topSymptomName)
      isFastingToday = try c.decodeIfPresent(Bool.self, forKey: .isFastingToday) ?? false
      statusLabel = try c.decodeIfPresent(String.self, forKey: .statusLabel) ?? (hasTodayLog ? "Logged" : "Open")
      tone = try c.decodeIfPresent(String.self, forKey: .tone) ?? (hasTodayLog ? "green" : "blue")
      headline = try c.decodeIfPresent(String.self, forKey: .headline) ?? summaryText
      gridCells = try c.decodeIfPresent([GridCell].self, forKey: .gridCells) ?? [
        GridCell(title: "symptoms active", detail: "\(symptomCountToday)"),
        GridCell(title: "energy", detail: energy.map { "\($0)/10" } ?? "—"),
        GridCell(title: "sleep", detail: sleep.map { "\($0)/10" } ?? "—"),
        GridCell(title: "mood check", detail: mood.map { "\($0)/10" } ?? "—"),
      ]
      actionRows = try c.decodeIfPresent([ActionRow].self, forKey: .actionRows) ?? [
        ActionRow(tone: "blue", title: hasTodayLog ? "Update later" : "Log check-in", subtitle: secondaryText, trailing: "Open"),
      ]
    }
  }

  struct Hydration: Codable {
    let presetLabel: String
    let sipAmountText: String
    let totalTodayMl: Int
    let totalTodayText: String
    let hasEntriesToday: Bool
    let launchHint: String
    let percentToday: Int
    let loggedCount: Int
    let targetSipsEstimate: Int
    let progress: Double
    let statusLabel: String
    let tone: String
    let secondaryLine: String

    enum CodingKeys: String, CodingKey {
      case presetLabel, sipAmountText, totalTodayMl, totalTodayText, hasEntriesToday, launchHint
      case percentToday, loggedCount, targetSipsEstimate, progress, statusLabel, tone, secondaryLine
    }

    init(
      presetLabel: String, sipAmountText: String, totalTodayMl: Int, totalTodayText: String,
      hasEntriesToday: Bool, launchHint: String, percentToday: Int, loggedCount: Int,
      targetSipsEstimate: Int, progress: Double, statusLabel: String, tone: String, secondaryLine: String
    ) {
      self.presetLabel = presetLabel; self.sipAmountText = sipAmountText
      self.totalTodayMl = totalTodayMl; self.totalTodayText = totalTodayText
      self.hasEntriesToday = hasEntriesToday; self.launchHint = launchHint
      self.percentToday = percentToday; self.loggedCount = loggedCount
      self.targetSipsEstimate = targetSipsEstimate; self.progress = progress
      self.statusLabel = statusLabel; self.tone = tone; self.secondaryLine = secondaryLine
    }

    init(from decoder: Decoder) throws {
      let c = try decoder.container(keyedBy: CodingKeys.self)
      presetLabel = try c.decode(String.self, forKey: .presetLabel)
      sipAmountText = try c.decode(String.self, forKey: .sipAmountText)
      totalTodayMl = try c.decode(Int.self, forKey: .totalTodayMl)
      totalTodayText = try c.decode(String.self, forKey: .totalTodayText)
      hasEntriesToday = try c.decode(Bool.self, forKey: .hasEntriesToday)
      launchHint = try c.decode(String.self, forKey: .launchHint)
      // Soft UI target 2000ml — not a medical goal.
      let softGoal = 2000.0
      let computedPercent = Int(min(100, max(0, round(Double(totalTodayMl) / softGoal * 100))))
      percentToday = try c.decodeIfPresent(Int.self, forKey: .percentToday) ?? computedPercent
      loggedCount = try c.decodeIfPresent(Int.self, forKey: .loggedCount) ?? (hasEntriesToday ? 1 : 0)
      targetSipsEstimate = try c.decodeIfPresent(Int.self, forKey: .targetSipsEstimate) ?? 8
      progress = try c.decodeIfPresent(Double.self, forKey: .progress) ?? min(1, Double(totalTodayMl) / softGoal)
      if let label = try c.decodeIfPresent(String.self, forKey: .statusLabel) {
        statusLabel = label
      } else if percentToday >= 80 {
        statusLabel = "Good"
      } else if percentToday >= 40 {
        statusLabel = "On track"
      } else {
        statusLabel = "Low"
      }
      tone = try c.decodeIfPresent(String.self, forKey: .tone)
        ?? (percentToday >= 80 ? "green" : percentToday >= 40 ? "blue" : "orange")
      secondaryLine = try c.decodeIfPresent(String.self, forKey: .secondaryLine)
        ?? (percentToday < 40 ? "nudge in 20m" : "keep sipping")
    }
  }

  struct Sleep: Codable {
    let hasData: Bool
    let score: Int?
    let heroText: String
    let statusLabel: String
    let tone: String
    let primaryLine: String
    let secondaryLine: String

    static let empty = Sleep(
      hasData: false, score: nil, heroText: "—", statusLabel: "OK", tone: "green",
      primaryLine: "no sleep note yet", secondaryLine: "log tonight when you can"
    )
  }

  struct FlareForecast: Codable {
    let statusLabel: String
    let tone: String
    let headline: String
    let supportText: String
    let trendTones: [String]

    static let empty = FlareForecast(
      statusLabel: "Calm", tone: "green",
      headline: "Pattern looks quieter today.",
      supportText: "No strong flare cues from today’s notes",
      trendTones: ["green", "blue", "green"]
    )
  }

  struct SickMode: Codable {
    let active: Bool
    let recoveryMode: Bool
    let latestTemperature: Double?
    let latestTemperatureText: String
    let statusText: String
    let statusLabel: String
    let heroAction: String
    let tone: String
    let needsStressDose: Bool
    let stressDoseText: String
    let checkInTimer: String?

    enum CodingKeys: String, CodingKey {
      case active, recoveryMode, latestTemperature, latestTemperatureText, statusText
      case statusLabel, heroAction, tone, needsStressDose, stressDoseText, checkInTimer
    }

    init(
      active: Bool, recoveryMode: Bool, latestTemperature: Double?, latestTemperatureText: String,
      statusText: String, statusLabel: String, heroAction: String, tone: String,
      needsStressDose: Bool, stressDoseText: String, checkInTimer: String?
    ) {
      self.active = active; self.recoveryMode = recoveryMode
      self.latestTemperature = latestTemperature; self.latestTemperatureText = latestTemperatureText
      self.statusText = statusText; self.statusLabel = statusLabel; self.heroAction = heroAction
      self.tone = tone; self.needsStressDose = needsStressDose
      self.stressDoseText = stressDoseText; self.checkInTimer = checkInTimer
    }

    init(from decoder: Decoder) throws {
      let c = try decoder.container(keyedBy: CodingKeys.self)
      active = try c.decode(Bool.self, forKey: .active)
      recoveryMode = try c.decode(Bool.self, forKey: .recoveryMode)
      latestTemperature = try c.decodeIfPresent(Double.self, forKey: .latestTemperature)
      latestTemperatureText = try c.decode(String.self, forKey: .latestTemperatureText)
      statusText = try c.decode(String.self, forKey: .statusText)
      needsStressDose = try c.decode(Bool.self, forKey: .needsStressDose)
      stressDoseText = try c.decode(String.self, forKey: .stressDoseText)
      checkInTimer = try c.decodeIfPresent(String.self, forKey: .checkInTimer)
      if recoveryMode {
        statusLabel = try c.decodeIfPresent(String.self, forKey: .statusLabel) ?? "Easing"
        heroAction = try c.decodeIfPresent(String.self, forKey: .heroAction) ?? "Ease back"
        tone = try c.decodeIfPresent(String.self, forKey: .tone) ?? "green"
      } else if active {
        statusLabel = try c.decodeIfPresent(String.self, forKey: .statusLabel) ?? "Active"
        heroAction = try c.decodeIfPresent(String.self, forKey: .heroAction)
          ?? (needsStressDose ? "Check stress dose" : "Check symptoms")
        tone = try c.decodeIfPresent(String.self, forKey: .tone) ?? "red"
      } else {
        statusLabel = try c.decodeIfPresent(String.self, forKey: .statusLabel) ?? "Off"
        heroAction = try c.decodeIfPresent(String.self, forKey: .heroAction) ?? "Stay ready"
        tone = try c.decodeIfPresent(String.self, forKey: .tone) ?? "blue"
      }
    }
  }

  struct MentalHealth: Codable {
    let active: Bool
    let statusText: String
    let statusLabel: String
    let tone: String
    let headline: String
    let supportText: String
    let nextCheckInText: String
    let checkInTimer: String?
    let trendTones: [String]

    enum CodingKeys: String, CodingKey {
      case active, statusText, statusLabel, tone, headline, supportText
      case nextCheckInText, checkInTimer, trendTones
    }

    init(
      active: Bool, statusText: String, statusLabel: String, tone: String,
      headline: String, supportText: String, nextCheckInText: String,
      checkInTimer: String?, trendTones: [String]
    ) {
      self.active = active; self.statusText = statusText; self.statusLabel = statusLabel
      self.tone = tone; self.headline = headline; self.supportText = supportText
      self.nextCheckInText = nextCheckInText; self.checkInTimer = checkInTimer
      self.trendTones = trendTones
    }

    init(from decoder: Decoder) throws {
      let c = try decoder.container(keyedBy: CodingKeys.self)
      active = try c.decode(Bool.self, forKey: .active)
      statusText = try c.decode(String.self, forKey: .statusText)
      nextCheckInText = try c.decode(String.self, forKey: .nextCheckInText)
      checkInTimer = try c.decodeIfPresent(String.self, forKey: .checkInTimer)
      statusLabel = try c.decodeIfPresent(String.self, forKey: .statusLabel) ?? (active ? "Active" : "Open")
      tone = try c.decodeIfPresent(String.self, forKey: .tone) ?? "purple"
      headline = try c.decodeIfPresent(String.self, forKey: .headline) ?? statusText
      supportText = try c.decodeIfPresent(String.self, forKey: .supportText) ?? nextCheckInText
      trendTones = try c.decodeIfPresent([String].self, forKey: .trendTones) ?? ["purple", "blue", "purple"]
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
    let age: Int?
    let relation: String?
    let status: String
    let statusText: String
    let statusLabel: String
    let tone: String
    let primaryText: String
    let secondaryText: String?
    let actionText: String?
    let headline: String
    let items: [Item]
    let missedCount: Int

    enum CodingKeys: String, CodingKey {
      case hasProfile, name, age, relation, status, statusText, statusLabel, tone
      case primaryText, secondaryText, actionText, headline, items, missedCount
    }

    init(
      hasProfile: Bool, name: String, age: Int?, relation: String?, status: String,
      statusText: String, statusLabel: String, tone: String, primaryText: String,
      secondaryText: String?, actionText: String?, headline: String, items: [Item], missedCount: Int
    ) {
      self.hasProfile = hasProfile; self.name = name; self.age = age; self.relation = relation
      self.status = status; self.statusText = statusText; self.statusLabel = statusLabel
      self.tone = tone; self.primaryText = primaryText; self.secondaryText = secondaryText
      self.actionText = actionText; self.headline = headline; self.items = items
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
      if let label = try c.decodeIfPresent(String.self, forKey: .statusLabel) {
        statusLabel = label
      } else if status == "urgent" || tone == "red" {
        statusLabel = "Share"
      } else if status == "all_good" {
        statusLabel = "OK"
      } else if !hasProfile {
        statusLabel = "Setup"
      } else {
        statusLabel = "Check"
      }
      headline = try c.decodeIfPresent(String.self, forKey: .headline)
        ?? (statusLabel == "Share" ? "Send today summary?" : primaryText)
    }

    static let placeholder = Caregiver(
      hasProfile: false, name: "Managed person", age: nil, relation: nil,
      status: "attention", statusText: "Set up profile", statusLabel: "Setup", tone: "yellow",
      primaryText: "Profile needed", secondaryText: "Open Synapse", actionText: "Open Synapse",
      headline: "Add a managed person",
      items: [Item(kind: "setup", text: "Managed person missing", tone: "yellow")],
      missedCount: 0
    )
  }

  struct Recovery: Codable {
    let active: Bool
    let title: String
    let statusText: String
    let statusLabel: String
    let tone: String
    let focusText: String?
    let nextAction: String
    let headline: String
    let supportText: String
    let progress: Double

    enum CodingKeys: String, CodingKey {
      case active, title, statusText, statusLabel, tone, focusText, nextAction
      case headline, supportText, progress
    }

    init(
      active: Bool, title: String, statusText: String, statusLabel: String, tone: String,
      focusText: String?, nextAction: String, headline: String, supportText: String, progress: Double
    ) {
      self.active = active; self.title = title; self.statusText = statusText
      self.statusLabel = statusLabel; self.tone = tone; self.focusText = focusText
      self.nextAction = nextAction; self.headline = headline; self.supportText = supportText
      self.progress = progress
    }

    init(from decoder: Decoder) throws {
      let c = try decoder.container(keyedBy: CodingKeys.self)
      active = try c.decode(Bool.self, forKey: .active)
      title = try c.decode(String.self, forKey: .title)
      statusText = try c.decode(String.self, forKey: .statusText)
      tone = try c.decode(String.self, forKey: .tone)
      focusText = try c.decodeIfPresent(String.self, forKey: .focusText)
      nextAction = try c.decode(String.self, forKey: .nextAction)
      statusLabel = try c.decodeIfPresent(String.self, forKey: .statusLabel) ?? "Stable"
      headline = try c.decodeIfPresent(String.self, forKey: .headline) ?? "You are trending calmer."
      supportText = try c.decodeIfPresent(String.self, forKey: .supportText) ?? (focusText ?? nextAction)
      progress = try c.decodeIfPresent(Double.self, forKey: .progress) ?? 0.62
    }

    static let empty = Recovery(
      active: false, title: "Recovery Today", statusText: "No recovery focus",
      statusLabel: "Stable", tone: "green", focusText: nil,
      nextAction: "Open recovery when you need it",
      headline: "You are trending calmer.",
      supportText: "Hydration on track · No PRN logged",
      progress: 0.62
    )
  }

  struct Pain: Codable {
    let hasPain: Bool
    let name: String
    let severity: Int?
    let statusText: String
    let statusLabel: String
    let tone: String
    let nextAction: String
    let lastLoggedText: String
    let progress: Double

    enum CodingKeys: String, CodingKey {
      case hasPain, name, severity, statusText, statusLabel, tone, nextAction, lastLoggedText, progress
    }

    init(
      hasPain: Bool, name: String, severity: Int?, statusText: String, statusLabel: String,
      tone: String, nextAction: String, lastLoggedText: String, progress: Double
    ) {
      self.hasPain = hasPain; self.name = name; self.severity = severity
      self.statusText = statusText; self.statusLabel = statusLabel; self.tone = tone
      self.nextAction = nextAction; self.lastLoggedText = lastLoggedText; self.progress = progress
    }

    init(from decoder: Decoder) throws {
      let c = try decoder.container(keyedBy: CodingKeys.self)
      hasPain = try c.decode(Bool.self, forKey: .hasPain)
      name = try c.decode(String.self, forKey: .name)
      severity = try c.decodeIfPresent(Int.self, forKey: .severity)
      statusText = try c.decode(String.self, forKey: .statusText)
      tone = try c.decode(String.self, forKey: .tone)
      nextAction = try c.decode(String.self, forKey: .nextAction)
      if let label = try c.decodeIfPresent(String.self, forKey: .statusLabel) {
        statusLabel = label
      } else if let severity, severity >= 7 {
        statusLabel = "Up"
      } else if let severity, severity >= 4 {
        statusLabel = "Watch"
      } else {
        statusLabel = "Calm"
      }
      lastLoggedText = try c.decodeIfPresent(String.self, forKey: .lastLoggedText) ?? "No recent pain log"
      if let explicit = try c.decodeIfPresent(Double.self, forKey: .progress) {
        progress = explicit
      } else if let severity {
        progress = min(1, max(0, Double(severity) / 10.0))
      } else {
        progress = 0
      }
    }

    static let empty = Pain(
      hasPain: false, name: "Pain", severity: nil, statusText: "Nothing flagged",
      statusLabel: "Calm", tone: "green", nextAction: "Log if something hurts",
      lastLoggedText: "No recent pain log", progress: 0
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
    let statusLabel: String
    let tone: String
    let headline: String
    let gridCells: [GridCell]
    let actionRows: [ActionRow]

    enum CodingKeys: String, CodingKey {
      case taken, expected, summaryText, nextAction, doses
      case statusLabel, tone, headline, gridCells, actionRows
    }

    init(
      taken: Int, expected: Int, summaryText: String, nextAction: String, doses: [Dose],
      statusLabel: String, tone: String, headline: String, gridCells: [GridCell], actionRows: [ActionRow]
    ) {
      self.taken = taken; self.expected = expected; self.summaryText = summaryText
      self.nextAction = nextAction; self.doses = doses; self.statusLabel = statusLabel
      self.tone = tone; self.headline = headline; self.gridCells = gridCells; self.actionRows = actionRows
    }

    init(from decoder: Decoder) throws {
      let c = try decoder.container(keyedBy: CodingKeys.self)
      taken = try c.decode(Int.self, forKey: .taken)
      expected = try c.decode(Int.self, forKey: .expected)
      summaryText = try c.decode(String.self, forKey: .summaryText)
      nextAction = try c.decode(String.self, forKey: .nextAction)
      doses = try c.decodeIfPresent([Dose].self, forKey: .doses) ?? []
      statusLabel = try c.decodeIfPresent(String.self, forKey: .statusLabel)
        ?? (expected == 0 ? "None" : taken >= expected ? "Done" : "Active")
      tone = try c.decodeIfPresent(String.self, forKey: .tone)
        ?? (taken >= expected && expected > 0 ? "green" : "orange")
      headline = try c.decodeIfPresent(String.self, forKey: .headline) ?? summaryText
      gridCells = try c.decodeIfPresent([GridCell].self, forKey: .gridCells) ?? [
        GridCell(title: "next med", detail: doses.first(where: { !$0.taken })?.timeText ?? "—"),
        GridCell(title: "taken today", detail: "\(taken)"),
        GridCell(title: "left today", detail: "\(max(0, expected - taken))"),
        GridCell(title: "scheduled", detail: "\(expected)"),
      ]
      if let rows = try c.decodeIfPresent([ActionRow].self, forKey: .actionRows) {
        actionRows = rows
      } else {
        actionRows = doses.prefix(2).map {
          ActionRow(tone: $0.taken ? "green" : "orange", title: $0.name, subtitle: $0.detail, trailing: $0.taken ? "Taken" : $0.timeText)
        }
      }
    }

    static let empty = MedicationDay(
      taken: 0, expected: 0, summaryText: "No scheduled doses today",
      nextAction: "Add meds in Synapse", doses: [], statusLabel: "None", tone: "blue",
      headline: "Nothing scheduled.",
      gridCells: [
        GridCell(title: "next med", detail: "—"), GridCell(title: "PRN window", detail: "—"),
        GridCell(title: "missed today", detail: "0"), GridCell(title: "refill check", detail: "—"),
      ],
      actionRows: [ActionRow(tone: "blue", title: "No schedule", subtitle: "Add meds in Synapse", trailing: "Open")]
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
    let statusLabel: String
    let tone: String
    let nextAction: String
    let headline: String
    let supportText: String
    let progress: Double
    let items: [Item]

    enum CodingKeys: String, CodingKey {
      case hasItems, title, statusText, statusLabel, tone, nextAction
      case headline, supportText, progress, items
    }

    init(
      hasItems: Bool, title: String, statusText: String, statusLabel: String, tone: String,
      nextAction: String, headline: String, supportText: String, progress: Double, items: [Item]
    ) {
      self.hasItems = hasItems; self.title = title; self.statusText = statusText
      self.statusLabel = statusLabel; self.tone = tone; self.nextAction = nextAction
      self.headline = headline; self.supportText = supportText; self.progress = progress
      self.items = items
    }

    init(from decoder: Decoder) throws {
      let c = try decoder.container(keyedBy: CodingKeys.self)
      hasItems = try c.decode(Bool.self, forKey: .hasItems)
      title = try c.decode(String.self, forKey: .title)
      statusText = try c.decode(String.self, forKey: .statusText)
      tone = try c.decode(String.self, forKey: .tone)
      nextAction = try c.decode(String.self, forKey: .nextAction)
      items = try c.decodeIfPresent([Item].self, forKey: .items) ?? []
      statusLabel = try c.decodeIfPresent(String.self, forKey: .statusLabel)
        ?? (tone == "orange" ? "Review" : hasItems ? "Steady" : "Empty")
      headline = try c.decodeIfPresent(String.self, forKey: .headline) ?? statusText
      supportText = try c.decodeIfPresent(String.self, forKey: .supportText)
        ?? (tone == "orange" ? "Not an emergency — review when you can." : nextAction)
      progress = try c.decodeIfPresent(Double.self, forKey: .progress) ?? (tone == "orange" ? 0.55 : 0.35)
    }

    static let empty = Labs(
      hasItems: false, title: "Labs", statusText: "No labs yet", statusLabel: "Empty",
      tone: "blue", nextAction: "Add or scan a result",
      headline: "Nothing on file yet.", supportText: "Add or scan a result when ready.",
      progress: 0.15, items: []
    )
  }

  struct Report14Day: Codable {
    let statusLabel: String
    let summaryText: String
    let tone: String
    let adherenceText: String
    let nextAction: String
    let insights: [String]
    let headline: String
    let gridCells: [GridCell]
    let actionRows: [ActionRow]

    enum CodingKeys: String, CodingKey {
      case statusLabel, summaryText, tone, adherenceText, nextAction, insights
      case headline, gridCells, actionRows
    }

    init(
      statusLabel: String, summaryText: String, tone: String, adherenceText: String,
      nextAction: String, insights: [String], headline: String,
      gridCells: [GridCell], actionRows: [ActionRow]
    ) {
      self.statusLabel = statusLabel; self.summaryText = summaryText; self.tone = tone
      self.adherenceText = adherenceText; self.nextAction = nextAction; self.insights = insights
      self.headline = headline; self.gridCells = gridCells; self.actionRows = actionRows
    }

    init(from decoder: Decoder) throws {
      let c = try decoder.container(keyedBy: CodingKeys.self)
      statusLabel = try c.decode(String.self, forKey: .statusLabel)
      summaryText = try c.decode(String.self, forKey: .summaryText)
      tone = try c.decode(String.self, forKey: .tone)
      adherenceText = try c.decode(String.self, forKey: .adherenceText)
      nextAction = try c.decode(String.self, forKey: .nextAction)
      insights = try c.decodeIfPresent([String].self, forKey: .insights) ?? []
      headline = try c.decodeIfPresent(String.self, forKey: .headline) ?? summaryText
      gridCells = try c.decodeIfPresent([GridCell].self, forKey: .gridCells) ?? [
        GridCell(title: "status", detail: statusLabel),
        GridCell(title: "med adherence", detail: adherenceText),
        GridCell(title: "days covered", detail: "14"),
        GridCell(title: "pattern notes", detail: "\(insights.count)"),
      ]
      actionRows = try c.decodeIfPresent([ActionRow].self, forKey: .actionRows) ?? [
        ActionRow(tone: tone, title: nextAction, subtitle: summaryText, trailing: "Report"),
      ]
    }

    static let empty = Report14Day(
      statusLabel: "Steady", summaryText: "Pattern over the last 14 days", tone: "blue",
      adherenceText: "No med schedule today", nextAction: "Open 14-day report", insights: [],
      headline: "Two-week pattern looks steady.",
      gridCells: [
        GridCell(title: "symptom spikes", detail: "—"), GridCell(title: "med adherence", detail: "—"),
        GridCell(title: "poor sleep nights", detail: "—"), GridCell(title: "lab changes", detail: "—"),
      ],
      actionRows: [ActionRow(tone: "blue", title: "Open 14-day report", subtitle: "Pattern view", trailing: "Report")]
    )
  }

  let medication: Medication?
  let appointment: Appointment?
  let prnMedication: PrnMedication?
  let wellness: Wellness
  let hydration: Hydration
  let sleep: Sleep
  let flareForecast: FlareForecast
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
    case appearance, medication, appointment, prnMedication, wellness, hydration, sleep, flareForecast
    case sickMode, mentalHealth, caregiver, recovery, pain, medicationDay, labs, report14Day, updatedAt
  }

  init(
    appearance: String, medication: Medication?, appointment: Appointment?,
    prnMedication: PrnMedication?, wellness: Wellness, hydration: Hydration,
    sleep: Sleep, flareForecast: FlareForecast, sickMode: SickMode, mentalHealth: MentalHealth,
    caregiver: Caregiver, recovery: Recovery, pain: Pain, medicationDay: MedicationDay,
    labs: Labs, report14Day: Report14Day, updatedAt: Date
  ) {
    self.appearance = appearance; self.medication = medication; self.appointment = appointment
    self.prnMedication = prnMedication; self.wellness = wellness; self.hydration = hydration
    self.sleep = sleep; self.flareForecast = flareForecast; self.sickMode = sickMode
    self.mentalHealth = mentalHealth; self.caregiver = caregiver; self.recovery = recovery
    self.pain = pain; self.medicationDay = medicationDay; self.labs = labs
    self.report14Day = report14Day; self.updatedAt = updatedAt
  }

  init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    appearance = try c.decode(String.self, forKey: .appearance)
    medication = try c.decodeIfPresent(Medication.self, forKey: .medication)
    appointment = try c.decodeIfPresent(Appointment.self, forKey: .appointment)
    prnMedication = try c.decodeIfPresent(PrnMedication.self, forKey: .prnMedication)
    wellness = try c.decode(Wellness.self, forKey: .wellness)
    hydration = try c.decode(Hydration.self, forKey: .hydration)
    if let decodedSleep = try c.decodeIfPresent(Sleep.self, forKey: .sleep) {
      sleep = decodedSleep
    } else if let score = wellness.sleep {
      let short = score < 6
      sleep = Sleep(
        hasData: true, score: score, heroText: "\(score)/10",
        statusLabel: short ? "Short" : "OK", tone: short ? "orange" : "green",
        primaryLine: short ? "flare risk factor" : "rest looks steadier",
        secondaryLine: short ? "pace the day" : "keep a gentle rhythm"
      )
    } else {
      sleep = .empty
    }
    flareForecast = try c.decodeIfPresent(FlareForecast.self, forKey: .flareForecast) ?? .empty
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
      name: "Next medication", detail: "No medication due yet", dueAt: nil, windowStart: nil,
      dueText: "Stay on track", isTaken: false, nextText: nil, heroTimeText: "2:00 PM",
      statusLabel: "Next", secondaryLine: "quiet reminder set", tone: "green"
    ),
    appointment: Appointment(
      doctorName: "Next appointment", detail: "No appointment scheduled", startsAt: nil,
      whenText: "Add one in Synapse", travelText: nil, location: nil, notes: nil,
      prepHint: "Open Synapse to prep", statusLabel: "Ready", tone: "green",
      headline: "Prep looks ready.", supportText: "Add a visit in Synapse",
      rows: [
        ActionRow(tone: "blue", title: "GI visit tomorrow", subtitle: "3 questions prepared", trailing: "10:30"),
        ActionRow(tone: "green", title: "Report packet synced", subtitle: "Last 14 days summarized", trailing: "ok"),
      ]
    ),
    prnMedication: PrnMedication(
      id: "placeholder", name: "Rescue med", detail: "As needed", lastLoggedAt: nil,
      statusText: "Not logged yet", countText: "Tap Log when you take it",
      hoursSinceLastText: "6h", windowText: "safe window clear", statusLabel: "Watch", tone: "orange"
    ),
    wellness: Wellness(
      hasTodayLog: false, energy: nil, mood: nil, sleep: nil, overallFeeling: nil,
      detailHighlights: [], summaryText: "Check in today",
      secondaryText: "Log energy, mood, and sleep", symptomCountToday: 0,
      topSymptomName: nil, isFastingToday: false, statusLabel: "Open", tone: "blue",
      headline: "Ready when you are.",
      gridCells: [
        GridCell(title: "symptoms active", detail: "0"), GridCell(title: "med due soon", detail: "0"),
        GridCell(title: "hydration", detail: "—"), GridCell(title: "mood check", detail: "—"),
      ],
      actionRows: [ActionRow(tone: "blue", title: "Log check-in", subtitle: "Energy, mood, sleep", trailing: "Open")]
    ),
    hydration: Hydration(
      presetLabel: "Water", sipAmountText: "8 oz", totalTodayMl: 840,
      totalTodayText: "840 mL today", hasEntriesToday: true, launchHint: "Take a Sip",
      percentToday: 42, loggedCount: 2, targetSipsEstimate: 5, progress: 0.42,
      statusLabel: "Low", tone: "orange", secondaryLine: "nudge in 20m"
    ),
    sleep: Sleep(
      hasData: true, score: 5, heroText: "5/10", statusLabel: "Short", tone: "orange",
      primaryLine: "flare risk factor", secondaryLine: "pace the day"
    ),
    flareForecast: FlareForecast(
      statusLabel: "Watch", tone: "orange",
      headline: "Pattern looks a little noisy.",
      supportText: "Pain up, hydration low, sleep short.",
      trendTones: ["green", "green", "blue", "orange", "orange", "orange", "blue", "blue", "green"]
    ),
    sickMode: SickMode(
      active: false, recoveryMode: false, latestTemperature: nil,
      latestTemperatureText: "No temp logged", statusText: "tap to start",
      statusLabel: "Off", heroAction: "Stay ready", tone: "blue",
      needsStressDose: false, stressDoseText: "no stress-dose meds", checkInTimer: nil
    ),
    mentalHealth: MentalHealth(
      active: false, statusText: "Tap when you need support", statusLabel: "Open",
      tone: "purple", headline: "Space for a gentle check-in.",
      supportText: "Purple accents mark recent energy notes",
      nextCheckInText: "No check-in yet", checkInTimer: nil,
      trendTones: ["purple", "purple", "orange", "green", "green", "blue", "blue", "blue", "green"]
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
  let wash: Color
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

  /// Soft translucent card wash from the export sheet: a faint clinical blue-green
  /// tint in the top-left settling into plain white.
  var cardGradient: LinearGradient {
    LinearGradient(
      colors: [wash, background],
      startPoint: .topLeading,
      endPoint: .bottomTrailing
    )
  }

  static let light = SynapseWidgetPalette(
    background: Color.white.opacity(0.96),
    wash: Color(red: 0.91, green: 0.95, blue: 0.96),
    surface: Color.black.opacity(0.04),
    ink: Color(red: 0.10, green: 0.13, blue: 0.18),
    muted: Color(red: 0.45, green: 0.49, blue: 0.56),
    red: Color(red: 0.78, green: 0.20, blue: 0.24),
    blue: Color(red: 0.22, green: 0.48, blue: 0.86),
    green: Color(red: 0.18, green: 0.62, blue: 0.42),
    orange: Color(red: 0.90, green: 0.48, blue: 0.12),
    yellow: Color(red: 0.82, green: 0.58, blue: 0.08),
    purple: Color(red: 0.48, green: 0.36, blue: 0.78),
    line: Color.black.opacity(0.08),
    track: Color.black.opacity(0.07)
  )

  static let calm = SynapseWidgetPalette(
    background: Color(red: 0.961, green: 0.925, blue: 0.886),
    wash: Color(red: 0.937, green: 0.898, blue: 0.855),
    surface: Color.white.opacity(0.44),
    ink: Color(red: 0.10, green: 0.10, blue: 0.10),
    muted: Color(red: 0.404, green: 0.322, blue: 0.282),
    red: Color(red: 0.80, green: 0.0, blue: 0.0),
    blue: Color(red: 0.294, green: 0.561, blue: 0.490),
    green: Color(red: 0.176, green: 0.490, blue: 0.275),
    orange: Color(red: 0.80, green: 0.40, blue: 0.0),
    yellow: Color(red: 0.722, green: 0.525, blue: 0.043),
    purple: Color(red: 0.420, green: 0.247, blue: 0.627),
    line: Color.white.opacity(0.55),
    track: Color.black.opacity(0.08)
  )

  static let dark = SynapseWidgetPalette(
    background: Color(red: 0.10, green: 0.11, blue: 0.13).opacity(0.96),
    wash: Color(red: 0.13, green: 0.16, blue: 0.19).opacity(0.96),
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
  case "calm":
    return .calm
  case "dark":
    return .dark
  default:
    return colorScheme == .dark ? .dark : .light
  }
}

private func toneColor(_ tone: String, palette: SynapseWidgetPalette) -> Color {
  switch tone.lowercased() {
  case "green": return palette.green
  case "blue": return palette.blue
  case "orange": return palette.orange
  case "red": return palette.red
  case "purple": return palette.purple
  case "yellow": return palette.yellow
  default: return palette.muted
  }
}

// MARK: - Shared chrome (export sheet)

private struct DotStatusChip: View {
  let text: String
  let color: Color

  var body: some View {
    HStack(spacing: 5) {
      Circle()
        .fill(color)
        .frame(width: 6, height: 6)
      Text(text)
        .font(.system(size: 11, weight: .semibold))
        .foregroundStyle(color)
        .lineLimit(1)
        .minimumScaleFactor(0.8)
    }
    .padding(.vertical, 4)
    .padding(.horizontal, 8)
    .background(color.opacity(0.12))
    .clipShape(Capsule())
  }
}

private struct WidgetHeader: View {
  let label: String
  let status: String
  let tone: String
  let palette: SynapseWidgetPalette

  var body: some View {
    HStack(alignment: .center, spacing: 8) {
      Text(label.uppercased())
        .font(.system(size: 11, weight: .semibold))
        .tracking(0.6)
        .foregroundStyle(palette.muted)
        .lineLimit(1)
      Spacer(minLength: 4)
      DotStatusChip(text: status, color: toneColor(tone, palette: palette))
    }
  }
}

private struct MetricHero: View {
  let text: String
  let palette: SynapseWidgetPalette
  var accent: Color? = nil
  var size: CGFloat = 42
  /// Number heroes stay on one line; word heroes ("Check symptoms") wrap like the export sheet.
  var lineLimit: Int = 1

  var body: some View {
    Text(text)
      .font(.system(size: size, weight: .bold))
      .foregroundStyle(accent ?? palette.ink)
      .lineLimit(lineLimit)
      .minimumScaleFactor(0.55)
      .fixedSize(horizontal: false, vertical: lineLimit > 1)
  }
}

private struct SupportLine: View {
  let text: String
  let palette: SynapseWidgetPalette

  var body: some View {
    Text(text)
      .font(.system(size: 12, weight: .regular))
      .foregroundStyle(palette.muted)
      .lineLimit(2)
      .minimumScaleFactor(0.85)
  }
}

private struct StoryHeadline: View {
  let text: String
  let palette: SynapseWidgetPalette
  var size: CGFloat = 18

  var body: some View {
    Text(text)
      .font(.system(size: size, weight: .bold))
      .foregroundStyle(palette.ink)
      .lineLimit(2)
      .minimumScaleFactor(0.8)
  }
}

private struct ProgressBar: View {
  let progress: Double
  let color: Color
  let palette: SynapseWidgetPalette

  var body: some View {
    GeometryReader { geo in
      ZStack(alignment: .leading) {
        Capsule().fill(palette.track)
        Capsule()
          .fill(color)
          .frame(width: max(6, geo.size.width * CGFloat(min(max(progress, 0), 1))))
      }
    }
    .frame(height: 4)
  }
}

/// Capsule pills from the export sheet — a soft pattern read, deliberately unlabelled
/// so it stays a texture rather than a score.
private struct TrendStrip: View {
  let tones: [String]
  let palette: SynapseWidgetPalette
  var height: CGFloat = 12

  var body: some View {
    HStack(spacing: 6) {
      ForEach(Array(tones.prefix(9).enumerated()), id: \.offset) { _, tone in
        Capsule()
          .fill(toneColor(tone, palette: palette))
          .frame(height: height)
      }
    }
    .frame(maxWidth: .infinity)
  }
}

private struct AccentRow: View {
  let tone: String
  let title: String
  let subtitle: String
  let trailing: String
  let palette: SynapseWidgetPalette

  var body: some View {
    HStack(spacing: 10) {
      RoundedRectangle(cornerRadius: 2, style: .continuous)
        .fill(toneColor(tone, palette: palette))
        .frame(width: 3, height: 30)
      VStack(alignment: .leading, spacing: 2) {
        Text(title)
          .font(.system(size: 13, weight: .semibold))
          .foregroundStyle(palette.ink)
          .lineLimit(1)
        if !subtitle.isEmpty {
          Text(subtitle)
            .font(.system(size: 11, weight: .regular))
            .foregroundStyle(palette.muted)
            .lineLimit(1)
        }
      }
      Spacer(minLength: 4)
      if !trailing.isEmpty {
        // The sheet keeps the trailing cue quiet — the accent bar carries the tone.
        Text(trailing)
          .font(.system(size: 11, weight: .semibold))
          .foregroundStyle(palette.muted)
          .lineLimit(1)
      }
    }
  }
}

private struct MetricGridCell: View {
  let title: String
  let detail: String
  let palette: SynapseWidgetPalette

  var body: some View {
    // Export sheet order: the value leads, the label explains it underneath.
    VStack(alignment: .leading, spacing: 2) {
      Text(detail)
        .font(.system(size: 20, weight: .bold))
        .foregroundStyle(palette.ink)
        .lineLimit(1)
        .minimumScaleFactor(0.6)
      Text(title)
        .font(.system(size: 11, weight: .regular))
        .foregroundStyle(palette.muted)
        .lineLimit(1)
        .minimumScaleFactor(0.75)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(.vertical, 8)
    .padding(.horizontal, 11)
    .background(palette.surface)
    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
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

private struct WidgetCard<Content: View>: View {
  let palette: SynapseWidgetPalette
  let content: Content

  init(palette: SynapseWidgetPalette, @ViewBuilder content: () -> Content) {
    self.palette = palette
    self.content = content()
  }

  var body: some View {
    let baseCard = ZStack {
      palette.cardGradient
        .frame(maxWidth: .infinity, maxHeight: .infinity)
      content
        .padding(14)
    }

    if #available(iOSApplicationExtension 17.0, *) {
      baseCard
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .clipShape(ContainerRelativeShape())
        .containerBackground(for: .widget) {
          palette.cardGradient
        }
    } else {
      baseCard
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(palette.cardGradient)
        .clipShape(ContainerRelativeShape())
    }
  }
}

private func metricGrid(_ cells: [SynapseWidgetSnapshot.GridCell], palette: SynapseWidgetPalette) -> some View {
  let items = Array(cells.prefix(4))
  return VStack(spacing: 8) {
    HStack(spacing: 8) {
      ForEach(Array(items.prefix(2).enumerated()), id: \.offset) { _, cell in
        MetricGridCell(title: cell.title, detail: cell.detail, palette: palette)
      }
    }
    if items.count > 2 {
      HStack(spacing: 8) {
        ForEach(Array(items.dropFirst(2).enumerated()), id: \.offset) { _, cell in
          MetricGridCell(title: cell.title, detail: cell.detail, palette: palette)
        }
      }
    }
  }
}

// MARK: - Widget views

private struct RecoveryWidgetView: View {
  let entry: SynapseProvider.Entry
  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    let palette = palette(for: entry.snapshot.appearance, colorScheme: colorScheme)
    let recovery = entry.snapshot.recovery
    let accent = toneColor(recovery.tone, palette: palette)

    WidgetCard(palette: palette) {
      VStack(alignment: .leading, spacing: 6) {
        WidgetHeader(label: recovery.title, status: recovery.statusLabel, tone: recovery.tone, palette: palette)
        StoryHeadline(text: recovery.headline, palette: palette, size: 20)
        SupportLine(text: recovery.supportText, palette: palette)
        Spacer(minLength: 0)
        ProgressBar(progress: recovery.progress, color: accent, palette: palette)
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
    let accent = toneColor(hydration.tone, palette: palette)

    WidgetCard(palette: palette) {
      VStack(alignment: .leading, spacing: 6) {
        WidgetHeader(label: "Hydration", status: hydration.statusLabel, tone: hydration.tone, palette: palette)
        MetricHero(text: "\(hydration.percentToday)%", palette: palette, accent: accent)
        SupportLine(text: "\(hydration.loggedCount) of \(hydration.targetSipsEstimate) logged", palette: palette)
        SupportLine(text: hydration.secondaryLine, palette: palette)
        Spacer(minLength: 0)
        ProgressBar(progress: hydration.progress, color: palette.blue, palette: palette)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
      .widgetURL(SynapseWidgetDestination.hydrationQuickSipURL())
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
        VStack(alignment: .leading, spacing: 6) {
          WidgetHeader(label: "PRN", status: prn.statusLabel, tone: prn.tone, palette: palette)
          MetricHero(text: prn.hoursSinceLastText, palette: palette, accent: toneColor(prn.tone, palette: palette))
          SupportLine(text: "since last rescue med", palette: palette)
          SupportLine(text: prn.windowText, palette: palette)
          Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .widgetURL(SynapseWidgetDestination.prnLogURL(for: prn.id))
      } else {
        VStack(alignment: .leading, spacing: 6) {
          WidgetHeader(label: "PRN", status: "Clear", tone: "green", palette: palette)
          MetricHero(text: "—", palette: palette)
          SupportLine(text: "no rescue meds yet", palette: palette)
          SupportLine(text: "add one in Synapse", palette: palette)
          Spacer(minLength: 0)
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
      VStack(alignment: .leading, spacing: 6) {
        WidgetHeader(
          label: "Meds",
          status: medication?.statusLabel ?? "Done",
          tone: medication?.tone ?? "green",
          palette: palette
        )
        MetricHero(
          text: medication?.heroTimeText ?? "Done",
          palette: palette,
          accent: toneColor(medication?.tone ?? "green", palette: palette),
          size: 36
        )
        SupportLine(text: medication.map { $0.isTaken ? $0.dueText : "dose due soon" } ?? "no dose due", palette: palette)
        SupportLine(text: medication?.secondaryLine ?? "stay on track", palette: palette)
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
      VStack(alignment: .leading, spacing: 6) {
        WidgetHeader(label: "Pain", status: pain.statusLabel, tone: pain.tone, palette: palette)
        MetricHero(
          text: pain.severity.map { "\($0)" } ?? "—",
          palette: palette,
          accent: accent
        )
        SupportLine(text: pain.name, palette: palette)
        SupportLine(text: pain.lastLoggedText, palette: palette)
        Spacer(minLength: 0)
        ProgressBar(progress: pain.progress, color: accent, palette: palette)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
  }
}

private struct SleepWidgetView: View {
  let entry: SynapseProvider.Entry
  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    let palette = palette(for: entry.snapshot.appearance, colorScheme: colorScheme)
    let sleep = entry.snapshot.sleep
    let accent = toneColor(sleep.tone, palette: palette)

    WidgetCard(palette: palette) {
      VStack(alignment: .leading, spacing: 6) {
        WidgetHeader(label: "Sleep", status: sleep.statusLabel, tone: sleep.tone, palette: palette)
        MetricHero(text: sleep.heroText, palette: palette, accent: accent)
        SupportLine(text: sleep.primaryLine, palette: palette)
        SupportLine(text: sleep.secondaryLine, palette: palette)
        Spacer(minLength: 0)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
  }
}

private struct SickModeWidgetView: View {
  let entry: SynapseProvider.Entry
  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    let palette = palette(for: entry.snapshot.appearance, colorScheme: colorScheme)
    let sick = entry.snapshot.sickMode

    WidgetCard(palette: palette) {
      VStack(alignment: .leading, spacing: 6) {
        WidgetHeader(label: "Sick Mode", status: sick.statusLabel, tone: sick.tone, palette: palette)
        MetricHero(text: sick.heroAction, palette: palette, accent: palette.ink, size: 24, lineLimit: 2)
        SupportLine(text: sick.statusText, palette: palette)
        SupportLine(text: sick.stressDoseText, palette: palette)
        Spacer(minLength: 0)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
  }
}

private struct FlareForecastWidgetView: View {
  let entry: SynapseProvider.Entry
  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    let palette = palette(for: entry.snapshot.appearance, colorScheme: colorScheme)
    let flare = entry.snapshot.flareForecast

    WidgetCard(palette: palette) {
      VStack(alignment: .leading, spacing: 6) {
        WidgetHeader(label: "Flare Forecast", status: flare.statusLabel, tone: flare.tone, palette: palette)
        StoryHeadline(text: flare.headline, palette: palette, size: 20)
        SupportLine(text: flare.supportText, palette: palette)
        Spacer(minLength: 0)
        TrendStrip(tones: flare.trendTones, palette: palette)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
  }
}

private struct DailyLogWidgetView: View {
  let entry: SynapseProvider.Entry
  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    let palette = palette(for: entry.snapshot.appearance, colorScheme: colorScheme)
    let wellness = entry.snapshot.wellness

    WidgetCard(palette: palette) {
      VStack(alignment: .leading, spacing: 10) {
        WidgetHeader(label: "Daily Log", status: wellness.statusLabel, tone: wellness.tone, palette: palette)
        StoryHeadline(text: wellness.headline, palette: palette, size: 22)
        metricGrid(wellness.gridCells, palette: palette)
        Spacer(minLength: 0)
        ForEach(Array(wellness.actionRows.prefix(2).enumerated()), id: \.offset) { _, row in
          AccentRow(tone: row.tone, title: row.title, subtitle: row.subtitle, trailing: row.trailing, palette: palette)
        }
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
  }
}

private struct MedicationDayWidgetView: View {
  let entry: SynapseProvider.Entry
  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    let palette = palette(for: entry.snapshot.appearance, colorScheme: colorScheme)
    let day = entry.snapshot.medicationDay

    WidgetCard(palette: palette) {
      VStack(alignment: .leading, spacing: 10) {
        WidgetHeader(label: "Medication Day", status: day.statusLabel, tone: day.tone, palette: palette)
        StoryHeadline(text: day.headline, palette: palette, size: 22)
        metricGrid(day.gridCells, palette: palette)
        Spacer(minLength: 0)
        ForEach(Array(day.actionRows.prefix(2).enumerated()), id: \.offset) { _, row in
          AccentRow(tone: row.tone, title: row.title, subtitle: row.subtitle, trailing: row.trailing, palette: palette)
        }
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
  }
}

private struct AppointmentWidgetView: View {
  let entry: SynapseProvider.Entry
  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    let palette = palette(for: entry.snapshot.appearance, colorScheme: colorScheme)
    let appointment = entry.snapshot.appointment

    WidgetCard(palette: palette) {
      VStack(alignment: .leading, spacing: 10) {
        WidgetHeader(
          label: "Appointment Prep",
          status: appointment?.statusLabel ?? "None",
          tone: appointment?.tone ?? "blue",
          palette: palette
        )
        if let appointment {
          // The sheet gives prep the rows instead of a headline — the visit and the
          // packet are the two things worth reading at a glance.
          Spacer(minLength: 0)
          ForEach(Array(appointment.rows.prefix(2).enumerated()), id: \.offset) { _, row in
            AccentRow(tone: row.tone, title: row.title, subtitle: row.subtitle, trailing: row.trailing, palette: palette)
          }
          Spacer(minLength: 0)
        } else {
          StoryHeadline(text: "No upcoming visit.", palette: palette, size: 20)
          SupportLine(text: "Add one in Synapse when you have a date.", palette: palette)
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

  var body: some View {
    let palette = palette(for: entry.snapshot.appearance, colorScheme: colorScheme)
    let caregiver = entry.snapshot.caregiver

    WidgetCard(palette: palette) {
      VStack(alignment: .leading, spacing: 6) {
        WidgetHeader(label: "Caregiver", status: caregiver.statusLabel, tone: caregiver.tone, palette: palette)
        StoryHeadline(text: caregiver.headline, palette: palette, size: 20)
        Spacer(minLength: 0)
        if let item = caregiver.items.first {
          AccentRow(
            tone: item.tone,
            title: item.text,
            subtitle: caregiver.secondaryText ?? caregiverPersonText(caregiver),
            trailing: caregiver.statusLabel.lowercased(),
            palette: palette
          )
        }
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
  }

  private func caregiverPersonText(_ caregiver: SynapseWidgetSnapshot.Caregiver) -> String {
    var details: [String] = [caregiver.name]
    if let age = caregiver.age { details.append("\(age)y") }
    if let relation = caregiver.relation, !relation.isEmpty { details.append(relation) }
    return details.joined(separator: " · ")
  }
}

private struct MentalHealthWidgetView: View {
  let entry: SynapseProvider.Entry
  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    let palette = palette(for: entry.snapshot.appearance, colorScheme: colorScheme)
    let mental = entry.snapshot.mentalHealth

    WidgetCard(palette: palette) {
      VStack(alignment: .leading, spacing: 6) {
        WidgetHeader(label: "Mental Health", status: mental.statusLabel, tone: mental.tone, palette: palette)
        StoryHeadline(text: mental.headline, palette: palette, size: 20)
        Spacer(minLength: 0)
        TrendStrip(tones: mental.trendTones, palette: palette, height: 20)
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
      VStack(alignment: .leading, spacing: 6) {
        WidgetHeader(label: labs.title, status: labs.statusLabel, tone: labs.tone, palette: palette)
        StoryHeadline(text: labs.headline, palette: palette, size: 20)
        SupportLine(text: labs.supportText, palette: palette)
        Spacer(minLength: 0)
        ProgressBar(progress: labs.progress, color: accent, palette: palette)
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

    WidgetCard(palette: palette) {
      VStack(alignment: .leading, spacing: 10) {
        WidgetHeader(label: "14-Day Report", status: report.statusLabel, tone: report.tone, palette: palette)
        StoryHeadline(text: report.headline, palette: palette, size: 22)
        metricGrid(report.gridCells, palette: palette)
        Spacer(minLength: 0)
        ForEach(Array(report.actionRows.prefix(2).enumerated()), id: \.offset) { _, row in
          AccentRow(tone: row.tone, title: row.title, subtitle: row.subtitle, trailing: row.trailing, palette: palette)
        }
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
      HStack(spacing: 12) {
        VStack(alignment: .leading, spacing: 6) {
          WidgetHeader(
            label: "Meds",
            status: medication?.statusLabel ?? "Done",
            tone: medication?.tone ?? "green",
            palette: palette
          )
          MetricHero(text: medication?.heroTimeText ?? "Done", palette: palette, size: 28)
          SupportLine(text: medication?.secondaryLine ?? "Stay on track", palette: palette)
          Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)

        Rectangle().fill(palette.line).frame(width: 1).padding(.vertical, 2)

        VStack(alignment: .leading, spacing: 6) {
          WidgetHeader(
            label: "Visit",
            status: appointment?.statusLabel ?? "None",
            tone: appointment?.tone ?? "blue",
            palette: palette
          )
          StoryHeadline(text: appointment?.doctorName ?? "No visit", palette: palette, size: 15)
          SupportLine(text: appointment?.whenText ?? "Add one in Synapse", palette: palette)
          Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
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
        .widgetURL(SynapseWidgetDestination.url(for: "recovery"))
    }
    .configurationDisplayName("Recovery Today")
    .description("See your recovery story and soft progress.")
    .supportedFamilies([.systemMedium])
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
    .description("Soft daily hydration progress and sip nudge.")
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
    .description("Hours since last rescue med and safe window.")
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
    .description("Next dose time with a quiet reminder.")
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
    .description("Severity hero with watch/up status.")
    .supportedFamilies([.systemSmall])
    .contentMarginsDisabled()
  }
}

struct SynapseSleepWidget: Widget {
  let kind = "SynapseSleepWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SynapseProvider()) { entry in
      SleepWidgetView(entry: entry)
        .widgetURL(SynapseWidgetDestination.url(for: "daily-log"))
    }
    .configurationDisplayName("Sleep")
    .description("Sleep score with a gentle pacing note.")
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
    .description("Active sick-mode action and stress-dose cue.")
    .supportedFamilies([.systemSmall])
    .contentMarginsDisabled()
  }
}

struct SynapseFlareForecastWidget: Widget {
  let kind = "SynapseFlareForecastWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SynapseProvider()) { entry in
      FlareForecastWidgetView(entry: entry)
        .widgetURL(SynapseWidgetDestination.url(for: "reports"))
    }
    .configurationDisplayName("Flare Forecast")
    .description("Cautious pattern story from today’s factors.")
    .supportedFamilies([.systemMedium])
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
    .description("Today’s check-in with metric grid and next action.")
    .supportedFamilies([.systemLarge])
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
    .description("Taken/left grid with upcoming dose rows.")
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
    .description("Visit + report packet rows for prep.")
    .supportedFamilies([.systemMedium])
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
    .description("Share today summary when something needs attention.")
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
    .configurationDisplayName("Mental Health")
    .description("Energy/stress headline with gentle trend dots.")
    .supportedFamilies([.systemMedium])
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
    .description("Cautious lab headline with review status.")
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
    .description("Two-week pattern grid and report actions.")
    .supportedFamilies([.systemLarge])
    .contentMarginsDisabled()
  }
}

struct SynapseOverviewWidget: Widget {
  let kind = "SynapseOverviewWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SynapseProvider()) { entry in
      OverviewWidgetView(entry: entry)
        .widgetURL(SynapseWidgetDestination.url(for: "dashboard"))
    }
    .configurationDisplayName("Synapse Overview")
    .description("Next medication and next appointment side by side.")
    .supportedFamilies([.systemMedium])
    .contentMarginsDisabled()
  }
}
