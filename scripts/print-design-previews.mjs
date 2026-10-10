import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function visit(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await visit(path);
    else if (/home-light[.]jpg$|work-expanded[.]jpg$/.test(path)) {
      console.log('DESIGN_PREVIEW_BEGIN ' + path);
      console.log((await readFile(path)).toString('base64'));
      console.log('DESIGN_PREVIEW_END');
    }
  }
}
await visit('client/test-results');
