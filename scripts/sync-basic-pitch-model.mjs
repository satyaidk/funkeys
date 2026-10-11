/**
 * Copies Spotify's Basic Pitch model from node_modules into public/, where
 * the browser downloads it when someone transcribes a recording.
 *
 *   npm run sync:model
 *
 * The copy is committed (about 0.9 MB) so a deployment never depends on a
 * build hook having run. A unit test (src/lib/transcription/model-files.test.ts)
 * fails if the committed files ever differ from the installed package, e.g.
 * after upgrading @spotify/basic-pitch: run this script, then commit.
 */

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const packageDir = dirname(require.resolve('@spotify/basic-pitch/package.json'));
const { version } = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
const target = join(root, 'public', 'models', 'basic-pitch');

mkdirSync(target, { recursive: true });
for (const file of ['model.json', 'group1-shard1of1.bin']) {
  copyFileSync(join(packageDir, 'model', file), join(target, file));
}
copyFileSync(join(packageDir, 'LICENSE'), join(target, 'LICENSE'));
writeFileSync(
  join(target, 'README.md'),
  `# Basic Pitch model\n\nThe automatic music transcription model from [Spotify's Basic Pitch](https://github.com/spotify/basic-pitch-ts) ` +
    `(\`@spotify/basic-pitch\` ${version}), copyright 2022 Spotify AB, licensed under the Apache License 2.0 (see LICENSE).\n\n` +
    `Copied here by \`npm run sync:model\`; do not edit by hand.\n`
);
console.log(`Copied the Basic Pitch ${version} model to public/models/basic-pitch/`);
