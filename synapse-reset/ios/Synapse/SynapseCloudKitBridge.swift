import CloudKit
import Foundation

@objc(SynapseCloudKitBridge)
final class SynapseCloudKitBridge: NSObject {
  private let container = CKContainer(identifier: "iCloud.com.mohammedsaruwar.synapse")
  private let recordType = "UserData"
  private let legacyRecordName = "current-user-data"
  private let recordNamePrefix = "backup-"
  private let payloadAssetFileName = "synapse-cloudkit-backup.json"
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
        reject("icloud_status_failed", "Could not check iCloud status.", error)
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
          reject("icloud_fetch_failed", "Could not fetch iCloud backup metadata.", error)
        }
      }
    }
  }

  @objc(savePayload:lastUpdatedISO:resolver:rejecter:)
  func savePayload(
    _ payload: String,
    lastUpdatedISO: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    checkAccountAvailable(resolve: resolve, reject: reject) {
      self.container.fetchUserRecordID { userRecordID, userError in
        if let userError {
          reject("icloud_user_failed", "Could not identify the iCloud user.", userError)
          return
        }

        let lastUpdated = self.parseISODate(lastUpdatedISO) ?? Date()
        let record = CKRecord(
          recordType: self.recordType,
          recordID: CKRecord.ID(recordName: self.backupRecordName(for: lastUpdated))
        )
        record["userId"] = (userRecordID?.recordName ?? "unknown") as CKRecordValue
        record["lastUpdated"] = lastUpdated as CKRecordValue
        if let asset = self.makePayloadAsset(payload) {
          record["payloadAsset"] = asset
          record["payload"] = nil
        } else {
          record["payload"] = payload as CKRecordValue
        }

        self.database.save(record) { savedRecord, saveError in
          if let saveError {
            reject("icloud_save_failed", "Could not save iCloud backup.", saveError)
            return
          }
          resolve(self.metadataDictionary(from: savedRecord ?? record))
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
          reject("icloud_restore_failed", "Could not restore iCloud backup.", error)
        }
      }
    }
  }

  private func checkAccountAvailable(
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock,
    run work: @escaping () -> Void
  ) {
    container.accountStatus { status, error in
      if let error {
        reject("icloud_status_failed", "Could not check iCloud status.", error)
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
    let query = CKQuery(recordType: recordType, predicate: NSPredicate(value: true))
    var latestRecord: CKRecord?

    func consider(_ record: CKRecord) {
      let recordDate = (record["lastUpdated"] as? Date) ?? Date.distantPast
      let latestDate = (latestRecord?["lastUpdated"] as? Date) ?? Date.distantPast
      if latestRecord == nil || recordDate > latestDate {
        latestRecord = record
      }
    }

    func run(_ operation: CKQueryOperation) {
      operation.resultsLimit = 100
      operation.recordMatchedBlock = { _, result in
        if case .success(let record) = result {
          consider(record)
        }
      }
      operation.queryResultBlock = { result in
        switch result {
        case .success(let cursor):
          if let cursor {
            run(CKQueryOperation(cursor: cursor))
          } else if let latestRecord {
            completion(.success(latestRecord))
          } else {
            self.fetchUserDataRecord(completion: completion)
          }
        case .failure(let error):
          if let ckError = error as? CKError, ckError.code == .unknownItem {
            self.fetchUserDataRecord(completion: completion)
            return
          }
          completion(.failure(error))
        }
      }
      self.database.add(operation)
    }

    run(CKQueryOperation(query: query))
  }

  private func metadataDictionary(from record: CKRecord) -> [String: Any] {
    let lastUpdated = record["lastUpdated"] as? Date
    return [
      "available": true,
      "recordName": record.recordID.recordName,
      "userId": (record["userId"] as? String) ?? "",
      "lastUpdated": lastUpdated.map { isoFormatter.string(from: $0) } ?? "",
    ]
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
