import fs from 'fs';

async function analyze() {
  console.log('Downloading main.dart.js...');
  const res = await fetch('https://app.rollyapp.ai/main.dart.js');
  const text = await res.text();
  fs.writeFileSync('temp-main.dart.js', text);
  console.log('Downloaded main.dart.js, length:', text.length);

  // Look for route names or path names
  const routeRegex = /name:\s*["']([A-Za-z0-9_-]+)["'],\s*path:\s*["']([^"']+)["']/g;
  let match;
  const routes = [];
  while ((match = routeRegex.exec(text)) !== null) {
    routes.push({ name: match[1], path: match[2] });
  }
  console.log('Found routes (pattern 1):', routes.slice(0, 30));

  // Also look for GoRoute or flutterflow route definitions
  const pathRegex = /path:\s*["'](\/[A-Za-z0-9_\-\/]*)["']/g;
  const paths = new Set();
  while ((match = pathRegex.exec(text)) !== null) {
    paths.add(match[1]);
  }
  console.log('Found paths:', Array.from(paths));

  // Look for onboarding phrases
  const phrases = [
    'Money Disappears',
    'Track Smarter',
    'Hello! My name is Rolly',
    'Returning user',
    'Log in now',
    'Sign Up'
  ];
  for (const phrase of phrases) {
    const idx = text.indexOf(phrase);
    if (idx !== -1) {
      console.log(`Found "${phrase}" context:`, text.substring(Math.max(0, idx - 100), Math.min(text.length, idx + 200)));
    }
  }

  // Find strings around "Money Disappears Before You Know It?"
  const startIdx = text.indexOf('Money Disappears Before You Know It?');
  if (startIdx !== -1) {
    console.log('Around onboarding 1:', text.substring(startIdx, startIdx + 1500));
  }
}

analyze().catch(console.error);
