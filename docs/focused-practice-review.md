# Warm Up MVP design audit

The agreed experience is internally consistent. The rotation-overlay timer edge case is resolved: pause while the activity is obscured and resume automatically when it is visible again. The missing Mozart assets have also been restored durably. The remaining gaps concern frontend integration and the Student enablement contract.

## Resolved behavior

### Phone rotation and the countdown

The existing practice interface covers the activity with a "Rotate your phone to landscape" overlay on portrait touch phones. Its timer pauses when the document is hidden, but orientation changes only update the overlay; they do not pause timing. Reusing that behavior unchanged would consume the new countdown while a technical exercise is obscured.

The user confirmed that the Warm Up countdown must pause while the rotation overlay covers the activity and resume automatically when the activity becomes visible again. Background and overlay pause conditions must both be clear before timing resumes. This includes an activity opened while the overlay is already visible.

This settles the rotation-related timer rule without introducing a manual pause control. The original audit's suggestion to let the text-only Slow Practice screen work in either orientation was not part of this explicit confirmation; avoid treating that suggestion as a separately agreed orientation requirement. The pause rule applies whenever the overlay is used.

Evidence: `docs/app.js` (`updateRotateHint`, visibility and orientation handlers) and `docs/styles.css` (portrait rotation overlay).

### Generated Mozart assets restored

The 73-card K.545 Allegro set is now retained under [`artmended/mozart-k545-1-allegro/`](../artmended/mozart-k545-1-allegro/), including original source and reference PDF, editable notation, first-onset fingering records, provenance and validation evidence. Native preparation, complete-chord look-ahead, ornament landings, initial grace-note staff context and semantic source-anchor preservation are covered by retained adapters. Automated checks and visual reference spot-checks passed. The [reproduction helpers](../scripts/artmender_cards/README.md) and exact Artmender runtime are saved in the repository.

The six technical passages use 23 complete-measure cards plus their existing landing context. Selecting those cards and integrating them into the app remain delivery work. A separately requested Chopin Op.9 No.2 bundle does not add exercises to the Warm Up library.

## Implementation readiness gaps

### Authenticated Student Home integration uses the shipped list

The saved dirty checkout's one-Piece text readout is stale. A live main-branch check on 26 November 2026 verified the Student Home `piece-list` container and current assigned-Practice host; [issue 44](https://github.com/thdecn/apartmender/issues/44) is already completed. No separate list-rebuild dependency is needed.

The agreed placement remains Warm Up first when enabled, followed by the Student's Pieces in their existing order. [Issue 93](https://github.com/thdecn/apartmender/issues/93), planning Bead `sludge-5l8.9`, adds that entry to the accepted current implementation after backend support is verified. Preserve the existing list and unrelated saved-checkout changes.

Evidence: `docs/login/practice/index.html`, `docs/login/practice/practice.js`, and `docs/login/browser-data.js`.

### The enablement flag needs a coordinated backend contract

The per-Student boolean, disabled by default and managed manually in Supabase, is settled. It still requires Sludge storage and an authorized own-row read before Apartmender consumes it. The existing Student response has a documented fixed shape, so implementation must explicitly extend or supplement that contract and preserve compatibility with current callers.

The flag controls authenticated tile visibility. It does not restrict the public Warm Up experience, and it does not enable logging, ratings, or Student writes. The chosen field name and adapter operation are implementation choices.

Evidence: Sludge's `docs/apartmender-browser-contract.md` and `docs/student-ownership-contract.md`.

## Wording corrected during this audit

- Replaced the stale statement that adapting cards was still a design decision with the actual asset-preparation work.
- Removed wording that could imply every Student always has exactly three Pieces. Warm Up is an extra entry; existing Piece count and order stay unchanged.
- Made the section-label rule explicit: a label should distinguish the landing bar from complete bars. For example, "bars 1–11, landing on bar 12" preserves the agreed boundary. The final Bach passage includes bar 34 in full.

## Settled decisions that do not need reopening

Slow Practice uses the selected Bach passage, a simple instruction sentence, and an inline live countdown, with no cards or additional focus cues. Technical Exercises uses the selected Mozart cards with both staves and no instruction prompts. Its categories are Alberti Bass, Trills, Scales, and Arpeggios in that order; Trills and Scales open directly, while the others first offer their two passages.

The countdown starts on activity entry, pauses in the background, resumes on return, and starts fresh after reload. There are no Start, Pause/Resume, or Reset controls, tempo indications, or completion sound. Home exits immediately to the launch page, and expiry shows the separate "Warm up complete" screen.

Technical browsing is chronological, bounded to the chosen passage, and uses existing arrows and swipes without scoring or Normal/Hard progression. Reaching the final card does not replace the five-minute timer with a card-completion rule. Preserving selected activity and launch origin across reload is implementation work required by the agreed behavior.

The [working MVP design](focused-practice-mvp.md) and [future roadmap](focused-practice-roadmap.md) contain the full scope. The card-generation work is tracked separately as `sludge-bv7`; no Warm Up application or database changes are implemented by these design notes or asset bundles.

## Planning and automation handoff

Owner-approved epic `sludge-5l8` contains eleven children. The whole epic and every implementation child depend on full accepted/CLOSED `sludge-s16`; the first child, `sludge-5l8.1`, is allowed to complete routine setup now. All other children also directly depend on that setup gate. Frontend specifications are linked one-to-one from their planning Beads to Apartmender issues 88–95; backend storage/contract and operator rollout remain Sludge-owned.

The existing app routine `apartmender-sludge-notation-migration` was extended into one ordered daily queue, preserving its target chat and 09:00 Europe/Brussels schedule. There is one shared maximum of two distinct Beads per day across both epics, including resumed work; no quota reset or extra cooldown at handoff. Existing owner review/merge/deployment gates remain. Native dependencies and live issue bodies were read back; the graph is acyclic and no Warm Up implementation is eligible while `sludge-s16` remains open. Setup verification and closure are recorded in `sludge-5l8.1`.


## Asset/spec incorporation — 28 November 2026

The predecessor is now accepted/CLOSED through Sludge PR52 and current owner device evidence; setup `.1` is verified/CLOSED. Child `.2` retains the existing bundles/runtime and an inactive selected public Mozart map. See the [incorporation report](warm-up-asset-incorporation.md). This is not timer, entrypoint, backend enablement or hosted rollout acceptance. The routine remains one ordered queue with the shared cap and owner gates above.
