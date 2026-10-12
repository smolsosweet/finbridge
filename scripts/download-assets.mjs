import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://app.rollyapp.ai/';

const ASSET_PATHS = [
  'assets/images/Welcome_Icon.png',
  'assets/images/Logo-transparent-1024x1024.png',
  'assets/images/Splash-screen.png',
  'assets/images/Confused_people-removebg-preview.png',
  'assets/images/Financial_Freedom-removebg.png',
  'assets/images/Rolly-365-streak-removebg-preview.png',
  'assets/images/intro1-removebg-preview.png',
  'assets/images/intro2-removebg.png',
  'assets/images/intro3-removebg.png',
  'assets/images/budget-badge.png',
  'assets/images/savings-badge-cropped.png',
  'assets/images/debt-badge-right-cropped.png',
  'assets/images/highest-streak-cropped.png',
  'assets/images/coin.png',
  'assets/images/user.png',
  'assets/images/intro-chat.png',
  'assets/images/intro-voice.png',
  'assets/images/favicon.png',
  // Bank logos
  'assets/bank_logos/vcb.png',
  'assets/bank_logos/tcb.png',
  'assets/bank_logos/mb.png',
  'assets/bank_logos/bidv.png',
  'assets/bank_logos/acb.png',
  'assets/bank_logos/tpb.png',
  'assets/bank_logos/vpb.png',
  // Category icons
  'assets/category_icons/current/food-drinks--restaurant.png',
  'assets/category_icons/current/food-drinks--coffee.png',
  'assets/category_icons/current/food-drinks--grocery.png',
  'assets/category_icons/current/food-drinks--burger.png',
  'assets/category_icons/current/transport-travel--car.png',
  'assets/category_icons/current/transport-travel--airplane.png',
  'assets/category_icons/current/home-bills--home.png',
  'assets/category_icons/current/home-bills--electricity.png',
  'assets/category_icons/current/fun-leisure--shopping.png',
  'assets/category_icons/current/health-personal-care--gym.png',
  'assets/category_icons/current/money-work--salary.png',
  'assets/category_icons/current/money-work--piggy-bag.png',
  'assets/category_icons/current/money-work--wallet-notes.png'
];

async function download() {
  const targetDir = path.resolve('public/sites/rolly');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  let count = 0;
  for (const assetPath of ASSET_PATHS) {
    const filename = path.basename(assetPath);
    const subfolder = path.dirname(assetPath).replace(/^assets\/?/, '');
    const outDir = subfolder ? path.join(targetDir, subfolder) : targetDir;
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    const outFile = path.join(outDir, filename);

    // Try both url formats: https://app.rollyapp.ai/assets/<path> and https://app.rollyapp.ai/<path>
    const urls = [
      `${BASE_URL}assets/${assetPath}`,
      `${BASE_URL}${assetPath}`
    ];

    let downloaded = false;
    for (const u of urls) {
      try {
        const res = await fetch(u);
        if (res.ok) {
          const buf = await res.arrayBuffer();
          fs.writeFileSync(outFile, Buffer.from(buf));
          console.log(`[OK] ${assetPath} (${buf.byteLength} bytes) -> ${outFile}`);
          downloaded = true;
          count++;
          break;
        }
      } catch (e) {}
    }
    if (!downloaded) {
      console.warn(`[FAIL] Could not download ${assetPath}`);
    }
  }
  console.log(`Successfully downloaded ${count}/${ASSET_PATHS.length} assets.`);
}

download().catch(console.error);
