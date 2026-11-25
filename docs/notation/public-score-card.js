import { loadNotationEdition } from './load-edition.js';
import { publicScorePilot } from './public-score-pilot.js';

// The shared host owns progression and timing. This collaborator only presents
// the public edition; it never receives an identity or personal fingering data.
export function createPublicScoreCard() {
  let generation = 0, edition = null, renderer = null, controller = null, active = null, legacy = false;
  let stylePromise = null;
  function ensureStyle() {
    if (stylePromise) return stylePromise;
    const href = new URL('./public-score-card.css', import.meta.url).href;
    if ([...document.querySelectorAll('link[rel="stylesheet"]')].some(link => link.href === href && link.sheet)) return Promise.resolve();
    // A supported cached index.html may predate the new stylesheet link.
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = href;
    stylePromise = new Promise((resolve, reject) => {
      link.onload = resolve; link.onerror = () => reject(Error('Public score stylesheet unavailable.'));
      document.head.append(link);
    }).catch(error => { link.remove(); stylePromise = null; throw error; });
    return stylePromise;
  }
  const panel = document.createElement('div'), scoreArea = document.createElement('div');
  const status = document.createElement('p'), notice = document.createElement('p'), actions = document.createElement('div');
  const retry = document.createElement('button'), useLegacy = document.createElement('button');
  panel.className = 'public-score-card'; status.className = 'public-score-status';
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  notice.textContent = 'Original fingerings only. Timing is not saved.';
  retry.type = useLegacy.type = 'button'; retry.textContent = 'Retry score';
  useLegacy.textContent = 'Use legacy PNG cards'; actions.append(retry, useLegacy);
  panel.append(scoreArea, status, actions, notice);
  retry.addEventListener('click', () => { legacy = false; if (active) void show(active); });
  useLegacy.addEventListener('click', () => { legacy = true; if (active) void show(active); });
  // A note or retry click must not become the surrounding host's swipe gesture.
  for (const type of ['pointerdown', 'pointerup']) panel.addEventListener(type, event => {
    if (event.target.closest('[data-note-id],button')) event.stopPropagation();
  });

  function cancel() {
    generation++; controller?.abort(); renderer?.destroy(); renderer = null;
    scoreArea.replaceChildren(); panel.remove();
  }
  function clear() {
    cancel(); edition?.release(); edition = null; active = null; legacy = false;
  }
  async function show(input) {
    cancel(); active = input;
    const request = generation, stale = () => request !== generation;
    controller = new AbortController();
    const signal = controller.signal;
    input.container.append(panel); actions.hidden = true;
    status.setAttribute('role', 'status'); status.textContent = 'Loading public score…';
    try {
      await ensureStyle();
      if (stale()) return;
      if (legacy) {
        const image = document.createElement('img');
        image.src = new URL(`../cards/${input.piece.id}/${input.piece.cards[input.cardIndex]}`, import.meta.url).href;
        image.alt = `${input.piece.label} legacy card ${input.cardIndex + 1}`;
        scoreArea.append(image); status.textContent = 'Legacy PNG cards — original fingerings only.';
        actions.hidden = false; useLegacy.hidden = true; return;
      }
      useLegacy.hidden = false;
      if (input.piece.notation?.version !== publicScorePilot.version) throw Error('Public pilot descriptor version changed.');
      if (!edition) {
        const loaded = await loadNotationEdition(input.piece, { signal });
        if (stale()) { loaded.release(); return; }
        edition = loaded;
      }
      const card = edition.projectMeasureCard(edition.score, edition.descriptor.cards[input.cardIndex].measureId);
      const style = document.createElement('style'); style.textContent = edition.css;
      const target = document.createElement('div'); scoreArea.append(style, target);
      renderer = edition.createScoreRenderer(target);
      // Empty overrides always inherit only the immutable source's annotations.
      const result = await renderer.render({ score: edition.score, card, overrides: {}, signal });
      if (stale()) return;
      if (result.outcome !== 'rendered') throw result.error ?? Error('Public score rendering did not finish.');
      status.textContent = '';
    } catch (error) {
      if (stale()) return;
      renderer?.destroy(); renderer = null; scoreArea.replaceChildren();
      status.setAttribute('role', 'alert');
      status.textContent = `Public score unavailable. ${error.message} Retry, or explicitly choose legacy PNG cards.`;
      actions.hidden = false;
    }
  }
  return { supports: piece => publicScorePilot.enabled && piece.id === publicScorePilot.slug, show, clear };
}
