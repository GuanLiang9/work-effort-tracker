/**
 * gen-icons.js — one-off rasteriser for icon.svg
 *
 * Run when icon.svg changes:   node scripts/gen-icons.js
 * Requires sharp (devDep):     npm i -D sharp
 *
 * Outputs:
 *   apple-touch-icon.png  (180×180, iOS home-screen)
 *   icon-192.png          (192×192, Android / PWA)
 *   icon-512.png          (512×512, PWA splash)
 *   favicon-32.png        (32×32,   browser tab fallback)
 */
const fs   = require('fs');
const path = require('path');

let sharp;
try { sharp = require('sharp'); }
catch { console.error('sharp not installed — run: npm i -D sharp'); process.exit(1); }

const root = path.join(__dirname, '..');
const src  = path.join(root, 'icon.svg');
const svg  = fs.readFileSync(src);

const targets = [
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'icon-192.png',         size: 192 },
  { name: 'icon-512.png',         size: 512 },
  { name: 'favicon-32.png',       size: 32  },
];

(async () => {
  for (const t of targets) {
    await sharp(svg, { density: 384 })
      .resize(t.size, t.size)
      .png({ compressionLevel: 9 })
      .toFile(path.join(root, t.name));
    console.log(`✓ ${t.name}  (${t.size}×${t.size})`);
  }
})();
