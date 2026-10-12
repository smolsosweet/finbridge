import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9224;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scan() {
  const userDataDir = path.resolve('temp-chrome-scan');
  if (!fs.existsSync('docs/design-references')) {
    fs.mkdirSync('docs/design-references', { recursive: true });
  }

  // Launch Chrome at 1280 x 800 (standard laptop resolution like user's Brave browser)
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--window-size=1280,800',
    'about:blank'
  ]);

  try {
    let wsUrl = null;
    for (let i = 0; i < 30; i++) {
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

    // Open live app
    const newPageRes = await fetch(`http://127.0.0.1:${PORT}/json/new?https://app.rollyapp.ai/`, { method: 'PUT' });
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
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false
    });

    console.log('Waiting for live app to load...');
    await sleep(9000);

    async function clickAt(x, y, label) {
      console.log(`Clicking ${label} at (${x}, ${y})...`);
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
      await sleep(3500);
    }

    async function snap(filename) {
      const res = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(`docs/design-references/${filename}`, Buffer.from(res.result.data, 'base64'));
      console.log(`Saved docs/design-references/${filename}`);
    }

    // 1. Initial Home Screen
    console.log('Capturing initial screen...');
    await snap('live-tab-1-home.png');

    // In 1280x800, the 4 tabs are at the bottom:
    // Y is around 770 (800 - 30)
    // Tab 1 (Trang chu): x ~ 160
    // Tab 2 (Giao dich): x ~ 480
    // Tab 3 (Cong cu tien te): x ~ 800
    // Tab 4 (Cai dat): x ~ 1120

    // Click Tab 2: Giao dịch
    await clickAt(480, 770, 'Tab 2: Giao dịch');
    await snap('live-tab-2-giao-dich.png');

    // Click Tab 3: Công cụ tiền tệ
    await clickAt(800, 770, 'Tab 3: Công cụ tiền tệ');
    await snap('live-tab-3-cong-cu-tien-te.png');

    // Click Tab 4: Cài đặt
    await clickAt(1120, 770, 'Tab 4: Cài đặt');
    await snap('live-tab-4-cai-dat.png');

    // Click back to Tab 1: Trang chủ
    await clickAt(160, 770, 'Tab 1: Trang chủ');
    await snap('live-back-to-home.png');

    // Click FAB (+) at bottom right
    // In 1280x800, FAB is at roughly x ~ 1220, y ~ 700
    await clickAt(1220, 700, 'FAB (+)');
    await snap('live-fab-add-transaction.png');

    // Click "Những cột mốc" at top-left
    // In 1280x800, x ~ 70, y ~ 45
    await send('Page.navigate', { url: 'https://app.rollyapp.ai/' });
    await sleep(7000);
    await clickAt(70, 45, 'Những cột mốc');
    await snap('live-milestones.png');

    ws.close();
  } finally {
    chromeProc.kill();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) {}
  }
}

scan().catch(console.error);
