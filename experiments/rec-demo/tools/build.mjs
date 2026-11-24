import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = path.resolve(root, '../../docs/rec-demo');
const vendor = path.resolve(root, '../../docs/vendor/verovio');
const digest = data => createHash('sha256').update(data).digest('hex');
const readJSON = async file => JSON.parse(await readFile(file, 'utf8'));
async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(full));
    else if (entry.isFile()) result.push(full);
  }
  return result.sort();
}

// Check the reused Apartmender asset package before distributing any files.
const verovio = await readJSON(path.join(vendor, 'manifest.json'));
for (const file of verovio.files) {
  const bytes = await readFile(path.join(vendor, file.path));
  if (bytes.byteLength !== file.bytes || digest(bytes) !== file.sha256) {
    throw new Error(`Pinned Verovio asset drift: ${file.path}`);
  }
}
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const file of await readdir(path.join(root, 'src'))) {
  if (file !== 'inference-worker.mjs') await cp(path.join(root, 'src', file), path.join(out, file));
}
await cp(path.join(root, 'node_modules/@spotify/basic-pitch/model'), path.join(out, 'model'), { recursive: true });
const result = await build({ absWorkingDir: root, entryPoints: ['src/inference-worker.mjs'],
  outfile: path.join(out, 'inference-worker.js'), bundle: true, format: 'esm', platform: 'browser',
  target: ['safari16', 'chrome110'], minify: true, metafile: true, legalComments: 'external' });

// Retain license files for every actual bundled package, including transitives.
const packages = new Map();
for (const input of Object.keys(result.metafile.inputs)) {
  if (!input.includes('node_modules/')) continue;
  let directory = path.dirname(path.resolve(root, input));
  while (directory.startsWith(path.join(root, 'node_modules'))) {
    try {
      const pkg = await readJSON(path.join(directory, 'package.json'));
      if (pkg.name) { packages.set(pkg.name, { directory, pkg }); break; }
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    directory = path.dirname(directory);
  }
}
const notices = [];
for (const [name, { directory, pkg }] of [...packages].sort()) {
  const folder = name.replaceAll('/', '__');
  await mkdir(path.join(out, 'notices', folder), { recursive: true });
  const licenseFiles = (await readdir(directory)).filter(file => /^(license|notice|copying)(\.|$)/i.test(file));
  for (const file of licenseFiles) await cp(path.join(directory, file), path.join(out, 'notices', folder, file));
  if (!licenseFiles.length) {
    // Several upstream npm packages put their notices in source headers rather
    // than separate LICENSE files. Retain those headers, including MIT notices.
    const inputs = Object.keys(result.metafile.inputs).filter(input =>
      path.resolve(root, input).startsWith(directory + path.sep));
    const headers = new Set();
    for (const input of inputs) {
      const text = await readFile(path.resolve(root, input), 'utf8');
      for (const comment of text.match(/\/\*[\s\S]*?\*\//g) || []) {
        if (/copyright|permission is hereby|licensed under|redistribution and use|@license/i.test(comment)) headers.add(comment);
      }
    }
    if (!headers.size) throw new Error(`No retained license notice for ${name}.`);
    await writeFile(path.join(out, 'notices', folder, 'SOURCE-NOTICES.txt'), [...headers].join('\n\n') + '\n');
    licenseFiles.push('SOURCE-NOTICES.txt');
  }
  notices.push({ name, version: pkg.version, license: pkg.license, files: licenseFiles.map(file => `${folder}/${file}`) });
}
await writeFile(path.join(out, 'notices/licenses.json'), JSON.stringify(notices, null, 2) + '\n');
const escapeHTML = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
await writeFile(path.join(out, 'notices/index.html'), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Piano demo runtime notices</title><h1>Runtime licenses and source</h1><p><a href="../">Back to recording check</a></p><p>Verovio assets use Apartmender's existing pinned shared asset package. Modules remain replaceable.</p><ul><li><a href="../../vendor/verovio/NOTICES.md">Verovio and font notices</a></li><li><a href="../../vendor/verovio/COPYING.LESSER">Verovio LGPL</a></li><li><a href="../../vendor/verovio/COPYING">GPL</a></li><li><a href="../../vendor/verovio/verovio-6.3.0-source.tar.gz">Exact Verovio corresponding source and build instructions</a></li><li><a href="../../vendor/verovio/Liberation-LICENSE.txt">Liberation font license</a></li><li><a href="../../vendor/verovio/LiberationSerif-1.04.ttf">Editable Liberation font</a></li></ul><h2>Bundled JavaScript and Basic Pitch model</h2><p>Basic Pitch 1.0.1 model and weights are from its Apache-2.0 npm distribution. Exact file digests are in the asset manifest. No model modifications.</p><ul>${notices.map(notice => `<li>${escapeHTML(notice.name)} ${escapeHTML(notice.version)} (${escapeHTML(notice.license)}) ${notice.files.map(file => `<a href="${escapeHTML(file)}">${escapeHTML(path.basename(file))}</a>`).join(' · ')}</li>`).join('')}</ul>`);

const lock = await readJSON(path.join(root, 'package-lock.json'));
const buildHash = createHash('sha256');
for (const file of [...await files(path.join(root, 'src')), path.join(root, 'package-lock.json'), path.join(root, 'tools/build.mjs'), path.join(vendor, 'manifest.json')]) {
  buildHash.update(path.relative(root, file)).update(await readFile(file));
}
const assets = [];
for (const file of await files(out)) {
  const bytes = await readFile(file);
  const relative = path.relative(out, file).split(path.sep).join('/');
  const runtime = !relative.startsWith('notices/') && !relative.endsWith('.LEGAL.txt');
  assets.push({ path: relative, bytes: bytes.length, gzipBytes: gzipSync(bytes).length,
    sha256: digest(bytes), runtime });
}
for (const file of verovio.files) {
  // The public frontend already distributes these files. Reference the exact
  // shared assets rather than duplicating the engine/source for the demo.
  assets.push({ ...file, path: `../vendor/verovio/${file.path}` });
}
const manifest = { buildId: buildHash.digest('hex').slice(0, 16),
  versions: { basicPitch: lock.packages['node_modules/@spotify/basic-pitch'].version,
    tensorflow: lock.packages['node_modules/@tensorflow/tfjs'].version, verovio: verovio.toolkitVersion },
  verovioProvenance: 'thdecn/apartmender shared docs/vendor/verovio, verified against its pinned manifest',
  backend: 'TensorFlow.js CPU in a disposable local module worker',
  notes: 'Gzip values are build estimates, not measured transfers. No peak device-memory measurement.', assets };
await writeFile(path.join(out, 'asset-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
const runtimeAssets = assets.filter(asset => asset.runtime);
console.log(JSON.stringify({ buildId: manifest.buildId, output: out, versions: manifest.versions,
  runtimeBytes: runtimeAssets.reduce((sum, asset) => sum + asset.bytes, 0),
  runtimeGzipEstimateBytes: runtimeAssets.reduce((sum, asset) => sum + asset.gzipBytes, 0),
  modelFiles: assets.filter(asset => asset.path.startsWith('model/')) }, null, 2));
