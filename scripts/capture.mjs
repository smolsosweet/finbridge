import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9222;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  const userDataDir = path.resolve('temp-chrome-profile');
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
      width: 393,
      height: 852,
      deviceScaleFactor: 2,
      mobile: true
    });

    console.log('Waiting for Flutter initial render...');
    await sleep(8000);

    // Click "Returning user? Log in here"
    // Location is roughly center X (196), Y ~780
    console.log('Clicking "Returning user? Log in here"...');
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 196, y: 780, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 196, y: 780, button: 'left', clickCount: 1 });
    await sleep(4000);

    let snap = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('docs/design-references/screen-login.png', Buffer.from(snap.result.data, 'base64'));
    console.log('Saved screen-login.png');

    // Also navigate back or reload to test "Get Started"
    await send('Page.navigate', { url: 'https://app.rollyapp.ai/' });
    await sleep(8000);

    // Click "Get Started" (x: 196, y: 730)
    console.log('Clicking "Get Started"...');
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 196, y: 730, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 196, y: 730, button: 'left', clickCount: 1 });
    await sleep(4000);

    snap = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('docs/design-references/screen-onboarding-1.png', Buffer.from(snap.result.data, 'base64'));
    console.log('Saved screen-onboarding-1.png');

    // Let's click next / continue on onboarding 1 to see onboarding 2
    console.log('Clicking continue on onboarding 1...');
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 196, y: 750, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 196, y: 750, button: 'left', clickCount: 1 });
    await sleep(3000);

    snap = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('docs/design-references/screen-onboarding-2.png', Buffer.from(snap.result.data, 'base64'));
    console.log('Saved screen-onboarding-2.png');

    // Desktop view of Login
    await send('Page.navigate', { url: 'https://app.rollyapp.ai/' });
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await sleep(8000);
    // In desktop 1440x900: center x is 720, "Returning user? Log in here" is around y: 925? Wait, let's look at app-desktop.png
    // In app-desktop.png, button is centered horizontally: x = 720, y ~ 875, "Returning user? Log in here" is at y ~ 925
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 720, y: 925, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 720, y: 925, button: 'left', clickCount: 1 });
    await sleep(3000);

    snap = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('docs/design-references/screen-desktop-login.png', Buffer.from(snap.result.data, 'base64'));
    console.log('Saved screen-desktop-login.png');

    ws.close();
  } finally {
    chromeProc.kill();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) {}
  }
}

run().catch(console.error);
