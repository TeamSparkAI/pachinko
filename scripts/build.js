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

const nextBuildSrc = path.join(appRoot, '.next');
const nextDest = path.join(distDir, '.next');
console.log('📋 Copying Next.js .next/ to dist/.next/...');
if (!fs.existsSync(nextBuildSrc)) {
  console.error('❌ Next.js build not found. Run: npm run build:prod');
  process.exit(1);
}
fs.cpSync(nextBuildSrc, nextDest, { recursive: true });
console.log('✅ Next.js build copied to', path.relative(repoRoot, nextDest));

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
