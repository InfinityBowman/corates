#!/usr/bin/env node
/**
 * Zag.js Documentation Scraper
 * Downloads Solid.js documentation for all Zag components
 * Run with: node scrape-zag.js
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// All Zag.js components with their Solid.js documentation URLs
const components = [
  'accordion',
  'angle-slider',
  'avatar',
  'carousel',
  'checkbox',
  'clipboard',
  'collapsible',
  'color-picker',
  'combobox',
  'context-menu',
  'date-picker',
  'dialog',
  'editable',
  'file-upload',
  'floating-panel',
  'hover-card',
  'image-cropper',
  'listbox',
  'marquee',
  'menu',
  'navigation-menu',
  'nested-menu',
  'number-input',
  'pagination',
  'password-input',
  'pin-input',
  'popover',
  'presence',
  'progress',
  'qr-code',
  'radio-group',
  'range-slider',
  'rating-group',
  'scroll-area',
  'segmented-control',
  'select',
  'signature-pad',
  'slider',
  'splitter',
  'steps',
  'switch',
  'tabs',
  'tags-input',
  'timer',
  'toast',
  'toggle-group',
  'tooltip',
  'tour',
  'tree-view',
];

const BASE_URL = 'https://zagjs.com/components/solid';

/**
 * Extract main content from the Zag.js documentation page HTML
 * Filters to only include Solid.js specific content
 */
function extractContent(html, _componentName) {
  // Remove script tags and their content
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove style tags
  html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove nav, header, footer elements
  html = html.replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, '');
  html = html.replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, '');
  html = html.replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, '');

  // Try to find the main content area
  let content = html;

  // Look for main or article tags
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) {
    content = mainMatch[1];
  } else {
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (articleMatch) {
      content = articleMatch[1];
    }
  }

  // Convert HTML to readable text/markdown
  let text = content
    // Preserve code blocks
    .replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (_, code) => {
      // Decode HTML entities in code
      const decoded = code
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/<[^>]+>/g, ''); // Remove any remaining HTML tags
      return '\n```\n' + decoded.trim() + '\n```\n';
    })
    // Inline code
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, code) => {
      const decoded = code
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/<[^>]+>/g, '');
      return '`' + decoded + '`';
    })
    // Headers
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n')
    // Paragraphs and breaks
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<hr\s*\/?>/gi, '\n---\n')
    // Lists
    .replace(/<ul[^>]*>/gi, '\n')
    .replace(/<\/ul>/gi, '\n')
    .replace(/<ol[^>]*>/gi, '\n')
    .replace(/<\/ol>/gi, '\n')
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
    // Links
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    // Bold and italic
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')
    // Tables - convert to markdown
    .replace(/<table[^>]*>/gi, '\n')
    .replace(/<\/table>/gi, '\n')
    .replace(/<thead[^>]*>/gi, '')
    .replace(/<\/thead>/gi, '')
    .replace(/<tbody[^>]*>/gi, '')
    .replace(/<\/tbody>/gi, '')
    .replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, (_, row) => {
      const cells = [];
      row.replace(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi, (__, cell) => {
        cells.push(cell.replace(/<[^>]+>/g, '').trim());
      });
      return '| ' + cells.join(' | ') + ' |\n';
    })
    // Remove remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode remaining HTML entities
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Clean up whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Filter out non-Solid.js content
  text = filterSolidOnly(text);

  return text;
}

/**
 * Filter the markdown content to only include Solid.js examples
 * Removes React, Vue, and Svelte code blocks and references
 */
function filterSolidOnly(text) {
  // The scraped content has code blocks that aren't properly separated
  // They appear as consecutive code with "Copy" between them
  // We need to identify and remove React/Vue/Svelte blocks

  // Split by "Copy" which appears after each code block
  let parts = text.split(/\nCopy\n?/);

  // Filter parts to only keep Solid.js or framework-agnostic code
  const filteredParts = [];

  for (const part of parts) {
    // Check if this part contains framework-specific code
    const isReact =
      part.includes('@zag-js/react') ||
      part.includes('from "react"') ||
      part.includes("from 'react'") ||
      (part.includes('useMachine(') &&
        part.includes('normalizeProps)') &&
        !part.includes('createMemo')) ||
      part.includes('import { useState }');

    const isVue =
      part.includes('@zag-js/vue') ||
      part.includes('from "vue"') ||
      part.includes("from 'vue'") ||
      part.includes('<script setup') ||
      part.includes('v-bind=') ||
      part.includes('<template>');

    const isSvelte =
      part.includes('@zag-js/svelte') ||
      part.includes('from "svelte"') ||
      part.includes('.svelte') ||
      (part.includes('<script lang="ts">') && part.includes('$derived')) ||
      part.includes('$state(') ||
      part.includes('{#each');

    // Skip this part if it's for another framework
    if (isReact || isVue || isSvelte) {
      continue;
    }

    filteredParts.push(part);
  }

  let result = filteredParts.join('\n');

  // Remove standalone framework labels
  result = result.replace(/\n\s*(React|Vue|Svelte|Solid)\s*\n/g, '\n');

  // Remove "# or" followed by yarn commands for other frameworks
  result = result.replace(/# or\nyarn add @zag-js\/(react|vue|svelte)[^\n]*/g, '');

  // Clean up duplicate empty lines
  result = result.replace(/\n{3,}/g, '\n\n');

  // Remove trailing "Copy" that might be left
  result = result.replace(/\nCopy$/gm, '');

  return result.trim();
}

/**
 * Fetch and parse a component's documentation
 */
async function fetchComponentDocs(component) {
  const url = `${BASE_URL}/${component}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const content = extractContent(html, component);

    return {
      name: component,
      url,
      content,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`  Failed to fetch ${component}: ${error.message}`);
    return {
      name: component,
      url,
      content: `Failed to fetch documentation. Visit ${url} for the latest docs.`,
      error: error.message,
      fetchedAt: new Date().toISOString(),
    };
  }
}

/**
 * Get package name for a component
 */
function getPackageName(component) {
  // Most components use their kebab-case name
  // Some exceptions share packages
  const packageMap = {
    'context-menu': 'menu',
    'nested-menu': 'menu',
    'range-slider': 'slider',
  };

  return `@zag-js/${packageMap[component] || component}`;
}

async function main() {
  console.log('Zag.js Documentation Scraper');
  console.log('============================\n');

  const docsDir = path.join(__dirname, 'zag-docs');

  // Create docs directory
  try {
    await fs.mkdir(docsDir, { recursive: true });
  } catch {
    // Directory exists
  }

  const manifest = {};
  let successCount = 0;
  let failCount = 0;

  // Fetch all components (with rate limiting)
  for (let i = 0; i < components.length; i++) {
    const component = components[i];
    console.log(`[${i + 1}/${components.length}] Fetching ${component}...`);

    const docs = await fetchComponentDocs(component);

    // Save individual doc file
    const docPath = path.join(docsDir, `${component}.md`);
    const packageName = getPackageName(component);

    const fileContent = `# ${component
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')}

**Package:** \`${packageName}\`
**Install:** \`npm install ${packageName} @zag-js/solid\`
**Documentation:** ${docs.url}

---

${docs.content}
`;

    await fs.writeFile(docPath, fileContent, 'utf8');

    // Add to manifest
    manifest[component] = {
      name: component
        .split('-')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' '),
      package: packageName,
      url: docs.url,
      docFile: `${component}.md`,
      fetchedAt: docs.fetchedAt,
      hasError: !!docs.error,
    };

    if (docs.error) {
      failCount++;
    } else {
      successCount++;
    }

    // Rate limit: wait 500ms between requests
    if (i < components.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Write manifest
  const manifestPath = path.join(__dirname, 'zag-manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  console.log('\n============================');
  console.log(`Done! ${successCount} succeeded, ${failCount} failed`);
  console.log(`Docs saved to: ${docsDir}`);
  console.log(`Manifest saved to: ${manifestPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
