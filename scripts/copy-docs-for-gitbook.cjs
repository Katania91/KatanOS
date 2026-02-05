const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', 'docs');
const DST = path.resolve(SRC, 'gitbook');

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const hasFrontmatter = (text) => /^---\n[\s\S]*?\n---/.test(text);

const titleFromFilename = (filename) => {
  const name = path.basename(filename, path.extname(filename));
  return name.replace(/[-_]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
};

function copy() {
  ensureDir(DST);
  const entries = fs.readdirSync(SRC, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(SRC, entry.name);
    const dstPath = path.join(DST, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'gitbook') continue;
      ensureDir(dstPath);
      const files = fs.readdirSync(srcPath);
      for (const f of files) {
        const s = path.join(srcPath, f);
        const d = path.join(dstPath, f);
        fs.copyFileSync(s, d);
      }
      continue;
    }

    if (!entry.name.endsWith('.md')) {
      fs.copyFileSync(srcPath, dstPath);
      continue;
    }

    let content = fs.readFileSync(srcPath, 'utf8');
    if (!hasFrontmatter(content)) {
      const title = titleFromFilename(entry.name);
      const front = `---\ntitle: ${title}\ndescription: Documentation page\n---\n\n`;
      content = front + content;
    }
    fs.writeFileSync(dstPath, content, 'utf8');
    console.log('Copied', entry.name);
  }

  const readme = `# KatanOS Docs (GitBook copy)\n\nThis folder is a GitBook-friendly copy of the repository docs. Run this script from project root to regenerate:\n\nnode scripts/copy-docs-for-gitbook.cjs\n`;
  fs.writeFileSync(path.join(DST, 'README.md'), readme, 'utf8');
  console.log('GitBook folder prepared at', DST);
}

if (require.main === module) {
  try {
    copy();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

module.exports = { copy };
