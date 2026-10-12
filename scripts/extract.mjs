import fs from 'fs';

const text = fs.readFileSync('temp-main.dart.js', 'utf8');

// FlutterFlow stores translations like: A.f(["key", A.f(["en", "English text", "vi", "Vietnamese text", ...])])
const regex = /\["en",\s*"((?:\\.|[^"\\])*)"/g;
let m;
const enStrings = new Set();
while ((m = regex.exec(text)) !== null) {
  enStrings.add(m[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\u([0-9a-fA-F]{4})/g, (_, code) => String.fromCharCode(parseInt(code, 16))));
}

const list = Array.from(enStrings);
fs.writeFileSync('docs/extracted_strings.json', JSON.stringify(list, null, 2));
console.log('Total unique English strings:', list.length);

// Print notable UI strings
const keywords = ['Onboarding', 'Welcome', 'Wallet', 'Budget', 'Transaction', 'Category', 'Analytics', 'Chat', 'AI', 'Streak', 'Voice', 'Receipt', 'Expense', 'Income', 'Settings'];
const categorized = {};
for (const kw of keywords) {
  categorized[kw] = list.filter(s => s.toLowerCase().includes(kw.toLowerCase()));
}
console.log('Summary of categories:');
for (const [k, v] of Object.entries(categorized)) {
  console.log(`- ${k}: ${v.length} strings`);
}
