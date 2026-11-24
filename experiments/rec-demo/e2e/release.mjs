import { readFileSync } from 'node:fs';

const release = JSON.parse(readFileSync(new URL('../../../docs/rec-demo/release.json', import.meta.url), 'utf8'));
export const moduleURL = name => `./${release.basePath}${name}`;
