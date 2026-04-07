import SwiftUI
import WidgetKit

private enum SynapseWidgetStore {
  static let suiteName = "group.com.mohammedsaruwar.synapse"
  static let snapshotKey = "synapse_widget_snapshot"

  static func loadSnapshot() -> SynapseWidgetSnapshot {
    guard
      let defaults = UserDefaults(suiteName: suiteName),
      let raw = defaults.string(forKey: snapshotKey),
      let data = raw.data(using: .utf8),
      let decoded = try? JSONDecoder().decode(SynapseWidgetSnapshot.self, from: data)
    else {
      return .placeholder
    }
    return decoded
  }
}

private struct SynapseWidgetSnapshot: Codable {
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

private enum SynapseWidgetPalette {
  static let skyTop = Color(red: 0.86, green: 0.91, blue: 1.0)
  static let skyBottom = Color(red: 0.79, green: 0.93, blue: 0.92)
  static let card = Color.white.opacity(0.92)
  static let ink = Color(red: 0.09, green: 0.10, blue: 0.14)
  static let muted = Color(red: 0.41, green: 0.45, blue: 0.53)
  static let red = Color(red: 0.70, green: 0.05, blue: 0.18)
  static let blue = Color(red: 0.25, green: 0.46, blue: 0.87)
  static let line = Color.white.opacity(0.45)
}

private struct SynapseWidgetBackground: View {
  var body: some View {
    LinearGradient(
      colors: [SynapseWidgetPalette.skyTop, SynapseWidgetPalette.skyBottom],
      startPoint: .topLeading,
      endPoint: .bottomTrailing
    )
  }
}

private struct MedicationProgressBar: View {
  let progress: Double

  var body: some View {
    ZStack(alignment: .leading) {
      Capsule()
        .fill(SynapseWidgetPalette.line)
        .frame(height: 8)
      Capsule()
        .fill(SynapseWidgetPalette.red)
        .frame(width: max(8, 140 * progress), height: 8)
    }
    .frame(width: 140, alignment: .leading)
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

  var body: some View {
    VStack(alignment: .leading, spacing: compact ? 8 : 10) {
      Text("Next med")
        .font(.caption.weight(.semibold))
        .foregroundStyle(SynapseWidgetPalette.muted)
      if let medication {
        Text(medication.name)
          .font(compact ? .headline : .title3.weight(.bold))
          .foregroundStyle(SynapseWidgetPalette.ink)
          .lineLimit(1)
        Text(medication.detail)
          .font(.caption)
          .foregroundStyle(SynapseWidgetPalette.muted)
          .lineLimit(2)
        HStack(spacing: 8) {
          MedicationProgressBar(progress: medicationProgress(medication))
          Spacer(minLength: 0)
        }
        if let dueAt = medication.dueAt {
          Text(dueAt, style: .timer)
            .font(compact ? .caption.weight(.bold) : .body.weight(.bold))
            .foregroundStyle(SynapseWidgetPalette.red)
          Text("until due")
            .font(.caption2)
            .foregroundStyle(SynapseWidgetPalette.muted)
        } else {
          Text(medication.dueText)
            .font(compact ? .caption.weight(.bold) : .body.weight(.bold))
            .foregroundStyle(SynapseWidgetPalette.red)
        }
      } else {
        Text("No medication due")
          .font(compact ? .headline : .title3.weight(.bold))
          .foregroundStyle(SynapseWidgetPalette.ink)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }
}

private struct AppointmentBlock: View {
  let appointment: SynapseWidgetSnapshot.Appointment?
  let compact: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: compact ? 8 : 10) {
      Text("Next appointment")
        .font(.caption.weight(.semibold))
        .foregroundStyle(SynapseWidgetPalette.muted)
      if let appointment {
        Text(appointment.doctorName)
          .font(compact ? .headline : .title3.weight(.bold))
          .foregroundStyle(SynapseWidgetPalette.ink)
          .lineLimit(1)
        Text(appointment.detail)
          .font(.caption)
          .foregroundStyle(SynapseWidgetPalette.muted)
          .lineLimit(2)
        Text(appointment.whenText)
          .font(compact ? .caption.weight(.bold) : .body.weight(.bold))
          .foregroundStyle(SynapseWidgetPalette.blue)
          .lineLimit(2)
      } else {
        Text("No upcoming appointment")
          .font(compact ? .headline : .title3.weight(.bold))
          .foregroundStyle(SynapseWidgetPalette.ink)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }
}

private struct CombinedWidgetView: View {
  let entry: SynapseProvider.Entry

  var body: some View {
    ZStack {
      SynapseWidgetBackground()
      HStack(spacing: 12) {
        MedBlock(medication: entry.snapshot.medication, compact: false)
          .padding(14)
          .background(SynapseWidgetPalette.card)
          .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        AppointmentBlock(appointment: entry.snapshot.appointment, compact: false)
          .padding(14)
          .background(SynapseWidgetPalette.card)
          .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
      }
      .padding(14)
    }
  }
}

private struct MedicationWidgetView: View {
  let entry: SynapseProvider.Entry

  var body: some View {
    ZStack {
      SynapseWidgetBackground()
      MedBlock(medication: entry.snapshot.medication, compact: true)
        .padding(16)
    }
  }
}

private struct AppointmentWidgetView: View {
  let entry: SynapseProvider.Entry

  var body: some View {
    ZStack {
      SynapseWidgetBackground()
      AppointmentBlock(appointment: entry.snapshot.appointment, compact: true)
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
    }
    .configurationDisplayName("Next Appointment")
    .description("See your next appointment at a glance.")
    .supportedFamilies([.systemSmall])
  }
}
