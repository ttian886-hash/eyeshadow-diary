# v299 acceptance audit

Status: fixes prepared on a review branch; production remains v298.

## Verified

- 21 application regression checks: save, undo, history edit/delete, persistence failure rollback, period boundaries, colour share totals, backup format validation and cloud status presentation.
- 8 mocked Firestore checks: remote updates, concurrent edits, cached/pending writes, guarded upload, revision conflict, edits during upload and offline handling.
- Live desktop browser at 1363 x 936: four complete 1500 x 720 homepage images, no horizontal overflow; collection search and filters, duo detail, month/all-time statistics and settings version.
- Script syntax and PNG full decoding passed.

## Fixes

- Legacy history edit referenced undefined beforeTotal after saving.
- Legacy edit/delete did not roll back memory on persistence failure.
- Legacy edit/delete now reject stale records after editing or confirmation.
- Invalid selection members and duplicate shade selections now return false rather than throwing or double-counting.

## Not verified

- Real phone/desktop two-way sync with the owner's Firebase account, reconnect and concurrent edits. No account login or cloud writes were performed.
- Full 320/390/768 px browser matrix, all palette geometries, screen-reader and keyboard coverage.
- End-to-end browser backup download/import or true offline service-worker restart. Backup schema/JSON roundtrip was checked in isolation.

These results do not establish a 10/10 score or complete acceptance.

Run from repository root:

```sh
node audit/acceptance.cjs
node audit/cloud-sync.cjs
```
