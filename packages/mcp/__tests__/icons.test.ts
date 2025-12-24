import { describe, it, expect } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface IconManifest {
  [library: string]: string[];
}

describe('icons tool', () => {
  it('should have icon manifest file', async () => {
    const manifestPath = path.join(__dirname, '..', 'icon-manifest.json');
    const stat = await fs.stat(manifestPath);
    expect(stat.isFile()).toBe(true);
  });

  it('should load valid icon manifest', async () => {
    const manifestPath = path.join(__dirname, '..', 'icon-manifest.json');
    const content = await fs.readFile(manifestPath, 'utf8');
    const manifest = JSON.parse(content) as IconManifest;

    expect(typeof manifest).toBe('object');
    expect(Object.keys(manifest).length).toBeGreaterThan(0);

    // Check structure - each key should have an array of icon names
    for (const [_lib, icons] of Object.entries(manifest)) {
      expect(Array.isArray(icons)).toBe(true);
      expect(icons.length).toBeGreaterThan(0);
      expect(typeof icons[0]).toBe('string');
    }
  });

  it('should have common icon libraries', async () => {
    const manifestPath = path.join(__dirname, '..', 'icon-manifest.json');
    const content = await fs.readFile(manifestPath, 'utf8');
    const manifest = JSON.parse(content) as IconManifest;

    // Check for common libraries
    expect(manifest).toHaveProperty('fa'); // Font Awesome
    expect(manifest).toHaveProperty('bi'); // Bootstrap Icons
  });
});
