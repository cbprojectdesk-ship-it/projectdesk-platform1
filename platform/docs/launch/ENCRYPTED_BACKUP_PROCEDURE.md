# Independent encrypted backup and recovery

Status: procedure prepared; the owner's final backup is NOT complete or independently verified. A synthetic hosted drill from 23 October is historical evidence only.

## Owner download, last technical gate before launch

1. On the owner's trusted laptop, sign in to the intended Quenvira business as its manager. Check the business name and saved records. In **Settings & backups → Protected backup and recovery**, select **Download encrypted backup**. A records JSON export is not equivalent: it excludes photo bytes and is unencrypted.
2. Enter and confirm a unique password of 12–256 characters, preferably a long password-manager-generated password. Save the password separately from the file. It is not sent to the service and cannot be recovered by support.
3. Select **Encrypt and download**. Finish the browser's file save and locate the actual `.qvb` file in the laptop filesystem. A download click or open browser tab is insufficient evidence. The file includes current business records and staff/job photos. It excludes login permissions, prior revisions, provider billing accounts, secret configuration and infrastructure.
4. Copy the encrypted file to an existing independent offline device or owner-controlled encrypted storage, without purchasing storage. Keep its password separately. Preserve the original unchanged; do not upload the file or password into chat or email.
5. Compute SHA-256 for both copies and compare. Linux: `sha256sum /path/business.qvb`; macOS: `shasum -a 256 /path/business.qvb`; Windows PowerShell: `Get-FileHash -Algorithm SHA256 'C:\path\business.qvb'`. Matching hashes prove identical bytes, not decryptability or complete recovery.
6. Independently read and authenticate the saved file using the offline verifier below. Compare record/photo counts and creation time against the intended business. Save the verifier's safe JSON receipt alongside the hash. A synthetic receipt does not verify the owner's file.
7. For a full recovery acceptance exercise, use a separately authorised empty test workspace with billing/email disabled, then **Restore backup into empty workspace**. Select the saved file and enter its password locally. Check customers, staff, jobs, invoices, checklists, notes and every photo; compare the receipt/counts. Never restore over existing work. Do not delete the source business. This is a separate write operation and must use an isolated destination; verification alone writes nothing.
8. Record download location, date, SHA-256, verified counts, restore destination and comparison results, without the password. Only mark the independent-backup gate passed when the actual saved file has been verified and recovery evidence reviewed. If independent restore cannot be performed, record that limitation explicitly.

## Read-only offline verification

Requires an existing Node.js installation >=22.13 and this repository checkout. No dependency install, credentials, provider API, database, network or paid service is needed. From the repository root, run in **Bash** (Linux/macOS or an existing Git Bash):

```bash
read -r -s -p 'Backup password: ' quenvira_backup_password
printf '\n'
printf '%s' "$quenvira_backup_password" | node platform/scripts/verify-business-backup.mjs /absolute/path/business.qvb
unset quenvira_backup_password
```

The password must not appear in command arguments, shell history, environment exports or receipts. The script reads it only from stdin, authenticates/decrypts in memory, checks supported state plus staff/job photo hashes/references using the application's restore validator, and outputs SHA-256, file size, creation time and counts. It never connects to production or restores records. It returns nonzero with a generic message for an incorrect password, corruption, unsupported data or unreadable input. JavaScript memory cannot guarantee password erasure; use a trusted laptop and end the process afterwards.

Do not use the password on an untrusted shared device. Do not substitute the lower-level `workspace-recovery.mjs` encryption format: it is an operator database utility, not the manager `.qvb` format. Files larger than the current 20 MB plaintext / approximately 29 MB encrypted limits need a separately reviewed recovery plan; do not split or edit an encrypted file.

## Recovery limitations and incident handling

Re-establish manager/staff sign-in, invitations, subscription/provider mappings, secrets, hosting and independent operational monitoring separately. Keep sending disabled after any infrastructure restoration until provider history is reconciled; do not replay old invoice emails or create duplicate subscriptions. Prior recovery revisions and external audit/provider histories are outside the business file. Preserve the original and hashes when verification fails, retry the correct password/file, and contact ccscreativetech@gmail.com without sharing passwords. No recovery-time or automatic-backup guarantee is implied.
