import { cp, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-threejs.ts';

const root = dirname(fileURLToPath(import.meta.url));
const output = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');
await mkdir(output, { recursive: true });
await cp(join(root, 'game'), join(output, 'game'), { recursive: true, force: true });
await cp(join(root, 'screenshots'), join(output, 'screenshots'), { recursive: true, force: true });
const dossier = await buildDossier(output, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648
});
await writeFile(join(output, 'dossier.json'), dossier);
