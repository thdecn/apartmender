import { createScoreToolkit } from './runtime.mjs';

const PAGE_OPTIONS = Object.freeze({ pageWidth: 2100, pageHeight: 2970, scale: 40,
  font: 'Leipzig', header: 'none', footer: 'none', breaks: 'auto',
  adjustPageHeight: false, svgViewBox: true, svgHtml5: false });

// Full-score host, independent of note recognition and the measure-card editor.
export function createScoreViewer(container) {
  container.classList.add('score-viewer');
  const status = document.createElement('p'), controls = document.createElement('div');
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  controls.className = 'score-navigation';
  const previous = document.createElement('button'), next = document.createElement('button');
  previous.textContent = 'Previous page'; next.textContent = 'Next page';
  const position = document.createElement('span');
  position.setAttribute('aria-live', 'polite');
  const label = document.createElement('label'), zoom = document.createElement('select');
  label.textContent = 'Score zoom';
  zoom.setAttribute('aria-label', 'Score zoom');
  for (const [value, text] of [[100, 'Fit width'], [150, '150%'], [200, '200%'], [300, '300%']]) {
    const option = document.createElement('option'); option.value = value; option.textContent = text; zoom.append(option);
  }
  label.append(zoom); controls.append(previous, position, next, label);
  const viewport = document.createElement('div'), sheet = document.createElement('div');
  viewport.className = 'score-page-viewport'; viewport.tabIndex = 0;
  viewport.setAttribute('role', 'region'); viewport.setAttribute('aria-label', 'Score page, scroll to view when zoomed');
  sheet.className = 'score-page-sheet'; sheet.dataset.zoom = '100'; viewport.append(sheet);
  container.replaceChildren(status, controls, viewport);
  const toolkits = new Set();
  let generation = 0, destroyed = false, current = null, displayedURL = null, pendingImage = null, busy = false;

  function controlsState() {
    previous.disabled = busy || !current || current.page <= 1;
    next.disabled = busy || !current || current.page >= current.pages;
    zoom.disabled = busy || !current;
    position.textContent = current ? `Page ${current.page} of ${current.pages}` : '';
    container.setAttribute('aria-busy', String(busy));
  }

  function dispose(toolkit) {
    if (toolkit && toolkits.delete(toolkit)) toolkit.destroy();
  }

  function release() {
    for (const toolkit of toolkits) dispose(toolkit);
    current = null;
    if (pendingImage) { URL.revokeObjectURL(pendingImage.url); pendingImage.image.removeAttribute('src'); pendingImage = null; }
    sheet.replaceChildren();
    if (displayedURL) URL.revokeObjectURL(displayedURL);
    displayedURL = null;
  }

  function clear(message = '') {
    generation++; release(); busy = false;
    status.setAttribute('role', 'status'); status.textContent = message;
    viewport.scrollLeft = viewport.scrollTop = 0;
    controlsState();
  }

  async function display(toolkit, page, pages, request) {
    const svg = toolkit.renderToSVG(page);
    if (!svg.includes('<svg')) throw new Error('Verovio returned no score page.');
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    let committed = false;
    try {
      const image = document.createElement('img');
      image.alt = `Piano score, page ${page} of ${pages}`;
      image.draggable = false; image.src = url;
      const pending = pendingImage = { image, url };
      await image.decode();
      if (pendingImage === pending) pendingImage = null;
      if (destroyed || generation !== request) return false;
      sheet.replaceChildren(image);
      if (displayedURL) URL.revokeObjectURL(displayedURL);
      displayedURL = url; committed = true;
      viewport.scrollLeft = viewport.scrollTop = 0;
      return true;
    } finally {
      if (pendingImage?.url === url) pendingImage = null;
      if (!committed) URL.revokeObjectURL(url);
    }
  }

  function failure(error) {
    const message = error?.message ?? String(error);
    clear(); status.setAttribute('role', 'alert');
    status.textContent = `Unable to display this score. ${message} Prepare a new take to try again; reload if the engine could not load.`;
    return { outcome: 'error', error: message };
  }

  async function go(page) {
    if (destroyed || busy || !current || page < 1 || page > current.pages) return;
    const request = ++generation, active = current;
    busy = true; controlsState();
    try {
      if (!await display(active.toolkit, page, active.pages, request) || request !== generation || current !== active) return;
      active.page = page;
    } catch (error) { if (request === generation) failure(error); }
    finally { if (request === generation) { busy = false; controlsState(); } }
  }

  previous.addEventListener('click', () => go(current?.page - 1));
  next.addEventListener('click', () => go(current?.page + 1));
  zoom.addEventListener('change', () => { sheet.dataset.zoom = zoom.value; });
  clear();
  return {
    clear,
    async render({ musicXML, noteCount }) {
      if (destroyed) return { outcome: 'superseded' };
      clear(); const request = generation, started = performance.now();
      if (noteCount === 0) {
        status.textContent = 'No notes detected; no score to display. Try a new take.';
        return { outcome: 'empty', pageCount: 0 };
      }
      busy = true; controlsState(); status.textContent = 'Engraving complete piano score…';
      let toolkit;
      try {
        if (typeof musicXML !== 'string' || !musicXML.trim()) throw new Error('No MusicXML was provided.');
        if (/<!\s*(DOCTYPE|ENTITY)\b/i.test(musicXML)) throw new Error('Unsupported MusicXML declarations.');
        const documentXML = new DOMParser().parseFromString(musicXML, 'application/xml');
        if (documentXML.querySelector('parsererror') || documentXML.documentElement.localName !== 'score-partwise'
          || !documentXML.querySelector('part > measure')) throw new Error('MusicXML is malformed or has no measures.');
        toolkit = await createScoreToolkit();
        toolkits.add(toolkit);
        if (destroyed || request !== generation) return { outcome: 'superseded' };
        toolkit.setOptions(PAGE_OPTIONS);
        if (!toolkit.loadData(musicXML)) throw new Error('MusicXML import failed.');
        const pages = toolkit.getPageCount();
        if (!Number.isInteger(pages) || pages < 1) throw new Error('The score has no pages.');
        if (!await display(toolkit, 1, pages, request) || destroyed || request !== generation) return { outcome: 'superseded' };
        current = { toolkit, pages, page: 1 }; toolkit = null;
        status.textContent = '';
        return { outcome: 'rendered', pageCount: pages, renderMs: performance.now() - started };
      } catch (error) {
        if (destroyed || request !== generation) return { outcome: 'superseded' };
        return failure(error);
      } finally {
        dispose(toolkit);
        if (request === generation) { busy = false; controlsState(); }
      }
    },
    destroy() { clear(); destroyed = true; container.replaceChildren(); },
  };
}
