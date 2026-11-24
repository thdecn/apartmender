let verovioPromise;
// Keep a strong reference while Basic Pitch runs; a destroyed probe toolkit
// alone must not let the WASM module be collected before the coexistence check.
let retainedVerovioModule;
let retainedVerovioToolkit;

export async function initializeVerovio() {
  const reused = Boolean(verovioPromise);
  const requestStarted = performance.now();
  if (!verovioPromise) verovioPromise = (async () => {
    const started = performance.now();
    const [{ default: createModule }, { VerovioToolkit }] = await Promise.all([
      import('../../../vendor/verovio/verovio-module.mjs'), import('../../../vendor/verovio/verovio.mjs'),
    ]);
    const module = retainedVerovioModule = await createModule();
    retainedVerovioToolkit = VerovioToolkit;
    const toolkit = new VerovioToolkit(module);
    try {
      const version = toolkit.getVersion();
      // Only a renderer initialization probe; this is not the recorded score.
      const xml = '<score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes><note><rest/><duration>4</duration><voice>1</voice><type>whole</type><staff>1</staff></note><backup><duration>4</duration></backup><note><rest/><duration>4</duration><voice>2</voice><type>whole</type><staff>2</staff></note></measure></part></score-partwise>';
      if (!toolkit.loadData(xml) || !toolkit.renderToSVG(1).includes('<svg')) {
        throw new Error('Verovio could not engrave its two-staff initialization probe.');
      }
      return { version, initializationMs: performance.now() - started,
        wasmHeapBytesAfterProbe: module.HEAP8?.buffer.byteLength ?? null,
        lifecycle: 'Toolkit destroyed after probe; initialized WASM module remains resident during inference.' };
    } finally { toolkit.destroy(); }
  })().catch(error => { verovioPromise = undefined; retainedVerovioModule = undefined; throw error; });
  return { ...await verovioPromise, reused, thisRequestMs: performance.now() - requestStarted };
}

export async function createScoreToolkit() {
  await initializeVerovio();
  return new retainedVerovioToolkit(retainedVerovioModule);
}

export class InferenceWorker {
  constructor() {
    this.worker = new Worker(new URL('./inference-worker.js', import.meta.url), { type: 'module' });
    this.worker.addEventListener('error', event => this.reject?.(new Error(event.message || 'Local inference worker failed.')));
    this.worker.addEventListener('messageerror', () => this.reject?.(new Error('Local worker message could not be decoded.')));
    this.worker.onmessage = ({ data }) => {
      if (data.type === 'error') this.reject?.(new Error(`${data.name}: ${data.message}`));
      else if (data.type === 'progress') this.onProgress?.(data.progress);
      else this.resolve?.(data);
    };
  }

  request(message, transfer = []) {
    return new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
      this.worker.postMessage(message, transfer);
    }).finally(() => { this.resolve = this.reject = undefined; });
  }

  initialize() {
    return this.request({ type: 'initialize', modelURL: new URL('./model/model.json', import.meta.url).href });
  }

  infer(pcm, onProgress) {
    this.onProgress = onProgress;
    return this.request({ type: 'infer', pcm: pcm.buffer }, [pcm.buffer]);
  }

  destroy() {
    this.worker.terminate();
    this.reject?.(new Error('Local inference was cancelled.'));
  }
}
