# Apartmender focused practice beyond the MVP

Status: exploration, updated 21 November 2026.

Focused practice is intended for adult intermediate pianists who would benefit from including more slow playing and technical exercises in their routine. The MVP keeps manual activity selection. Slow Practice shows a sentence naming the Piece and passage, asking the player to practise slowly, and ending with the live countdown; it has no on-screen cards or additional focus cues. Technical exercises use both-staff card browsing without instruction prompts. Remembered ratings, adaptive rotation, and automatic tempo progression are deferred; the ideas below are not implementation commitments or tickets.

## Practice context

Learning a Piece remains the core activity, using hands separately or together to develop coordination, fluency, accuracy, and musical detail. A practice routine may rotate among roughly three Pieces.

Around five minutes of focused practice at the beginning can involve a technical exercise related to a Piece being learned, or slow practice of a passage identified with a teacher. An example is the opening of a Bach invention through its first cadence. These activities might eventually be combined within the same preparation period; the combination and allocation of time remain undecided.

## Current MVP decisions

The [working MVP design](focused-practice-mvp.md) records the fixed passage choices, text-only Slow Practice instruction/countdown, technical-card browsing, automatic timer lifecycle, completion, and immediate return Home. The MVP behavior is settled; implementation is tracked in `sludge-5l8`. This roadmap keeps future exploration separate from those decisions.

## Ratings and adaptive rotation

A future version could ask how practice went, with simple self-ratings such as Bad and Good. These describe the player's own assessment, not automatic evaluation of the playing. The final labels and rating criteria remain open.

Ratings could influence how often an activity reappears, inspired by Anki's spaced repetition. For example, a slow-practice passage rated as difficult could appear more frequently in a later rotation. The scheduling rule, memory across visits or devices, and relationship to manual choice are undecided.

## Tempo progression

A positive rating on a technical exercise could eventually suggest a higher target tempo for a later visit. Possible displays include a metronome marking or an Italian indication such as Adagio or Andante. The MVP has no tempo indication or completion sound; any later sounding metronome or audio cue needs its own decision.

Before implementing progression, resolve the starting tempo, beat unit, increments, limits, ability to repeat or lower a tempo, and what a positive rating means. These proposals do not establish that a positive rating alone demonstrates readiness for a faster tempo.

## Repertoire specific progression

Explore sequences that gradually approach the original passage: isolate an Alberti bass pattern, use the Piece's chord progression, add a simplified right hand, then restore the melody, rhythm, and articulation. Progression could consider comfort, evenness, control, and unnecessary tension rather than elapsed time alone.

Other explorations include variations in key, harmony, or pattern; mapping exercises to precise passages and technique goals; choosing when to introduce both hands; and distinguishing mastery of one passage from transfer to other music.

## Personalization and teaching workflow

Potential later capabilities include teacher-selected activities, weekly rotation, an exercise catalog, custom instructions, notation and fingering, and activities derived from repertoire. Any product role or authenticated workflow for a teacher remains a separate design decision.

The MVP includes a per-Student enablement flag, disabled by default and managed manually in Supabase, that reveals the fixed Warm Up library on the authenticated Student page. A Teacher-facing enablement control and Teacher configuration of which exercises a Student receives remain later capabilities. Personal plans, custom exercise selections, and Practice Report integration require further design across Apartmender and Sludge. A public General Practice visitor is not an authenticated Student, and the MVP does not create personal warm-up Practice history.

Possible later records include actual duration, activity type, completion, recurrence, ratings, and perceived usefulness. Distinguish these from recorded repertoire Practice and resolve storage and retention before introducing persistence. Adjustable durations and optional feedback are also deferred. Reconsider Start and Pause/Resume controls if player feedback establishes a need; they are excluded from the MVP to keep the interface simple.

## Validation and further research

Explore how piano teachers select exercises and slow-practice passages, scaffold technical challenges, decide when to progress, and distinguish preparation from technical study.

Evaluate whether players understand the activities, use them repeatedly, and find them useful. Investigate changes in playing separately: engagement and completion do not establish learning gains. Comparative claims about generic versus repertoire-specific exercises, or injury prevention, need their own evidence.

Broader teaching strategies for Mozart K.545, including phrasing, Classical style, interpretation, and movement-by-movement learning, remain outside the current experiment.

## Ownership

Apartmender owns the frontend and this exploration. Sludge owns backend contracts and persistence.

Source context: the supplied focused-practice draft dated 20 November 2026 and the ongoing voice interview on 21 November 2026. Adaptive capabilities remain proposals requiring further decisions before implementation.
