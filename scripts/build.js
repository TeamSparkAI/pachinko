#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔨 Starting build orchestration...\n');

const repoRoot = path.join(__dirname, '..');
const appRoot = repoRoot;
const distDir = path.join(repoRoot, 'dist');

console.log('🧹 Cleaning dist directory...');
if (fs.existsSync(distDir)) {
  try {
    fs.rmSync(distDir, { recursive: true, force: true });
  } catch (error) {
    try {
      execSync('rm -rf dist', {
        stdio: 'inherit',
        cwd: repoRoot
      });
    } catch (rmError) {
      console.error('❌ Failed to clean dist directory:', rmError.message);
      process.exit(1);
    }
  }
}
fs.mkdirSync(distDir, { recursive: true });

console.log('🔧 Building Next.js and server bundle...');
try {
  execSync('npm run build:prod', {
    stdio: 'inherit',
    cwd: repoRoot
  });
  console.log('✅ Production build completed');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}

function copyNextStandalone() {
  const candidates = [
    path.join(appRoot, '.next', 'standalone', '.next'),
    path.join(appRoot, '.next', 'standalone', 'teamspark-pachinko', '.next'),
    path.join(appRoot, '.next', 'standalone', 'pachinko', '.next'),
    path.join(appRoot, '.next', 'standalone', 'pachinko-server', '.next'),
    path.join(appRoot, '.next', 'standalone', 'server', '.next')
  ];
  for (const nextSrc of candidates) {
    if (fs.existsSync(nextSrc)) {
      const nextDest = path.join(distDir, '.next');
      fs.cpSync(nextSrc, nextDest, { recursive: true });
      console.log('✅ Next.js standalone .next copied from', path.relative(repoRoot, nextSrc));
      return true;
    }
  }
  const standaloneRoot = path.join(appRoot, '.next', 'standalone');
  if (fs.existsSync(standaloneRoot)) {
    console.error('❌ Could not find .next under standalone. Contents of', standaloneRoot);
    try {
      console.error(fs.readdirSync(standaloneRoot).join(', '));
    } catch (_) {}
  }
  return false;
}

console.log('📋 Copying Next.js standalone build to dist/.next...');
if (!copyNextStandalone()) {
  console.error('❌ Next.js standalone .next not found');
  process.exit(1);
}

console.log('📋 Copying Next.js static assets...');
const nextStaticSrc = path.join(appRoot, '.next', 'static');
const nextStaticDest = path.join(distDir, '.next', 'static');
if (fs.existsSync(nextStaticSrc)) {
  fs.cpSync(nextStaticSrc, nextStaticDest, { recursive: true });
  console.log('✅ Next.js static assets copied');
} else {
  console.error('❌ Next.js static directory not found');
  process.exit(1);
}

console.log('📋 Copying server executable to dist/pachinko...');
const serverExecutable = path.join(appRoot, 'dist', 'server.js');
const serverDest = path.join(distDir, 'pachinko');
if (!fs.existsSync(serverExecutable)) {
  console.error('❌ Bundled server.js not found at', serverExecutable);
  process.exit(1);
}
fs.copyFileSync(serverExecutable, serverDest);
fs.chmodSync(serverDest, 0o755);
console.log('✅ Server executable copied to dist/pachinko');

console.log('📋 Copying appData files to dist/appData...');
const appDataSrc = path.join(appRoot, 'appData');
const appDataDest = path.join(distDir, 'appData');
if (fs.existsSync(appDataSrc)) {
  fs.cpSync(appDataSrc, appDataDest, { recursive: true });
  console.log('✅ appData files copied to dist/appData');
} else {
  console.error('❌ appData directory not found');
  process.exit(1);
}

console.log('📋 Copying public assets...');
const publicSrc = path.join(appRoot, 'public');
const publicDest = path.join(distDir, 'public');
if (fs.existsSync(publicSrc)) {
  fs.cpSync(publicSrc, publicDest, { recursive: true });
  console.log('✅ Public assets copied');
}

console.log('\n🔍 Verifying build output...');
const pachinkoExists = fs.existsSync(path.join(distDir, 'pachinko'));
const nextExists = fs.existsSync(path.join(distDir, '.next'));

if (pachinkoExists && nextExists) {
  console.log('✅ Build artifacts created successfully');
  console.log(`📁 Distribution in: ${distDir}`);
  console.log('   - pachinko (bundled server)');
  console.log('   - .next/ (Next.js build)');
  console.log('   - public/ (static assets)');
  console.log('   - appData/ (migrations, data)');
} else {
  console.error('❌ Failed to create all components');
  if (!pachinkoExists) console.error('   - Missing: pachinko executable');
  if (!nextExists) console.error('   - Missing: .next directory');
  process.exit(1);
}

console.log('\n🎉 Build orchestration completed successfully!');
