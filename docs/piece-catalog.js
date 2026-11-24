// Public metadata only: no Auth, backend, private storage or Assignment lookup.
const require = (value, message) => { if (!value) throw Error(`Piece Catalog: ${message}`); };
const slug = value => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

export function cardAssetPath(id, card) {
  require(slug(id) && typeof card === 'string' && /^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*\.png$/.test(card), 'invalid card address');
  return `cards/${id}/${card}`;
}

export function validateCatalog(catalog, { knownSlugs } = {}) {
  require(Array.isArray(catalog), 'expected an array');
  const ids = new Set();
  for (const piece of catalog) {
    require(piece && slug(piece.id) && !ids.has(piece.id), 'invalid or duplicate permanent slug');
    ids.add(piece.id);
    require(piece.catalogVersion === 1, `unsupported contract for ${piece.id}`);
    require(typeof piece.label === 'string' && piece.label.trim(), `missing title for ${piece.id}`);
    require(['supported', 'retired'].includes(piece.status), `invalid retirement state for ${piece.id}`);
    require(typeof piece.assetsAvailable === 'boolean' && (piece.status === 'retired' || piece.assetsAvailable), `supported Piece needs assets: ${piece.id}`);
    require(typeof piece.version === 'string' && /^sha256:[a-f0-9]{64}$/.test(piece.version), `invalid version for ${piece.id}`);
    require(Array.isArray(piece.cards) && piece.cards.length > 0 && new Set(piece.cards).size === piece.cards.length, `invalid ordered cards for ${piece.id}`);
    require(Array.isArray(piece.cardAssets) && piece.cardAssets.length === piece.cards.length, `incomplete asset declarations for ${piece.id}`);
    for (const [index, card] of piece.cards.entries()) {
      const asset = piece.cardAssets[index];
      require(asset && asset.path === cardAssetPath(piece.id, card) && digest(asset.sha256), `invalid card asset for ${piece.id}`);
    }
  }
  if (knownSlugs !== undefined) {
    require(Array.isArray(knownSlugs) && knownSlugs.every(slug) && new Set(knownSlugs).size === knownSlugs.length, 'invalid permanent-slug ledger');
    require(knownSlugs.length === ids.size && knownSlugs.every(id => ids.has(id)), 'retain every permanent slug and register new slugs');
  }
  return catalog;
}

export function generalPracticePieces(catalog, collection) {
  validateCatalog(catalog);
  require(collection?.collectionVersion === 1 && Array.isArray(collection.slugs), 'invalid General Practice Collection');
  require(new Set(collection.slugs).size === collection.slugs.length, 'duplicate General slug');
  const byId = new Map(catalog.map(piece => [piece.id, piece]));
  return collection.slugs.map(id => {
    const piece = byId.get(id);
    require(piece && piece.assetsAvailable, `General Piece needs retained assets: ${id}`);
    // Retirement and public curation are independent; retained retired assets may be public.
    return piece;
  });
}
