// FinBridge E2E Chrome CDP Browser Test: Dynamic Zero-Reload Language Switching
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const CHROME_PATHS = [
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  process.env.CHROME_BIN,
].filter(Boolean);

const CHROME_PATH = CHROME_PATHS.find((p) => fs.existsSync(p));
const CDP_PORT = 9225;
const SERVER_PORT = 3006;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isServerReady(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/`);
    return res.ok || res.status === 200 || res.status === 304;
  } catch {
    return false;
  }
}

async function runE2E() {
  if (!CHROME_PATH) {
    throw new Error('Chrome binary not found on system. Tested: ' + CHROME_PATHS.join(', '));
  }

  console.log('Using Chrome binary at:', CHROME_PATH);

  let spawnedServer = null;
  const alreadyRunning = await isServerReady(SERVER_PORT);

  if (!alreadyRunning) {
    console.log(`Starting Next.js server on port ${SERVER_PORT}...`);
    const nextBin = path.resolve('node_modules/next/dist/bin/next');
    spawnedServer = spawn('node', [nextBin, 'start', '-p', String(SERVER_PORT)], {
      stdio: 'ignore',
    });

    let ready = false;
    for (let i = 0; i < 30; i++) {
      await sleep(500);
      if (await isServerReady(SERVER_PORT)) {
        ready = true;
        console.log(`Next.js server is ready on http://127.0.0.1:${SERVER_PORT}/`);
        break;
      }
    }

    if (!ready) {
      if (spawnedServer) spawnedServer.kill();
      throw new Error(`Next.js server failed to start within 15 seconds on port ${SERVER_PORT}`);
    }
  } else {
    console.log(`Using existing Next.js server on port ${SERVER_PORT}`);
  }

  const userDataDir = path.resolve('temp-chrome-localization-e2e');
  try {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  } catch {}

  console.log(`Launching headless Chrome with CDP port ${CDP_PORT}...`);
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--window-size=1440,900',
    'about:blank',
  ]);

  try {
    let wsUrl = null;
    for (let i = 0; i < 25; i++) {
      await sleep(400);
      try {
        const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
        if (res.ok) {
          const data = await res.json();
          wsUrl = data.webSocketDebuggerUrl;
          break;
        }
      } catch {}
    }

    if (!wsUrl) {
      throw new Error('Could not establish CDP connection to Chrome');
    }

    console.log('Connected to Chrome CDP. Opening root page...');
    const newPageRes = await fetch(
      `http://127.0.0.1:${CDP_PORT}/json/new?http://127.0.0.1:${SERVER_PORT}/`,
      { method: 'PUT' }
    );
    const pageData = await newPageRes.json();
    const ws = new WebSocket(pageData.webSocketDebuggerUrl);

    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = rej;
    });

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

    async function evaluate(expression) {
      const res = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (res.result && res.result.exceptionDetails) {
        throw new Error(
          `CDP evaluate error: ${JSON.stringify(res.result.exceptionDetails)}`
        );
      }
      return res.result && res.result.result ? res.result.result.value : undefined;
    }

    await send('Page.enable');
    await send('Runtime.enable');
    await sleep(2500);

    console.log('Verifying initial welcome page load and language selector presence...');
    const hasLangTrigger = await evaluate(
      `Boolean(document.querySelector('button[aria-label="Select language"]'))`
    );
    assert.equal(hasLangTrigger, true, 'Language selector trigger must be present in DOM');

    // Initial English headline check
    const initialHeadline = await evaluate(
      `document.getElementById('welcome-title')?.textContent?.trim()`
    );
    console.log('Initial headline observed:', initialHeadline);
    assert.equal(initialHeadline, 'Track smarter with your AI assistant');

    // -------------------------------------------------------------------------
    // TEST STEP 1: DYNAMIC SWITCH TO TIẾNG VIỆT (ZERO RELOAD)
    // -------------------------------------------------------------------------
    console.log('Step 1: Switching language to Tiếng Việt via live DOM click...');
    await evaluate(`
      (() => {
        const trigger = document.querySelector('button[aria-label="Select language"]');
        trigger.click();
      })()
    `);
    await sleep(300);

    await evaluate(`
      (() => {
        const viOption = Array.from(document.querySelectorAll('button[role="option"]'))
          .find(el => el.textContent.includes('Tiếng Việt'));
        if (!viOption) throw new Error('Tiếng Việt option not found in menu');
        viOption.click();
      })()
    `);
    await sleep(400);

    const viHeadline = await evaluate(
      `document.getElementById('welcome-title')?.textContent?.trim()`
    );
    console.log('Vietnamese headline observed:', viHeadline);
    assert.equal(viHeadline, 'Theo dõi thông minh hơn với trợ lý AI');

    // Assert zero full reload occurred
    const navEntries = await evaluate(
      `window.performance.getEntriesByType('navigation').map(e => e.type)`
    );
    assert.ok(
      !navEntries.includes('reload'),
      'Performance navigation must confirm zero reload occurred on VI switch'
    );

    // -------------------------------------------------------------------------
    // TEST STEP 2: DYNAMIC SWITCH TO CHINESE (中文) (ZERO RELOAD)
    // -------------------------------------------------------------------------
    console.log('Step 2: Switching language to Chinese (中文) via live DOM click...');
    await evaluate(`
      (() => {
        const trigger = document.querySelector('button[aria-label="Select language"]');
        trigger.click();
      })()
    `);
    await sleep(300);

    await evaluate(`
      (() => {
        const zhOption = Array.from(document.querySelectorAll('button[role="option"]'))
          .find(el => el.textContent.includes('中文'));
        if (!zhOption) throw new Error('中文 option not found in menu');
        zhOption.click();
      })()
    `);
    await sleep(400);

    const zhHeadline = await evaluate(
      `document.getElementById('welcome-title')?.textContent?.trim()`
    );
    console.log('Chinese headline observed:', zhHeadline);
    assert.equal(zhHeadline, '与 AI 助手一起智能管理财务');

    // -------------------------------------------------------------------------
    // TEST STEP 3: DYNAMIC SWITCH BACK TO ENGLISH (ZERO RELOAD)
    // -------------------------------------------------------------------------
    console.log('Step 3: Switching language back to English via live DOM click...');
    await evaluate(`
      (() => {
        const trigger = document.querySelector('button[aria-label="Select language"]');
        trigger.click();
      })()
    `);
    await sleep(300);

    await evaluate(`
      (() => {
        const enOption = Array.from(document.querySelectorAll('button[role="option"]'))
          .find(el => el.textContent.includes('English'));
        if (!enOption) throw new Error('English option not found in menu');
        enOption.click();
      })()
    `);
    await sleep(400);

    const finalHeadline = await evaluate(
      `document.getElementById('welcome-title')?.textContent?.trim()`
    );
    console.log('English headline observed after cycling:', finalHeadline);
    assert.equal(finalHeadline, 'Track smarter with your AI assistant');

    ws.close();
    console.log('PASS: All headless Chrome CDP live localization switching tests passed with 100% success.');
  } finally {
    try {
      chromeProc.kill();
    } catch {}
    if (spawnedServer) {
      try {
        spawnedServer.kill();
      } catch {}
    }
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {}
  }
}

runE2E().catch((err) => {
  console.error('FAIL: verify-localization-e2e failed:', err);
  process.exit(1);
});
