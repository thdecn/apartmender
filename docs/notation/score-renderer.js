import { compactPreview } from './score-preview.js';

const VERSION = '6.3.0-425dd7b';
const NS = 'http://www.w3.org/2000/svg';
const check = (value, message) => { if (!value) throw Error(message); };
export const CARD_ENGRAVING_OPTIONS = Object.freeze({ pageWidth: 1450, pageHeight: 650, scale: 50, font: 'Leipzig', spacingStaff: 12,
  spacingBraceGroup: 12, spacingLinear: 0.15, spacingNonLinear: 0.8, breaks: 'encoded',
  adjustPageHeight: true, condense: 'none', minLastJustification: 0, header: 'none', footer: 'none',
  svgViewBox: true, svgHtml5: false, mnumInterval: 0 });
let enginePromise;
async function engine() {
  if (!enginePromise) enginePromise = Promise.all([
    import('../vendor/verovio/verovio-module.mjs'), import('../vendor/verovio/verovio.mjs'),
  ]).then(async ([{ default: createModule }, { VerovioToolkit }]) => ({ module: await createModule(), VerovioToolkit }))
    .catch(error => { enginePromise = null; throw error; });
  return enginePromise;
}

// Only this throwaway projection is edited. Source/index identity is never regenerated.
function workingCopy(score, card, overrides) {
  check(card.slug === score.index.slug && card.editionId === score.index.editionId, 'Score edition mismatch');
  const model = new Map(score.index.measures.flatMap(m => m.notes).map(n => [n.noteId, n]));
  const ids = [...card.currentNoteIds, ...card.previewNoteIds];
  check(new Set(ids).size === ids.length && ids.every(id => model.has(id)), 'Invalid projected note identity');
  check(overrides && typeof overrides === 'object' && !Array.isArray(overrides), 'Invalid fingering overrides');
  for (const [id, value] of Object.entries(overrides)) {
    check(model.has(id) && value && (value.kind === 'suppress' || (value.kind === 'set'
      && ['L', 'R'].includes(value.hand) && Number.isInteger(value.finger) && value.finger >= 1 && value.finger <= 5)), 'Invalid fingering override');
  }
  const document = card.document.cloneNode(true);
  const notes = new Map([...document.querySelectorAll('note > pitch')].map(pitch => [pitch.parentNode.id, pitch.parentNode]));
  check(notes.size === ids.length && ids.every(id => notes.has(id)), 'Projection contains unexpected pitched notes');
  for (const id of ids) {
    const note = notes.get(id), entry = model.get(id), override = overrides[id];
    const value = override ?? entry.originalFingering;
    for (const finger of note.querySelectorAll('fingering')) finger.remove();
    if (!value || value.kind === 'suppress') continue;
    let notations = note.querySelector('notations');
    if (!notations) {
      notations = document.createElement('notations');
      note.insertBefore(notations, note.querySelector('lyric, play, listen'));
    }
    let technical = notations.querySelector('technical');
    if (!technical) { technical = document.createElement('technical'); notations.append(technical); }
    const finger = document.createElement('fingering');
    finger.textContent = `${value.hand === (entry.staff === 1 ? 'R' : 'L') ? '' : value.hand}${value.finger}`;
    technical.append(finger);
  }
  // The projection materializes context for standalone use. Verovio prints
  // repeated explicit clefs/time, so omit only unchanged preview declarations.
  if (card.previewMeasureId) {
    const previous = score.index.measures.find(m => m.measureId === card.currentMeasureId).contextAtEnd;
    const next = score.index.measures.find(m => m.measureId === card.previewMeasureId).contextAtStart;
    const attrs = document.querySelector('part > measure:last-child > attributes');
    for (const name of ['key', 'time']) if (JSON.stringify(previous[name]) === JSON.stringify(next[name])) attrs.querySelector(name)?.remove();
    for (const staff of [1, 2]) if (JSON.stringify(previous.clefs[staff]) === JSON.stringify(next.clefs[staff]))
      attrs.querySelector(`clef[number="${staff}"]`)?.remove();
  }
  for (const label of document.querySelectorAll('part-name, part-abbreviation')) label.textContent = '';
  return { xml: new XMLSerializer().serializeToString(document), ids, model };
}

function engrave(toolkit, xml) {
  check(toolkit.getVersion() === VERSION, 'Unexpected Verovio version');
  toolkit.setOptions(CARD_ENGRAVING_OPTIONS);
  check(toolkit.loadData(xml), `MusicXML import failed: ${toolkit.getLog()}`);
  check(toolkit.getPageCount() === 1, 'Score card does not fit a single page');
  return { svg: toolkit.renderToSVG(1), mei: new DOMParser().parseFromString(toolkit.getMEI(), 'application/xml') };
}

function bindNotes(svg, mei, ids, model, onSelect) {
  const imported = new Set([...mei.querySelectorAll('note')].map(note => note.getAttribute('xml:id')));
  const notes = new Map([...svg.querySelectorAll('g.note')].map(note => [note.id, note]));
  const layer = document.createElementNS(NS, 'g'), targets = new Map(), heads = new Map();
  layer.dataset.noteTargets = '';
  const common = svg.querySelector('g.page-margin');
  check(common, 'Missing engraving coordinates'); common.append(layer);
  for (const id of ids) {
    const note = notes.get(id), head = note?.querySelector('.notehead');
    check(imported.has(id) && head && !note.closest('[visibility="hidden"]'), `Missing individual notehead: ${id}`);
    const box = head.getBBox(), hit = document.createElementNS(NS, 'rect');
    const matrix = layer.getCTM().inverse().multiply(head.getCTM());
    for (const [key, value] of Object.entries({ x: box.x - 12, y: box.y - 12, width: box.width + 24, height: box.height + 24,
      transform: `matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`,
      role: 'button', tabindex: '0', 'aria-pressed': 'false' })) hit.setAttribute(key, value);
    const entry = model.get(id);
    hit.setAttribute('aria-label', `${entry.pitch.step}${entry.pitch.alter ? ' altered' : ''}${entry.pitch.octave}, note ${id}`);
    hit.dataset.noteId = id; layer.append(hit); targets.set(id, hit); heads.set(id, head);
    const activate = () => { hit.focus({ preventScroll: true }); onSelect(id); };
    hit.addEventListener('click', activate);
    hit.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); }
    });
  }
  check([...notes].every(([id, note]) => !note.querySelector('.notehead') || note.closest('[visibility="hidden"]') || targets.has(id)), 'Unexpected engraved notehead');
  for (const finger of mei.querySelectorAll('fing')) {
    const glyph = [...svg.querySelectorAll('g.fing')].find(node => node.id === finger.getAttribute('xml:id'));
    if (glyph) glyph.dataset.fingeringFor = finger.getAttribute('startid')?.slice(1);
  }
  return { targets, highlight(id) {
    for (const [noteId, head] of heads) {
      const selected = noteId === id;
      targets.get(noteId).setAttribute('aria-pressed', String(selected));
      head.style.fill = selected ? '#a54208' : '#000000';
    }
  } };
}

// The host imports score-renderer.css once. No fetch, Auth, persistence or route activation.
export function createScoreRenderer(container, { onSelect = () => {} } = {}) {
  container.classList.add('score-renderer');
  const status = document.createElement('p'), viewport = document.createElement('div');
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  viewport.className = 'score-viewport'; container.replaceChildren(status, viewport);
  let generation = 0, selectionRevision = 0, destroyed = false, current = null;
  function select(id, focus = false) {
    check(current && (id === null || current.binding.targets.has(id)), 'Note is outside the displayed score');
    selectionRevision++;
    current.selectedNoteId = id; current.binding.highlight(id);
    if (focus && id) current.binding.targets.get(id).focus({ preventScroll: true });
  }
  return {
    select,
    async render({ score, card, overrides = {}, selectedNoteId, signal } = {}) {
      const request = ++generation, selectionRevisionAtStart = selectionRevision;
      const stale = () => destroyed || request !== generation;
      let stage, toolkit;
      const cancelled = () => {
        if (stale()) return { outcome: 'superseded' };
        if (signal?.aborted) { status.textContent = 'Score rendering cancelled.'; return { outcome: 'cancelled' }; }
        return null;
      };
      try {
        if (destroyed) return { outcome: 'cancelled' };
        container.setAttribute('aria-busy', 'true'); status.textContent = 'Rendering score…';
        const working = workingCopy(score, card, overrides);
        check(selectedNoteId == null || working.ids.includes(selectedNoteId), 'Selected note is outside this projection');
        const { module, VerovioToolkit } = await engine();
        let ignored = cancelled(); if (ignored) return ignored;
        toolkit = new VerovioToolkit(module);
        const engraved = engrave(toolkit, working.xml);
        toolkit.destroy(); toolkit = null;
        stage = document.createElement('div'); stage.className = 'score-staging';
        stage.innerHTML = engraved.svg; container.append(stage);
        const svg = stage.querySelector('svg'); check(svg, 'Missing engraved SVG');
        svg.setAttribute('role', 'group'); svg.setAttribute('aria-label', 'Piano score notes');
        const binding = bindNotes(svg, engraved.mei, working.ids, working.model, id => {
          if (current?.binding !== binding) return;
          select(id); onSelect(id);
        });
        await document.fonts.ready;
        ignored = cancelled(); if (ignored) return ignored;
        if (card.previewMeasureId) compactPreview(svg);
        const context = `${card.slug}|${card.editionId}|${card.currentMeasureId}`;
        const same = current?.context === context;
        // A selection captured by the host cannot replace a later user action.
        const retainSelection = same && (selectedNoteId === undefined || selectionRevision !== selectionRevisionAtStart);
        const selected = retainSelection ? current.selectedNoteId : (selectedNoteId ?? null);
        const focused = same && viewport.contains(document.activeElement);
        if (viewport.contains(document.activeElement)) document.activeElement.blur();
        current = { context, binding, selectedNoteId: selected };
        viewport.replaceChildren(svg); select(selected, focused);
        status.textContent = ''; status.setAttribute('role', 'status');
        return { outcome: 'rendered', context, selectedNoteId: selected };
      } catch (error) {
        const ignored = cancelled(); if (ignored) return ignored;
        status.setAttribute('role', 'alert');
        status.textContent = `Unable to render score. ${current ? 'Previous score remains shown. ' : ''}${error.message}`;
        return { outcome: 'error', error };
      } finally {
        toolkit?.destroy(); stage?.remove();
        if (request === generation) container.setAttribute('aria-busy', 'false');
      }
    },
    destroy() {
      destroyed = true; generation++; current = null;
      if (container.contains(document.activeElement)) document.activeElement.blur();
      container.replaceChildren(); container.removeAttribute('aria-busy');
    },
  };
}

// Full-score presentation for the Teacher host (#64). No Auth or Practice state.
// Reuse this module's pinned engine, throwaway fingering projection and hit binding.
export function createScorePages(container, { onSelect = () => {}, onChange = () => {} } = {}) {
  container.classList.add('score-pages');
  const toolbar = document.createElement('div'), viewport = document.createElement('div'), status = document.createElement('p');
  const previous = document.createElement('button'), next = document.createElement('button'), position = document.createElement('span');
  const label = document.createElement('label'), sizeInput = document.createElement('select');
  toolbar.className = 'score-pages-toolbar'; viewport.className = 'score-pages-viewport';
  status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
  previous.type = next.type = 'button'; previous.textContent = 'Previous page'; next.textContent = 'Next page';
  previous.disabled = next.disabled = true; position.setAttribute('aria-live','polite');
  label.textContent = 'Notation size ';
  for (const [value,text] of [[40,'Small'],[50,'Medium'],[60,'Large'],[70,'Extra large']]) {
    const option = document.createElement('option'); option.value = value; option.textContent = text; sizeInput.append(option);
  }
  label.append(sizeInput); toolbar.append(previous,position,next,label); container.replaceChildren(toolbar,status,viewport);
  let generation = 0, selectionRevision = 0, destroyed = false, current = null, input = null, size = 50, selected = null, resizeTimer;
  sizeInput.value = String(size);
  const snapshot = () => current ? {outcome:'pages',page:current.page,pageCount:current.pages.length,size,selectedNoteId:selected,
    measurePages:Object.fromEntries(current.measurePages),notePages:Object.fromEntries(current.notePages)} : {outcome:'not_loaded'};
  function revealSelection() {
    const target = current?.binding.targets.get(selected);
    if (!target) return;
    const box = target.getBoundingClientRect(), area = viewport.getBoundingClientRect();
    viewport.scrollTop += box.bottom > area.bottom ? box.bottom-area.bottom+8 : box.top < area.top ? box.top-area.top-8 : 0;
    viewport.scrollLeft += box.right > area.right ? box.right-area.right+8 : box.left < area.left ? box.left-area.left-8 : 0;
  }
  function showPage(page, focus = false) {
    check(current && page >= 1 && page <= current.pages.length, 'Page outside the score');
    const svg = current.pages[page-1].cloneNode(true);
    const ids = current.ids.filter(id => current.notePages.get(id) === page);
    viewport.replaceChildren(svg);
    const binding = bindNotes(svg,current.mei,ids,current.model,id => { select(id); onSelect(id); });
    current.binding = binding; current.page = page; binding.highlight(selected);
    if (focus && selected) binding.targets.get(selected)?.focus({preventScroll:true});
    previous.disabled = page === 1; next.disabled = page === current.pages.length;
    position.textContent = `${page} / ${current.pages.length}`;
    viewport.scrollTop = viewport.scrollLeft = 0;
    const overflow = svg.getBoundingClientRect().height > viewport.clientHeight + 1 || svg.getBoundingClientRect().width > viewport.clientWidth + 1;
    status.textContent = overflow ? 'This screen is smaller than a readable piano system. Scroll the score, reduce notation size, or rotate your device.' : '';
    revealSelection();
    onChange(snapshot());
  }
  function select(id, focus = false) {
    check(current && (id === null || current.notePages.has(id)), 'Note outside the score');
    selectionRevision++; selected = id;
    if (id && current.notePages.get(id) !== current.page) showPage(current.notePages.get(id),focus);
    else { current.binding.highlight(id); if (focus && id) current.binding.targets.get(id)?.focus({preventScroll:true}); revealSelection(); onChange(snapshot()); }
  }
  async function render(options = input) {
    const request = ++generation, revisionAtStart = selectionRevision;
    if (destroyed) return {outcome:'cancelled'};
    input = options; let toolkit;
    try {
      container.setAttribute('aria-busy','true'); status.textContent = 'Laying out score…';
      const {score,overrides = {},selectedNoteId} = options;
      const context = `${score.index.slug}|${score.index.editionId}`;
      const same = current?.context === context;
      const width = Math.floor(viewport.clientWidth), height = Math.floor(viewport.clientHeight);
      check(width > 0 && height > 0, 'Score area has no usable size');
      const card = {slug:score.index.slug,editionId:score.index.editionId,document:score.createDocument(),
        currentNoteIds:score.index.measures.flatMap(m => m.notes.map(n => n.noteId)),previewNoteIds:[]};
      const working = workingCopy(score,card,overrides);
      check(selectedNoteId == null || working.ids.includes(selectedNoteId), 'Selected note outside the score');
      const {module,VerovioToolkit} = await engine();
      if (destroyed || request !== generation) return {outcome:'superseded'};
      toolkit = new VerovioToolkit(module); check(toolkit.getVersion() === VERSION, 'Unexpected Verovio version');
      toolkit.setOptions({...CARD_ENGRAVING_OPTIONS,breaks:'auto',adjustPageHeight:false,
        pageWidth:Math.max(600,Math.floor(width*100/size)),pageHeight:Math.max(600,Math.floor(height*100/size)),scale:size,
        pageMarginTop:25,pageMarginBottom:25,pageMarginLeft:25,pageMarginRight:25,spacingSystem:8});
      check(toolkit.loadData(working.xml), `Score import failed: ${toolkit.getLog()}`);
      const count = toolkit.getPageCount(); check(count > 0 && count <= score.index.measures.length, 'Invalid page count');
      const pages = [], notePages = new Map(), measurePages = new Map(), measureIds = score.index.measures.map(m => m.measureId);
      for (let page = 1; page <= count; page++) {
        const doc = new DOMParser().parseFromString(toolkit.renderToSVG(page),'image/svg+xml'), svg = doc.documentElement;
        check(svg.localName === 'svg' && !doc.querySelector('parsererror'), 'Malformed score page');
        svg.setAttribute('role','group'); svg.setAttribute('aria-label',`Piano score page ${page}`);
        // Keep engraving scale; an undersized screen scrolls instead of shrinking notes.
        const box = svg.viewBox.baseVal;
        svg.style.width = `${box.width}px`; svg.style.height = `${box.height}px`;
        for (const node of svg.querySelectorAll('g.measure')) {
          check(measureIds.includes(node.id) && !measurePages.has(node.id), 'Missing/duplicate measure mapping'); measurePages.set(node.id,page);
        }
        for (const node of svg.querySelectorAll('g.note')) if (node.querySelector('.notehead')) {
          check(working.model.has(node.id) && !notePages.has(node.id), 'Missing/duplicate note mapping'); notePages.set(node.id,page);
        }
        pages.push(svg);
      }
      check(JSON.stringify([...measurePages.keys()]) === JSON.stringify(measureIds)
        && notePages.size === working.ids.length, 'Incomplete full-score pagination');
      const mei = new DOMParser().parseFromString(toolkit.getMEI(),'application/xml');
      toolkit.destroy(); toolkit = null; await document.fonts.ready;
      if (destroyed || request !== generation) return {outcome:'superseded'};
      const anchor = same && [...current.measurePages].find(([,page]) => page === current.page)?.[0];
      selected = same && (selectedNoteId === undefined || selectionRevision !== revisionAtStart) ? selected : selectedNoteId ?? null;
      const focused = viewport.contains(document.activeElement);
      current = {context,pages,notePages,measurePages,mei,ids:working.ids,model:working.model,page:1};
      showPage(selected ? notePages.get(selected) : measurePages.get(anchor) ?? 1,focused);
      status.setAttribute('role','status'); return snapshot();
    } catch (error) {
      if (destroyed || request !== generation) return {outcome:'superseded'};
      status.setAttribute('role','alert'); status.textContent = `Unable to lay out score. ${current ? 'Previous pages remain shown. ' : ''}${error.message}`;
      return {outcome:'error',error};
    } finally { toolkit?.destroy(); if (request === generation) container.setAttribute('aria-busy','false'); }
  }
  function setSize(value) {
    check([40,50,60,70].includes(value), 'Unsupported notation size'); size = value; sizeInput.value = String(value);
    return input ? render({...input,selectedNoteId:undefined}) : Promise.resolve(snapshot());
  }
  previous.addEventListener('click',() => { if (current?.page > 1) showPage(current.page-1); });
  next.addEventListener('click',() => { if (current?.page < current?.pages.length) showPage(current.page+1); });
  sizeInput.addEventListener('change',() => { void setSize(Number(sizeInput.value)); });
  let dimensions = '';
  const observer = new ResizeObserver(() => {
    const nextDimensions = `${viewport.clientWidth}|${viewport.clientHeight}`;
    if (dimensions === nextDimensions) return;
    dimensions = nextDimensions; clearTimeout(resizeTimer);
    if (input) resizeTimer = setTimeout(() => { void render({...input,selectedNoteId:undefined}); },100);
  });
  observer.observe(viewport);
  return {render,select,setSize,snapshot,
    previous() { if (current?.page > 1) showPage(current.page-1); return snapshot(); },
    next() { if (current?.page < current?.pages.length) showPage(current.page+1); return snapshot(); },
    destroy() { destroyed = true; generation++; observer.disconnect(); clearTimeout(resizeTimer); current = input = null; selected = null;
      container.replaceChildren(); container.removeAttribute('aria-busy'); },
  };
}
