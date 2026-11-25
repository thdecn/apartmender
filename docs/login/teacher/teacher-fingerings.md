# Teacher fingering editor

Issue [#65](https://github.com/thdecn/apartmender/issues/65), planning Bead
`sludge-s16.18`, connects the existing Teacher Student detail route to the
merged full-score page component and Student-owned saved differences.

After the existing protected Student detail reads, a current Bach Assignment
offers **Open Bach Inv. No. 8 score**. The full-screen dialog continuously
names the validated Student and Piece. It supplies readable pages, previous/
next, notation size and responsive reflow, plus the same Left/Right, 1–5,
Remove number and retry controls used by Student Practice. These controls now
live in one shared private presentation module. The shared score remains
immutable; successful edits re-engrave a throwaway copy with the selected
chord member retained. Suppression hides an original or personal number.

Teacher metrics/notes permission only provides an entry context. The existing
fingering adapter independently enforces the Teacher RPC boundary, validates
Student/Assignment/slug/edition responses, and clears state on definitive
permission or Auth changes. Current Teacher relationship, Active Student and
Active Assignment eligibility are checked by Sludge, not inferred from a
browser role, name, catalogue entry or notes permission. No Administrator
portal or backend operations are added.

The verified-byte loader exposes the already-pinned page renderer. It does
not import a second engine or change score/index/descriptor bytes. The fixed
edition's 34 measures and 598 pitched notes fit one contracted bounded scope
(at most 64 measures/4,096 notes); each page opening/reflow refreshes that
complete scope. This avoids partial page reads when re-engraving moves a
measure between pages. Adapter `refresh()` preserves per-note pending intent
and retry UUIDs while incorporating newer committed revisions. It adds no
durable storage, Realtime channel or live-update promise.

Pages stay hidden until their latest read succeeds. Failed reads have an
explicit retry message; they never become empty/default data. Unconfirmed
saves stay visibly unsaved with same-payload retry. Paging/reflow retains
the Student context, selection and pending operations. Close, navigation,
identity change or denial invalidate pending responses and clear private
engraving/editor state. A delayed close event cannot close a newly reopened
dialog. Public edition assets may remain in memory; private fingerings do not
persist in browser storage.

The identity observer is installed before public score loading and bound to
the Teacher UUID already verified by the route. Construction's initial clear
is distinguished from subsequent Auth/permission invalidation. Invalidations
clear the opening view immediately, including during the first private read.
A separate page-read guard survives failed reads: delayed save notifications
can update cached revisions but cannot reveal the score, clear the read error,
or re-enable editing until a fresh read succeeds.

Teacher browsing/editing does not mount the Practice host, create Session
markers/events, advance progression, alter timing or publish Teacher notes.
The Student editor continues to use its existing Practice lifecycle. Both
roles read the same committed overrides on reopen.

Automated tests use synthetic Auth/RPC fixtures around the real BrowserData,
actual Teacher/Student routes and pinned WASM engine. They cover chord edits,
suppression/reopen, uncertain retry through reflow, read/reassignment/Auth
denials, two-Student isolation, closed-view stale responses, phone controls,
Teacher save followed by Student reopen, and existing Teacher notes/metrics
and Student Practice regressions. These are not new hosted or manual device
results. Fresh macOS Safari, iPhone Safari, iPad Firefox and owner usability/
release evidence remain #66 / `.19` and `.8` gates. No migration is required.
