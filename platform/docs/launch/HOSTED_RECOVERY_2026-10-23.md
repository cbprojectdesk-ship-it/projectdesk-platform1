# Hosted recovery verification — 23 October 2026

A separate owner-private Sites deployment used actual Cloudflare D1 and R2 bindings with the production application's business backup/import handlers. Only synthetic customer/staff/job/invoice records were used. No production database, account membership, payment or customer record was modified.

The client saved an independently encrypted .qvb file outside the hosted database/object store, read it from disk, decrypted it and compared the contents before removing the synthetic source workspace and its photos. Restoration into a new empty destination preserved the records and photo bytes, including the issued/credited invoice and locked supplier snapshot. Wrong-password decryption, incomplete-photo restoration, a second restore into an occupied destination and cross-business export were rejected. Lost-response replay succeeded without duplicate changes; D1 reported no foreign-key violations.

This proves a hosted synthetic business-data recovery path. It is not the owner's real independent backup, a subscription-account migration or a guarantee of total infrastructure recovery. Real backup download was explicitly deferred by Charles until laptop access; a reminder is scheduled for this evening. The private test endpoint's runtime flag was switched off after the drill and the disabled environment revision redeployed.

## Machine receipt

```json
{
  "passed": true,
  "syntheticOnly": true,
  "customers": 1,
  "staff": 1,
  "jobs": 1,
  "invoices": 1,
  "photoBytesVerified": true,
  "invoiceStatus": "Credited",
  "incompletePhotoRejected": true,
  "occupiedDestinationRejected": true,
  "crossBusinessExportDenied": true,
  "replaySafe": true,
  "foreignKeyViolations": 0,
  "restore": {
    "restored": true,
    "photos": 1
  },
  "completedAt": "2026-10-23T10:35:06.252Z",
  "encryptedFileBytes": 8115,
  "encryptedFileSHA256": "eb2bc846707525786182749909ea9a94d338a9b15c4bd2463a59650dafa5f3b0",
  "independentFileRoundTrip": true,
  "wrongPasswordRejected": true
}
```
