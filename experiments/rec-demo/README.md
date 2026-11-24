# Recording demo frontend

This is the frontend for Sludge Bead `sludge-0z8.1`, under epic `sludge-0z8`.
It is stacked on Apartmender's `codex/rec-demo` branch. Sludge remains the
backend repository and owns the approved scope and Beads tracking. The
recording demo's capture/transcription runs entirely in the browser and
requires no backend calls, account or persistence.

The intended public URL is **`https://thdecn.github.io/apartmender/rec-demo/`**.
It is a target, not a verified live deployment. The page is separate from
Apartmender's root, login and Practice flows.

## Current slice

Prepare initializes Basic Pitch 1.0.1 / TensorFlow.js 3.21.0 in an explicit
local CPU module worker and loads the existing shared Verovio
6.3.0-425dd7b assets. Start requests microphone permission and records until
Stop; decoding/resampling to mono 22,050 Hz and polyphonic inference happen
locally afterward. Results show pitch, onset/offset seconds and estimated
strength. There is no audio upload or server fallback.

This first slice has **no tap tempo, count-in, quantization, triplet
interpretation or score pages yet**. Those remain mandatory later children
of the approved epic. Verovio engraves an internal synthetic rest-measure
probe, not the captured notes. No physical-iPhone acceptance is claimed.

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
model JSON and weight shard, worker, shared Verovio runtime and notice/source
links. Confirm the first-slice interface rather than claiming the later
count-in/score flow exists.

## Owner phone check and limits

On the verified public URL in iPhone Safari, keep the page visible and screen
unlocked. Prepare engines, Start and allow the microphone, play a short
two-handed passage with chords/repeated attacks without pedal, then Stop and
view the events. Prepare and run a second take. Short takes are a verification
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
cancels visibly. Microphone tracks are released before decode. The report
distinguishes reused renderer initialization from current-action timing.
Peak device memory, physical-iPhone inference time and piano accuracy remain
unmeasured; tensor counts, optional JS heap and WASM heap visibility are not
device peak-memory measurements.

Thresholds remain onset/frame `0.25/0.25`, minimum five model frames, from the
upstream example. Pitch-bend contours are not retained. Invalid events and
padded tails are filtered; simultaneous pitches, different lengths and repeated
attacks are retained. Strength is an estimate, not calibrated velocity.
Events use decoded-audio time, not score beats. Encoder duration differed from
wall time in synthetic tests; `.2` must establish actual capture/count-in clock
mapping. This interface is not the completed recording-to-notation demo.
