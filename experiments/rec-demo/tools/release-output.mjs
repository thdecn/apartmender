import { cp, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(file));
    else if (entry.isFile()) result.push(file);
  }
  return result.sort();
}

// Published cohort URLs are immutable, including when regenerating a build.
// Never remove previous cohorts or repair/overwrite a partially changed one.
export async function retainRelease(staging, destination) {
  const exists = await stat(destination).catch(error => {
    if (error.code !== 'ENOENT') throw error; return null;
  });
  if (!exists) { await cp(staging, destination, { recursive: true }); return; }
  const old = await files(destination), fresh = await files(staging);
  if (old.length !== fresh.length) throw new Error('Immutable release file set changed.');
  for (const file of fresh) {
    const relative = path.relative(staging, file);
    const previous = await readFile(path.join(destination, relative)).catch(error => {
      if (error.code !== 'ENOENT') throw error; throw new Error(`Immutable release file missing: ${relative}`);
    });
    if (!previous.equals(await readFile(file))) throw new Error(`Immutable release changed: ${relative}`);
  }
}
