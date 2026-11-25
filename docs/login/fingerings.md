# Private fingering transport v1

`browserData.createFingerings()` provides the separate private adapter for
#62 / Sludge `sludge-s16.15`. It uses the existing authenticated SDK client and
the four exact public RPCs in Sludge's
[fingering contract](https://github.com/thdecn/Sludge/blob/main/docs/score-fingering-api-v1.md).
No score route, editor, Practice Session, local database, Realtime channel or
durable offline edit queue is added. Public rendering never imports this module.

```js
const view = browserData.createFingerings({
  onChange(state) { /* render only this view's latest confirmed values/drafts */ },
});
const result = await view.open({
  assignmentId, index: loadedScore.index, measureIds: ['m000033', 'm000034'],
  // Student: omit role/studentId; identity comes from the authenticated session.
  // Teacher: role: 'teacher', studentId: selectedAuthorizedStudentId
});
const save = await view.save('m000034-n000002', {kind:'set', hand:'L', finger:4});
// Or {kind:'suppress'}; view.retry(noteId) repeats the same immutable payload/key.
// view.snapshot() returns current confirmed values plus pending/unsaved drafts.
// view.clear() discards the open private scope; view.destroy() ends its lifetime.
```

The optional `expectedActorId` restricts the view to an already verified Auth
UUID; it never supplies RPC authorization. Teacher hosts use it to observe
identity loss before public assets finish loading. `onChange(state, reason)`
marks scope construction as `opening`, Auth/permission invalidation as
`access_changed`, and ordinary clear/destroy as `context_closed`. Existing
single-argument callbacks remain supported. Invalidation must clear the host
even when its first private read has not completed.

`refresh()` rereads the current scope without discarding pending operations
or retry keys. A failed refresh retains cached adapter state, so the host must
keep its page-read failure/visibility guard until a read succeeds. A later
save acknowledgement or cached snapshot does not establish that the page's
latest read succeeded.

`index` must be the validated immutable score index from the bound descriptor.
One view opens one Student/Assignment/edition and 1–64 distinct measures, with
at most 4,096 pitched notes. Larger Teacher pages must split bounded read scopes.
The own-Student path rejects a supplied Student selector. Teacher targets remain
subject to the backend's current relationship and role checks; names/selectors
never grant permission. Named compact JSON arguments are limited to 16 KiB.

Opening/reopening always clears the prior scope and reads fresh state. An
authorized empty read is `fingerings` with `overrides:[]`; a failed read returns
its failure and leaves `snapshot().outcome === 'not_loaded'`. Do not engrave
originals as if an unsuccessful latest-data read had returned an empty scope.
Expected JSON rejections retain their contract outcome; permission/eligibility
errors normalize to `fingering_access_denied`, while transport, timeout and
unrecognized responses normalize to `fingering_unavailable`.
Definitive RPC permission denial clears the matching view before any subsequent
Auth lookup, so an Auth outage cannot mask revoked access. Epoch checks still
discard denials from an older view. Response rows require explicit note membership
and a matching measure; malformed rows cannot become successful empty reads.

Saves create a UUID once per intent. A pending/failed intent remains separate
from the confirmed per-note state. A timeout/lost acknowledgement is unsaved;
an automatic fresh read may reconcile values but does not acknowledge that
operation. Retry repeats exactly the original UUID/operation. Changing intent
uses a new UUID. Only `saved`/`already_saved` confirms an acknowledgement; the
replay's **current** record can differ from the original acknowledgement.
Conflicts and unknown results trigger a fresh scoped read. Failures remain
visible to the host through the returned outcome and unsaved draft state.

Revisions remain decimal strings and are compared as BigInt, separately per
note in the same Student/edition scope. Out-of-order replies cannot overwrite
a newer note or remove a different note's value; newer local intent remains
separate from an older request's acknowledgement. Return `snapshot` represents
the latest merged state, not a command to paint the acknowledged old operation.

Generations reject results for old opens/navigation. The adapter checks real
Auth identity around requests, observes Auth changes to clear state, and checks
response Student/Assignment/slug/edition/membership/revisions before adoption.
The `onChange` microtask reads the **latest** state rather than replaying a
captured private snapshot. Hosts must render names as text, handle denied/error
outcomes visibly and clear their editor/renderer on identity or permission loss.
The adapter does not decide which note the host has selected. Destroy unsubscribes
its Auth listener and prevents reopening that view. Each network/Auth step has
a 15-second timeout; this bounds waiting, not server commit or rollback.

```sh
node --test test/fingerings.test.js
npx playwright test e2e/fingerings.spec.js --workers=1
npm test
```

Tests cover exact Student/Teacher RPC/payloads, fresh reads, set/suppress,
unknown outcome/same-key retry, timeout/late success, per-note overlap and
independent ordering, revisions above Number's safe range, malformed/foreign
responses, navigation/identity/sign-out/recovery gates and public isolation.
Served browser tests exercise real local HTTP JSON traffic through a synthetic
SDK boundary; these are not new hosted Auth/deployment evidence. Owner-reported
real backend HTTP evidence is recorded in Sludge `.7`. Student and Teacher host
integration and physical-device/release acceptance remain #63/#65/#66.
