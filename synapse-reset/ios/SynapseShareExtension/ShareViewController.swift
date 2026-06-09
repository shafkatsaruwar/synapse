import UIKit
import UniformTypeIdentifiers

private let appGroupSuiteName = "group.com.mohammedsaruwar.synapse"
private let pendingImportKey = "synapse_pending_ics_import"

struct ImportedCalendarEvent: Codable {
  var title: String
  var date: String
  var time: String
  var endTime: String
  var location: String
  var notes: String
}

struct ImportedCalendarPayload: Codable {
  var events: [ImportedCalendarEvent]
  var importedAt: String
}

final class ShareViewController: UIViewController {
  private let titleLabel = UILabel()
  private let detailLabel = UILabel()
  private let openButton = UIButton(type: .system)
  private let cancelButton = UIButton(type: .system)
  private var didPrepareImport = false

  override func viewDidLoad() {
    super.viewDidLoad()
    configureView()
  }

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    guard !didPrepareImport else { return }
    didPrepareImport = true
    Task { await prepareCalendarImport() }
  }

  private func configureView() {
    view.backgroundColor = .systemBackground

    titleLabel.text = "Import to Synapse"
    titleLabel.font = .systemFont(ofSize: 24, weight: .bold)
    titleLabel.textColor = .label
    titleLabel.textAlignment = .center

    detailLabel.text = "Reading appointment file..."
    detailLabel.font = .systemFont(ofSize: 16, weight: .regular)
    detailLabel.textColor = .secondaryLabel
    detailLabel.textAlignment = .center
    detailLabel.numberOfLines = 0

    openButton.setTitle("Open Synapse", for: .normal)
    openButton.titleLabel?.font = .systemFont(ofSize: 18, weight: .semibold)
    openButton.backgroundColor = .systemBlue
    openButton.tintColor = .white
    openButton.layer.cornerRadius = 14
    openButton.contentEdgeInsets = UIEdgeInsets(top: 14, left: 18, bottom: 14, right: 18)
    openButton.isEnabled = false
    openButton.alpha = 0.55
    openButton.addTarget(self, action: #selector(openSynapseTapped), for: .touchUpInside)

    cancelButton.setTitle("Cancel", for: .normal)
    cancelButton.titleLabel?.font = .systemFont(ofSize: 16, weight: .medium)
    cancelButton.addTarget(self, action: #selector(cancelTapped), for: .touchUpInside)

    let stack = UIStackView(arrangedSubviews: [titleLabel, detailLabel, openButton, cancelButton])
    stack.axis = .vertical
    stack.alignment = .fill
    stack.spacing = 18
    stack.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(stack)

    NSLayoutConstraint.activate([
      stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
      stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
      stack.centerYAnchor.constraint(equalTo: view.centerYAnchor),
      openButton.heightAnchor.constraint(greaterThanOrEqualToConstant: 54),
    ])
  }

  private func prepareCalendarImport() async {
    guard let providers = extensionContext?.inputItems
      .compactMap({ $0 as? NSExtensionItem })
      .flatMap({ $0.attachments ?? [] }),
      let provider = providers.first(where: acceptsCalendarFile)
    else {
      await MainActor.run {
        detailLabel.text = "No .ics appointment file was found in the share item."
        openButton.isEnabled = false
        openButton.alpha = 0.55
      }
      return
    }

    let events: [ImportedCalendarEvent]
    do {
      let contents = try await loadICSContents(from: provider)
      events = ICSParser.parse(contents)
    } catch {
      events = []
    }

    savePayload(events: events)
    await MainActor.run {
      detailLabel.text = events.isEmpty
        ? "Synapse received the file, but could not read an appointment. Open Synapse to see the import screen."
        : "Ready to import \(events.count) appointment\(events.count == 1 ? "" : "s")."
      openButton.isEnabled = true
      openButton.alpha = 1
    }
  }

  private func acceptsCalendarFile(_ provider: NSItemProvider) -> Bool {
    provider.hasItemConformingToTypeIdentifier("public.calendar-event")
      || provider.hasItemConformingToTypeIdentifier("com.apple.ical.ics")
      || provider.registeredTypeIdentifiers.contains { $0.lowercased().contains("ics") }
  }

  private func loadICSContents(from provider: NSItemProvider) async throws -> String {
    let type = ["public.calendar-event", "com.apple.ical.ics"]
      .first(where: { provider.hasItemConformingToTypeIdentifier($0) })
      ?? provider.registeredTypeIdentifiers.first(where: { $0.lowercased().contains("ics") })
      ?? "public.data"

    if let contents = try? await loadFileContents(from: provider, type: type) {
      return contents
    }

    return try await withCheckedThrowingContinuation { continuation in
      provider.loadItem(forTypeIdentifier: type, options: nil) { item, error in
        if let error {
          continuation.resume(throwing: error)
          return
        }

        if let url = item as? URL {
          do {
            continuation.resume(returning: try String(contentsOf: url, encoding: .utf8))
          } catch {
            continuation.resume(throwing: error)
          }
          return
        }

        if let data = item as? Data, let text = String(data: data, encoding: .utf8) {
          continuation.resume(returning: text)
          return
        }

        if let text = item as? String {
          continuation.resume(returning: text)
          return
        }

        continuation.resume(throwing: NSError(domain: "SynapseShareExtension", code: 1))
      }
    }
  }

  private func loadFileContents(from provider: NSItemProvider, type: String) async throws -> String {
    try await withCheckedThrowingContinuation { continuation in
      provider.loadFileRepresentation(forTypeIdentifier: type) { url, error in
        if let error {
          continuation.resume(throwing: error)
          return
        }
        guard let url else {
          continuation.resume(throwing: NSError(domain: "SynapseShareExtension", code: 2))
          return
        }
        do {
          continuation.resume(returning: try String(contentsOf: url, encoding: .utf8))
        } catch {
          continuation.resume(throwing: error)
        }
      }
    }
  }

  private func savePayload(events: [ImportedCalendarEvent]) {
    let payload = ImportedCalendarPayload(events: events, importedAt: ISO8601DateFormatter().string(from: Date()))
    guard let data = try? JSONEncoder().encode(payload),
      let json = String(data: data, encoding: .utf8)
    else {
      UserDefaults(suiteName: appGroupSuiteName)?.set(#"{"events":[],"importedAt":""}"#, forKey: pendingImportKey)
      return
    }
    UserDefaults(suiteName: appGroupSuiteName)?.set(json, forKey: pendingImportKey)
  }

  @objc private func openSynapseTapped() {
    Task { await openMainApp() }
  }

  @objc private func cancelTapped() {
    finish()
  }

  private func openMainApp() async {
    guard let url = URL(string: "myapp:///import/appointment") else { return }
    let openedWithContext = await withCheckedContinuation { continuation in
      extensionContext?.open(url) { completed in
        continuation.resume(returning: completed)
      }
    }
    if !openedWithContext {
      await MainActor.run {
        openViaResponderChain(url)
      }
    }
    try? await Task.sleep(nanoseconds: 500_000_000)
    finish()
  }

  private func openViaResponderChain(_ url: URL) {
    var responder: UIResponder? = self
    while let current = responder {
      if let application = current as? UIApplication {
        application.open(url)
        return
      }
      responder = current.next
    }
  }

  private func finish() {
    extensionContext?.completeRequest(returningItems: nil)
  }
}

enum ICSParser {
  static func parse(_ raw: String) -> [ImportedCalendarEvent] {
    let lines = unfold(raw)
    var events: [[String: String]] = []
    var current: [String: String]?

    for line in lines {
      if line.uppercased() == "BEGIN:VEVENT" {
        current = [:]
        continue
      }
      if line.uppercased() == "END:VEVENT" {
        if let current { events.append(current) }
        current = nil
        continue
      }
      guard current != nil, let split = line.firstIndex(of: ":") else { continue }
      let left = String(line[..<split])
      let value = String(line[line.index(after: split)...])
      let key = left.split(separator: ";", maxSplits: 1).first.map(String.init)?.uppercased() ?? left.uppercased()
      current?[key] = value
      if left.uppercased().hasPrefix("DTSTART;") { current?["DTSTART_PARAMS"] = left }
      if left.uppercased().hasPrefix("DTEND;") { current?["DTEND_PARAMS"] = left }
    }

    return events.map { event in
      let start = parseDate(event["DTSTART"] ?? "", params: event["DTSTART_PARAMS"] ?? "")
      let end = parseDate(event["DTEND"] ?? "", params: event["DTEND_PARAMS"] ?? "")
      return ImportedCalendarEvent(
        title: clean(event["SUMMARY"]) ||| "Appointment",
        date: start.date,
        time: start.time,
        endTime: end.time,
        location: clean(event["LOCATION"]),
        notes: clean(event["DESCRIPTION"])
      )
    }
  }

  private static func unfold(_ raw: String) -> [String] {
    raw
      .replacingOccurrences(of: "\r\n", with: "\n")
      .replacingOccurrences(of: "\r", with: "\n")
      .split(separator: "\n", omittingEmptySubsequences: false)
      .reduce(into: [String]()) { result, part in
        let line = String(part)
        if line.hasPrefix(" ") || line.hasPrefix("\t"), let last = result.indices.last {
          result[last] += String(line.dropFirst())
        } else {
          result.append(line)
        }
      }
  }

  private static func clean(_ value: String?) -> String {
    (value ?? "")
      .replacingOccurrences(of: "\\n", with: "\n")
      .replacingOccurrences(of: "\\,", with: ",")
      .replacingOccurrences(of: "\\;", with: ";")
      .replacingOccurrences(of: "\\\\", with: "\\")
      .trimmingCharacters(in: .whitespacesAndNewlines)
  }

  private static func parseDate(_ value: String, params: String) -> (date: String, time: String) {
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return ("", "") }

    let tzid = params
      .split(separator: ";")
      .first(where: { $0.uppercased().hasPrefix("TZID=") })
      .map { String($0.dropFirst(5)) }
    let sourceTimeZone = trimmed.hasSuffix("Z") ? TimeZone(secondsFromGMT: 0) : tzid.flatMap(TimeZone.init(identifier:))

    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = sourceTimeZone ?? TimeZone.current

    for format in ["yyyyMMdd'T'HHmmss'Z'", "yyyyMMdd'T'HHmmss", "yyyyMMdd'T'HHmm", "yyyyMMdd"] {
      formatter.dateFormat = format
      if let date = formatter.date(from: trimmed) {
        let outDate = DateFormatter()
        outDate.locale = Locale(identifier: "en_US_POSIX")
        outDate.timeZone = .current
        outDate.dateFormat = "yyyy-MM-dd"

        let outTime = DateFormatter()
        outTime.locale = Locale(identifier: "en_US_POSIX")
        outTime.timeZone = .current
        outTime.dateFormat = "HH:mm"
        return (outDate.string(from: date), format == "yyyyMMdd" ? "" : outTime.string(from: date))
      }
    }

    return ("", "")
  }
}

infix operator |||: NilCoalescingPrecedence
private func ||| (left: String, right: String) -> String {
  left.isEmpty ? right : left
}
