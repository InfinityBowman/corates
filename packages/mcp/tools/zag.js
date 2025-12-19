import { z } from 'zod';
import { CACHE_TTL } from '../constants.js';

const ZAG_DOCS_URL = 'https://zagjs.com/llms-solid.txt';

// Cache for parsed Zag docs
let zagDocsCache = null;
let zagCacheTime = 0;

/**
 * Fetch and parse Zag docs from remote URL
 * Parses into sections by component name from ## Resources sections
 */
async function fetchZagDocs() {
  const now = Date.now();
  if (zagDocsCache && now - zagCacheTime < CACHE_TTL) {
    return zagDocsCache;
  }

  const response = await fetch(ZAG_DOCS_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch Zag docs: ${response.status} ${response.statusText}`);
  }

  const content = await response.text();
  const lines = content.split('\n');

  // Find all '## Resources' lines and their associated component names
  const resourceMarkers = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === '## Resources') {
      // Look ahead for npm link (within next 10 lines)
      for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
        const npmMatch = lines[j].match(/@zag-js\/([a-z-]+)/);
        if (npmMatch && npmMatch[1] !== 'solid' && npmMatch[1] !== 'i') {
          resourceMarkers.push({ lineNum: i, name: npmMatch[1] });
          break;
        }
      }
    }
  }

  const sections = new Map();

  for (let i = 0; i < resourceMarkers.length; i++) {
    const marker = resourceMarkers[i];
    const nextMarker = resourceMarkers[i + 1];

    // Find section start
    let startLine = 0;
    if (i > 0) {
      const prevMarkerLine = resourceMarkers[i - 1].lineNum;
      for (let j = prevMarkerLine + 1; j < marker.lineNum; j++) {
        if (lines[j].trim() === '' && j + 1 < marker.lineNum && lines[j + 1].trim() !== '') {
          const nextNonEmpty = lines[j + 1].trim();
          if (nextNonEmpty && !nextNonEmpty.startsWith('#') && !nextNonEmpty.startsWith('**`')) {
            startLine = j + 1;
          }
        }
      }
      if (startLine === 0) startLine = prevMarkerLine;
    }

    // Find section end
    let endLine = lines.length;
    if (nextMarker) {
      for (let j = nextMarker.lineNum - 1; j > marker.lineNum; j--) {
        if (lines[j].trim() === '' && j - 1 > marker.lineNum) {
            const prevLine = lines[j - 1].trim();
            if (prevLine.startsWith('Description:') || prevLine === '') {
              endLine = j + 1;
              break;
            }
          }
      }
      if (endLine === lines.length) endLine = nextMarker.lineNum;
    }

    const sectionLines = lines.slice(startLine, endLine);
    const sectionContent = sectionLines.join('\n').trim();

    // Only add if not already present (first occurrence wins)
    if (!sections.has(marker.name) && sectionContent) {
      sections.set(marker.name, sectionContent);
    }
  }

  zagDocsCache = { sections };
  zagCacheTime = now;
  return zagDocsCache;
}

/**
 * Generate an index of all Zag component sections
 */
function generateZagIndex(sections) {
  const sortedComponents = [...sections.keys()].toSorted();

  let index = `# Zag.js Documentation Index\n\n`;
  index += `Zag.js is a framework-agnostic toolkit for building accessible UI components. Below are the ${sortedComponents.length} available components.\n\n`;
  index += `## Available Components\n\n`;

  for (const component of sortedComponents) {
    index += `- [${component}](${component})\n`;
  }

  index += `\n---\n\nUse the component name (e.g. "accordion", "dialog", "tooltip") to fetch specific documentation.`;

  return index;
}

export function registerZagTools(server) {
  server.tool(
    'zag_docs',
    'Fetch Zag.js documentation for building accessible UI components with SolidJS. Returns an index of all components when no path is provided, or specific component documentation when a path is given. Use this for accordion, dialog, tooltip, tabs, and all other Zag UI components.',
    {
      path: z
        .string()
        .describe(
          'The component name to fetch (e.g. "accordion", "dialog", "tooltip", "tabs", "menu"). Omit to get the index of all available components.',
        )
        .optional(),
    },
    async ({ path: componentName }) => {
      try {
        const { sections } = await fetchZagDocs();

        if (!componentName) {
          const index = generateZagIndex(sections);
          return { content: [{ type: 'text', text: index }] };
        }

        const normalizedName = componentName.toLowerCase().trim();

        // Exact match
        if (sections.has(normalizedName)) {
          return {
            content: [
              {
                type: 'text',
                text: `# Zag.js: ${normalizedName}\n\n${sections.get(normalizedName)}`,
              },
            ],
          };
        }

        // Partial match
        const matches = [...sections.keys()].filter(
          c => c.includes(normalizedName) || normalizedName.includes(c),
        );

        if (matches.length === 1) {
          return {
            content: [
              { type: 'text', text: `# Zag.js: ${matches[0]}\n\n${sections.get(matches[0])}` },
            ],
          };
        }

        if (matches.length > 1) {
          return {
            content: [
              {
                type: 'text',
                text: `Multiple matches found for "${componentName}":\n\n${matches.map(m => `- ${m}`).join('\n')}\n\nPlease specify the exact component name.`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `No documentation found for "${componentName}". Try fetching the index (omit the path parameter) to see all available components.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error fetching Zag docs: ${error.message}` }],
        };
      }
    },
  );
}
