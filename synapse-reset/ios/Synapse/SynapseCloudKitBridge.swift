import CloudKit
import Foundation

@objc(SynapseCloudKitBridge)
final class SynapseCloudKitBridge: NSObject {
  private let container = CKContainer.default()
  private let recordType = "UserData"
  private let recordName = "current-user-data"
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
      self.fetchUserDataRecord { result in
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

        self.fetchUserDataRecord { result in
          switch result {
          case .success(let existingRecord):
            let record = existingRecord ?? CKRecord(
              recordType: self.recordType,
              recordID: CKRecord.ID(recordName: self.recordName)
            )
            let lastUpdated = self.parseISODate(lastUpdatedISO) ?? Date()
            record["userId"] = (userRecordID?.recordName ?? "unknown") as CKRecordValue
            record["lastUpdated"] = lastUpdated as CKRecordValue
            record["payload"] = payload as CKRecordValue

            self.database.save(record) { savedRecord, saveError in
              if let saveError {
                reject("icloud_save_failed", "Could not save iCloud backup.", saveError)
                return
              }
              resolve(self.metadataDictionary(from: savedRecord ?? record))
            }
          case .failure(let error):
            reject("icloud_fetch_failed", "Could not prepare iCloud backup.", error)
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
      self.fetchUserDataRecord { result in
        switch result {
        case .success(let record):
          guard let record, let payload = record["payload"] as? String else {
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
    let recordID = CKRecord.ID(recordName: recordName)
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

  private func metadataDictionary(from record: CKRecord) -> [String: Any] {
    let lastUpdated = record["lastUpdated"] as? Date
    return [
      "available": true,
      "recordName": record.recordID.recordName,
      "userId": (record["userId"] as? String) ?? "",
      "lastUpdated": lastUpdated.map { isoFormatter.string(from: $0) } ?? "",
    ]
  }

  private func parseISODate(_ value: String) -> Date? {
    isoFormatter.date(from: value) ?? fallbackISOFormatter.date(from: value)
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
