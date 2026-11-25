# Public Bach Practice integration

Issue [#61](https://github.com/thdecn/apartmender/issues/61), planning Bead
`sludge-s16.14`, connects the existing public Practice host to the fixed Bach
edition. The owner retained General Practice at `/apartmender/` on 25 November
2026; this work adds no `/general/` route or Login cutover.

`app.js` injects `createPublicScoreCard()` as the host's presentation collaborator.
The existing Flow still owns both modes, streaks, backward progression,
browsing/Resume, completion, timing, haptics and wake locks. Every other Piece
keeps its existing PNG presentation. Catalogue declarations, edition/source,
index, renderer assets and private Student/Teacher clients remain unchanged.

The public collaborator loads the complete edition through `loadNotationEdition`:
descriptor/dependency bytes are verified before execution, and the complete
34-measure index is reparsed and checked. Card ordinals resolve to the descriptor's
canonical reverse measure list and downbeat-only preview. A visit retains the
verified edition in memory, reuses it across cards and releases it on Home or
completion. Abort/generation guards discard old loads, renders and errors after
navigation. New visits start from the current verified public declaration.
The collaborator ensures its stylesheet is loaded before notation presentation,
including when an older cached root document lacks the new stylesheet link.

Rendering always supplies an empty override map. Only the immutable source's
original annotations can appear; the accepted Bach edition contains no explicit
fingering numbers, so General Practice displays none. Personal replacements and
suppression belong exclusively to authenticated Student/Teacher views. Public
note selection highlights a source note and has no editing or saving controls.
The score panel explicitly states that timing is not saved.

## Failures and deliberate legacy presentation

A failed load, hash check, descriptor binding or engraving clears the score and
shows its cause with **Retry score** and **Use legacy PNG cards**. No failed
notation request silently becomes an image. Choosing legacy cards deliberately
uses the same Piece, current card and shared progression; the panel labels this
presentation as original fingerings only. **Retry score** returns the current
card to notation. The choice lasts only for this visit and resets on Home.
Recovery controls and PNG layout work without the score stylesheet, so its own
failure cannot block that deliberate choice. The shared host hides its unused
image directly, including when cached base CSS overrides the native `hidden`
attribute; choosing an ordinary PNG Piece restores its normal display.

## Reversible public pilot

`public-score-pilot.js` names only Bach and pins the exact accepted
`piece.notation.version`. Set `enabled: false` in a reviewed change to return
public Bach to the existing PNG presentation. This switch does not change the
catalogue, descriptor, Student/Teacher presentation, stored overrides, Assignments
or queued Practice. A different declared notation version fails visibly rather
than being implicitly approved; explicitly review and update the pilot pin when
adopting a new descriptor. Never replace the accepted source/index identity.

The switch is frontend configuration subject to owner review/merge. This PR
does not perform a hosted migration or authorize a separate production release.
Keep the complete public runtime, notices and corresponding-source downloads
described in [the renderer distribution](score-renderer.md#distribution).

## Verification and remaining gates

Run `npm run test:public -- --browser=chromium` and the equivalent WebKit
command. `e2e/public-score.spec.js` serves the real static app at the project
prefix `/apartmender/`, using the real verified MusicXML and renderer. It covers
all 34 cards in Normal and deterministic Hard order, final chord members,
penultimate/first cards, browsing/Resume, touch and swipe interaction, timing,
load/render failures and retry, explicit legacy choice, stale loads/renders,
byte/version rejection and public rollback. Existing PNG public regression
tests stay in the same command. Descriptor and Student suites remain separate
compatibility checks.

Every public-score scenario starts with fake Auth state, a private Session
marker and queued Practice. Storage access guards, unchanged-state probes,
network/module spies and page-error checks verify isolation. Only the existing
non-personal mode preference is allowed; no Auth or personal fingering adapter,
database, ingestion or synchronization is initialized. Supabase availability
therefore cannot convert or upload public activity.

These are deterministic local browser checks. Fresh manual macOS Safari,
iPhone Safari and iPad Firefox observations, readability/usability approval and
release authorization remain #66 / `sludge-s16.19` and Sludge's final gate `.8`.
Live updates, offline fingering edits and catalogue-wide notation migration
remain deferred. Existing authenticated Offline Access work is separate.
