import { AudioCapture } from './audio.mjs';
import { InferenceWorker, initializeVerovio } from './runtime.mjs';
import { TapTempo } from './timing.mjs';
import { createTranscription } from './transcription.mjs';
import { buildStraightScore } from './score.mjs';
import { createScoreViewer } from './score-viewer.mjs';

const $ = id => document.getElementById(id);
const scoreViewer = createScoreViewer($('score-viewer'));
const report = {
  schemaVersion: 2, startedAt: new Date().toISOString(),
  environment: { userAgent: navigator.userAgent, secureContext: window.isSecureContext,
    url: location.origin + location.pathname, viewport: { width: innerWidth, height: innerHeight } },
  devicePeakMemory: 'Unmeasured. Tensor bytes, WASM heap and optional Chromium JS heap are not peak device memory.',
  networkVerification: 'Pending external request inspection; resource timings alone cannot prove absence of uploads.',
  takes: [],
};
let state = 'idle', generation = 0, worker, capture, take;
const tapTempo = new TapTempo();
let bpm = 120;
let manifestPromise;
function loadManifest() {
  if (!manifestPromise) {
    manifestPromise = fetch('./asset-manifest.json').then(response => {
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
  $('cancel').disabled = !['preparing', 'ready', 'permission', 'countin', 'recording', 'processing'].includes(next);
  const frozen = ['permission', 'countin', 'recording', 'processing'].includes(next);
  $('meter').disabled = $('tap').disabled = frozen;
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

function fail(error) {
  ++generation;
  worker?.destroy();
  worker = undefined;
  capture?.cancel().catch(() => {});
  capture = undefined;
  scoreViewer.clear(); $('score-output').hidden = true;
  const message = error instanceof Error ? error.message : String(error);
  if (take) { take.status = 'error'; take.error = message; take.endedAt = new Date().toISOString(); }
  $('error').textContent = message;
  $('error').hidden = false;
  showState('error', 'The local check stopped. You can prepare a new take.');
  diagnostics();
}

$('prepare').addEventListener('click', async () => {
  const current = ++generation;
  take = { number: report.takes.length + 1, startedAt: new Date().toISOString(), status: 'preparing' };
  report.takes.push(take);
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
    worker = new InferenceWorker();
    take.model = await worker.initialize();
    if (current !== generation) return;
    take.prepareWallMs = performance.now() - started;
    take.status = 'ready';
    showState('ready', 'Local engines ready. Start recording when you are ready to play.');
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

$('stop').addEventListener('click', async () => {
  const current = generation;
  const started = performance.now();
  const activeCapture = capture;
  showState('processing', 'Stopping capture and preparing performance audio locally…');
  try {
    const audio = await activeCapture.stop();
    if (current !== generation) return;
    capture = undefined;
    take.audio = audio.metadata;
    take.status = 'processing';
    const result = await worker.infer(audio.pcm, progress => {
      if (current !== generation) return;
      $('progress').value = progress;
      $('status').textContent = `Transcribing on this device: ${Math.round(progress * 100)}%. You can cancel.`;
    });
    if (current !== generation) return;
    worker.destroy();
    worker = undefined;
    take.result = result;
    take.transcription = createTranscription(result.notes, audio.metadata);
    take.score = buildStraightScore(take.transcription);
    take.stopToEventsMs = performance.now() - started;
    take.status = 'rendering';
    showState('processing', 'Engraving piano score on this device…');
    $('score-output').hidden = false;
    take.display = await scoreViewer.render({ musicXML: take.score.musicXML, noteCount: take.score.noteCount });
    if (current !== generation) return;
    take.stopToScoreMs = performance.now() - started;
    take.status = 'complete';
    take.endedAt = new Date().toISOString();
    if (performance.memory) take.chromiumJSHeapBytes = performance.memory.usedJSHeapSize;
    renderNotes(take.transcription.notes);
    $('score-summary').textContent = `${take.score.measureCount} measures of straight-rhythm piano MusicXML prepared. Triplet interpretation remains a later step.`;
    showState('complete', take.display.outcome === 'error'
      ? 'Local transcription finished, but the score could not be displayed. You can download the MusicXML or prepare again.'
      : take.display.outcome === 'empty' ? 'No notes detected. Prepare a new take to try again.'
        : 'Local transcription finished. View the score or prepare again for a repeat take.');
    diagnostics();
  } catch (error) { if (current === generation) fail(error); }
});

$('cancel').addEventListener('click', () => fail('Check cancelled. Microphone and inference worker released.'));
document.addEventListener('visibilitychange', () => {
  if (document.hidden && ['preparing', 'ready', 'permission', 'countin', 'recording', 'processing'].includes(state)) {
    fail('Safari was backgrounded or the screen was locked. Keep this page open and try a new take.');
  }
});
window.addEventListener('pagehide', () => {
  if (['preparing', 'ready', 'permission', 'countin', 'recording', 'processing'].includes(state)) fail('The page was left. Prepare a new take when you return.');
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
  if (state === 'complete' && take?.score) downloadFile('piano-straight.musicxml', take.score.musicXML, 'application/vnd.recordare.musicxml+xml');
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
