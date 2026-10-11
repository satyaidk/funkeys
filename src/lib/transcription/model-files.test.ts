/**
 * The model the browser downloads (public/models/basic-pitch) is a copy of
 * the one in the installed @spotify/basic-pitch package. This catches the
 * two drifting apart, e.g. after an upgrade: run `npm run sync:model`.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { MODEL_PATH } from './transcriber';

const require = createRequire(import.meta.url);
const packageModel = join(dirname(require.resolve('@spotify/basic-pitch/package.json')), 'model');
const servedModel = join(process.cwd(), 'public', dirname(MODEL_PATH));
const hash = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');

describe('served Basic Pitch model', () => {
  it.each(['model.json', 'group1-shard1of1.bin'])('%s matches the installed package', (file) => {
    expect(hash(join(servedModel, file))).toBe(hash(join(packageModel, file)));
  });

  it('is the model the code asks for, and its weights file is the one model.json names', () => {
    const model = JSON.parse(readFileSync(join(servedModel, 'model.json'), 'utf8'));
    expect(model.weightsManifest[0].paths).toEqual(['group1-shard1of1.bin']);
  });

  it('ships the Apache 2.0 license with it', () => {
    expect(readFileSync(join(servedModel, 'LICENSE'), 'utf8')).toMatch(/Apache License/);
  });
});
