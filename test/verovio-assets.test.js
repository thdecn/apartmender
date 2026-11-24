import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = new URL('../docs/vendor/verovio/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', root)));

test('pinned Verovio runtime, source, font and notice files have exact reviewed bytes', async () => {
  assert.equal(manifest.toolkitVersion,'6.3.0-425dd7b');
  assert.equal(manifest.npmVersion,'6.3.0');
  for (const entry of manifest.files) {
    const bytes=await readFile(new URL(entry.path,root));
    assert.equal(bytes.length,entry.bytes,entry.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256,entry.path);
  }
  const runtime=manifest.files.filter(file=>file.runtime);
  assert.equal(runtime.length,2);
  assert.equal(runtime.reduce((n,file)=>n+file.bytes,0),7311285);
  assert.equal(runtime.find(f=>f.path==='verovio-module.mjs').sha256,'cd7c77d0738e9359b9f77956ae398556bf9949f35e4c5b3471ab3198fd660431');
  assert.equal(runtime.find(f=>f.path==='verovio.mjs').sha256,'3db61c94295aeb4983baff06b5e03b2fc0e397fa405fa2461f81427954ec874b');
});

test('font versions and separate license/source evidence accompany the embedded data', async()=>{
  assert.deepEqual(manifest.embeddedFonts.map(f=>f.name),['Leipzig','Bravura','Gootville','Petaluma','Leland','Liberation']);
  const text=manifest.embeddedFonts.at(-1);
  assert.equal(text.version,'Version 1.04');
  assert.equal(text.family,'Liberation Serif');
  assert.match(text.license,/GPL-2/);
  for(const path of [...text.licenseFiles,text.editableFont])assert(manifest.files.some(f=>f.path===path));
  const notice=await readFile(new URL('NOTICES.md',root),'utf8');
  assert.match(notice,/Text-font correction/);
  assert.match(notice,/LGPL-3.0-or-later/);
});
