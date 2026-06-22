import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

try {
  // 1. Copy index.source.html to index.html
  fs.copyFileSync('index.source.html', 'index.html');
  console.log('Copied index.source.html to index.html');

  // 2. Clean dist folder
  if (fs.existsSync('dist')) {
    fs.rmSync('dist', { recursive: true, force: true });
  }

  // 3. Run vite build
  console.log('Running Vite build...');
  execSync('npx vite build', { stdio: 'inherit' });

  // 4. Delete old assets in autodev/assets
  if (fs.existsSync('assets')) {
    fs.rmSync('assets', { recursive: true, force: true });
  }
  fs.mkdirSync('assets');

  // 5. Copy dist/assets/* to assets/
  const distAssets = fs.readdirSync('dist/assets');
  distAssets.forEach(file => {
    fs.copyFileSync(path.join('dist/assets', file), path.join('assets', file));
  });
  console.log('Copied built assets to assets/');

  // 6. Copy dist/index.html to index.html (so static server can serve it)
  fs.copyFileSync('dist/index.html', 'index.html');
  console.log('Copied dist/index.html to index.html for static serving');

  console.log('Build and deployment complete!');
} catch (err) {
  console.error('Build process failed:', err);
  process.exit(1);
}
