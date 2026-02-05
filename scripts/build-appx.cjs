/**
 * Build script that merges local MS Store configuration
 * Usage: node scripts/build-appx.cjs
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LOCAL_CONFIG_PATH = path.join(ROOT, 'build-config.local.json');
const PACKAGE_PATH = path.join(ROOT, 'package.json');
const PACKAGE_BACKUP_PATH = path.join(ROOT, 'package.json.bak');

function loadLocalConfig() {
  if (!fs.existsSync(LOCAL_CONFIG_PATH)) {
    console.error('❌ build-config.local.json not found!');
    console.error('   Create this file with your MS Store credentials:');
    console.error(`
{
  "appx": {
    "identityName": "YourName.KatanOS",
    "publisher": "CN=YOUR-PUBLISHER-ID",
    "publisherDisplayName": "YourName"
  }
}
`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(LOCAL_CONFIG_PATH, 'utf8'));
}

function main() {
  console.log('📦 Building KatanOS for Microsoft Store...\n');

  // Load configs
  const localConfig = loadLocalConfig();
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8'));

  // Backup original package.json
  fs.writeFileSync(PACKAGE_BACKUP_PATH, JSON.stringify(packageJson, null, 2));

  // Merge appx config
  const mergedPackage = {
    ...packageJson,
    build: {
      ...packageJson.build,
      appx: {
        ...packageJson.build.appx,
        ...localConfig.appx
      }
    }
  };

  // Write merged config
  fs.writeFileSync(PACKAGE_PATH, JSON.stringify(mergedPackage, null, 2));
  console.log('✅ Merged local APPX configuration');

  try {
    // Run electron-builder for APPX only
    console.log('\n🔨 Running electron-builder...\n');
    execSync('npm run build && npx electron-builder --win appx', {
      cwd: ROOT,
      stdio: 'inherit'
    });
    console.log('\n✅ Build completed successfully!');
  } finally {
    // Restore original package.json
    fs.copyFileSync(PACKAGE_BACKUP_PATH, PACKAGE_PATH);
    fs.unlinkSync(PACKAGE_BACKUP_PATH);
    console.log('🔄 Restored original package.json');
  }
}

main();
