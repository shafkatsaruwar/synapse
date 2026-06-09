import EventKit
import Foundation

@objc(SynapseCalendarBridge)
final class SynapseCalendarBridge: NSObject {
  private let eventStore = EKEventStore()
  private let isoFormatter: ISO8601DateFormatter = {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter
  }()
  private let fallbackISOFormatter = ISO8601DateFormatter()

  @objc
  static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc(requestAccess:rejecter:)
  func requestAccess(
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let finish: (Bool, Error?) -> Void = { granted, error in
      if let error {
        reject("calendar_permission_failed", "Could not request Apple Calendar access.", error)
        return
      }
      resolve(granted)
    }

    if #available(iOS 17.0, *) {
      eventStore.requestFullAccessToEvents(completion: finish)
    } else {
      eventStore.requestAccess(to: .event, completion: finish)
    }
  }

  @objc(getEvents:endISO:resolver:rejecter:)
  func getEvents(
    _ startISO: String,
    endISO: String,
    resolver resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    guard let startDate = parseISODate(startISO),
      let endDate = parseISODate(endISO)
    else {
      reject("invalid_date_range", "Could not read the calendar import date range.", nil)
      return
    }

    let status = EKEventStore.authorizationStatus(for: .event)
    let isAuthorized: Bool
    if #available(iOS 17.0, *) {
      isAuthorized = status == .fullAccess
    } else {
      isAuthorized = status == .authorized
    }

    guard isAuthorized else {
      reject("calendar_not_authorized", "Synapse does not have Apple Calendar access.", nil)
      return
    }

    let predicate = eventStore.predicateForEvents(withStart: startDate, end: endDate, calendars: nil)
    let events = eventStore.events(matching: predicate)
      .filter { !$0.isAllDay }
      .sorted { $0.startDate < $1.startDate }
      .prefix(100)
      .map(eventDictionary)

    resolve(Array(events))
  }

  private func eventDictionary(_ event: EKEvent) -> [String: Any] {
    [
      "id": event.eventIdentifier ?? UUID().uuidString,
      "title": event.title ?? "Appointment",
      "startDate": isoFormatter.string(from: event.startDate),
      "endDate": isoFormatter.string(from: event.endDate),
      "location": event.location ?? "",
      "notes": event.notes ?? "",
      "calendarTitle": event.calendar.title,
    ]
  }

  private func parseISODate(_ value: String) -> Date? {
    isoFormatter.date(from: value) ?? fallbackISOFormatter.date(from: value)
  }
}
