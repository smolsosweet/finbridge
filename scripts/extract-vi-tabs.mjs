import fs from 'fs';

async function extractVi() {
  let text = '';
  if (fs.existsSync('temp-main.dart.js')) {
    text = fs.readFileSync('temp-main.dart.js', 'utf8');
  } else {
    console.log('Downloading main.dart.js...');
    const res = await fetch('https://app.rollyapp.ai/main.dart.js');
    text = await res.text();
    fs.writeFileSync('temp-main.dart.js', text);
  }

  // Find all pairs with "vi"
  // Format: "vi","..."
  const regex = /"vi",\s*"((?:\\.|[^"\\])*)"/g;
  let m;
  const viStrings = new Set();
  while ((m = regex.exec(text)) !== null) {
    viStrings.add(m[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\u([0-9a-fA-F]{4})/g, (_, code) => String.fromCharCode(parseInt(code, 16))));
  }

  const list = Array.from(viStrings);
  fs.writeFileSync('docs/extracted_vi_strings.json', JSON.stringify(list, null, 2));
  console.log('Total Vietnamese strings:', list.length);

  // Group by features
  const searchTerms = [
    'Giao dịch',
    'Công cụ tiền tệ',
    'Cài đặt',
    'Những cột mốc',
    'Ví',
    'Ngân hàng',
    'Danh mục',
    'Báo cáo',
    'Ngân sách',
    'Tiết kiệm',
    'Nợ',
    'Thống kê',
    'Cột mốc',
    'Huy hiệu',
    'Chuỗi'
  ];

  const results = {};
  for (const term of searchTerms) {
    results[term] = list.filter(s => s.toLowerCase().includes(term.toLowerCase()));
  }

  fs.writeFileSync('docs/grouped_vi_features.json', JSON.stringify(results, null, 2));
  for (const [k, v] of Object.entries(results)) {
    console.log(`- ${k}: ${v.length} items`);
    console.log('  Samples:', v.slice(0, 5));
  }
}

extractVi().catch(console.error);
