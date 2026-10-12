import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9223;
const SERVER_PORT = 3005;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function verify() {
  console.log('Starting Next.js production server on port ' + SERVER_PORT + '...');
  const nextBin = path.resolve('node_modules/next/dist/bin/next');
  const serverProc = spawn('node', [nextBin, 'start', '-p', String(SERVER_PORT)], {
    stdio: 'ignore'
  });

  // Wait for server to be ready
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    try {
      const res = await fetch(`http://127.0.0.1:${SERVER_PORT}/`);
      if (res.ok) {
        console.log('Next.js server is ready!');
        break;
      }
    } catch (e) {}
  }

  const userDataDir = path.resolve('temp-chrome-verify');
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--window-size=1440,900',
    'about:blank'
  ]);

  try {
    let wsUrl = null;
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
        if (res.ok) {
          const data = await res.json();
          wsUrl = data.webSocketDebuggerUrl;
          break;
        }
      } catch (e) {}
    }

    if (!wsUrl) throw new Error('Could not connect to Chrome CDP');

    // Open local homepage
    const newPageRes = await fetch(`http://127.0.0.1:${PORT}/json/new?http://127.0.0.1:${SERVER_PORT}/`, { method: 'PUT' });
    const pageData = await newPageRes.json();
    const ws = new WebSocket(pageData.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

    let msgId = 1;
    const callbacks = new Map();
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (callbacks.has(msg.id)) {
        callbacks.get(msg.id)(msg);
        callbacks.delete(msg.id);
      }
    };

    function send(method, params = {}) {
      return new Promise((resolve) => {
        const id = msgId++;
        callbacks.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await sleep(2000);

    // Capture local desktop
    console.log('Capturing local desktop screenshot...');
    let snap = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('docs/design-references/local-desktop.png', Buffer.from(snap.result.data, 'base64'));
    console.log('Saved docs/design-references/local-desktop.png');

    // Capture local mobile
    console.log('Capturing local mobile screenshot...');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 393,
      height: 852,
      deviceScaleFactor: 2,
      mobile: true
    });
    await sleep(1500);
    snap = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('docs/design-references/local-mobile.png', Buffer.from(snap.result.data, 'base64'));
    console.log('Saved docs/design-references/local-mobile.png');

    // Capture local dashboard / app
    console.log('Capturing local dashboard screenshot...');
    await send('Page.navigate', { url: `http://127.0.0.1:${SERVER_PORT}/app` });
    await sleep(2000);
    snap = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('docs/design-references/local-dashboard.png', Buffer.from(snap.result.data, 'base64'));
    console.log('Saved docs/design-references/local-dashboard.png');

    ws.close();
  } finally {
    chromeProc.kill();
    serverProc.kill();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) {}
  }
}

verify().catch(console.error);
