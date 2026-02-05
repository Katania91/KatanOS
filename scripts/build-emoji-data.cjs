const fs = require('fs');
const path = require('path');

const sourcePath = path.resolve(__dirname, '..', 'node_modules', 'emoji-datasource', 'emoji.json');
const raw = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

const output = raw
  .filter((entry) => entry.category && entry.category !== 'Component')
  .map((entry) => {
    const skinVariations = entry.skin_variations
      ? Object.values(entry.skin_variations)
          .map((variation) => ({
            unified: variation.unified,
            sheet_x: variation.sheet_x,
            sheet_y: variation.sheet_y,
          }))
          .filter((variation) => variation.unified)
      : undefined;
    const out = {
      unified: entry.unified,
      short_name: entry.short_name,
      short_names: entry.short_names && entry.short_names.length ? entry.short_names : undefined,
      category: entry.category,
      sort_order: entry.sort_order,
      sheet_x: entry.sheet_x,
      sheet_y: entry.sheet_y,
      keywords: entry.keywords && entry.keywords.length ? entry.keywords : undefined,
      skin_variations: skinVariations && skinVariations.length ? skinVariations : undefined,
    };
    Object.keys(out).forEach((key) => {
      if (out[key] === undefined) delete out[key];
    });
    return out;
  });

const destPath = path.resolve(__dirname, '..', 'assets', 'emoji-data.json');
fs.writeFileSync(destPath, JSON.stringify(output), 'utf8');

const sheetSource = path.resolve(
  __dirname,
  '..',
  'node_modules',
  'emoji-datasource',
  'img',
  'apple',
  'sheets',
  '32.png'
);
// const sheetDest = path.resolve(__dirname, '..', 'assets', 'emoji-sheet-32.png');
// fs.copyFileSync(sheetSource, sheetDest);

const sheetBuffer = fs.readFileSync(sheetSource);
const width = sheetBuffer.readUInt32BE(16);
const height = sheetBuffer.readUInt32BE(20);
const metaPath = path.resolve(__dirname, '..', 'assets', 'emoji-sheet-meta.json');
fs.writeFileSync(metaPath, JSON.stringify({ width, height }), 'utf8');

console.log(`Wrote ${output.length} entries to ${destPath}`);
console.log(`Copied sheet to ${sheetDest}`);
console.log(`Wrote sheet metadata to ${metaPath}`);
