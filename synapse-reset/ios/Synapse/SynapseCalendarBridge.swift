import EventKit
import CoreLocation
import Foundation
import MapKit

@objc(SynapseCalendarBridge)
final class SynapseCalendarBridge: NSObject, CLLocationManagerDelegate {
  private let eventStore = EKEventStore()
  private let locationManager = CLLocationManager()
  private var pendingTravelResolve: RCTPromiseResolveBlock?
  private var pendingTravelReject: RCTPromiseRejectBlock?
  private var pendingTravelDestination: CLLocation?
  private var pendingTravelAllowsPermissionPrompt = false
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

  override init() {
    super.init()
    locationManager.delegate = self
    locationManager.desiredAccuracy = kCLLocationAccuracyReduced
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

  @objc(getTravelEstimate:allowPermissionPrompt:resolver:rejecter:)
  func getTravelEstimate(
    _ destination: String,
    allowPermissionPrompt: NSNumber,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let trimmedDestination = destination.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmedDestination.isEmpty else {
      resolve(NSNull())
      return
    }

    CLGeocoder().geocodeAddressString(trimmedDestination) { [weak self] placemarks, error in
      guard let self else { return }
      if let error {
        reject("travel_geocode_failed", "Could not find that appointment location.", error)
        return
      }
      guard let destinationLocation = placemarks?.first?.location else {
        reject("travel_destination_missing", "Could not find that appointment location.", nil)
        return
      }

      DispatchQueue.main.async {
        self.pendingTravelResolve = resolve
        self.pendingTravelReject = reject
        self.pendingTravelDestination = destinationLocation
        self.pendingTravelAllowsPermissionPrompt = allowPermissionPrompt.boolValue
        self.requestCurrentVicinity()
      }
    }
  }

  private func requestCurrentVicinity() {
    let status = locationManager.authorizationStatus
    switch status {
    case .authorizedAlways, .authorizedWhenInUse:
      locationManager.requestLocation()
    case .notDetermined:
      if pendingTravelAllowsPermissionPrompt {
        locationManager.requestWhenInUseAuthorization()
      } else {
        finishTravelEstimate(result: nil)
      }
    case .denied, .restricted:
      finishTravelEstimate(result: nil)
    @unknown default:
      finishTravelEstimate(result: nil)
    }
  }

  func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    guard pendingTravelResolve != nil else { return }
    requestCurrentVicinity()
  }

  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    guard let currentLocation = locations.last, let destination = pendingTravelDestination else {
      finishTravelEstimate(result: nil)
      return
    }
    calculateTravelTime(from: currentLocation, to: destination)
  }

  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    finishTravelEstimate(result: nil)
  }

  private func calculateTravelTime(from currentLocation: CLLocation, to destination: CLLocation) {
    let roundedCoordinate = CLLocationCoordinate2D(
      latitude: (currentLocation.coordinate.latitude * 20).rounded() / 20,
      longitude: (currentLocation.coordinate.longitude * 20).rounded() / 20
    )

    let request = MKDirections.Request()
    request.source = MKMapItem(placemark: MKPlacemark(coordinate: roundedCoordinate))
    request.destination = MKMapItem(placemark: MKPlacemark(coordinate: destination.coordinate))
    request.transportType = .automobile

    MKDirections(request: request).calculate { [weak self] response, error in
      guard let self else { return }
      if error != nil {
        self.finishTravelEstimate(result: nil)
        return
      }
      guard let route = response?.routes.sorted(by: { $0.expectedTravelTime < $1.expectedTravelTime }).first else {
        self.finishTravelEstimate(result: nil)
        return
      }

      let minutes = max(1, Int(ceil(route.expectedTravelTime / 60)))
      self.finishTravelEstimate(result: [
        "travelMinutes": minutes,
        "travelText": "\(minutes) min drive",
        "source": "approximate_vicinity",
      ])
    }
  }

  private func finishTravelEstimate(result: [String: Any]?) {
    let resolve = pendingTravelResolve
    pendingTravelResolve = nil
    pendingTravelReject = nil
    pendingTravelDestination = nil
    pendingTravelAllowsPermissionPrompt = false
    resolve?(result ?? NSNull())
  }
}
