# Readable full-score pages

Issue [#64](https://github.com/thdecn/apartmender/issues/64), planning Bead
`sludge-s16.17`, adds `createScorePages` alongside `createScoreRenderer` in
the existing pinned renderer module. Both modes reuse its engine, immutable
score/index identity, throwaway fingering projection and individual chord-tone
hit binding. Full pages render the entire score, without Student previews.

```js
const pages = createScorePages(contentBelowToolbar, {
  onSelect: noteId => selectEditorNote(noteId),
  onChange: state => updatePageStatus(state),
});
await pages.render({score, overrides}); // a validated indexScore result
pages.select(noteId, true);
await pages.setSize(60); // 40, 50, 60 or 70
pages.previous();
pages.next();
pages.snapshot();
pages.destroy();
```

The parent supplies a bounded content area below its application toolbar.
The component measures the remaining viewport below its page/size controls,
then asks Verovio to flow complete measures horizontally into piano systems
and vertically onto pages. It derives dimensions from pixels and notation
scale, never a fixed bar count. Medium is the default; size changes preserve
the notation scale instead of squeezing the full Piece onto one screen.
The viewport scrolls with an explicit rotate/reduce-size notice when a screen
cannot contain a readable system, including unusually narrow content. Both
staves remain reachable, and selected notes are scrolled into view.

ResizeObserver handles content-area resize and orientation reflow. Every
layout verifies all 34 measure IDs once in order and all 598 pitched note IDs
once across pages. Reflow retains the selected chord member, takes the user
to its new page and restores focus when it was inside the old score. A later
selection wins over a selection captured by an earlier async layout. Without
a selection, the previous visible measure anchors the new page. Errors are
visible and previous successfully laid-out pages remain available.

The compatible shared renderer/CSS update deliberately regenerates the
descriptor hashes and complete notation version. The MusicXML, accepted index,
edition identity, Assignment slugs, PNG versions and card bytes are unchanged;
no registry update or database migration is needed. Existing open consumers
retain their pinned version; future consumers load the complete verified
version together, as required by the descriptor contract.

This is the reusable presentation mode for the existing Teacher integration
in #65; it does not independently activate a route, load private state, create
Practice Sessions or change Student timing. #65 supplies the unmistakably
named authorized Student/Piece context, verified module loading, bounded
page-scoped fingering reads and persisted editor. This implementation starts
from main and uses none of the unmerged Student PR's code.

Served Chromium checks use the exact pinned full Bach score and WASM engine
at representative phone/tablet/desktop content sizes, including undersized
systems, page boundaries, complete inventory, selected-note reflow/size/races,
real re-engraving and unchanged source. They are not fresh manual macOS Safari,
iPhone Safari or iPad Firefox evidence; final device/usability gates remain
#66 / `sludge-s16.19` and `.8`.
