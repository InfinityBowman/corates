/**
 * This script replaces __BUILD_TIME__ in sw.js with the current timestamp
 * to ensure service worker updates are detected on each deployment.
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const swPath = resolve(__dirname, '../.output/public/sw.js');

try {
  const content = readFileSync(swPath, 'utf-8');
  const buildTime = Date.now().toString(36); // Short, unique identifier
  const updated = content.replace(/__BUILD_TIME__/g, buildTime);
  writeFileSync(swPath, updated);
  console.log(`[version-sw] Updated sw.js with build version: ${buildTime}`);
} catch (error) {
  console.error('[version-sw] Failed to update sw.js:', error.message);
  process.exit(1);
}
