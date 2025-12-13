import {
  readFileSync,
  writeFileSync,
  copyFileSync,
  cpSync,
  readdirSync,
  statSync,
  existsSync,
} from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const webDist = join(__dirname, '../dist');
const landingPublic = join(__dirname, '../../landing/.output/public');

// Check if landing build exists
if (!existsSync(landingPublic)) {
  console.log('Landing build not found, skipping copy to landing.');
  process.exit(0);
}

try {
  console.log('Copying web app to landing build...');

  // Read web app HTML
  const webIndexContent = readFileSync(join(webDist, 'index.html'), 'utf-8');

  // Create app.html as the SPA shell (this will return 200 status, not 404)
  const appHtmlPath = join(landingPublic, 'app.html');
  writeFileSync(appHtmlPath, webIndexContent);
  console.log('  - Created app.html with web app HTML');

  // Also create 404.html to point to the same content for actual 404s
  writeFileSync(join(landingPublic, '404.html'), webIndexContent);
  console.log('  - Created 404.html fallback');

  // Copy all web app assets (JS, CSS, etc.) to landing public directory
  const webFiles = readdirSync(webDist);

  for (const file of webFiles) {
    const srcPath = join(webDist, file);
    const destPath = join(landingPublic, file);

    // Skip index.html and files that landing already has
    if (file === 'index.html' || file === 'favicon.ico' || file === 'icon.png') {
      continue;
    }

    // Copy file or directory
    if (statSync(srcPath).isDirectory()) {
      cpSync(srcPath, destPath, { recursive: true, force: true });
    } else {
      copyFileSync(srcPath, destPath);
    }
  }

  console.log('Done! Web app assets copied to landing build.');
} catch (error) {
  console.error('Failed to copy web build to landing:', error.message);
  process.exit(1);
}
