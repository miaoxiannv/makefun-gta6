// Headless Chromium over the DevTools protocol (Node 22+, standard library only), shared by
// tools/shoot.ts and tools/playtest.ts: starts serve.ts and the browser, opens pages, runs
// script in them, sends keys, takes screenshots and collects every console error or uncaught
// exception so a run can fail loudly.
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('..', import.meta.url));
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function chromePath(): string {
  if (process.env.CHROME) return process.env.CHROME;
  const cache = join(homedir(), '.cache', 'ms-playwright');
  const dirs = existsSync(cache) ? readdirSync(cache).filter((d) => d.startsWith('chromium_headless_shell')).sort().reverse() : [];
  for (const dir of dirs) {
    for (const sub of readdirSync(join(cache, dir))) {
      const bin = join(cache, dir, sub, 'headless_shell');
      if (existsSync(bin)) return bin;
    }
  }
  throw new Error('No Chromium found: set CHROME to a Chromium binary');
}

export class Browser {
  errors: string[] = [];
  private socket!: WebSocket;
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void; method: string }>();
  private procs: ChildProcess[] = [];
  port = 8770;

  static async launch(width = 1280, height = 800, port = 8770): Promise<Browser> {
    const b = new Browser();
    b.port = port;
    b.procs.push(spawn(process.execPath, [join(root, 'serve.ts'), '--port', String(port)], { stdio: 'ignore' }));
    const chrome = spawn(chromePath(), [
      '--no-sandbox', '--headless', '--remote-debugging-port=0', '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', `--window-size=${width},${height}`,
      '--hide-scrollbars', 'about:blank',
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    b.procs.push(chrome);
    const ws: string = await new Promise((resolve, reject) => {
      let log = '';
      chrome.stderr!.on('data', (chunk) => {
        log += chunk;
        const m = log.match(/DevTools listening on (ws:\/\/\S+)/);
        if (m) resolve(m[1]);
      });
      chrome.on('exit', () => reject(new Error(`Chromium exited early:\n${log}`)));
    });
    b.socket = new WebSocket(ws);
    await new Promise((resolve) => b.socket.addEventListener('open', resolve, { once: true }));
    b.socket.addEventListener('message', (event) => b.onMessage(JSON.parse(String(event.data))));
    await sleep(400); // let serve.ts bind its port
    return b;
  }

  private onMessage(msg: any) {
    if (msg.id && this.pending.has(msg.id)) {
      const p = this.pending.get(msg.id)!;
      this.pending.delete(msg.id);
      if (msg.error) p.reject(new Error(`${p.method}: ${msg.error.message}`));
      else p.resolve(msg.result);
      return;
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      this.errors.push(`exception: ${d.exception?.description ?? d.text}`);
    } else if (msg.method === 'Runtime.consoleAPICalled' && (msg.params.type === 'error' || msg.params.type === 'warning')) {
      this.errors.push(`console.${msg.params.type}: ${msg.params.args.map((a: any) => a.value ?? a.description).join(' ')}`);
    } else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      this.errors.push(`log: ${msg.params.entry.text} ${msg.params.entry.url ?? ''}`);
    }
  }

  send(method: string, params: object = {}, sessionId?: string): Promise<any> {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject, method }));
  }

  /** Open `path` (e.g. "/?shot=drive") in a fresh tab of the given size; returns a Page. */
  async open(path: string, width = 1280, height = 800): Promise<Page> {
    const { targetId } = await this.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await this.send('Target.attachToTarget', { targetId, flatten: true });
    const page = new Page(this, targetId, sessionId);
    await page.call('Runtime.enable');
    await page.call('Log.enable');
    await page.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await page.call('Page.navigate', { url: `http://127.0.0.1:${this.port}${path}` });
    return page;
  }

  close() {
    try { this.socket.close(); } catch { /* already closed */ }
    for (const p of this.procs) p.kill();
  }
}

const KEYS: Record<string, { key: string; keyCode: number }> = {
  KeyW: { key: 'w', keyCode: 87 }, KeyA: { key: 'a', keyCode: 65 }, KeyS: { key: 's', keyCode: 83 },
  KeyD: { key: 'd', keyCode: 68 }, KeyE: { key: 'e', keyCode: 69 }, KeyQ: { key: 'q', keyCode: 81 },
  KeyF: { key: 'f', keyCode: 70 }, KeyH: { key: 'h', keyCode: 72 }, Space: { key: ' ', keyCode: 32 },
  ShiftLeft: { key: 'Shift', keyCode: 16 }, Enter: { key: 'Enter', keyCode: 13 }, Escape: { key: 'Escape', keyCode: 27 },
};

export class Page {
  private browser: Browser;
  readonly targetId: string;
  readonly sessionId: string;

  constructor(browser: Browser, targetId: string, sessionId: string) {
    this.browser = browser;
    this.targetId = targetId;
    this.sessionId = sessionId;
  }

  call(method: string, params: object = {}) {
    return this.browser.send(method, params, this.sessionId);
  }

  async eval<T = any>(expression: string): Promise<T> {
    const { result, exceptionDetails } = await this.call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (exceptionDetails) throw new Error(`eval failed: ${exceptionDetails.exception?.description ?? exceptionDetails.text}`);
    return result.value as T;
  }

  async waitFor(expression: string, timeoutMs = 180000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (this.browser.errors.length) throw new Error(`page error while waiting:\n  ${this.browser.errors.join('\n  ')}`);
      if (await this.eval<boolean>(`!!(${expression})`).catch(() => false)) return;
      await sleep(250);
    }
    throw new Error(`timed out waiting for ${expression}`);
  }

  async key(code: string, type: 'keyDown' | 'keyUp') {
    const k = KEYS[code];
    await this.call('Input.dispatchKeyEvent', { type, code, key: k.key, windowsVirtualKeyCode: k.keyCode });
  }

  /** Hold keys down for `ms` milliseconds of real time, then release them. */
  async hold(codes: string[], ms: number) {
    for (const c of codes) await this.key(c, 'keyDown');
    await sleep(ms);
    for (const c of codes) await this.key(c, 'keyUp');
  }

  /** Hold keys down until the game has run `frames` more frames (slow software GL safe). */
  async holdFrames(codes: string[], frames: number) {
    const start = await this.eval<number>('window.portSolano.frames');
    for (const c of codes) await this.key(c, 'keyDown');
    await this.waitFor(`window.portSolano.frames >= ${start + frames}`, 600000);
    for (const c of codes) await this.key(c, 'keyUp');
  }

  tap(code: string) {
    return this.hold([code], 120);
  }

  async screenshot(format: 'png' | 'jpeg' = 'png', quality = 90): Promise<Buffer> {
    const { data } = await this.call('Page.captureScreenshot', { format, ...(format === 'jpeg' ? { quality } : {}) });
    return Buffer.from(data, 'base64');
  }

  close() {
    return this.browser.send('Target.closeTarget', { targetId: this.targetId });
  }
}
