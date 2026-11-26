import { loadNotationEdition } from '../../notation/load-edition.js';
import { createFingeringControls } from '../fingering-controls.js';
import { notationPilot } from '../notation-pilot.js';

// Private presentation injected into the existing host; it owns no Practice state.
export function createFingeringCard({ browserData, loadEdition = loadNotationEdition }) {
  let generation = 0, renderer, view, edition, controller, selected = null, active = null;
  const panel = document.createElement('div'), scoreArea = document.createElement('div');
  const editor = createFingeringControls({onSave:(id,operation)=>{void view?.save(id,operation);},onRetry:id=>{void view?.retry(id);}});
  const {element:controls,status} = editor;
  const reload=document.createElement('button'),footer=document.createElement('div');
  let snapshot=null;
  footer.className='fingering-footer';panel.className='fingering-card';
  const updateControls=()=>editor.show(snapshot,selected,edition?.score.index);
  function select(id){selected=id;updateControls();}
  reload.type='button';reload.textContent='Reload fingerings';
  reload.addEventListener('click',()=>{if(active)void show(active);});
  footer.append(status,reload);panel.append(scoreArea,controls,footer);
  // Note clicks must reach the renderer instead of starting the host's swipe capture.
  for (const type of ['pointerdown','pointerup']) panel.addEventListener(type, event => {
    if (event.target.closest('[data-note-id],button,select,label')) event.stopPropagation();
  });
  function reset(keepEdition = false) {
    generation++; controller?.abort(); renderer?.destroy(); renderer = null;
    view?.destroy(); view = null;
    if (!keepEdition) { edition?.release(); edition = null; }
    selected = null; snapshot = null; active = null; editor.unavailable(''); panel.remove();
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
  return { supports: piece => notationPilot.student && piece.id === 'bach-bwv-779-invention-no-8', show, clear:() => reset(true) };
}
