import { loadNotationEdition } from '../../notation/load-edition.js';

// Private presentation injected into the existing host; it owns no Practice state.
export function createFingeringCard({ browserData, loadEdition = loadNotationEdition }) {
  let generation = 0, renderer, view, edition, controller, selected = null, active = null;
  const panel = document.createElement('div'), scoreArea = document.createElement('div'), controls = document.createElement('div');
  const status = document.createElement('p'), reload = document.createElement('button'), retry = document.createElement('button');
  const noteLabel = document.createElement('span'), hands = [], fingers = [];
  const footer = document.createElement('div'); footer.className = 'fingering-footer'; status.className = 'fingering-status';
  let hand = 'R', snapshot = null;
  panel.className = 'fingering-card'; controls.className = 'fingering-controls';
  status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
  function button(label, action) {
    const node = document.createElement('button'); node.type = 'button'; node.textContent = label;
    node.addEventListener('click', action); controls.append(node); return node;
  }
  function updateControls() {
    const draft = snapshot?.drafts.find(d => d.noteId === selected);
    const note = edition?.score.index.measures.flatMap(m => m.notes).find(n => n.noteId === selected);
    noteLabel.textContent = note ? `Selected: ${note.pitch.step}${note.pitch.alter === 1 ? '♯' : note.pitch.alter === -1 ? '♭' : ''}${note.pitch.octave}` : 'Select a note';
    for (const b of [...hands,...fingers]) b.disabled = !selected || snapshot?.outcome !== 'fingerings';
    remove.disabled = !selected || snapshot?.outcome !== 'fingerings';
    for (const b of hands) b.setAttribute('aria-pressed', String(b.dataset.hand === hand));
    retry.hidden = draft?.status !== 'unsaved';
    status.textContent = snapshot?.drafts.some(d => d.status === 'saving') ? 'Saving fingering…'
      : snapshot?.drafts.some(d => d.status === 'unsaved') ? 'Fingering unsaved. Select its note to retry. Saving requires a connection.'
      : snapshot?.outcome === 'fingerings' ? 'Fingerings saved. Changes load when a measure reopens.' : 'Loading latest fingerings…';
  }
  function select(id) {
    selected = id;
    const original = edition.score.index.measures.flatMap(m => m.notes).find(n => n.noteId === id);
    const value = snapshot?.drafts.find(d => d.noteId === id)?.operation
      ?? snapshot?.overrides.find(n => n.noteId === id) ?? original.originalFingering;
    hand = value?.hand ?? (original.staff === 1 ? 'R' : 'L'); updateControls();
  }
  for (const side of ['L','R']) {
    const b = button(side === 'L' ? 'Left hand' : 'Right hand', () => { hand = side; updateControls(); });
    b.dataset.hand = side; hands.push(b);
  }
  for (let finger = 1; finger <= 5; finger++) fingers.push(button(String(finger), () => { void view?.save(selected, {kind:'set',hand,finger}); }));
  const remove = button('Remove number', () => { void view?.save(selected, {kind:'suppress'}); });
  retry.type = reload.type = 'button'; retry.textContent = 'Retry fingering'; reload.textContent = 'Reload fingerings';
  retry.addEventListener('click', () => { void view?.retry(selected); });
  reload.addEventListener('click', () => { if (active) void show(active); });
  controls.prepend(noteLabel); controls.append(retry); footer.append(status,reload); panel.append(scoreArea,controls,footer);
  // Note clicks must reach the renderer instead of starting the host's swipe capture.
  for (const type of ['pointerdown','pointerup']) panel.addEventListener(type, event => {
    if (event.target.closest('[data-note-id],button,select,label')) event.stopPropagation();
  });
  function reset(keepEdition = false) {
    generation++; controller?.abort(); renderer?.destroy(); renderer = null;
    view?.destroy(); view = null;
    if (!keepEdition) { edition?.release(); edition = null; }
    selected = null; snapshot = null; active = null; panel.remove();
  }
  async function show(input) {
    const retained = active?.piece.assignmentId === input.piece.assignmentId ? selected : null;
    const keepEdition = edition?.version === input.piece.notation?.version;
    reset(keepEdition); active = input; selected = retained;
    const request = generation; controller = new AbortController();
    const stale = () => request !== generation;
    input.container.append(panel); controls.hidden = true; reload.disabled = true; scoreArea.replaceChildren();
    status.textContent = 'Loading latest fingerings…';
    try {
      const loaded = edition ?? await loadEdition(input.piece, {signal:controller.signal});
      if (stale()) { loaded.release(); return; }
      edition = loaded;
      const card = edition.projectMeasureCard(edition.score, edition.descriptor.cards[input.cardIndex].measureId);
      if (![...card.currentNoteIds,...card.previewNoteIds].includes(selected)) selected = null;
      const style = document.createElement('style'); style.textContent = edition.css; scoreArea.append(style);
      const target = document.createElement('div'); scoreArea.append(target);
      renderer = edition.createScoreRenderer(target, {onSelect:select});
      const render = async data => {
        if (stale()) return;
        snapshot = data;
        if (data.outcome !== 'fingerings') {
          controls.hidden = true; renderer?.destroy();
          status.textContent = 'Fingering access changed. Reopen this Piece after signing in.'; return;
        }
        const overrides = Object.fromEntries(data.overrides.map(row => [row.noteId,row]));
        for (const draft of data.drafts) overrides[draft.noteId] = draft.operation;
        controls.hidden = false; updateControls();
        const result = await renderer.render({score:edition.score,card,overrides,selectedNoteId:selected});
        if (!stale() && result.outcome === 'error') { controls.hidden = true; status.textContent = 'Score rendering failed. Reload fingerings to retry.'; }
      };
      // open() emits not_loaded while constructing its new scope: only subscribe
      // after that initial read, so the loading event cannot destroy the renderer.
      let opened = false;
      view = browserData.createFingerings({onChange:data => { if (opened) void render(data); }});
      const result = await view.open({assignmentId:input.piece.assignmentId,index:edition.score.index,
        measureIds:[card.currentMeasureId,...(card.previewMeasureId ? [card.previewMeasureId] : [])]});
      if (stale()) return;
      if (result.outcome !== 'fingerings') throw Error('Latest fingerings could not be loaded.');
      opened = true; await render(result);
    } catch (error) {
      if (stale()) return;
      renderer?.destroy(); controls.hidden = true;
      status.textContent = 'Latest fingerings unavailable. Personalized notation is not shown. Reconnect and reload.';
    }
    if (!stale()) reload.disabled = false;
  }
  return { supports: piece => piece.id === 'bach-bwv-779-invention-no-8', show, clear:() => reset(true) };
}
