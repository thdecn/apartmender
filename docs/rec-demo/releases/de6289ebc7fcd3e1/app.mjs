import { AudioCapture } from './audio.mjs';
import { InferenceWorker, initializeVerovio } from './runtime.mjs';
import { TapTempo } from './timing.mjs';
import { createTranscription, resamplePerformance, MODEL_SAMPLE_RATE } from './transcription.mjs';
import { buildStraightScore } from './score.mjs';
import { createScoreViewer } from './score-viewer.mjs';
import { MAGENTA_AUDIO } from './magenta-input.mjs';

const $ = id => document.getElementById(id);
const scoreViewer = createScoreViewer($('score-viewer'));
const report = {
  schemaVersion: 3, startedAt: new Date().toISOString(),
  environment: { userAgent: navigator.userAgent, secureContext: window.isSecureContext,
    url: location.origin + location.pathname, viewport: { width: innerWidth, height: innerHeight } },
  devicePeakMemory: 'Unmeasured. Tensor bytes, WASM heap and optional Chromium JS heap are not peak device memory.',
  networkVerification: 'Pending external request inspection; resource timings alone cannot prove absence of uploads.',
  takes: [],
};
let state = 'idle', generation = 0, worker, capture, take;
const isActiveTake = phase => ['preparing', 'ready', 'permission', 'countin', 'recording', 'processing'].includes(phase);
const tapTempo = new TapTempo();
const engineNames = { 'basic-pitch': 'Spotify Basic Pitch', magenta: 'Magenta Onsets and Frames' };
const engineIds = mode => mode === 'both' ? ['basic-pitch', 'magenta'] : [mode];
let selection = 0;
let bpm = 120;
let manifestPromise;
function loadManifest() {
  if (!manifestPromise) {
    manifestPromise = fetch(new URL('./asset-manifest.json', import.meta.url)).then(response => {
      if (!response.ok) throw new Error(`Asset manifest failed (${response.status}).`);
      return response.json();
    }).catch(error => {
      manifestPromise = undefined;
      throw error;
    });
  }
  return manifestPromise;
}

function showState(next, message) {
  state = next;
  document.body.dataset.state = next;
  $('status').textContent = message;
  $('prepare').disabled = !['idle', 'complete', 'error'].includes(next);
  $('start').disabled = next !== 'ready';
  $('stop').disabled = next !== 'recording';
  $('cancel').disabled = !isActiveTake(next);
  const frozen = ['permission', 'countin', 'recording', 'processing'].includes(next);
  $('meter').disabled = $('tap').disabled = frozen;
  $('engine-mode').disabled = isActiveTake(next);
  $('download').disabled = !report.takes.length;
  $('score-download').disabled = next !== 'complete' || !take?.score;
  $('progress').hidden = next !== 'processing';
}

$('tap').addEventListener('click', () => {
  const tapped = tapTempo.tap(performance.now());
  if (tapped !== null) bpm = tapped;
  $('tempo').textContent = tapped === null ? `Tap again · current tempo ${bpm} BPM` : `${bpm} BPM · quarter-note beat`;
});

function renderNotes(notes) {
  $('notes').replaceChildren();
  for (const note of notes.slice(0, 60)) {
    const row = document.createElement('tr');
    const name = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'][note.pitchMidi % 12];
    for (const value of [`${name}${Math.floor(note.pitchMidi / 12) - 1} (${note.pitchMidi})`,
      note.onsetSeconds.toFixed(3), note.offsetSeconds.toFixed(3), note.estimatedStrength?.toFixed(3) ?? '—']) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    $('notes').append(row);
  }
  $('results').hidden = false;
  $('note-summary').textContent = notes.length
    ? `${notes.length} estimated notes. First ${Math.min(60, notes.length)} shown; the report includes all events.`
    : 'No notes detected. This can reflect capture level, the model or the thresholds; try a new take.';
}

function diagnostics() {
  $('diagnostics').textContent = JSON.stringify({ build: report.build?.buildId,
    versions: report.build?.versions, currentTake: take,
    devicePeakMemory: report.devicePeakMemory }, null, 2);
}

function fail(error, engineStatus = 'error') {
  ++generation; ++selection;
  worker?.destroy();
  worker = undefined;
  capture?.cancel().catch(() => {});
  capture = undefined;
  scoreViewer.clear(); $('score-output').hidden = true;
  $('engine-comparison').hidden = true;
  const message = error instanceof Error ? error.message : String(error);
  if (take) {
    take.status = 'error'; take.error = message; take.endedAt = new Date().toISOString();
    for (const entry of Object.values(take.engineResults)) {
      if (!isActiveTake(entry.status)) continue;
      entry.status = engineStatus; entry.error = message; entry.endedAt = take.endedAt;
    }
  }
  $('error').textContent = message;
  $('error').hidden = false;
  showState('error', 'The local check stopped. You can prepare a new take.');
  diagnostics();
}

$('prepare').addEventListener('click', async () => {
  const current = ++generation;
  take = { number: report.takes.length + 1, startedAt: new Date().toISOString(), status: 'preparing',
    engineMode: $('engine-mode').value, engineResults: {} };
  report.takes.push(take);
  $('engine-comparison').hidden = true; $('result-engine').replaceChildren();
  scoreViewer.clear(); $('score-output').hidden = true;
  $('results').hidden = true;
  $('error').hidden = true;
  $('progress').value = 0;
  showState('preparing', 'Loading local engines. The first download may take a moment.');
  const started = performance.now();
  try {
    report.build = await loadManifest();
    const verovio = await initializeVerovio();
    if (current !== generation) return;
    take.verovio = verovio;
    const id = engineIds(take.engineMode)[0];
    const entry = take.engineResults[id] = { status: 'preparing', modelSetupPhase: 'prepare' };
    const activeWorker = worker = new InferenceWorker(id);
    const model = await activeWorker.initialize();
    if (current !== generation) return;
    take.model = entry.model = model; entry.status = 'ready';
    take.prepareWallMs = performance.now() - started;
    take.status = 'ready';
    showState('ready', take.engineMode === 'both'
      ? 'Basic Pitch ready. Record once; after Stop both engines will run sequentially, including loading Magenta.'
      : `${engineNames[take.engineMode]} ready. Start recording when you are ready to play.`);
    diagnostics();
  } catch (error) { if (current === generation) fail(error); }
});

$('start').addEventListener('click', async () => {
  const current = generation;
  showState('permission', 'Requesting microphone access…');
  capture = new AudioCapture(fail);
  try {
    const activeCapture = capture;
    const metadata = await activeCapture.start({ beats: Number($('meter').value), bpm });
    if (current !== generation) return;
    take.capture = metadata;
    activeCapture.watchClock(({ phase, beat }) => {
      if (current !== generation) return;
      take.status = phase;
      showState(phase, phase === 'recording' ? 'Play now. Press Stop when finished.'
        : beat ? `Count-in: ${beat} of ${metadata.timing.meter.beats}.` : 'Count-in about to start.');
    });
  } catch (error) { if (current === generation) fail(error); }
});

function comparisonSummary() {
  $('engine-comparison').hidden = false;
  $('engine-outcomes').replaceChildren();
  for (const id of engineIds(take.engineMode)) {
    const result = take.engineResults[id], row = document.createElement('li');
    row.textContent = `${engineNames[id]}: ${result?.status === 'complete'
      ? `${result.transcription.notes.length} notes · ${(result.result.inferenceMs / 1000).toFixed(1)} s inference · ${(result.model.initializationMs / 1000).toFixed(1)} s model setup`
      : result?.status === 'error' ? `failed — ${result.error}` : result?.status ?? 'waiting'}`;
    $('engine-outcomes').append(row);
  }
  $('comparison-summary').textContent = take.engineMode === 'both'
    ? 'Both engines use this same captured take and count-in origin. Inference times exclude model setup, resampling and rendering. Note strengths are not comparable.'
    : 'One engine selected for this take.';
  const selected = $('result-engine').value;
  $('result-engine').replaceChildren();
  for (const [id, result] of Object.entries(take.engineResults)) {
    if (result.status !== 'complete') continue;
    const option = document.createElement('option'); option.value = id; option.textContent = engineNames[id];
    $('result-engine').append(option);
  }
  if ([...$('result-engine').options].some(option => option.value === selected)) $('result-engine').value = selected;
  $('result-engine').disabled = $('result-engine').options.length < 2;
}

function completionMessage() {
  const results = Object.values(take.engineResults), selected = take.engineResults[take.selectedEngine];
  const alternatives = results.some(result => result !== selected && result.status === 'complete');
  if (selected?.display?.outcome === 'error') return 'Transcription finished, but the selected score could not be displayed. '
    + (alternatives ? 'Choose another engine result or download its MusicXML.' : 'Download its MusicXML or prepare a new take.');
  if (selected?.display?.outcome === 'empty') return 'No notes detected by the selected engine. '
    + (alternatives ? 'Choose another engine result or prepare a new take.' : 'Prepare a new take to try again.');
  if (results.some(result => result.status === 'error')) return 'One engine failed; the selected result is available below. Prepare again to retry.';
  return take.engineMode === 'both' ? 'Both engines finished. Switch View result to compare the same take.'
    : 'Local transcription finished. View the score or prepare a new take.';
}

async function selectResult(id) {
  const owner = take, result = owner.engineResults[id];
  if (result?.status !== 'complete') return;
  const current = generation, request = ++selection;
  owner.selectedEngine = id;
  // Keep legacy diagnostic fields on the first successful result so its
  // events/score timings stay coherent when the viewed engine changes.
  if (!owner.transcription) Object.assign(owner, { model: result.model, result: result.result, transcription: result.transcription,
    score: result.score, stopToEventsMs: result.stopToEventsMs });
  $('result-engine').value = id;
  renderNotes(result.transcription.notes);
  $('note-summary').textContent = `${engineNames[id]}: ${$('note-summary').textContent}`;
  $('score-summary').textContent = `${engineNames[id]} · ${result.score.measureCount} measures of straight-rhythm MusicXML. Triplet interpretation remains pending.`;
  $('score-output').hidden = false;
  const display = await scoreViewer.render({ musicXML: result.score.musicXML, noteCount: result.score.noteCount });
  if (current !== generation || request !== selection || owner !== take) return;
  result.display = display;
  if (owner.transcription === result.transcription) owner.display = display;
  if (state === 'complete') showState('complete', completionMessage());
  else $('score-download').disabled = true;
  diagnostics();
}
$('result-engine').addEventListener('change', () => { void selectResult($('result-engine').value); });

$('stop').addEventListener('click', async () => {
  const current = generation, started = performance.now(), activeCapture = capture;
  showState('processing', 'Stopping capture and preparing performance audio locally…');
  try {
    const audio = await activeCapture.stop();
    if (current !== generation) return;
    capture = undefined; take.audio = audio.metadata; take.status = 'processing';
    const hash = await crypto.subtle.digest('SHA-256', audio.pcm);
    if (current !== generation) return;
    take.input = { sha256: [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join(''),
      sampleRate: MODEL_SAMPLE_RATE, samples: audio.pcm.length, timeOrigin: 'count-in-end' };
    const engines = engineIds(take.engineMode);
    for (const id of engines) {
      if (current !== generation) return;
      const engineStarted = performance.now(), entry = take.engineResults[id] ??= {};
      entry.status = 'processing'; entry.input = take.input;
      comparisonSummary();
      let activeWorker = worker;
      entry.modelSetupPhase = activeWorker ? 'prepare' : 'after-stop';
      try {
        if (!activeWorker) {
          showState('processing', `Loading ${engineNames[id]} locally. You can cancel.`);
          activeWorker = worker = new InferenceWorker(id);
          entry.model = await activeWorker.initialize();
        } else entry.model = take.model;
        if (current !== generation) return;
        const modelSampleRate = id === 'magenta' ? MAGENTA_AUDIO.sampleRate : MODEL_SAMPLE_RATE;
        const pcm = id === 'magenta' ? await resamplePerformance(audio.pcm, MODEL_SAMPLE_RATE, modelSampleRate)
          : engines.length > 1 ? audio.pcm.slice() : audio.pcm;
        if (current !== generation) return;
        if (id === engines.at(-1)) audio.pcm = null; // No later pass needs the canonical buffer.
        entry.modelInput = { sampleRate: modelSampleRate, samples: pcm.length };
        entry.result = await activeWorker.infer(pcm, progress => {
          if (current !== generation) return;
          $('progress').value = progress;
          $('status').textContent = id === 'magenta' ? 'Magenta is transcribing on this device. You can cancel.'
            : `Basic Pitch: ${Math.round(progress * 100)}%. You can cancel.`;
        });
        if (current !== generation) return;
        activeWorker.destroy(); if (worker === activeWorker) worker = undefined;
        entry.transcription = createTranscription(entry.result.notes, audio.metadata);
        entry.score = buildStraightScore(entry.transcription);
        entry.stopToEventsMs = performance.now() - started;
        entry.eventsWallMs = performance.now() - engineStarted; entry.status = 'complete';
        entry.endedAt = new Date().toISOString();
        comparisonSummary();
        if (!take.selectedEngine) {
          await selectResult(id);
          if (current !== generation) return;
          take.stopToScoreMs = performance.now() - started;
        }
      } catch (error) {
        if (current !== generation) return;
        entry.status = 'error'; entry.error = error.message ?? String(error); entry.endedAt = new Date().toISOString();
        comparisonSummary();
      } finally { activeWorker?.destroy(); if (worker === activeWorker) worker = undefined; }
    }
    if (current !== generation) return;
    if (!Object.values(take.engineResults).some(result => result.status === 'complete')) throw new Error(Object.entries(take.engineResults).map(([id, result]) => `${engineNames[id]}: ${result.error}`).join(' · '));
    take.status = 'complete'; take.endedAt = new Date().toISOString();
    if (performance.memory) take.chromiumJSHeapBytes = performance.memory.usedJSHeapSize;
    showState('complete', completionMessage());
    diagnostics();
  } catch (error) { if (current === generation) fail(error); }
});

$('cancel').addEventListener('click', () => fail('Check cancelled. Microphone and inference worker released.', 'cancelled'));
document.addEventListener('visibilitychange', () => {
  if (document.hidden && isActiveTake(state)) {
    fail('Safari was backgrounded or the screen was locked. Keep this page open and try a new take.', 'cancelled');
  }
});
window.addEventListener('pagehide', () => {
  if (isActiveTake(state)) fail('The page was left. Prepare a new take when you return.', 'cancelled');
  else {
    scoreViewer.clear(); $('score-output').hidden = true;
    if (state === 'complete') showState('complete', 'The score was cleared after leaving the page. Prepare a new take.');
  }
});

function downloadFile(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$('score-download').addEventListener('click', () => {
  const score = take?.engineResults[take.selectedEngine]?.score;
  if (state === 'complete' && score) downloadFile(`piano-${take.selectedEngine}-straight.musicxml`, score.musicXML, 'application/vnd.recordare.musicxml+xml');
});

$('download').addEventListener('click', () => {
  report.device = { model: $('device').value.trim(), osAndSafari: $('browser').value.trim(),
    observations: $('observations').value.trim() };
  report.pageResources = performance.getEntriesByType('resource').map(entry => ({
    name: entry.name, initiatorType: entry.initiatorType, durationMs: entry.duration,
    transferBytes: entry.transferSize, decodedBytes: entry.decodedBodySize,
  }));
  downloadFile(`piano-feasibility-${new Date().toISOString().replaceAll(':', '-')}.json`, JSON.stringify(report, null, 2), 'application/json');
});

if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
  $('error').hidden = false;
  $('error').textContent = 'Open this page over HTTPS to record on a phone. A plain HTTP LAN address cannot access the microphone.';
  $('prepare').disabled = true;
} else showState('idle', 'Prepare the local engines to begin.');
