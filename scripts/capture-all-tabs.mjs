import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9225;
const SERVER_PORT = 3007;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function captureTabs() {
  console.log('Starting Next.js production server on port ' + SERVER_PORT + '...');
  const nextBin = path.resolve('node_modules/next/dist/bin/next');
  const serverProc = spawn('node', [nextBin, 'start', '-p', String(SERVER_PORT)], {
    stdio: 'ignore'
  });

  // Wait for server to be ready
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    try {
      const res = await fetch(`http://127.0.0.1:${SERVER_PORT}/app`);
      if (res.ok) {
        console.log('Next.js server is ready!');
        break;
      }
    } catch (e) {}
  }

  const userDataDir = path.resolve('temp-chrome-tabs-v2');
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--window-size=393,852',
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

    const newPageRes = await fetch(`http://127.0.0.1:${PORT}/json/new?http://127.0.0.1:${SERVER_PORT}/app`, { method: 'PUT' });
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
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 393,
      height: 852,
      deviceScaleFactor: 2,
      mobile: true
    });
    await sleep(2000);

    // Tab 1: Trang chủ
    console.log('Capturing Tab 1: Trang chủ...');
    let snap = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('docs/design-references/tab1-home.png', Buffer.from(snap.result.data, 'base64'));

    // Tab 2: Giao dịch
    console.log('Capturing Tab 2: Giao dịch...');
    await send('Page.navigate', { url: `http://127.0.0.1:${SERVER_PORT}/app?tab=transactions` });
    await sleep(1500);
    snap = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('docs/design-references/tab2-transactions.png', Buffer.from(snap.result.data, 'base64'));

    // Tab 3: Công cụ tiền tệ
    console.log('Capturing Tab 3: Công cụ tiền tệ...');
    await send('Page.navigate', { url: `http://127.0.0.1:${SERVER_PORT}/app?tab=tools` });
    await sleep(1500);
    snap = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('docs/design-references/tab3-money-tools.png', Buffer.from(snap.result.data, 'base64'));

    // Tab 4: Cài đặt
    console.log('Capturing Tab 4: Cài đặt...');
    await send('Page.navigate', { url: `http://127.0.0.1:${SERVER_PORT}/app?tab=settings` });
    await sleep(1500);
    snap = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('docs/design-references/tab4-settings.png', Buffer.from(snap.result.data, 'base64'));

    // Landing Page
    console.log('Capturing Landing Page (rollyapp.ai/vi)...');
    await send('Page.navigate', { url: `http://127.0.0.1:${SERVER_PORT}/vi` });
    await sleep(2000);
    snap = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('docs/design-references/landing-vi.png', Buffer.from(snap.result.data, 'base64'));

    console.log('All 4 tabs and landing page successfully captured!');
    ws.close();
  } finally {
    chromeProc.kill();
    serverProc.kill();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) {}
  }
}

captureTabs().catch(console.error);
