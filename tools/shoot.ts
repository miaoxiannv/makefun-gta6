// Takes the screenshots listed in shots.json (Node 22+, standard library only): serves game/,
// opens each ?shot= scene in headless Chromium over the DevTools protocol, waits for the scene
// to report ready and saves a JPEG at 1280x800 into screenshots/, under the 256 KiB cap.
//   node tools/shoot.ts [name-filter]
// CHROME may point at any Chromium binary; by default it uses Playwright's headless shell.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const PORT = 8765;
const WIDTH = 1280;
const HEIGHT = 800;
const MAX_BYTES = 256 * 1024;

function findChrome(): string {
  if (process.env.CHROME) return process.env.CHROME;
  const cache = join(homedir(), '.cache', 'ms-playwright');
  for (const dir of readdirSync(cache).filter((d) => d.startsWith('chromium_headless_shell')).sort().reverse()) {
    for (const sub of readdirSync(join(cache, dir))) {
      const candidate = join(cache, dir, sub, 'headless_shell');
      if (existsSync(candidate)) return candidate;
    }
  }
  throw new Error('no Chromium found: set CHROME');
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const server = spawn(process.execPath, [join(root, 'serve.ts'), '--port', String(PORT)], { stdio: 'ignore' });
const chrome = spawn(findChrome(), [
  '--no-sandbox', '--headless', '--remote-debugging-port=0', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist', `--window-size=${WIDTH},${HEIGHT}`, '--hide-scrollbars', 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });

const endpoint: string = await new Promise((resolve, reject) => {
  let text = '';
  chrome.stderr.on('data', (chunk) => {
    text += chunk;
    const match = text.match(/DevTools listening on (ws:\/\/\S+)/);
    if (match) resolve(match[1]);
  });
  chrome.on('exit', () => reject(new Error(`Chromium exited:\n${text}`)));
});

const socket = new WebSocket(endpoint);
await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }));
let nextId = 1;
const waiting = new Map<number, (message: any) => void>();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(String(event.data));
  if (message.id && waiting.has(message.id)) {
    waiting.get(message.id)!(message);
    waiting.delete(message.id);
  } else if (message.method === 'Runtime.exceptionThrown') {
    console.error('  page exception:', message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
  } else if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(message.params.type)) {
    console.error(`  console.${message.params.type}:`, message.params.args.map((a: any) => a.value ?? a.description).join(' '));
  }
});
function send(method: string, params: object = {}, sessionId?: string): Promise<any> {
  const id = nextId++;
  socket.send(JSON.stringify({ id, method, params, sessionId }));
  return new Promise((resolve, reject) => waiting.set(id, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result))));
}

const shots: { name: string; query: string }[] = JSON.parse(readFileSync(join(root, 'shots.json'), 'utf8'));
const filter = process.argv[2];
try {
  for (const shot of shots.filter((s) => !filter || s.name.includes(filter))) {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    await send('Runtime.enable', {}, sessionId);
    await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false }, sessionId);
    const started = Date.now();
    await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/${shot.query}` }, sessionId);
    let ready = false;
    while (!ready && Date.now() - started < 180000) {
      await sleep(300);
      const { result } = await send('Runtime.evaluate', { expression: 'window.__shotReady === true' }, sessionId);
      ready = result.value === true;
    }
    if (!ready) throw new Error(`${shot.name}: scene never reported ready`);
    let quality = 90;
    let bytes: Buffer;
    do {
      const { data } = await send('Page.captureScreenshot', { format: 'jpeg', quality }, sessionId);
      bytes = Buffer.from(data, 'base64');
      quality -= 5;
    } while (bytes.length > MAX_BYTES && quality > 30);
    writeFileSync(join(root, 'screenshots', shot.name), bytes);
    console.log(`${shot.name}: ${(bytes.length / 1024).toFixed(0)} KiB, quality ${quality + 5}, ${((Date.now() - started) / 1000).toFixed(1)} s`);
    await send('Target.closeTarget', { targetId });
  }
} finally {
  socket.close();
  chrome.kill();
  server.kill();
}
