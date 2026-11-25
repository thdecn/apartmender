// Execute the exact verified dependency bytes, including dynamic vendor imports.
// No bare-URL module cache, private state, or persistent offline cache is used.
const root = new URL('../', import.meta.url);
const pathValid = path => typeof path === 'string' && /^[a-zA-Z0-9_-][a-zA-Z0-9_./-]*$/.test(path)
  && path.split('/').every(part => part && part !== '.' && part !== '..');
const decode = bytes => new TextDecoder('utf-8', { fatal: true }).decode(bytes);
export async function loadNotationEdition(piece, { signal } = {}) {
  const blobs = new Map(), bytes = new Map();
  const verified = async (path, expected) => {
    if (!pathValid(path) || !/^[a-f0-9]{64}$/.test(expected)) throw Error('Invalid notation asset');
    const response = await fetch(new URL(path, root), { cache: 'no-store', signal });
    if (!response.ok) throw Error(`Notation unavailable: ${path}`);
    const data = new Uint8Array(await response.arrayBuffer());
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map(b => b.toString(16).padStart(2,'0')).join('');
    if (hash !== expected) throw Error(`Notation version changed: ${path}`);
    bytes.set(path, data); return data;
  };
  const json = async (path, hash) => JSON.parse(decode(await verified(path, hash)));
  const release = () => { for (const url of blobs.values()) URL.revokeObjectURL(url); blobs.clear(); };
  try {
    const pointer = piece.notation;
    if (!pointer || pointer.version !== `sha256:${pointer.descriptor?.sha256}`) throw Error('Missing notation version');
    const descriptor = await json(pointer.descriptor.url, pointer.descriptor.sha256);
    const index = await json(descriptor.manifest.url, descriptor.manifest.sha256);
    const manifest = await json(descriptor.renderer.assetsManifestUrl, descriptor.renderer.assetsManifestSha256);
    await Promise.all([verified(descriptor.score.url, descriptor.score.sha256),
      verified(descriptor.provenance.url, descriptor.provenance.sha256),
      ...descriptor.assets.map(asset => verified(asset.url, asset.sha256)),
      ...manifest.files.map(asset => verified(`vendor/verovio/${asset.path}`, asset.sha256).then(data => {
        if (data.length !== asset.bytes) throw Error('Renderer size mismatch');
      }))]);
    // This is the bounded, reviewed v1 import graph, not a general JS rewriter.
    const dependencies = {
      'notation/score-renderer.js': ['./score-preview.js', '../vendor/verovio/verovio-module.mjs', '../vendor/verovio/verovio.mjs'],
      'notation/edition-descriptor.js': ['./score-renderer.js'],
    };
    function moduleUrl(path) {
      if (blobs.has(path)) return blobs.get(path);
      if (!bytes.has(path)) throw Error(`Unverified module: ${path}`);
      let source = decode(bytes.get(path));
      for (const specifier of dependencies[path] ?? []) {
        const target = new URL(specifier, new URL(path, root)).pathname.slice(root.pathname.length);
        source = source.replaceAll(`'${specifier}'`, JSON.stringify(moduleUrl(target)));
      }
      const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
      blobs.set(path, url); return url;
    }
    const { verifyNotationDescriptor } = await import(moduleUrl('notation/edition-descriptor.js'));
    verifyNotationDescriptor(piece, descriptor, index, manifest);
    const { indexScore } = await import(moduleUrl('notation/score-index.js'));
    const { projectMeasureCard } = await import(moduleUrl('notation/measure-card.js'));
    const { createScoreRenderer, createScorePages } = await import(moduleUrl('notation/score-renderer.js'));
    const score = await indexScore(bytes.get(descriptor.score.url), { slug: piece.id, editionId: descriptor.editionId, inventory: index });
    return { score, descriptor, version: pointer.version, projectMeasureCard, createScoreRenderer, createScorePages,
      css: decode(bytes.get('notation/score-renderer.css')), release };
  } catch (error) { release(); throw error; }
}
