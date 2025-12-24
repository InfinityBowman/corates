// Generates a manifest of all available icons from solid-icons
// Parses the index.js files directly since Node can't import JSX
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface IconManifest {
  [library: string]: string[];
}

// All icon set abbreviations in solid-icons
const iconSets: readonly string[] = [
  'ai',
  'bi',
  'bs',
  'cg',
  'fa',
  'fi',
  'hi',
  'im',
  'io',
  'oc',
  'ri',
  'si',
  'tb',
  'ti',
  'vs',
  'wi',
] as const;

async function getIconsFromSet(setAbbr: string): Promise<string[]> {
  try {
    // Read the index.js file and extract function export names
    // (Node can't import JSX files directly)
    const indexPath = path.join(
      __dirname,
      '..',
      '..',
      'web',
      'node_modules',
      'solid-icons',
      setAbbr,
      'index.js',
    );
    const content = await fs.readFile(indexPath, 'utf8');

    // Match: export function IconName(props)
    const exportRegex = /export\s+function\s+([A-Z][a-zA-Z0-9]*)\s*\(/g;
    const icons: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = exportRegex.exec(content)) !== null) {
      icons.push(match[1]);
    }

    return icons;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.warn(`Could not read solid-icons/${setAbbr}: ${errorMessage}`);
    return [];
  }
}

async function main(): Promise<void> {
  const manifest: IconManifest = {};
  let totalIcons = 0;

  for (const setAbbr of iconSets) {
    console.log(`Processing ${setAbbr}...`);
    const icons = await getIconsFromSet(setAbbr);
    manifest[setAbbr] = icons;
    totalIcons += icons.length;
    console.log(`  Found ${icons.length} icons`);
  }

  const outFile = path.join(__dirname, '..', 'icon-manifest.json');
  await fs.writeFile(outFile, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`\nTotal: ${totalIcons} icons`);
  console.log(`Manifest written to ${outFile}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
