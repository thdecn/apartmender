# Bach pilot acceptance and release handoff

Issue [#66](https://github.com/thdecn/apartmender/issues/66) / Bead
`sludge-s16.19` owns this frontend gate; Sludge `.8` owns final cross-repository
acceptance. Both stay open until actual evidence, owner review and required
incorporation are complete. Completion is tracked there, not by this document.

The current merged defaults already select Bach notation in public Practice,
assigned Student Practice and Teacher score pages. This gate preserves those
defaults and adds explicit rollback controls and reproducible evidence. A main
merge or a green automated suite is not a substitute for manual platform,
usability or final release acceptance. Public Practice stays at `/apartmender/`;
the deferred #24 `/general/` move is outside this pilot.

## Build and automated evidence

The baseline is accepted PR86, `dfe6ba84215badd3f478eaa18a7018b133b6f0d2`,
containing reviewed `247d48a` and its CSS-independent public legacy recovery.
Student PR82, Teacher pages PR83 and Teacher editor PR84 are incorporated.
Source edition `sha256:2d9973db07428c5390ea4f8c2c1518f29834022db5d788682f37d8fcf3765b49`
and complete index `85f4e0bbdc778d67d316949b695dc0a3717d7d4d54c17a6ca9d09ce54ff6a057`
remain unchanged. The shared descriptor binds the pinned Verovio 6.3.0 runtime,
authored renderer, source, index and public asset closure together.

From a clean task checkout with dependencies installed:

```sh
npm ci
npx playwright install chromium webkit
npm run validate:catalog -- --baseline origin/main
npm run test:notation:evidence
npm run test:notation -- --browser=chromium --reporter=json \
  --output=/private/tmp/notation-chromium-results > /private/tmp/notation-chromium.json
npm run test:notation -- --browser=webkit --reporter=json \
  --output=/private/tmp/notation-webkit-results > /private/tmp/notation-webkit.json
node tools/record-notation-evidence.mjs /private/tmp/notation-chromium.json \
  /private/tmp/notation-webkit.json /private/tmp/notation-evidence.json
```

The dedicated config covers public/catalogue/descriptor isolation, all backward
cards and both modes, private transport, Student editing, Teacher pages/editing
and a three-view journey sharing one synthetic wire store. It exercises unknown
save acknowledgement and identical retry, independent chord tones, suppression,
latest values on reopen, reflow, permission/identity/context invalidation,
render races, explicit legacy recovery, and configured rollback/re-enable.
Teacher editing leaves Student Practice state and notes publications unchanged.
Rollback preserves a real pending browser Practice event and private overrides.

These fixtures exercise actual UI, adapter and WASM rendering against synthetic
Auth/RPC responses. They are neither fresh hosted database tests nor physical
Safari/Firefox observations. Sludge `.7` retains the separately operator-reported
hosted phases (19 + 7 + 15 + 16 checks); this run does not repeat hosted mutations.
The accepted source has no explicit fingering annotations: public Bach displays
no numbers; private edits must never appear publicly.

The evidence recorder rejects failing, skipped, flaky or incomplete browser
reports and wrong engines. It executes the full unfiltered Node gate itself:
caller-supplied Node reports are not accepted, inherited Node test options are
cleared, and the local-Supabase opt-in is disabled. Only that one documented
local integration skip is allowed; failures, TODOs or other skips block evidence.
The separate isolated regression command proves that a passing subset cannot
hide a failing omitted suite. It runs outside the Node-discovered test tree to
avoid recursively invoking the full gate. Its runtime fingerprint hashes
the working-tree application code and relevant catalogue/descriptor bindings;
this identifies tested changes before a commit can refer to its own evidence.
Record the eventual accepted PR/merge SHA as well for manual checks. The
[generated report](pilot-evidence.json) keeps manual surfaces **pending** and
release authorization false. Never turn those fields green from CI alone.

Failure screenshots and traces are retained by the gate config. Keep them with
the exact build and failing scenario, preserving available request outcomes,
render errors and superseded/cancelled status. Repository fixtures contain fake
actors. Real-session traces/HAR can contain secrets: keep credentials/tokens out
of chat and shared artifacts; prefer UI screenshots and sanitized observations.

## Manual platform pass — owner action

Use a reviewed build on the intended GitHub Pages URL and record its exact
accepted commit and deployment identity before testing. Use the retained active
Student B / Teacher B test pair and Bach Assignment after choosing the approved
test environment. Student actions create normal test Practice; Teacher browsing
and fingering edits must create no Student Practice. No new migration, account
provisioning or reassignment SQL is required for this pass.

Repeat the following on real macOS Safari, iPhone Safari and iPad Firefox:

1. Open the public root directly and reload. Choose Bach; inspect final measure
   alone, penultimate preview and first card. Complete a backward visit, use
   Normal and Hard, Mistake, browsing/Resume and Home. Other Pieces still use
   PNG cards. Public timing is ephemeral and never acquires personal numbers.
2. On the Student B account, tap/click each independent final-chord member;
   choose a note and set Left 4, then Right 2. Verify selection and placement,
   navigate away/reopen and confirm the saved value. Record the note identity
   and before/after values in the observations; no bulk clear is offered.
3. As Teacher B, open **Student B — Bach Inv. No. 8**. Find that note through
   previous/next pages; change its value. Change notation size, resize/rotate,
   and verify the selected note remains visible on its correct page and the
   Student/Piece name stays unmistakable. No Student timer or Practice starts.
4. Reopen the Student measure to see the Teacher's committed change. Remove the
   number, reopen both views and confirm suppression persists. Public Practice
   still shows the immutable original. Retain intended test edits or restore
   individual prior values deliberately; do not reset the score or clear storage.
5. Check mouse/keyboard on Mac and real touch on phone/tablet. Observe accidental
   selection, chord separation, controls, clipping, preview readability, page
   boundaries and rotation. Student cards should fit without horizontal card
   scrolling. Record any Teacher minimum-size notice/scrolling and judge actual
   readability rather than assuming an automated geometry pass is sufficient.
6. During the test account's online editing, briefly remove connectivity. A
   failed or uncertain save remains visibly unsaved; use its Retry action once
   connectivity returns, then reopen to verify the committed result. Report an
   unexpected result before calling it a pass. The automated fixtures cover
   forced lost acknowledgements, stale callbacks and relationship denials.
7. Sign out or change account/context. The prior private score/editor clears;
   no other Student's values appear. Check public Practice in a separate tab
   while the authenticated app is present. Closing/opening public views must
   not upload or convert public timing into recorded Practice.

For each surface, supply: device model, OS version, full browser version,
browser-tab/Home Screen surface if relevant, test date/time/timezone, build SHA,
deployment URL, actor labels (no credentials), outcomes for steps 1–7, screenshot
or session references, usability observations and any failure's available cause.
Explicitly state **pass**, **fail**, or **not run** per step. A failure or missing
surface keeps #66 / `.19` open; prototype evidence cannot fill the gap.

## Rollout order and deliberate rollback

1. Keep the accepted additive Sludge migrations/registry/API deployment; `.7`
   records that operator evidence. This frontend gate adds no database migration.
2. Review/merge frontend changes manually. Verify GitHub Pages serves the exact
   accepted build and its complete catalogue/descriptor/runtime/license files.
   Do not repin source/index or replace only part of a notation dependency set.
3. Collect the manual observations above, owner usability acceptance and final
   rollout/rollback approval. Record approval in #66 / `.19` and Sludge `.8`.
   No automated job grants approval, merges, or performs a hosted deployment.

For a reviewed rollback change, set the affected switches below to false:

| Surface | Configuration | Result after normal reload |
| --- | --- | --- |
| Public | `notation/public-score-pilot.js`: `enabled` | Existing original PNG Practice |
| Student | `login/notation-pilot.js`: `student` | Assigned PNG Practice with explicit saved-fingering limitation |
| Teacher | `login/notation-pilot.js`: `teacher` | Named Student detail with explicit notice; score editing entry disabled |

The public switch remains outside private modules. The private switches change
only presentation; Student Assignment IDs, normal Practice recording and queues
retain their existing contracts. No switch deletes backend overrides. Both
private fallback notices say PNG cards cannot show saved fingerings and changes
are retained. Re-enable through the same reviewed flags to reopen the stored
values. Tests prove disable/re-enable does not overwrite or suppress them.

Do not force-reload an Open Practice Session, clear Auth/IndexedDB/storage, reset
the database, or discard unacknowledged Practice as part of rollback. Finish an
open visit normally with Home, then load the accepted rollback build. Supported
older/cached clients retain their pinned code until normal reload; no atomic
cross-repository or mid-Session swap is required. An asset failure is a visible
error/retry, not implicit permission to show PNGs as personalized notation.

## Remaining acceptance and deferred work

Fresh physical-device observations, usability acceptance and release approval
are still missing. #66 / `.19`, Sludge `.8` and the epic remain open. Deferred
#24 is not revived by this handoff; its separate routing scope needs its own
future decision before eventual planning cleanup.

The independent PR87 review also encountered intermittent initial Teacher-load
failures in Chromium before the tested editing action. The same failure was
reproduced with production files restored to base `dfe6ba8`, so it was not
attributed to this PR; its cause is still undetermined. That review passed all
59 WebKit checks and both new journeys in each engine, but did not independently
confirm a fully green Chromium gate. Keep this limitation and the retained
review traces with the final acceptance evidence rather than treating it as
resolved or substituting it for the remaining manual pass.

`sludge-lgi` remains an honest diagnostic follow-up: a historical iPad Firefox
experiment contains one failed edit-to-display sample at 1068 ms without an
exception reason. Its cause is unknown; it is not relabeled as intentional
supersession. Current renderer errors retain their Error object, and the gate
keeps failed-test traces/screenshots, but neither fact retroactively diagnoses
that historical sample or completes the separate diagnostic task.

Post-MVP work remains live updates, durable offline fingering edit/sync, explicit
score-edition migration tooling and the remaining catalogue. Audio is excluded.
