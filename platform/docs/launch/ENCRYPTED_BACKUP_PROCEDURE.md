# Independent encrypted backup and recovery

Status: procedure prepared; the owner's final backup is NOT complete or independently verified. A synthetic hosted drill from 23 October is historical evidence only.

## Owner download, last technical gate before launch

1. On the owner's trusted laptop, sign in to the intended Quenvira business as its manager. Check the business name and saved records. In **Settings & backups → Protected backup and recovery**, select **Download encrypted backup**. A records JSON export is not equivalent: it excludes photo bytes and is unencrypted.
2. Enter and confirm a unique password of 12–256 characters, preferably a long password-manager-generated password. Save the password separately from the file. It is not sent to the service and cannot be recovered by support.
3. Select **Encrypt and download**, then select **Save encrypted backup** in the resulting dialog. The first button creates a local download link; it does not save the file. Finish the browser's file save and locate the actual `quenvira-business-YYYY-MM-DD.qvb` file in the laptop filesystem. A download click or open browser tab is insufficient evidence. The file includes current business records and staff/job photos. It excludes login permissions, prior revisions, provider billing accounts, secret configuration and infrastructure.
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

## Samsung laptop running Windows

Use the existing trusted application bookmark, sign in as the intended business manager, open **Settings & backups → Protected backup and recovery**, then follow the two-button download sequence above. Do not use the fictional demo or **Download records JSON (no photos)**. Check the business name before exporting. The application origin must come from the existing authorized deployment, not a guessed download endpoint. There is no permanent public URL for the file: the encrypted download link is generated locally in the signed-in browser.

In Microsoft Edge or Chrome, press **Ctrl+J**, select **Show in folder**, and check the actual filename and date. Windows may hide known extensions; enable **View → Show → File name extensions** in File Explorer. The browser may append a duplicate-file suffix. Keep the file unchanged and save a second copy on existing independent owner-controlled storage. Store its password separately.

In PowerShell, select the actual saved file (replace the example path), inspect its size and calculate its checksum:

```powershell
$quenviraBackupPath = (Resolve-Path -LiteralPath 'C:\Users\YOUR_WINDOWS_USER\Downloads\quenvira-business-YYYY-MM-DD.qvb').Path
Get-Item -LiteralPath $quenviraBackupPath | Select-Object Name, Length, LastWriteTime
Get-FileHash -LiteralPath $quenviraBackupPath -Algorithm SHA256
```

Calculate the hash of the independent copy too; the values must match. The actual file size/checksum cannot be supplied in advance: records/photos vary and each encryption uses fresh random values. A matching hash alone does not verify the password or completeness.

For authenticated offline validation, use an existing Node.js >=22.13 installation and the reviewed repository checkout containing `platform/scripts/verify-business-backup.mjs`. Run from that checkout's root. Do not install paid software, relax device execution policy or paste the password into a command. This PowerShell method sends exact UTF-8 password bytes to the existing verifier without a trailing newline; ordinary PowerShell piping would add a newline and fail password verification.

```powershell
$quenviraNodePath = (Get-Command node -CommandType Application -ErrorAction Stop).Source
$quenviraVerifierPath = (Resolve-Path -LiteralPath '.\platform\scripts\verify-business-backup.mjs').Path
$quenviraSecret = Read-Host 'Backup password' -AsSecureString
$quenviraSecretPointer = [IntPtr]::Zero
$quenviraProcess = New-Object System.Diagnostics.Process
try {
    $quenviraProcess.StartInfo.FileName = $quenviraNodePath
    $quenviraProcess.StartInfo.Arguments = '"{0}" "{1}"' -f $quenviraVerifierPath, $quenviraBackupPath
    $quenviraProcess.StartInfo.UseShellExecute = $false
    $quenviraProcess.StartInfo.RedirectStandardInput = $true
    $quenviraProcess.StartInfo.RedirectStandardOutput = $true
    $quenviraProcess.StartInfo.RedirectStandardError = $true
    $quenviraProcess.StartInfo.StandardInputEncoding = New-Object System.Text.UTF8Encoding($false)
    $quenviraSecretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($quenviraSecret)
    if (-not $quenviraProcess.Start()) { throw 'Verifier could not start.' }
    try {
        $quenviraProcess.StandardInput.Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($quenviraSecretPointer))
    } finally {
        $quenviraProcess.StandardInput.Close()
    }
    $quenviraReceipt = $quenviraProcess.StandardOutput.ReadToEnd()
    $quenviraFailure = $quenviraProcess.StandardError.ReadToEnd()
    $quenviraProcess.WaitForExit()
    if ($quenviraProcess.ExitCode -ne 0) { throw 'Backup verification failed; preserve the original file and check the password.' }
    $quenviraReceipt
} finally {
    if ($quenviraSecretPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($quenviraSecretPointer)
    }
    $quenviraSecret.Dispose()
    $quenviraProcess.Dispose()
}
```

Check the receipt has `verified: true`, the same SHA-256 and byte length, the expected creation time/record/photo counts, and `productionRestorePerformed: false`. Save the safe receipt beside the checksum without its password. The managed-memory password copy cannot be guaranteed erased; close PowerShell afterwards. The verifier itself has automated coverage. Its exact UTF-8 stdin protocol, a spaced file path, checksum, redacted output and rejection of an added newline passed a synthetic Linux CLI regression through the normal approval-controlled execution path. The earlier default-sandbox EPERM did not establish a verifier defect. This Windows launch sequence remains reviewed but not executed on the owner's Samsung laptop; the Linux test is not Windows device acceptance. If Node or the reviewed checkout is unavailable, retain both encrypted copies and record offline authentication as pending. Never substitute an untrusted online decryption site.

The result is an **application-data snapshot**, not a complete infrastructure backup. Recovery must use the separately authorized empty isolated workspace procedure above. Do not restore into the owner's working business. Recreate sign-in permissions and reconcile external billing/email separately. The owner's actual download, checksum, password validation and recovery comparison remain unverified until performed.

## Recovery limitations and incident handling

Re-establish manager/staff sign-in, invitations, subscription/provider mappings, secrets, hosting and independent operational monitoring separately. Keep sending disabled after any infrastructure restoration until provider history is reconciled; do not replay old invoice emails or create duplicate subscriptions. Prior recovery revisions and external audit/provider histories are outside the business file. Preserve the original and hashes when verification fails, retry the correct password/file, and contact ccscreativetech@gmail.com without sharing passwords. No recovery-time or automatic-backup guarantee is implied.

## Infrastructure inventory and database export (separate operator operation)

The manager `.qvb` is a business-record backup, not a full cloud account export. Retain a separate private inventory with:

- Source commit, lockfiles, all `platform/drizzle/*.sql` migrations and reviewed deployment/build configuration. Current GitHub main and hosted source differ; record both SHAs and the actual deployed version.
- The selected host/Site ID and URL, tenant/workspace identifiers, actual D1 account/database identifiers and `DB` binding, object-store/bucket identity and `BUCKET` binding. Staff/job photo bytes are in `.qvb`; a full infrastructure recovery also needs the complete authorised object inventory and integrity checks.
- Non-secret runtime names/values, cron/scheduler IDs and timing, email sender/domain DNS/authentication records, webhook URLs/event subscriptions and API versions, Stripe account/mode/price/portal mappings.
- **Secret names and vault locations only** in ordinary documentation. Export credentials only through the owner's existing secure secret-management procedure, separately encrypted and access-controlled; never put them in Git, terminal output, a report or this chat. Reissue/rotate lost credentials rather than embedding them in a database dump.
- Required membership/access reconstruction, provider contract/retention information and manual recovery contacts. Business `.qvb` intentionally excludes sign-in permissions and external subscription accounts.

### Existing standalone staging D1 only

These commands are a prepared procedure, **not a completed export**. Use only an already authorised Cloudflare account and the exact verified database. From `platform/`, the committed `wrangler.staging.jsonc` currently selects the separate `quenvira-staging` database `CONFIGURE_IN_SECURE_ENVIRONMENT`; it does **not** identify the live managed Sites database. Never substitute it for production.

```bash
node node_modules/wrangler/bin/wrangler.js d1 info quenvira-staging --config wrangler.staging.jsonc
# Compare account/database identity with the private inventory before exporting.
node node_modules/wrangler/bin/wrangler.js d1 export quenvira-staging --remote --config wrangler.staging.jsonc --output /private/owner-backups/quenvira-staging.sql
```

Run on the owner's trusted machine and private directory with restrictive permissions. The export is plaintext sensitive SQL: encrypt it immediately with an already available trusted tool. For an existing GnuPG installation:

```bash
gpg --symmetric --cipher-algo AES256 --output /private/owner-backups/quenvira-staging.sql.gpg /private/owner-backups/quenvira-staging.sql
sha256sum /private/owner-backups/quenvira-staging.sql.gpg
```

GnuPG prompts locally; do not supply a passphrase in arguments or environment variables. Independently decrypt and inspect the saved encrypted copy before treating it as verified. Do not delete existing backup material. Keep plaintext exports access-restricted under the owner's retention procedure.

### Managed production D1

No supported full managed-Sites database export endpoint, consistent-snapshot permission or production Cloudflare database identity is available to this session. Record this as an **infrastructure recovery blocker**, not a successful export. Use the host's authorised consistent-export/support workflow once supplied; do not scrape independent table pages and claim they constitute an atomic backup, and do not use a different Cloudflare account/database as a workaround. The verified manager `.qvb` remains the supported business export path.

### Isolated database restore test

Use a disposable local SQLite database or an already authorised isolated test destination with billing, sending and scheduled jobs disabled. Decrypt a copy to a private temporary directory; inspect the SQL before execution. Import into an empty local database using an existing SQLite CLI, then run `PRAGMA integrity_check;` and `PRAGMA foreign_key_check;`, inspect table/row counts and compare the source receipt. Do not run imported SQL against production. Reconcile object bytes separately. On infrastructure restoration, use the reviewed operator `restoreIntoEmptyDatabase` path for logical snapshots where applicable: queued/retry/sending invoice emails become `review`, requiring provider reconciliation before sending. A raw SQL import does not automatically apply that safeguard and must never be connected to dispatch until queued work has been reviewed. Verify identities/permissions and external Stripe customer mappings independently; never initiate duplicate subscriptions during recovery.
