import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { retainRelease } from '../tools/release-output.mjs';

test('rebuilding an identical release keeps its files and publishing another preserves old URLs', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'release-test-'));
  try {
    const staging = path.join(root, 'staging'), first = path.join(root, 'first'), second = path.join(root, 'second');
    await mkdir(staging); await writeFile(path.join(staging, 'app.mjs'), 'first');
    await retainRelease(staging, first);
    const initial = await stat(path.join(first, 'app.mjs'));
    await retainRelease(staging, first);
    assert.equal((await stat(path.join(first, 'app.mjs'))).mtimeMs, initial.mtimeMs);
    await writeFile(path.join(staging, 'app.mjs'), 'second');
    await retainRelease(staging, second);
    assert.equal(await readFile(path.join(first, 'app.mjs'), 'utf8'), 'first');
    assert.equal(await readFile(path.join(second, 'app.mjs'), 'utf8'), 'second');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a changed or incomplete immutable cohort fails without overwriting published bytes', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'release-test-'));
  try {
    const staging = path.join(root, 'staging'), output = path.join(root, 'output');
    await mkdir(staging); await writeFile(path.join(staging, 'app.mjs'), 'original');
    await retainRelease(staging, output);
    await writeFile(path.join(staging, 'app.mjs'), 'changed');
    await assert.rejects(retainRelease(staging, output), /Immutable release changed/);
    assert.equal(await readFile(path.join(output, 'app.mjs'), 'utf8'), 'original');
    await writeFile(path.join(staging, 'runtime.mjs'), 'new export');
    await assert.rejects(retainRelease(staging, output), /file set changed/);
    assert.equal(await readFile(path.join(output, 'app.mjs'), 'utf8'), 'original');
  } finally { await rm(root, { recursive: true, force: true }); }
});
