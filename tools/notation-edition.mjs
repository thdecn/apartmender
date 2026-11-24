import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { publicAssetPath, verifyNotationDescriptor } from '../docs/notation/edition-descriptor.js';

export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export async function validateNotationFiles(piece, { root, readBytes = path => readFile(resolve(root,path)) }) {
  const pointer = piece.notation;
  if (!pointer || !publicAssetPath(pointer.descriptor?.url) || pointer.version !== `sha256:${pointer.descriptor.sha256}`)
    throw Error('Invalid notation complete-version pointer');
  const verified = async (path, expected) => {
    if (!publicAssetPath(path)) throw Error('Invalid public asset path');
    const bytes = await readBytes(path);
    if (digest(bytes) !== expected) throw Error(`Changed notation asset: ${path}`);
    return bytes;
  };
  const descriptor = JSON.parse(await verified(pointer.descriptor.url,pointer.descriptor.sha256));
  const index = JSON.parse(await verified(descriptor.manifest?.url,descriptor.manifest?.sha256));
  const rendererManifest = JSON.parse(await verified(descriptor.renderer?.assetsManifestUrl,descriptor.renderer?.assetsManifestSha256));
  verifyNotationDescriptor(piece,descriptor,index,rendererManifest);
  await verified(descriptor.score.url,descriptor.score.sha256);
  await verified(descriptor.provenance.url,descriptor.provenance.sha256);
  for (const asset of descriptor.assets) await verified(asset.url,asset.sha256);
  const folder = descriptor.renderer.assetsManifestUrl.slice(0,descriptor.renderer.assetsManifestUrl.lastIndexOf('/')+1);
  for (const asset of rendererManifest.files) {
    const bytes = await verified(folder+asset.path,asset.sha256);
    if (bytes.length !== asset.bytes) throw Error(`Wrong renderer asset size: ${asset.path}`);
  }
  return { version:pointer.version, descriptor, index, rendererManifest };
}
