# Staff profile photos

Optional phone camera/file inputs are available when adding staff and in the
manager's Add/Change photo action. Photos are previewed, centre-cropped and
re-encoded to a 224px JPEG thumbnail on the device; the original/EXIF metadata
is not uploaded. Supported browser decoders handle JPEG, PNG, WebP and compatible
phone formats. Native camera capture is a physical-device acceptance check.

Thumbnails use a private R2 BUCKET binding, separate from the 512 KiB workspace
record. The staff record stores only a content-derived photo identifier. Photo
reads require authenticated workspace membership: managers see staff photos,
workers can retrieve only their own. Image responses use no-store/private,
image/jpeg, nosniff and same-origin resource policy. There are no public bucket
URLs. Names and initials remain available as fallback.

Only managers can upload/remove. A dedicated bounded command endpoint accepts a
JPEG thumbnail of at most 32 KiB and up to 256px in either dimension; ordinary
command limits remain unchanged. It reuses revision checks, request hashing,
idempotent retries, atomic DB persistence and commit-time membership checks.
Content-derived object keys prevent concurrent requests from overwriting another
photo's bytes. Provider upload failures produce safe retryable errors. A failed
DB commit may leave an inaccessible staged object for operator cleanup; it is
not treated as a successful photo update.

After staff creation, photo failure opens management of the saved member rather
than rerunning staff creation. An unresolved upload can retry the original
command. Removing/replacing a photo updates the current pointer; older objects
are retained for revision recovery. Workspace deletion removes its object prefix
after the authority-checked DB deletion. If object cleanup fails, the API returns
photoCleanupPending and emits an operator-attention message; manual cleanup is
required. Separate backup/retention and actual R2 recovery remain release gates:
the SQLite logical backup does not include image bytes.

Photos appear beside names on job tables, schedules, visit details, team cards
and staff profile navigation. The existing fictional browser-only demo is kept
separate; this feature belongs to the signed-in, server-backed workspace.

Validation: API tests exercise private reads, own-worker access, manager-only
writes, exact bytes, replay, stale writes, invalid/oversized images, missing and
failed storage, failed transactions, replacement/removal/history and scoped
workspace cleanup. Browser CI covers choosing a file at staff creation, preview,
resizing, reload persistence, report/calendar display and removal. Its R2 adapter
is in memory and does not establish hosted R2/device acceptance.
