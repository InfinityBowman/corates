/**
 * Zag Documentation Search
 * Provides search functionality for Zag.js component documentation
 * Uses scraped docs from zag-docs/ directory
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache for the manifest
let manifestCache = null;

/**
 * Load the Zag manifest (component metadata)
 */
export async function loadManifest() {
  if (!manifestCache) {
    const manifestPath = path.join(__dirname, 'zag-manifest.json');
    try {
      manifestCache = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    } catch {
      console.error('Failed to load zag-manifest.json. Run `node scrape-zag.js` first.');
      manifestCache = {};
    }
  }
  return manifestCache;
}

/**
 * Get the full documentation content for a component
 * @param {string} componentKey - Component key (e.g., 'switch', 'date-picker')
 * @returns {Promise<string|null>} Documentation content or null
 */
export async function getComponentDocs(componentKey) {
  const normalizedKey = componentKey.toLowerCase().replace(/\s+/g, '-');
  const docPath = path.join(__dirname, 'zag-docs', `${normalizedKey}.md`);

  try {
    return await fs.readFile(docPath, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Search for Zag components by name
 * @param {string} query - Search query
 * @param {number} limit - Maximum results to return
 * @returns {Promise<Array>} Matching components
 */
export async function searchComponents(query, limit = 10) {
  const manifest = await loadManifest();
  const q = query.toLowerCase();
  const results = [];

  for (const [key, component] of Object.entries(manifest)) {
    const nameMatch = component.name.toLowerCase().includes(q);
    const keyMatch = key.includes(q);
    const packageMatch = component.package.toLowerCase().includes(q);

    if (nameMatch || keyMatch || packageMatch) {
      results.push({
        key,
        ...component,
        relevance:
          nameMatch ? 3
          : keyMatch ? 2
          : packageMatch ? 1.5
          : 1,
      });
    }

    if (results.length >= limit * 2) break;
  }

  return results.sort((a, b) => b.relevance - a.relevance).slice(0, limit);
}

/**
 * Get a specific component's metadata by key
 * @param {string} key - Component key (e.g., 'accordion', 'date-picker')
 * @returns {Promise<Object|null>} Component metadata or null
 */
export async function getComponent(key) {
  const manifest = await loadManifest();
  const normalizedKey = key.toLowerCase().replace(/\s+/g, '-');
  return manifest[normalizedKey] || null;
}

/**
 * List all available components
 * @returns {Promise<Array>} All components
 */
export async function listAllComponents() {
  const manifest = await loadManifest();
  return Object.entries(manifest).map(([key, component]) => ({
    key,
    name: component.name,
    package: component.package,
  }));
}

/**
 * Generate installation command for a component
 * @param {string} packageName - The @zag-js package name
 * @returns {string} Installation command
 */
export function getInstallCommand(packageName) {
  return `npm install ${packageName}`;
}
