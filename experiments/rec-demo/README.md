# Recording demo frontend

This is the frontend for Sludge Bead `sludge-0z8.2`, following the accepted
`.1` feasibility harness under epic `sludge-0z8`.
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

Results show estimated pitch/onset/offset/strength events. **Quantization,
triplet interpretation and score pages remain later slices.** Verovio still
engraves an internal synthetic rest-measure probe, not the captured notes.
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
