# Assigned Bach fingering editor

Issue [#63](https://github.com/thdecn/apartmender/issues/63), planning Bead
`sludge-s16.16`, connects the accepted renderer and authenticated transport to
the existing Student Practice host. The actual assigned Bach button opens
the complete current measure and next downbeat preview. Every pitched chord
member is selectable; Left/Right hand and 1–5 replace its number, and Remove
number persists a suppression. Changes re-engrave the score and preserve the
selected note. Other Pieces retain their PNG presentation.

The shared host accepts an optional presentation collaborator and retains its
existing Normal/Hard progression, browsing, controls and timing lifecycle.
Assignment IDs are unchanged. The Open marker pins the notation descriptor's
complete version for Bach and the legacy image version for other Pieces; it
does not swap versions or create another Session during edits/reloads. Public
Practice supplies no private collaborator and imports no private modules.

`load-edition.js` validates the catalogue pointer, descriptor, source, index,
provenance, authored module/CSS bytes and every renderer-manifest file. It
imports verified in-memory blob modules with the bounded v1 dependency graph
rewritten to verified blob URLs, including dynamic Verovio imports. Executed
code cannot come from an unrelated bare-URL module cache. A public edition is
retained in memory during this page's lifetime; private adapters, drafts and
SVG are discarded on navigation, access change and sign-out. No private
fingering state is cached persistently. Descriptor/source/index are unchanged.

Each measure open/reopen freshly reads its current and preview scopes using
the existing BrowserData Auth/recovery boundary. Saving, unacknowledged errors
and same-key retry are visible. Draft values are only a visible unsaved
preview until acknowledged. Reload drops view-local drafts and fetches the
latest committed state, including Teacher changes. No live updates, durable
offline fingering queue or offline personalized-notation guarantee is added.
An unavailable read/asset fails visibly with a retry; it never presents PNGs
or original fingerings as a successful personal read. Existing Practice
journaling, synchronization and non-pilot behavior remain in place.

Validation uses served-browser synthetic Auth/RPC fixtures around the actual
BrowserData adapter, Practice host and pinned WASM renderer. It covers all 34
cards through Good/Advance, finalization, chord set/replace/suppress/reopen,
preview identity, lost acknowledgement/retry, Teacher-change refresh,
old-measure responses, read/permission/Auth failures, byte tampering and
poisoned bare module caches. These are not new hosted or manual device
results. Fresh macOS Safari, iPhone Safari, iPad Firefox and owner usability
observations remain final #66 / `.19` and `.8` gates. Teacher host integration
and public route integration retain their own issues.
