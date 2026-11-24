# Recording demo frontend

This is the frontend for Sludge Bead `sludge-0z8.4`, following merged
`.1` feasibility, `.2` capture/count-in and `.3` event adapter under epic `sludge-0z8`.
It is stacked on Apartmender's `codex/rec-demo` branch. Sludge remains the
backend repository and owns the approved scope and Beads tracking. The
recording demo's capture/transcription runs entirely in the browser and
requires no backend calls, account or persistence.

The public URL is **`https://thdecn.github.io/apartmender/rec-demo/`**. PR75
published the first harness there; changes on this branch are available only
after their own review/merge/Pages publication. The page is separate from
Apartmender's root, login and Practice flows.

## Current slice

Prepare initializes Basic Pitch 1.0.1 / TensorFlow.js 3.21.0 in an explicit
local CPU module worker and loads the existing shared Verovio
6.3.0-425dd7b assets. Choose 2/4, 3/4 or 4/4 (default), then tap quarter-note
beats. The initial tempo is an implementation default of 120 BPM; at least two
taps set a tempo from the median of up to six recent intervals. A pause longer
than four seconds starts a fresh tap series. Meter/BPM are frozen for a take.

Start requests microphone permission and starts timestamped mono PCM capture
through an AudioWorklet. Once input is flowing, clicks are scheduled for one
selected-meter bar on that same AudioContext clock, with no continuing
metronome. The count-in endpoint is score time zero. UI timers only display
the current beat/state; they never establish sample times or schedule clicks.
Stop is enabled after the count-in and finalizes capture before local
resampling/inference. Initial performance silence stays intact.

Results show validated estimated pitch/onset/offset/strength events, with a
versioned engine-neutral handoff for score construction. Straight rhythms
through sixteenths become downloadable two-staff MusicXML. **Triplet
interpretation and on-screen score pages remain later slices.** The page's
Verovio initialization still uses a rest-measure probe; representative generated
scores are imported/engraved in the focused browser checks.
There is no audio upload or server fallback.

## Capture timing contract

The worklet supplies each PCM packet's first absolute sample frame. Capture
starts before the count-in; `captureFirstFrame`, `countInStartFrame`,
`clickFrames`, `scoreOriginFrame`, `scoreOriginSeconds` and the context sample
rate bind capture and playback to a shared reference. `captureToOriginSeconds`
records their offset. Stop snapshots an audio-clock frame; packet delivery or
UI callback delays do not move either boundary. The collector clips exactly to
`[scoreOriginFrame, stopFrame)` and rejects gaps/overlaps instead of silently
compressing time. Count-in samples are removed before resampling to mono
22,050 Hz and passing PCM to Basic Pitch. Event seconds are relative to score
zero, including any silence before the first played attack.

An absent input block or discontinuous frame number closes the partial worklet
packet, so resumed input retains its actual timestamp. The collector rejects
gaps/overlaps in the performance interval visibly after Stop, including gaps
inside a final packet with a delayed Stop. Startup gaps before score zero are
outside the retained performance and do not invalidate it.

## Note-event handoff

`transcription.mjs` exports `createTranscription(notes, audioMetadata)`. The
page invokes it after Stop, resampling and local inference; results and the
diagnostic report use `take.transcription`. It contains no engine-specific
classes or tensors. Existing model diagnostics remain in `take.result`.

| Field | Meaning |
| --- | --- |
| `schemaVersion` | Handoff contract version, initially `1` |
| `timeUnit`, `timeOrigin` | `seconds`, `count-in-end`; initial silence is retained |
| `durationSeconds` | Exact `(stopFrame - scoreOriginFrame) / captureSampleRate` |
| `meter`, `tempoBPM` | Saved meter and tapped quarter-note BPM; no tempo detection |
| `capture` | Sample rate, first frame, score-origin frame, Stop frame and capture-to-origin seconds |
| `notes` | Sorted independent events: `pitchMidi`, `onsetSeconds`, `offsetSeconds`, optional `estimatedStrength` |

MIDI pitch is an integer from 21 through 108. Onset/offset are finite seconds
relative to the saved count-in endpoint, never to the first detected attack.
Estimated strength is a finite model estimate when present; missing strength
is displayed as a dash. It is not calibrated MIDI velocity or dynamics.
The adapter rejects inconsistent timing/sample-conversion metadata rather
than guessing an origin. Invalid note events are filtered; negative onsets
and padded ends are clipped to the exact performance interval, and events
outside it or with nonpositive duration are dropped. Chords, unequal overlapping
durations and repeated same-pitch attacks are kept separately; there is no
deduplication, duration equalization, musical-grid snapping or piece tuning.

`resamplePerformance` converts already-trimmed mono float32 PCM to 22,050 Hz
with OfflineAudioContext, preserving the first sample's origin and silence.
The output length is the ceiling of the exact rate conversion; event clipping
uses the original capture duration rather than that fractional-sample padding.
Basic Pitch 1.0.1 performs its own overlapping-window inference and removes
window margins in `unwrapOutput`. We append those frame/onset outputs and run
`outputToNotesPoly` once over the combined sequence, adding no application
chunks or independently decoded boundary notes. Thresholds remain 0.25 onset,
0.25 frame and five minimum note frames. No accuracy improvement is claimed.

## Straight-rhythm MusicXML

`buildStraightScore(take.transcription)` returns `take.score`, containing
`musicXML`, quantized notes, measure/voice counts and maximum onset/offset
rounding errors. The result button downloads this XML locally. It is an interim
straight-only score artifact, not a finished transcription demo or score editor.
The raw event table/handoff retain their original seconds and estimated strength.

Implementation defaults are deterministic and general:

- One tick is a sixteenth (`divisions=4` per quarter). Onsets and offsets round
  independently to the nearest tick from count-in zero, with half ticks rounding
  forward and a minimum one-sixteenth duration. No first-attack alignment, tempo
  redetection, note merging or silent deletion. Sub-grid repeated attacks can
  coincide after rounding; they remain separate in different voices.
- MIDI 60 and above use treble staff 1; lower pitches use bass staff 2. This is
  a staff heuristic, not hand detection. All chromatic black keys use sharps,
  with a neutral zero-fifths key signature; no key/piece lookup or dynamics marks.
  Explicit sharps/naturals follow chronological staff/pitch/octave state,
  reset each bar, and clarify simultaneous chromatic conflicts. Tied
  continuations retain pitch without a new accidental.
- Only equal-onset/equal-end, distinct-pitch notes on one staff form a chord.
  Greedy nonoverlapping lanes handle independent durations, same-pitch overlaps
  and repeated attacks. Voice identities stay fixed across bars. Only lanes
  with notes or tied continuations in a bar are emitted, and each emitted lane
  fills that bar with notes/rests. A completely silent staff gets one whole-bar
  rest; inactive lanes add none beside playing lanes. Opposite stem directions
  distinguish overlapping lanes.
- Whole through sixteenth note types and single dots follow metric alignment.
  Off-beat/half-bar boundaries split longer spans into tied values instead of
  hiding beats. Beams join eighth/sixteenth values within each quarter beat;
  secondary hooks handle mixed values. All bar-crossing spans tie each chord
  member individually. The recording's trailing silence stays, and a final
  partial bar is padded with rests. Reduced rational quarter units accompany
  quantized onset/duration ticks as `{numerator, denominator}`.

MusicXML divisions, rational reduction, note-value lengths, metric alignment
and beaming derive from one tick resolution. The meter's quarter-note
denominator and the sixteenth quantization grid are separate concepts; no
triplet interpretation is introduced by this internal resolution refactor.

No triplet interpretation is claimed by this grid. Required bead `.5` will
compare coherent straight/triplet groupings; `.6` owns the on-screen page host.
No PDF, pedal marks or reference-score input is added.

The MusicXML contains a standard tempo/metronome direction. The existing bounded
immutable index excludes directions, so the production demo does not feed this
document into its measure-card path. Browser checks validate musical structure
using a notation-only clone with tempo directions removed, then engrave the
**full original XML** with pinned Verovio. They check every source attack,
per-source tied duration, complete voice/measure fill and supported pitch/clef/
chord structure. The standalone SVG inspection leaves the capture page's strict
CSP; styling/pagination integration belongs to `.6`. A test harness rendering
an SVG is not a new public score page.

## Resource lifecycle

The worker receives PCM only after capture finalizes. Its temporary tensors
and model are disposed and it terminates on success/error/cancel; raw PCM is
not retained in the handoff/report. Generation guards prevent a cancelled
take's queued result or progress from replacing a new take. The handoff adds
no upload, persistence, reference-score requirement or server fallback.

This replaces the MP4/MediaRecorder prototype path, which lacked an exact
encoder-to-audio-clock mapping. Report schema 2 uses `performanceDurationSeconds`,
`captureSampleRate`, `captureChannels`, `capturedPCMBytes` and `resampleMs`;
the nested timing object is available to the later note-to-score adapter.
No raw PCM is exported in diagnostic JSON. PCM is kept only for the active
take; there is no recording cap. Worklet startup/stop acknowledgement has a
10-second failure timeout, separate from recording duration.

AudioWorklet support is required and failures are explicit. Hardware and room
input/output latency are not calibrated; reported `baseLatency`/`outputLatency`
are observations, not assumed corrections. Acoustic click/reverb tails and
physical count-in usability need a fresh phone check after publication.

## Build and check

From Apartmender's repository root:

```sh
npm ci --ignore-scripts --no-audit --no-fund --prefix experiments/rec-demo
npm run rec-demo:build
npm run rec-demo:test
npm run rec-demo:test:browser
```

Browser checks require the pinned Playwright Chromium and WebKit installations.
When needed, install them from this subproject with `npx playwright install
chromium webkit`. They use a generated Web Audio stream, real browser recording,
real inference and Verovio WASM; they are desktop plumbing tests, not microphone,
acoustic-piano or iPhone quality evidence.

The retained `evidence/count-in-*` reports describe the initial implementation
build `06f89f0458488f9f`. The subsequent
`evidence/capture-gap-summary-2026-11-24.json` records the corrected build,
processor regressions and browser interruption/repeat checks separately.
The `.3` handoff and conversion/cancellation checks are summarized in
`evidence/event-adapter-summary-2026-11-24.json` for their own build.
The `.4` MusicXML fixtures and engraving checks have their own
`evidence/straight-score-summary-2026-11-24.json` and synthetic XML/SVG artifacts.

Authored source, build tooling and its dependency lockfile live here. The
generated **`docs/rec-demo/` is deliberately tracked**, because Apartmender's
existing Pages configuration publishes `main:/docs` without a custom build.
Rebuild and include the generated route with each demo source change. The
builder only replaces `docs/rec-demo/`; it does not alter any other page or
shared asset. It verifies `docs/vendor/verovio/manifest.json` and reuses those
shared assets, notices, editable font and exact source archive without copies.
The route's asset manifest records digests and estimated gzip costs, including
the shared runtime. Runtime files and model weights are same-origin static
downloads; notices are linked from the page.

For local validation, run `npm run serve --prefix experiments/rec-demo` and open
`http://127.0.0.1:4178/apartmender/rec-demo/`. The server emulates the actual
Pages path prefix and rejects uploads. It is a development check, not the
requested remote delivery. Optional `PIANO_PORT`, `PIANO_HOST`,
`PIANO_TLS_CERT` and `PIANO_TLS_KEY` are supported; never version private keys.

## Public deployment

The current public Apartmender Pages site already uses HTTPS and publishes
`main:/docs`. Adding `docs/rec-demo/` to that source gives the desired URL with
no new Pages site, paid-plan requirement for private Sludge, source-setting
change or separate hosting account. The repo stays public and Sludge stays
private. A trailing slash is canonical for the directory index.

The feature branch alone does not publish at the existing URL. The additive
frontend changes must be reviewed, committed/pushed and incorporated into
Apartmender's Pages source before that address can be reported live. The owner
authorized committing/pushing this frontend branch and opening a PR; merging
and publication remain separate steps. No Sludge backend deployment or Dolt
remote sync is needed.

After publication, verify the returned/deployed build at the target URL, its
model JSON and weight shard, inference worker, capture worklet, shared Verovio
runtime and notice/source links. Check meter/taps/one-bar clicks and the
post-count-in result; no complete score flow is claimed.

## Owner phone check and limits

On the verified public URL in iPhone Safari, keep the page visible and screen
unlocked. Select meter and tap tempo, prepare engines, Start and allow the
microphone. Listen to one count-in bar, play after it ends, then Stop and view
events. Try a short initial rest before the first note and confirm it remains.
Cancel once during count-in and then make a repeat take. Short takes are a verification
strategy; no arbitrary recording cap is imposed. No piece name/reference score
is requested.

Expand Save device observations, enter phone model, iOS/Safari version and
observations, then download the local JSON report. It includes note events,
asset versions, timings and failures, but no raw audio. Sharing it is deliberate.
Inspect requests using Safari Web Inspector where available: static same-origin
GETs only, no performance upload/fallback. Resource entries alone do not prove
the absence of uploads; record missing inspection honestly. Normal static-host
page/asset access logs are outside the audio pipeline.

A fresh worker per take scopes/disposes Basic Pitch's temporary tensors and
model, then terminates on success/failure/cancel. Verovio WASM is strongly
retained during inference and its probe toolkit is destroyed. Backgrounding
cancels visibly. Microphone tracks are released before resampling. The report
distinguishes reused renderer initialization from current-action timing.
The prior MP4 harness has owner-supplied iPhone 15 success and repeat evidence
retained privately in Sludge. This new worklet/count-in path has desktop
Chromium/WebKit evidence and still needs a fresh physical-iPhone check.
Peak device memory and piano accuracy remain unmeasured; tensor counts,
optional JS heap and WASM heap visibility are not device peak-memory measurements.

Thresholds remain onset/frame `0.25/0.25`, minimum five model frames, from the
upstream example. Pitch-bend contours are not retained. Invalid events and
padded tails are filtered; simultaneous pitches, different lengths and repeated
attacks are retained. Strength is an estimate, not calibrated velocity.
Events now use time from the count-in endpoint, not quantized score beats.
This interface is not the completed recording-to-notation demo.
