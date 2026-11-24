# Recording demo frontend

This is the frontend for Sludge Bead `sludge-0z8.8` (same-take engine comparison),
following merged `.1` feasibility, `.2` capture/count-in, `.3` event adapter,
`.4` straight MusicXML and `.6` full-score viewer under epic `sludge-0z8`. The owner chose the viewer before `.5` triplets;
triplet interpretation remains mandatory and unimplemented.
It is stacked on Apartmender's `codex/rec-demo` branch. Sludge remains the
backend repository and owns the approved scope and Beads tracking. The
recording demo's capture/transcription runs entirely in the browser and
requires no backend calls, account or persistence.

The public URL is **`https://thdecn.github.io/apartmender/rec-demo/`**. PR75
published the first harness there; changes on this branch are available only
after their own review/merge/Pages publication. The page is separate from
Apartmender's root, login and Practice flows.

## Current slice

By default, Prepare initializes Basic Pitch 1.0.1 / TensorFlow.js 3.21.0 in an explicit
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
through sixteenths become two-staff MusicXML displayed as complete Verovio pages,
with previous/next navigation, Fit width and 150/200/300% zoom. The XML download
remains available. **Triplet interpretation remains the next slice.** Verovio
initialization still uses its rest-measure probe; the viewer subsequently loads
the actual generated score in a separate toolkit on that same resident module.
There is no audio upload or server fallback.

## Same-recording engine comparison

Choose **Spotify Basic Pitch** (the unchanged default), **Magenta Onsets and
Frames**, or **Compare both on the same recording** before Prepare. The choice
is frozen through preparation/capture/inference. In comparison mode, Prepare
loads Basic Pitch; after Stop, Basic Pitch finishes and its worker terminates
before Magenta loads in a new worker. The first result is available while the
second runs. No two inference models coexist. Verovio's shared module remains
resident; the existing viewer owns only the selected result's toolkit/page.

Magenta is pinned to `@magenta/music` **1.23.1**, its separate TensorFlow.js
**2.8.6**, and the official **onsets_frames_uni_q2** checkpoint (two-byte
quantized unidirectional weights). The checkpoint is 31,280,427 bytes including
its weights manifest, before the small provenance/license files. It is checked
in under `docs/vendor/magenta-onsets-frames-uni-q2/`, hash-verified by the
builder and served from that same origin. Original shards are unmodified.
The runtime bundle is separate, so Basic-Pitch-only runs do not load Magenta.
First Magenta initialization may require downloading these assets; the UI says
so before recording. No phone performance or accuracy improvement is claimed.

One take retains one canonical mono 22,050-Hz PCM buffer only until the requested
engines finish or cancellation unwinds. Basic Pitch receives a copy; Magenta
receives a 16,000-Hz Web Audio resampling of that same buffer, preserving time
zero and initial silence. No re-recording, first-attack realignment, content
lookup or reference piece is used. Diagnostics record the canonical PCM SHA-256,
length and origin for each engine, alongside its actual model input rate/length.
Raw PCM is neither persisted nor exported.

The Magenta worker uses the library's `melSpectrogram`/`powerToDb` preprocessing
(2048 FFT, 512 hop, 229 mel bins, 30-Hz minimum) and
`OnsetsAndFrames.transcribeFromMelSpec`. Onset/frame thresholds stay at the
library defaults of 0.5; chunk length 64 and one convolution batch at a time
are memory-oriented defaults. The library carries recurrent state through its
chunks; application code does not decode separate audio chunks or merge notes.
The worker compatibility module supplies worker globals and excludes unused
AudioBuffer/Node resampling dependencies; a build transform uses the CommonJS
FFT constructor's default import. Neural-network computation, weights and
spectrogram math remain unchanged. Takes shorter than half an FFT window get
trailing zero padding for preprocessing; events are still clipped to the exact
original duration. AudioBuffer transcription APIs are not used
in this worker. CPU inference keeps the page responsive and cancel terminates
the worker; progress for Magenta is a stage indication, not a measured percent.

Both engines produce the same normalized event handoff and use the exact same
straight-rhythm MusicXML builder and Verovio viewer. Magenta's predicted MIDI
velocity is not comparable with Basic Pitch confidence, so its strength column
is blank. No calibrated dynamics claim is added. **View result** switches the
labelled notes and score; the MusicXML filename includes the engine. A failed
engine remains visible in the comparison list/report and leaves the other's
result available. A new take, backgrounding or cancellation invalidates late
results and releases old workers/viewer resources. Retrying Prepare starts
fresh engine state.

Report schema **3** adds `engineMode`, `engineResults`, `selectedEngine` and
`input`. Each engine records initialization and its setup phase (Prepare or after Stop),
inference time, processing wall
time (initialization/conversion/inference/score construction for that pass),
normalized notes, score, errors and display result when selected. Comparison
runs sequentially; `stopToEventsMs` includes waiting for the earlier engine.
The comparison list shows inference and model-setup times separately: Basic
Pitch setup occurs before capture in comparison mode, while Magenta setup
occurs after Stop. The old top-level result/score fields mirror the first successful engine for
report compatibility (keeping its event/score timings coherent), and `stopToScoreMs` is the first automatically displayed result.
Switching later records rendering duration, not an artificial new processing
latency. Tensor cleanup counts remain observations, not peak device memory.

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
compare coherent straight/triplet groupings; the viewer accepts their MusicXML
without taking over rhythmic interpretation.
No PDF, pedal marks or reference-score input is added.

The MusicXML contains a standard tempo/metronome direction. The existing bounded
immutable index excludes directions, so the production demo does not feed this
document into its measure-card path. Browser checks validate musical structure
using a notation-only clone with tempo directions removed, then engrave the
**full original XML** with pinned Verovio. They check every source attack,
per-source tied duration, complete voice/measure fill and supported pitch/clef/
chord structure. The standalone SVG inspection leaves the capture page's strict
CSP. That historical standalone inspection is separate from the current
public-page viewer checks below.

## Full-score viewer

`createScoreViewer(container)` in `score-viewer.mjs` owns a complete-score host.
`render({musicXML, noteCount})` resolves to `rendered` with page count/render
time, `empty`, `error` with a message, or `superseded`. `clear()` invalidates
pending work, clears the image, revokes page URLs and destroys owned toolkits;
`destroy()` also removes the host controls permanently. Voice/measure-card
projection, score editing and PDF export are not part of this interface.

The viewer uses Verovio **6.3.0-425dd7b**, Leipzig, practical A4 dimensions
(`2100 x 2970` toolkit page units), automatic full-score layout and the engine's
page count/per-page SVG APIs. It preserves the complete page/viewBox. Fit width
shows the whole page; larger zoom levels scroll within a keyboard-focusable
viewport, including the far-right/bottom margins. Navigation retains the score
toolkit but replaces the selected page; there is no all-pages SVG cache.

Each page is a local SVG Blob image. Its embedded engraving CSS/font data stay
with that image, so staff lines, symbols and text render without copying dynamic
SVG CSS into the document. The capture page retains `style-src 'self'` and adds
only `blob:` to `img-src`; no inline-script/style permission or remote renderer
is introduced. No extra font download is needed. Only static same-origin assets
are downloaded, with local Blob image reads for displayed pages; nothing is
uploaded. Notices/source/font links still refer to the unchanged shared
`docs/vendor/verovio/` package and pinned manifest.

`createScoreToolkit()` reuses the module initialized by `initializeVerovio()`;
the viewer does not instantiate another WASM module or import the measure-card
renderer. Basic Pitch's worker is terminated before full-score engraving.
Preparing another take releases the old score toolkit, page image and any
pending decode before loading/inference begins. The resident shared WASM module
stays loaded across takes, as before; this is not a new phone-memory pass.

The score appears above the raw event table. No detected notes gives an explicit
empty state. Malformed/measure-less XML, failed engine initialization and image
decode failures give a visible viewer alert and clear the prior page. Rendering
failure leaves valid note events/MusicXML available for inspection/download.
Failed module downloads may require a page reload because browsers can cache a
rejected module import. A new take or page departure invalidates in-flight work;
late image decodes cannot restore an old score. Superseded/cancelled candidates
and displayed pages release toolkits and Blob URLs.

Diagnostics retain `stopToEventsMs` through note/score construction;
`stopToScoreMs` includes the first displayed page, and `take.display` records
the viewer outcome, page count and first-render time. These are current-action
timings, not total cold page-load time or peak device memory.

Focused browser checks use a bounded **64-measure synthetic full piano score**
with chords, independent bass rhythms/rests, cross-bar ties and actual 3:2 eighth
triplet MusicXML. Both engines preserve all 64 measure-head identities across
two pages and show both staves, embedded styles and tuplet groups. This verifies
display of supplied tuplets, not detection of triplets from playing. Navigation,
zoom/panning, strict CSP, empty/import/runtime/decode failures, immediate toolkit/
URL cleanup and superseded rendering are checked. The recording/inference test
also displays the real generated straight score and clears it before a repeat.

## Resource lifecycle

The worker receives PCM only after capture finalizes. Its temporary tensors
and model are disposed and it terminates on success/error/cancel; raw PCM is
not retained in the handoff/report. Generation guards prevent a cancelled
take's queued result or progress from replacing a new take. The handoff adds
no upload, persistence, reference-score requirement or server fallback.

This replaces the MP4/MediaRecorder prototype path, which lacked an exact
encoder-to-audio-clock mapping. Report schema 2 introduced (and schema 3 retains) `performanceDurationSeconds`,
`captureSampleRate`, `captureChannels`, `capturedPCMBytes` and `resampleMs`;
the nested timing object is used by the note-to-score adapter.
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
The `.6` viewer checks are recorded separately in
`evidence/score-viewer-summary-2026-11-24.json`; earlier evidence keeps its build
attribution. Same-take engine comparison, partial failure, cancellation and
input equality checks are recorded in `evidence/engine-comparison-summary-2026-11-24.json`
with a 390px screenshot. All of these are desktop synthetic evidence.

Authored source, build tooling and its dependency lockfile live here. The
generated **`docs/rec-demo/` is deliberately tracked**, because Apartmender's
existing Pages configuration publishes `main:/docs` without a custom build.
Rebuild and include the generated route with each demo source change. The
builder stages an immutable `docs/rec-demo/releases/<buildId>/` cohort, then
updates only the root HTML and `release.json` pointer. It retains earlier
cohorts and refuses to overwrite changed/incomplete output at an existing ID.
A new cohort is copied to a temporary sibling and atomically renamed only
after the copy completes, so an interrupted first copy does not reserve its URL;
it does not alter any other page or shared asset. It verifies `docs/vendor/verovio/manifest.json` and reuses those
shared assets, notices, editable font and exact source archive without copies.
Each cohort owns its modules, CSS, worker/worklet, model, notices and asset
manifest, recording digests and estimated gzip costs including the shared
runtime. Root HTML links to that cohort; application manifest loading resolves
relative to its own module, never the mutable pointer. Runtime files and model
weights are same-origin static downloads; notices are linked from the page.

The previously published unversioned graph (build `42c402040d4cdbc0`) stays
frozen at the route root for cached old HTML. `legacy-index.html` preserves
that HTML and the root `asset-manifest.json` describes that legacy graph;
`release.json` identifies the current cohort for tooling. Old cached pages keep
their previous behavior until the HTML refreshes. New HTML never combines a
new viewer/app with an old unversioned runtime. Future builds must retain both
the legacy graph and prior cohorts. No service worker or server is needed.
Browser regressions use Pages' ten-minute cache policy and cover legacy HTML
followed by current HTML, old unversioned runtime responses, and retained
cohort entry URLs. The first regression failed against the mixed graph before
this fix (Prepare could not leave idle).

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

After publication, choose Compare both, record once and switch View result.
Judge extra/missing notes and durations on the same take. Try a repeat and
cancel once during Magenta loading/inference. Save the schema-3 diagnostic
report with device observations; no recording/reference score is requested.

After publication, verify the root HTML links the expected cohort and its
manifest (the root manifest intentionally describes the legacy graph). Check its
model JSON and weight shard, inference worker, capture worklet, viewer module,
shared Verovio runtime and notice/source links. Check meter/taps/one-bar clicks,
the resulting score, page navigation and zoom. Straight-only output still does
not complete the approved demo's triplet requirement.

## Owner phone check and limits

On the verified public URL in iPhone Safari, keep the page visible and screen
unlocked. Select meter and tap tempo, prepare engines, Start and allow the
microphone. Listen to one count-in bar, play after it ends, then Stop and view
the score. Try page navigation/zoom and check the raw events if useful. Try a
short initial rest before the first note and confirm it remains.
Cancel once during count-in and then make a repeat take. Short takes are a verification
strategy; no arbitrary recording cap is imposed. No piece name/reference score
is requested.

Expand Save device observations, enter phone model, iOS/Safari version and
observations, then download the local JSON report. It includes note events,
generated XML, display outcomes, asset versions, timings and failures, but no
raw audio. Sharing it is deliberate.
Inspect requests using Safari Web Inspector where available: static same-origin
GETs and local Blob page images only, no performance upload/fallback. Resource entries alone do not prove
the absence of uploads; record missing inspection honestly. Normal static-host
page/asset access logs are outside the audio pipeline.

A fresh worker per take scopes/disposes Basic Pitch's temporary tensors and
model, then terminates on success/failure/cancel. Verovio WASM is strongly
retained during inference and its probe toolkit is destroyed. Backgrounding
cancels active takes visibly. Microphone tracks are released before resampling. The report
distinguishes reused renderer initialization from current-action timing.
The prior MP4 harness has owner-supplied iPhone 15 success and repeat evidence
retained privately in Sludge. This new worklet/count-in/viewer path has desktop
Chromium/WebKit evidence and still needs a fresh physical-iPhone check.
Peak device memory and piano accuracy remain unmeasured; tensor counts,
optional JS heap and WASM heap visibility are not device peak-memory measurements.

Thresholds remain onset/frame `0.25/0.25`, minimum five model frames, from the
upstream example. Pitch-bend contours are not retained. Invalid events and
padded tails are filtered; simultaneous pitches, different lengths and repeated
attacks are retained. Strength is an estimate, not calibrated velocity.
Events now use time from the count-in endpoint, not quantized score beats.
This interface is not the completed recording-to-notation demo.
