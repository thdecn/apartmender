# Apartmender focused practice MVP decisions

Status: owner-approved MVP behavior, converted into Sludge Beads epic `sludge-5l8` and linked Apartmender implementation issues on 26 November 2026. Detailed acceptance and dependencies live in those issues.

## Delivery gates and routine

The entire Warm Up epic and every implementation child are blocked by full accepted completion of `sludge-s16`. The first child, `sludge-5l8.1`, is the explicit exception: routine setup may be configured, verified and closed before that predecessor finishes. No other Warm Up child starts early.

The existing daily routine now covers the ordered queue: finish `sludge-s16`, then proceed to `sludge-5l8`. It runs at 09:00 Europe/Brussels with one shared maximum of two distinct Beads per day, including resumed work and all prior runs. Handoff does not reset the allowance or impose an extra waiting day. The owner controls review, merge and hosted deployment; the routine may prepare scoped branches, commits, pushes and tested draft PRs. It does not merge, push main, deploy or remotely synchronize Dolt. Setup/verification does not launch an immediate implementation run.

## Audience and purpose

Adult intermediate pianists need more slow playing and technical exercises in their routine. Focused practice provides about five minutes of preparation before the core work of learning Pieces, hands separately or together.

## Entry and activity choice

Warm Up is the first tile in the piece list on the public home screen and, when enabled for that Student, on the authenticated Student page (described as the Student profile in the interview). It uses the same visual style as the existing piece tiles. The existing pieces retain their order below it, moving down one position. Warm Up is an additional feature entry rather than a Piece Assignment; the Student's assigned Pieces remain available below it, with their count unchanged.

Selecting the Warm Up tile opens two vertically stacked buttons: Slow Practice first and Technical Exercises below it. Slow Practice uses the three agreed passages of Bach's Invention No. 8 from the existing Piece Catalog.

The Warm Up screens, branch choices, passage lists, and activity presentation are the same whether launched from the public page or the authenticated Student page. The Student enablement flag affects entry-tile visibility, and the launch origin determines the Home destination; neither changes the fixed exercise experience.

The technical chooser shows four tiles in this exact order: Alberti Bass, Trills, Scales, Arpeggios. The six selected technical passages all come from the Allegro, the first movement of Mozart's K.545. This selection supersedes the earlier proposal to limit the MVP to one or two technical exercises.

## Student enablement

Each Student has a stored boolean controlling whether their authenticated Student page displays Warm Up. It defaults to disabled for existing and newly created Students. When enabled, the button opens the same fixed activities and passages specified below; there is no per-Student exercise configuration in the MVP.

The public entry remains available independently of this per-Student visibility setting. This extends the original public-only proposal: Sludge will need additive storage and an authorized read of the Student's setting, and Apartmender will need to use that setting in the authenticated interface. Existing Student reads are explicitly shaped by the browser contract, so the read extension must be coordinated rather than silently changing the current response.

An authorized operator manages the setting manually in Supabase for the MVP, targeting the intended Student row. There is no Teacher-facing or Student-facing enablement switch. Current Sludge contracts give Students read-only access to their own row; the new setting does not introduce a browser write capability or privileged browser credentials.

Teacher configuration of the actual exercises is deferred to the [roadmap](focused-practice-roadmap.md). The initial enablement flag does not introduce adaptive rotation, ratings, or warm-up Practice history.

## Selected passages

Passage boundaries use the existing Card convention: each measure card includes the next bar through its first sounding onset on each staff, retaining preceding rests. The ending bar supplies that landing rather than a complete additional card. The user confirmed that "bar 1 until bar 5" means cards for bars 1 through 4, with the existing bar-5 landing on the bar-4 card. Apply the same convention to every supplied range. Card numbers here refer to original written measures, not positions in Artmender's reverse-order export.

| Branch or category | Piece | Complete bars or measure cards | Landing at first note of bar |
| --- | --- | --- | --- |
| Slow Practice | Bach Invention No. 8, BWV 779 | 1–11 | 12 |
| Slow Practice | Bach Invention No. 8, BWV 779 | 12–25 | 26 |
| Slow Practice | Bach Invention No. 8, BWV 779 | 26–34 | End of Piece; bar 34 in full |
| Alberti Bass | Mozart K.545, I. Allegro | 1–4 | 5 |
| Alberti Bass | Mozart K.545, I. Allegro | 22–25 | 26 |
| Trills | Mozart K.545, I. Allegro | 13–17 | 18 |
| Scales | Mozart K.545, I. Allegro | 5–10 | 11 |
| Arpeggios | Mozart K.545, I. Allegro | 11 | 12 |
| Arpeggios | Mozart K.545, I. Allegro | 18–20 | 21 |

These are nine selectable passages: three slow-practice passages and six technical passages across four categories. Technical passages retain both staves of the approved score cards and need no instruction prompt. Slow Practice uses the piece-and-passage instruction sentence defined below, with no additional focus cues. The final Invention passage is the explicit exception to the ending-bar landing convention: play bar 34 in full, using its ordinary final-measure behavior rather than truncating it to a landing.

## Passage choice flow

The Warm Up branch chooser shows Slow Practice above Technical Exercises. Selecting Slow Practice opens a vertical list of the three Invention No. 8 passages in score order: the opening passage, middle passage, then final passage. Selecting a passage opens that passage's five-minute activity.

Technical Exercises first offers the four category tiles in this order: Alberti Bass, Trills, Scales, Arpeggios. Choosing Alberti Bass then offers its two passage options, and choosing Arpeggios likewise offers its two passage options. The player selects one passage for the five-minute warm-up; the two passages do not form a mandatory sequence or a combined timed activity.

Trills and Scales each have one passage and open that activity directly, without an intermediate passage-selection screen. The automatic countdown begins when the activity opens, including when reached directly from a single-passage category tile.

For example: Home → Warm Up → Technical exercises → Alberti Bass → choose bars 1–4 with a landing on bar 5, or bars 22–25 with a landing on bar 26 → activity.

## Technical notation source

Use Artmender for the score-to-cards workflow. Henle is not required. The agreed source is [Alejandro Sierra's Mutopia edition](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=998), supplied as LilyPond and a reference PDF under Creative Commons Attribution-ShareAlike 3.0; its reference appearance was approved during the interview.

The lost temporary base set has been regenerated as 73 Allegro measure cards under [`artmended/mozart-k545-1-allegro/`](../artmended/mozart-k545-1-allegro/). It retains original notation, the reference PDF, editable card files, provenance, source-anchor audits and validation records. Count, reverse order, landing labels, dimensions, source fingering preservation, native engraving and visual spot-checks passed. Excerpt-boundary slur/hairpin warnings and normalized card barlines are documented in the bundle.

Generation helpers and the exact Artmender runtime are retained in this repository; see the [reproduction instructions](../scripts/artmender_cards/README.md). Selecting the agreed 23 complete-measure cards for the six technical passages and wiring them into Apartmender remain implementation work. Generating the assets does not itself make them available in the application. Chopin Prelude in E minor, Op.28 No.4 is a separate requested card bundle and does not change this Warm Up library.

## Activity presentation

Slow Practice shows the instruction "Practice [piece name], [section defined by measures], slowly for [remaining time]". The remaining-time indicator is the live countdown in minutes and seconds separated by a colon, for example 2:29. It is part of that sentence, rather than a fixed duration in the instruction. There are no additional pedagogical focus cues.

For example, the final passage can display "Practice Bach Invention No. 8, bars 26–34, slowly for 2:29". For earlier passages, the section label must make the landing explicit, for example "bars 1–11, landing on bar 12", rather than suggesting that bar 12 is played in full. These labels describe the already agreed passage boundaries; they add no pedagogical focus cues.

The five-minute countdown starts immediately when the selected activity opens. The player practises the selected passage using their own score. Slow Practice has no on-screen measure cards or card-browsing controls; "go through those measures" describes playing the selected passage rather than browsing notation in the app.

Technical exercises show the selected score cards with both staves, as reminders of exercises learned beforehand. There is no instruction or focus prompt for this branch; the score provides the instructions.

Technical exercises open on the selected passage's first measure card and browse chronologically within that passage. Reuse the existing practice interface's card-navigation methods and control placement; the user's reference to swiping means the current supported navigation behavior, not a requirement to add a new gesture. Previous and Next describe browsing direction and do not require a new set of navigation buttons if the existing interface already provides them another way. Slow Practice has no card-browsing controls.

Warm Up has no Normal/Hard mode behavior. Its card screen omits the existing mistake, good, and advance/progression actions. Navigation is free browsing of the chosen passage, without scoring or the normal practice progression. Existing next-bar landing context is retained. The reverse file-export order is not the warm-up display order.

The existing browsing inputs are header arrow buttons and horizontal pointer swipes/drags on the card frame, including touch swipes. Keep their musical direction: right arrow or left swipe moves forward chronologically, and left arrow or right swipe moves backward. Reuse the header arrangement of Home on the left, title in the center, and timer/navigation on the right. Omit the streak counter as well as the scoring actions and reclaim their layout space. The existing no-wrap behavior bounds browsing to the selected passage.

The activity shows a five-minute timer and a Home button. The countdown starts automatically as soon as the selected passage's warm-up activity page opens. Time spent choosing a branch, category, or passage is outside the countdown.

Backgrounding or hiding the app pauses the timer. Returning to the activity resumes the remaining countdown automatically. Reloading the activity starts a fresh five-minute countdown rather than restoring elapsed time.

Technical-exercise timing also pauses whenever the rotate-to-landscape overlay covers the cards. It resumes automatically only when the app is visible and the overlay no longer obscures the activity. Opening an activity while that overlay is already present must not consume countdown time behind it. The same pause rule applies to any Warm Up activity if it is covered by that overlay; this rule does not add a manual pause control.

There are no Start, Pause/Resume, or Reset controls in the MVP. Start and Pause/Resume may be revisited if player feedback establishes a need.

There is no fixed tempo indication, sounding metronome, or completion sound in the MVP. Completion is visual only.

## Completion and leaving

At five minutes, replace the activity with a separate screen displaying "Warm up complete". A button below the message returns Home.

Pressing Home during the activity ends the warm-up immediately, without a confirmation dialog. Home returns to the page from which Warm Up was launched: Student entry returns to the Student page, and public entry returns to the public page. The same destination rule applies to Home on the completion screen. Origin determines the destination; being logged in does not redirect a warm-up launched from the public page to the Student page.

## Scope boundary

Keep manual activity selection. Slow Practice uses the piece-and-passage instruction sentence with an inline live countdown and the player's own score. Technical exercises use both-staff score cards without instruction prompts. Remembered ratings, adaptive rotation, and automatic tempo progression are deferred to the [roadmap](focused-practice-roadmap.md).

Public access without login and preservation of existing normal and hard flows remain in scope. The Student enablement decision supersedes the original prohibition on all backend or schema changes: additive storage and a read for the enablement setting are now required. Personal warm-up Practice records remain outside the MVP scope. The owner subsequently authorized ticket creation and routine setup; implementation remains subject to the predecessor/setup gates and recorded routine permissions above.

## Design review status

The discussed Slow Practice and Technical Exercises flows, instruction presentation, passage selections, category order, background/reload and rotation-overlay timer lifecycle, Home destinations, entry placement, card browsing, and completion behavior are settled. The countdown pauses while the rotation overlay covers an activity, resolving the timer edge case identified by the [design audit](focused-practice-review.md). Epic `sludge-5l8` now owns delivery; frontend issues [88](https://github.com/thdecn/apartmender/issues/88) through [95](https://github.com/thdecn/apartmender/issues/95) contain the detailed frontend acceptance. Application implementation remains in the dependency-gated child issues; `.2` incorporates the approved specification/assets without activating the app.

## Repository facts

The current public entry is `docs/index.html`, published at the lowercase `/apartmender/` base path according to the repository README. Its home screen contains the Piece picker and normal or hard mode controls. `docs/app.js` loads the shared `docs/pieces.json` catalog, and screen changes currently occur without URL navigation.

The saved dirty checkout has an older Student-page baseline. Current main already contains the Student piece list: [issue 44](https://github.com/thdecn/apartmender/issues/44) is completed, and `docs/login/practice/index.html` has the existing `piece-list` container. Reuse that accepted implementation and add Warm Up above its pieces; do not rebuild it from the stale checkout. Verify the current accepted baseline after `sludge-s16` completes and preserve unrelated local changes.

Apartmender owns the frontend and this design. Sludge owns backend contracts and persistence.


## Predecessor acceptance — 27 November 2026

`sludge-s16` and final `.8` are accepted/CLOSED after owner physical-device/pilot approval and [Sludge PR52](https://github.com/thdecn/Sludge/pull/52), merge `a33a204`. Warm Up setup `.1` is CLOSED with app read-back. The gates above remain required and are now satisfied; other child dependencies, reviews and hosted/operator gates remain independent. The [asset incorporation report](warm-up-asset-incorporation.md) describes `.2`; this document does not claim a shipped Warm Up interface.
