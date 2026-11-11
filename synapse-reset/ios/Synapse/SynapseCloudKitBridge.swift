import CloudKit
import Foundation

@objc(SynapseCloudKitBridge)
final class SynapseCloudKitBridge: NSObject {
  private let container = CKContainer(identifier: "iCloud.com.mohammedsaruwar.synapse")
  private let recordType = "UserData"
  private let legacyRecordName = "current-user-data"
  private let indexRecordName = "synapse-backup-index"
  private let recordNamePrefix = "backup-"
  private let payloadAssetFileName = "synapse-cloudkit-backup.json"
  private let maxSnapshots = 10
  private let isoFormatter: ISO8601DateFormatter = {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter
  }()
  private let fallbackISOFormatter = ISO8601DateFormatter()

  private var database: CKDatabase {
    container.privateCloudDatabase
  }

  @objc
  static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc(getStatus:rejecter:)
  func getStatus(
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    container.accountStatus { status, error in
      if let error {
        reject("icloud_status_failed", "Could not check iCloud status: \(self.describe(error))", error)
        return
      }

      resolve([
        "available": status == .available,
        "status": self.statusString(status),
      ])
    }
  }

  @objc(fetchBackupMetadata:rejecter:)
  func fetchBackupMetadata(
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    checkAccountAvailable(resolve: resolve, reject: reject) {
      self.fetchLatestUserDataRecord { result in
        switch result {
        case .success(let record):
          guard let record else {
            resolve(NSNull())
            return
          }
          resolve(self.metadataDictionary(from: record))
        case .failure(let error):
          reject("icloud_fetch_failed", "Could not fetch iCloud backup metadata: \(self.describe(error))", error)
        }
      }
    }
  }

  @objc(savePayload:lastUpdatedISO:schemaVersion:summaryJson:encrypted:resolver:rejecter:)
  func savePayload(
    _ payload: String,
    lastUpdatedISO: String,
    schemaVersion: NSNumber,
    summaryJson: String,
    encrypted: Bool,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    checkAccountAvailable(resolve: resolve, reject: reject) {
      self.container.fetchUserRecordID { userRecordID, userError in
        if let userError {
          reject("icloud_user_failed", "Could not identify the iCloud user: \(self.describe(userError))", userError)
          return
        }

        let lastUpdated = self.parseISODate(lastUpdatedISO) ?? Date()
        let userId = (userRecordID?.recordName ?? "unknown")
        let snapshotName = self.backupRecordName(for: lastUpdated)

        // 1) Upsert stable "latest" record (no query index required).
        let latestID = CKRecord.ID(recordName: self.legacyRecordName)
        self.database.fetch(withRecordID: latestID) { existing, fetchError in
          if let fetchError = fetchError as? CKError, fetchError.code != .unknownItem {
            reject("icloud_save_failed", "Could not prepare iCloud backup: \(self.describe(fetchError))", fetchError)
            return
          }
          if let fetchError, (fetchError as? CKError) == nil {
            reject("icloud_save_failed", "Could not prepare iCloud backup: \(self.describe(fetchError))", fetchError)
            return
          }

          let latest = existing ?? CKRecord(recordType: self.recordType, recordID: latestID)
          self.applyPayloadFields(
            to: latest,
            payload: payload,
            userId: userId,
            lastUpdated: lastUpdated,
            schemaVersion: schemaVersion.intValue,
            summaryJson: summaryJson,
            encrypted: encrypted,
            kind: "latest"
          )

          self.saveUserDataRecord(latest, payload: payload, preferAsset: true) { latestResult in
            switch latestResult {
            case .failure(let error):
              reject("icloud_save_failed", "Could not save iCloud backup: \(self.describe(error))", error)
            case .success(let savedLatest):
              // 2) Best-effort snapshot + index. Latest already confirmed — never fail the
              //    overall backup if snapshot bookkeeping hits a schema/query limit.
              self.saveSnapshotAndIndex(
                payload: payload,
                userId: userId,
                lastUpdated: lastUpdated,
                schemaVersion: schemaVersion.intValue,
                summaryJson: summaryJson,
                encrypted: encrypted,
                snapshotName: snapshotName
              ) {
                resolve(self.metadataDictionary(from: savedLatest))
              }
            }
          }
        }
      }
    }
  }

  @objc(restorePayload:rejecter:)
  func restorePayload(
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    checkAccountAvailable(resolve: resolve, reject: reject) {
      self.fetchLatestUserDataRecord { result in
        switch result {
        case .success(let record):
          guard let record else {
            resolve(NSNull())
            return
          }
          let payload = self.payloadString(from: record)
          guard let payload else {
            resolve(NSNull())
            return
          }
          var dictionary = self.metadataDictionary(from: record)
          dictionary["payload"] = payload
          resolve(dictionary)
        case .failure(let error):
          reject("icloud_restore_failed", "Could not restore iCloud backup: \(self.describe(error))", error)
        }
      }
    }
  }

  @objc(restorePayloadByRecordName:resolver:rejecter:)
  func restorePayloadByRecordName(
    _ recordName: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    checkAccountAvailable(resolve: resolve, reject: reject) {
      let recordID = CKRecord.ID(recordName: recordName)
      self.database.fetch(withRecordID: recordID) { record, error in
        if let ckError = error as? CKError, ckError.code == .unknownItem {
          resolve(NSNull())
          return
        }
        if let error {
          reject("icloud_restore_failed", "Could not restore iCloud backup: \(self.describe(error))", error)
          return
        }
        guard let record, let payload = self.payloadString(from: record) else {
          resolve(NSNull())
          return
        }
        var dictionary = self.metadataDictionary(from: record)
        dictionary["payload"] = payload
        resolve(dictionary)
      }
    }
  }

  @objc(listSnapshots:rejecter:)
  func listSnapshots(
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    checkAccountAvailable(resolve: resolve, reject: reject) {
      self.loadSnapshotIndex { entries in
        // Always include the stable latest record if present.
        self.fetchUserDataRecord { result in
          var rows: [[String: Any]] = entries
          if case .success(let latest) = result, let latest {
            let meta = self.snapshotDictionary(from: latest)
            if !rows.contains(where: { ($0["recordName"] as? String) == self.legacyRecordName }) {
              rows.insert(meta, at: 0)
            }
          }
          resolve(rows)
        }
      }
    }
  }

  // MARK: - Private

  private func saveSnapshotAndIndex(
    payload: String,
    userId: String,
    lastUpdated: Date,
    schemaVersion: Int,
    summaryJson: String,
    encrypted: Bool,
    snapshotName: String,
    completion: @escaping () -> Void
  ) {
    let snapshotID = CKRecord.ID(recordName: snapshotName)
    let snapshot = CKRecord(recordType: recordType, recordID: snapshotID)
    applyPayloadFields(
      to: snapshot,
      payload: payload,
      userId: userId,
      lastUpdated: lastUpdated,
      schemaVersion: schemaVersion,
      summaryJson: summaryJson,
      encrypted: encrypted,
      kind: "snapshot"
    )

    saveUserDataRecord(snapshot, payload: payload, preferAsset: true) { snapshotResult in
      switch snapshotResult {
      case .failure:
        completion()
      case .success(let savedSnapshot):
        self.updateIndex(with: savedSnapshot) {
          self.pruneSnapshotsIfNeeded(completion: completion)
        }
      }
    }
  }

  private func updateIndex(with snapshot: CKRecord, completion: @escaping () -> Void) {
    loadSnapshotIndex { existing in
      var entries = existing.filter { ($0["recordName"] as? String) != snapshot.recordID.recordName }
      entries.insert(self.snapshotDictionary(from: snapshot), at: 0)
      if entries.count > self.maxSnapshots {
        entries = Array(entries.prefix(self.maxSnapshots))
      }
      self.persistSnapshotIndex(entries, completion: completion)
    }
  }

  private func pruneSnapshotsIfNeeded(completion: @escaping () -> Void) {
    loadSnapshotIndex { entries in
      guard entries.count > self.maxSnapshots else {
        completion()
        return
      }
      let keep = Array(entries.prefix(self.maxSnapshots))
      let drop = Array(entries.dropFirst(self.maxSnapshots))
      let ids = drop.compactMap { entry -> CKRecord.ID? in
        guard let name = entry["recordName"] as? String, name != self.legacyRecordName else { return nil }
        return CKRecord.ID(recordName: name)
      }
      guard !ids.isEmpty else {
        self.persistSnapshotIndex(keep, completion: completion)
        return
      }
      // Never wipe the whole history in one shot if the index is wrong — delete only listed extras.
      let op = CKModifyRecordsOperation(recordsToSave: nil, recordIDsToDelete: ids)
      op.modifyRecordsResultBlock = { _ in
        self.persistSnapshotIndex(keep, completion: completion)
      }
      self.database.add(op)
    }
  }

  private func loadSnapshotIndex(completion: @escaping ([[String: Any]]) -> Void) {
    let recordID = CKRecord.ID(recordName: indexRecordName)
    database.fetch(withRecordID: recordID) { record, error in
      if let ckError = error as? CKError, ckError.code == .unknownItem {
        completion([])
        return
      }
      if error != nil {
        completion([])
        return
      }
      guard let payload = record.flatMap({ self.payloadString(from: $0) }),
            let data = payload.data(using: .utf8),
            let json = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]
      else {
        completion([])
        return
      }
      completion(json)
    }
  }

  private func persistSnapshotIndex(_ entries: [[String: Any]], completion: @escaping () -> Void) {
    let recordID = CKRecord.ID(recordName: indexRecordName)
    database.fetch(withRecordID: recordID) { existing, _ in
      let record = existing ?? CKRecord(recordType: self.recordType, recordID: recordID)
      guard let data = try? JSONSerialization.data(withJSONObject: entries, options: []),
            let json = String(data: data, encoding: .utf8)
      else {
        completion()
        return
      }
      record["userId"] = "index" as CKRecordValue
      record["lastUpdated"] = Date() as CKRecordValue
      record["kind"] = "index" as CKRecordValue
      record["schemaVersion"] = 1 as CKRecordValue
      record["encrypted"] = 0 as CKRecordValue
      record["summaryJson"] = "{\"entryCount\":\(entries.count)}" as CKRecordValue
      record["payload"] = json as CKRecordValue
      record["payloadAsset"] = nil

      self.database.save(record) { _, _ in
        completion()
      }
    }
  }

  private func applyPayloadFields(
    to record: CKRecord,
    payload: String,
    userId: String,
    lastUpdated: Date,
    schemaVersion: Int,
    summaryJson: String,
    encrypted: Bool,
    kind: String
  ) {
    record["userId"] = userId as CKRecordValue
    record["lastUpdated"] = lastUpdated as CKRecordValue
    record["schemaVersion"] = schemaVersion as CKRecordValue
    record["summaryJson"] = summaryJson as CKRecordValue
    record["encrypted"] = (encrypted ? 1 : 0) as CKRecordValue
    record["kind"] = kind as CKRecordValue

    if let asset = makePayloadAsset(payload) {
      record["payloadAsset"] = asset
      record["payload"] = nil
    } else {
      record["payload"] = payload as CKRecordValue
    }
  }

  private func saveUserDataRecord(
    _ record: CKRecord,
    payload: String,
    preferAsset: Bool,
    completion: @escaping (Result<CKRecord, Error>) -> Void
  ) {
    database.save(record) { savedRecord, saveError in
      if let saveError {
        // Production schema may lack newer optional fields or payloadAsset.
        if self.isMissingFieldError(saveError) {
          if preferAsset {
            record["payloadAsset"] = nil
            record["payload"] = payload as CKRecordValue
          }
          // Strip metadata fields that may not exist in Production yet.
          record["schemaVersion"] = nil
          record["summaryJson"] = nil
          record["encrypted"] = nil
          record["kind"] = nil
          self.database.save(record) { fallbackRecord, fallbackError in
            if let fallbackError {
              completion(.failure(fallbackError))
              return
            }
            completion(.success(fallbackRecord ?? record))
          }
          return
        }
        completion(.failure(saveError))
        return
      }
      completion(.success(savedRecord ?? record))
    }
  }

  private func isMissingFieldError(_ error: Error) -> Bool {
    let nsError = error as NSError
    let message = nsError.localizedDescription.lowercased()
    return message.contains("payloadasset")
      || message.contains("summaryjson")
      || message.contains("schemaversion")
      || message.contains("encrypted")
      || message.contains("kind")
      || (message.contains("field") && message.contains("not"))
      || (error as? CKError)?.code == .invalidArguments
  }

  private func checkAccountAvailable(
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock,
    run work: @escaping () -> Void
  ) {
    container.accountStatus { status, error in
      if let error {
        reject("icloud_status_failed", "Could not check iCloud status: \(self.describe(error))", error)
        return
      }

      guard status == .available else {
        resolve([
          "available": false,
          "status": self.statusString(status),
        ])
        return
      }

      work()
    }
  }

  private func fetchUserDataRecord(completion: @escaping (Result<CKRecord?, Error>) -> Void) {
    let recordID = CKRecord.ID(recordName: legacyRecordName)
    database.fetch(withRecordID: recordID) { record, error in
      if let ckError = error as? CKError, ckError.code == .unknownItem {
        completion(.success(nil))
        return
      }
      if let error {
        completion(.failure(error))
        return
      }
      completion(.success(record))
    }
  }

  private func fetchLatestUserDataRecord(completion: @escaping (Result<CKRecord?, Error>) -> Void) {
    // Prefer the stable record first — does not require Production query indexes.
    fetchUserDataRecord { legacyResult in
      switch legacyResult {
      case .failure(let error):
        completion(.failure(error))
      case .success(let legacyRecord):
        completion(.success(legacyRecord))
      }
    }
  }

  private func metadataDictionary(from record: CKRecord) -> [String: Any] {
    let lastUpdated = record["lastUpdated"] as? Date
    let schemaVersion = record["schemaVersion"] as? Int ?? (record["schemaVersion"] as? NSNumber)?.intValue
    let encryptedNumber = record["encrypted"] as? Int ?? (record["encrypted"] as? NSNumber)?.intValue
    return [
      "available": true,
      "recordName": record.recordID.recordName,
      "userId": (record["userId"] as? String) ?? "",
      "lastUpdated": lastUpdated.map { isoFormatter.string(from: $0) } ?? "",
      "schemaVersion": schemaVersion ?? 1,
      "summaryJson": (record["summaryJson"] as? String) ?? "",
      "encrypted": (encryptedNumber ?? 0) == 1,
    ]
  }

  private func snapshotDictionary(from record: CKRecord) -> [String: Any] {
    let meta = metadataDictionary(from: record)
    var row: [String: Any] = [
      "recordName": meta["recordName"] as? String ?? record.recordID.recordName,
      "createdAt": meta["lastUpdated"] as? String ?? "",
      "schemaVersion": meta["schemaVersion"] as? Int ?? 1,
      "encrypted": meta["encrypted"] as? Bool ?? false,
      "summaryJson": meta["summaryJson"] as? String ?? "",
    ]
    if let summaryJson = meta["summaryJson"] as? String,
       let data = summaryJson.data(using: .utf8),
       let summary = try? JSONSerialization.jsonObject(with: data) {
      row["summary"] = summary
    }
    return row
  }

  private func makePayloadAsset(_ payload: String) -> CKAsset? {
    do {
      let directory = FileManager.default.temporaryDirectory.appendingPathComponent("SynapseCloudKit", isDirectory: true)
      try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
      let fileURL = directory.appendingPathComponent(payloadAssetFileName)
      try payload.data(using: .utf8)?.write(to: fileURL, options: [.atomic])
      return CKAsset(fileURL: fileURL)
    } catch {
      return nil
    }
  }

  private func payloadString(from record: CKRecord) -> String? {
    if let payload = record["payload"] as? String {
      return payload
    }
    guard let asset = record["payloadAsset"] as? CKAsset, let fileURL = asset.fileURL else {
      return nil
    }
    return try? String(contentsOf: fileURL, encoding: .utf8)
  }

  private func parseISODate(_ value: String) -> Date? {
    isoFormatter.date(from: value) ?? fallbackISOFormatter.date(from: value)
  }

  private func backupRecordName(for date: Date) -> String {
    let safeTimestamp = isoFormatter
      .string(from: date)
      .replacingOccurrences(of: ":", with: "-")
      .replacingOccurrences(of: ".", with: "-")
    return "\(recordNamePrefix)\(safeTimestamp)-\(UUID().uuidString)"
  }

  /// Human-readable description of a CloudKit error, including the CKError code so
  /// failures like a missing Production record type ("UserData") are diagnosable
  /// instead of hidden behind a generic message.
  private func describe(_ error: Error) -> String {
    let nsError = error as NSError
    return "\(nsError.localizedDescription) [\(nsError.domain) \(nsError.code)]"
  }

  private func statusString(_ status: CKAccountStatus) -> String {
    switch status {
    case .available:
      return "available"
    case .couldNotDetermine:
      return "could_not_determine"
    case .noAccount:
      return "no_account"
    case .restricted:
      return "restricted"
    case .temporarilyUnavailable:
      return "temporarily_unavailable"
    @unknown default:
      return "unknown"
    }
  }
}
