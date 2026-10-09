import fs from 'node:fs';
import path from 'node:path';

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(item => {
    const target = path.join(directory, item.name);
    return item.isDirectory() ? walk(target) : [target];
  });
}
for (const file of walk('client/test-results').filter(file => /home-(light|dark)\.jpg$/.test(file)).slice(0, 4)) {
  console.log('VISUAL_SAMPLE_START ' + file);
  const base64 = fs.readFileSync(file).toString('base64');
  for (let offset = 0; offset < base64.length; offset += 2000) console.log(base64.slice(offset, offset + 2000));
  console.log('VISUAL_SAMPLE_END');
}
