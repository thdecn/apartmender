# Standalone Verovio score cards

`score-renderer.js` packages the selected Verovio 6.3.0 MusicXML path for #59 /
Sludge `sludge-s16.12`. It consumes the validated immutable index and
[measure projection](measure-card.md). It does not activate a route, catalogue
descriptor, Auth client, private adapter or persistence. No existing Practice
host changes in this package. Teacher pagination and the actual public/Student
editor hosts remain separate dependent issues.

## Host interface

Load `score-renderer.css` once in the host page. With an `indexScore()` result:

```js
import { projectMeasureCard } from './measure-card.js';
import { createScoreRenderer } from './score-renderer.js';

const renderer = createScoreRenderer(container, {
  onSelect(noteId) { /* show the host's editor for this canonical note */ },
});
const result = await renderer.render({
  score,
  card: projectMeasureCard(score, 'm000033'),
  overrides: { 'm000034-n000002': { kind: 'set', hand: 'L', finger: 4 } },
  // selectedNoteId: canonical ID, null to clear, omitted to retain on same card
  // signal: AbortController.signal
});
renderer.select('m000034-n000002', true); // optional keyboard focus
// renderer.destroy() when removing the host or changing a private identity
```

An override map uses canonical pitched-note IDs from the **complete** edition;
notes outside the card are allowed. Values are `{kind:'set', hand:'L'|'R',
finger:1..5}` or `{kind:'suppress'}`. Missing entries inherit the original.
The host owns its in-memory state and replaces the map when rendering. Edits
clone the projection, replace its fingering annotations, then import/engrave
that XML with a fresh toolkit. Suppression removes the label before engraving;
no number overlays or source mutation. Original single explicit fingerings are
normalized too. Staff 1/R and staff 2/L are presentation heuristics: matching
hands show a number, opposite hands retain L/R. No automatic hand detection.

The pinned Leipzig/reference spacing, proportional SVG fit and compact preview
are extracted from the accepted experiment. Preview trimming changes only empty
staff tails, the preview boundary and outer viewport, leaving two staff spaces
after visible ink and retaining both staves. Unchanged preview clef/key/time
declarations are omitted only in the throwaway renderer copy because Verovio
otherwise prints those redundant explicit declarations. Changed context stays.
There is no score stretching or fixed-width horizontal card scroller.

Each pitched head gets its own canonical interactive target, including chords,
cross-staff members and preview notes. Click/touch and Enter/Space select; Tab
moves focus. Selected heads are dark orange with an SVG frame, while keyboard
focus uses a distinct dashed frame. Native outlines/tap highlights are disabled
only for these targets. Successful re-engraving transfers existing note focus
within the same card and removes the old SVG, rather than retaining old frames.
If the user selects another note while re-engraving waits, that newer selection
wins over the host's earlier `selectedNoteId` snapshot. Explicit selection still
applies when no later selection has been made.

## Render lifecycle and failures

`render()` resolves to `{outcome:'rendered', context, selectedNoteId}`, or one
of `superseded`, `cancelled`, `error`. Only a newer request/destroy supersedes
an older result; an active failed load/import/layout reports `error` with its
original Error object and an accessible alert. A current aborted request reports
`cancelled`. Checks occur across runtime/font initialization boundaries; the
synchronous WASM engraving itself is not interrupted. Failed/cancelled/stale
renders leave the last committed score and selection unchanged. The alert
explicitly says when the previous score remains shown.

Successful renders clear the alert. The shared runtime initializes lazily once;
each toolkit is destroyed even on failure. Reload the page after a failed module
download (browsers may cache a rejected module import). Hosts must distinguish
render outcomes from backend save acknowledgements: rendering proves no durable
save. Private hosts must destroy/clear the view when identity/permission changes;
preserving a prior score during an ordinary render failure is not authorization
to preserve another Student's view. Fresh private data, retry and ordering belong
to #62/#63/#65. The toolkit's public APIs are documented in the
[upstream reference](https://book.verovio.org/toolkit-reference/toolkit-methods.html).

## Distribution

The [manifest](../vendor/verovio/manifest.json) pins every distributed file,
size, digest, toolkit version and font identity. Both runtime ESM files match
the official npm 6.3.0 tarball byte-for-byte. Embedded WASM/music glyph data and
the text font require no separate request. Cold runtime download: **7,311,285
uncompressed bytes** over two requests, approximately **2,338,282 gzip bytes**
(local estimate; actual server encoding varies). Score/index and authored
modules/styles are additional; source archives/notices are not runtime imports.

Keep [notices](../vendor/verovio/NOTICES.md), LGPL/GPL copies, exact corresponding
Verovio source archive and font files together with the modules. The 1.04
Liberation text font is separately identified with its GPL v2 font exception;
it is not mislabeled as the newer OFL release. Music fonts retain upstream OFL
notices. Modules remain separate replaceable files; rebuild instructions are in
the retained source. This package does not claim a reproduced WASM toolchain
build. Future deployment must keep these public attribution/source links.

## Verification and remaining gates

```sh
npx playwright test e2e/score-renderer.spec.js e2e/score-index.spec.js e2e/measure-card.spec.js --workers=1
node --test test/verovio-assets.test.js
npm test
```

Real local Chromium/WASM checks cover all 34 Bach cards / 663 current-preview
head appearances, final chord tones, actual mouse/touch/keyboard events,
default/opposite/original fingerings and suppression, preview-to-current edits,
source/copy isolation, unchanged current geometry, compact ink clearance,
375px fitting, tie/grace/cross-staff input, cold/runtime/font overlap,
cancellation/destruction and explicit failed-load/render outcomes. Asset tests
reject missing or drifted pinned files. No physical Safari/iPhone/iPad evidence
is claimed: fresh device/host integration and owner usability/release approval
remain #66 / Sludge `.19` and `.8`. Live updates, offline edit queues, audio and
catalogue-wide migration remain out of scope.
