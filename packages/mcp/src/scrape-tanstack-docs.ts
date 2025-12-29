// Generates manifest files for TanStack Router, Start, and Query documentation
// Scrapes GitHub repositories to discover all markdown documentation files
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface GitHubContentItem {
  name: string;
  path: string;
  type: 'file' | 'dir';
  download_url?: string;
}

interface DocsManifest {
  [framework: string]: string[];
}

const GITHUB_API_BASE = 'https://api.github.com/repos';
const ROUTER_REPO = 'TanStack/router';
const QUERY_REPO = 'TanStack/query';
const ROUTER_DOCS_PATH = 'docs/router/framework';
const QUERY_DOCS_PATH = 'docs/framework';

// Rate limiting: GitHub API allows 60 requests/hour unauthenticated
// We'll add delays between requests to be safe
const DELAY_MS = 100;

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchGitHubContents(
  repo: string,
  path: string,
  token?: string,
): Promise<GitHubContentItem[]> {
  const url = `${GITHUB_API_BASE}/${repo}/contents/${path}`;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };

  if (token) {
    headers.Authorization = `token ${token}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    if (response.status === 404) {
      return [];
    }
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  await delay(DELAY_MS);
  return response.json() as Promise<GitHubContentItem[]>;
}

async function findMarkdownFiles(
  repo: string,
  basePath: string,
  framework: string,
  token?: string,
): Promise<string[]> {
  const frameworkPath = `${basePath}/${framework}`;
  const paths: string[] = [];

  async function traverseDirectory(dirPath: string): Promise<void> {
    const items = await fetchGitHubContents(repo, dirPath, token);

    if (items.length === 0) {
      console.warn(`    Warning: No items found at ${dirPath}`);
      return;
    }

    for (const item of items) {
      if (item.type === 'dir') {
        await traverseDirectory(item.path);
      } else if (item.type === 'file' && item.name.endsWith('.md')) {
        // Extract relative path from framework directory
        // e.g., "docs/router/framework/solid/api/router.md" -> "api/router"
        const relativePath = item.path.replace(`${frameworkPath}/`, '').replace(/\.md$/, '');
        paths.push(relativePath);
      }
    }
  }

  await traverseDirectory(frameworkPath);
  return paths.sort();
}

async function scrapeDocs(
  repo: string,
  basePath: string,
  frameworks: string[],
  token?: string,
): Promise<DocsManifest> {
  const manifest: DocsManifest = {};

  for (const framework of frameworks) {
    console.log(`  Scraping ${framework}...`);
    const paths = await findMarkdownFiles(repo, basePath, framework, token);
    manifest[framework] = paths;
    console.log(`    Found ${paths.length} documentation files`);
  }

  return manifest;
}

async function main(): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  const frameworks = ['solid'];

  console.log('Scraping TanStack Router documentation...');
  const routerManifest = await scrapeDocs(ROUTER_REPO, ROUTER_DOCS_PATH, frameworks, token);

  // Also scrape Start integration docs from Router repo
  console.log('Scraping TanStack Start documentation from Router repo...');
  const startManifest = await scrapeDocs(ROUTER_REPO, 'docs/start/framework', frameworks, token);

  // Merge Start integration docs into router manifest with "start/" prefix
  for (const framework of frameworks) {
    const startPaths = startManifest[framework] || [];
    const prefixedPaths = startPaths.map(p => `start/${p}`);
    routerManifest[framework] = [...(routerManifest[framework] || []), ...prefixedPaths].sort();
  }

  console.log('\nScraping TanStack Query documentation...');
  const queryManifest = await scrapeDocs(QUERY_REPO, QUERY_DOCS_PATH, frameworks, token);

  const routerManifestPath = path.join(__dirname, '..', 'tanstack-router-manifest.json');
  const startManifestPath = path.join(__dirname, '..', 'tanstack-start-manifest.json');
  const queryManifestPath = path.join(__dirname, '..', 'tanstack-query-manifest.json');

  await fs.writeFile(routerManifestPath, JSON.stringify(routerManifest, null, 2), 'utf8');
  console.log(`\nRouter manifest written to ${routerManifestPath}`);

  await fs.writeFile(startManifestPath, JSON.stringify(startManifest, null, 2), 'utf8');
  console.log(`Start manifest written to ${startManifestPath}`);

  await fs.writeFile(queryManifestPath, JSON.stringify(queryManifest, null, 2), 'utf8');
  console.log(`Query manifest written to ${queryManifestPath}`);

  const routerTotal = Object.values(routerManifest).reduce((sum, paths) => sum + paths.length, 0);
  const startTotal = Object.values(startManifest).reduce((sum, paths) => sum + paths.length, 0);
  const queryTotal = Object.values(queryManifest).reduce((sum, paths) => sum + paths.length, 0);

  console.log(`\nTotal Router docs: ${routerTotal}`);
  console.log(`Total Start docs: ${startTotal}`);
  console.log(`Total Query docs: ${queryTotal}`);
}

main().catch((err: unknown) => {
  console.error('Error scraping TanStack docs:', err);
  process.exit(1);
});
