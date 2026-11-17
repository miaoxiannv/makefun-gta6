// Captures the screenshots listed in shots.json: opens each deterministic ?shot= scene in
// headless Chromium at 1280x800, waits for the scene to say it is ready and saves a JPEG into
// screenshots/, lowering quality until it fits the 256 KiB cap. Fails on any page error.
//   node tools/shoot.ts [name-filter]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Browser, root } from './browser.ts';

const CAP = 256 * 1024;
const shots: { name: string; query: string }[] = JSON.parse(readFileSync(join(root, 'shots.json'), 'utf8'));
const filter = process.argv[2];
mkdirSync(join(root, 'screenshots'), { recursive: true });

const browser = await Browser.launch(1280, 800, 8771);
try {
  for (const shot of shots.filter((s) => !filter || s.name.includes(filter))) {
    const started = Date.now();
    const page = await browser.open(`/${shot.query}`);
    await page.waitFor('window.__shotReady === true');
    let quality = 92;
    let bytes = await page.screenshot('jpeg', quality);
    while (bytes.length > CAP && quality > 40) {
      quality -= 6;
      bytes = await page.screenshot('jpeg', quality);
    }
    writeFileSync(join(root, 'screenshots', shot.name), bytes);
    console.log(`${shot.name}: ${(bytes.length / 1024).toFixed(0)} KiB at q${quality}, ${((Date.now() - started) / 1000).toFixed(1)} s`);
    await page.close();
  }
} finally {
  browser.close();
}
if (browser.errors.length) {
  console.error(`page errors:\n  ${browser.errors.join('\n  ')}`);
  process.exit(1);
}
