import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

function assertSafeDocName(doc) {
  if (!doc || typeof doc !== 'string') throw new Error('doc is required');
  if (!/^[A-Za-z0-9._-]+$/.test(doc)) {
    throw new Error('Invalid doc name. Use only letters, numbers, dot, underscore, or dash.');
  }
}

async function listLocalDocsWithLlmsTxt(docsRoot) {
  try {
    const entries = await fs.readdir(docsRoot, { withFileTypes: true });
    const docNames = entries
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .toSorted((a, b) => a.localeCompare(b));

    const results = [];
    for (const name of docNames) {
      const llmsPath = path.join(docsRoot, name, 'llms.txt');
      try {
        await fs.access(llmsPath);
        results.push({ name, llmsPath });
      } catch {
        // ignore folders without llms.txt
      }
    }

    return results;
  } catch {
    return [];
  }
}

export function registerLocalDocsTools(server, docsRoot) {
  server.tool(
    'docs_list',
    'List local documentation sources available under the repo /docs folder (only those with an llms.txt).',
    {},
    async () => {
      const available = await listLocalDocsWithLlmsTxt(docsRoot);

      if (available.length === 0) {
        return {
          content: [{ type: 'text', text: 'No local docs with llms.txt found under /docs.' }],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text:
              'Available local docs (llms.txt):\n\n' +
              available.map(d => `- ${d.name}`).join('\n') +
              '\n\nUse docs_get_llms_txt with one of these names.',
          },
        ],
      };
    },
  );

  server.tool(
    'docs_get_llms_txt',
    'Return the contents of docs/<doc>/llms.txt from this repository (local-only docs).',
    {
      doc: z.string().describe('Docs folder name under /docs (e.g. "solidjs", "hono")'),
    },
    async ({ doc }) => {
      assertSafeDocName(doc);
      const llmsPath = path.join(docsRoot, doc, 'llms.txt');

      const available = await listLocalDocsWithLlmsTxt(docsRoot);
      const isAllowed = available.some(d => d.name === doc);
      if (!isAllowed) {
        const suggestion =
          available.length > 0 ? `\n\nAvailable: ${available.map(d => d.name).join(', ')}` : '';
        return {
          content: [
            { type: 'text', text: `Unknown doc "${doc}" or missing llms.txt.${suggestion}` },
          ],
        };
      }

      const text = await fs.readFile(llmsPath, 'utf8');
      return {
        content: [{ type: 'text', text }],
      };
    },
  );

  // Resource to list local docs
  server.resource('local-docs', 'docs://llms', async () => {
    const available = await listLocalDocsWithLlmsTxt(docsRoot);
    return {
      contents: [
        {
          uri: 'docs://llms',
          mimeType: 'application/json',
          text: JSON.stringify(
            available.map(d => ({ name: d.name })),
            null,
            2,
          ),
        },
      ],
    };
  });
}
