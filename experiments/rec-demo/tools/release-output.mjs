import { cp, mkdir, mkdtemp, readFile, readdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';

export async function listFiles(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await listFiles(file));
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
  if (!exists) {
    // A failed copy must never reserve the immutable final URL with partial data.
    await mkdir(path.dirname(destination), { recursive: true });
    const pending = await mkdtemp(path.join(path.dirname(destination), '.piano-release-'));
    try {
      await cp(staging, pending, { recursive: true });
      await rename(pending, destination);
    } finally { await rm(pending, { recursive: true, force: true }); }
    return;
  }
  const old = await listFiles(destination), fresh = await listFiles(staging);
  if (old.length !== fresh.length) throw new Error('Immutable release file set changed.');
  for (const file of fresh) {
    const relative = path.relative(staging, file);
    const previous = await readFile(path.join(destination, relative)).catch(error => {
      if (error.code !== 'ENOENT') throw error; throw new Error(`Immutable release file missing: ${relative}`);
    });
    if (!previous.equals(await readFile(file))) throw new Error(`Immutable release changed: ${relative}`);
  }
}
