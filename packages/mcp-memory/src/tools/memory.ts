/**
 * MCP Memory Tools
 *
 * Implements three tools for agent memory management:
 * - search_memory: Retrieve relevant knowledge
 * - propose_memory_write: Submit new knowledge
 * - propose_memory_update: Refine or supersede existing knowledge
 */

import { z } from 'zod';
import type { McpServerType, MemoryStorage, EmbeddingService } from '../types.js';
import {
  SearchQuerySchema,
  CreateEntrySchema,
  UpdateEntrySchema,
  KnowledgeTypeSchema,
  SourceTypeSchema,
} from '../validation.js';
import { computeConfidence } from '../confidence.js';
import { DUPLICATE_THRESHOLD } from '../constants.js';

interface ToolDependencies {
  storage: MemoryStorage;
  embedding: EmbeddingService;
}

export function registerMemoryTools(server: McpServerType, deps: ToolDependencies): void {
  const { storage, embedding } = deps;

  // Tool 1: search_memory
  server.tool(
    'search_memory',
    'Search repository memory for relevant knowledge (facts, decisions, procedures, patterns). Use before starting tasks to retrieve context.',
    {
      query: z.string().describe('Semantic search query describing what knowledge you need'),
      types: z
        .array(KnowledgeTypeSchema)
        .optional()
        .describe('Filter by knowledge types: fact, decision, procedure, pattern'),
      tags: z.array(z.string()).optional().describe('Filter by tags'),
      limit: z
        .number()
        .optional()
        .default(10)
        .describe('Maximum results to return (default: 10, max: 50)'),
      min_confidence: z
        .number()
        .optional()
        .default(0.3)
        .describe('Minimum confidence threshold (0-1, default: 0.3)'),
    },
    async (args): Promise<{ content: Array<{ type: 'text'; text: string }> }> => {
      try {
        const parsed = SearchQuerySchema.parse(args);

        // Generate embedding for query
        const queryEmbedding = await embedding.embed(parsed.query);

        // Search storage
        const response = await storage.search(
          {
            query: parsed.query,
            types: parsed.types,
            tags: parsed.tags,
            limit: parsed.limit,
            minConfidence: parsed.min_confidence,
          },
          queryEmbedding,
        );

        if (response.results.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `No memory entries found matching "${parsed.query}"`,
              },
            ],
          };
        }

        // Format results
        const formattedResults = response.results.map((r, i) => {
          const tagStr = r.tags.length > 0 ? ` [${r.tags.join(', ')}]` : '';
          return `${i + 1}. [${r.type.toUpperCase()}] ${r.title}${tagStr}
   ID: ${r.id}
   Confidence: ${(r.confidence * 100).toFixed(0)}% | Relevance: ${(r.relevanceScore * 100).toFixed(0)}%
   ${r.content}
   Updated: ${r.updatedAt}`;
        });

        return {
          content: [
            {
              type: 'text',
              text: `Found ${response.results.length} of ${response.totalMatches} matching entries:\n\n${formattedResults.join('\n\n---\n\n')}`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [{ type: 'text', text: `Error searching memory: ${message}` }],
        };
      }
    },
  );

  // Tool 2: propose_memory_write
  server.tool(
    'propose_memory_write',
    'Propose new durable knowledge for the repository memory. Server validates and may reject duplicates or low-quality entries.',
    {
      type: KnowledgeTypeSchema.describe(
        'Knowledge type: fact (verifiable info), decision (choice with rationale), procedure (steps), pattern (repeated practice)',
      ),
      title: z.string().describe('Concise title (5-100 characters)'),
      content: z.string().describe('Detailed content (10-5000 characters)'),
      tags: z.array(z.string()).optional().describe('Categorization tags'),
      source: z
        .object({
          type: SourceTypeSchema.describe(
            'Source type: code, discussion, documentation, observation',
          ),
          reference: z.string().optional().describe('File path, URL, or description'),
        })
        .optional()
        .describe('Provenance information'),
      confidence_hint: z
        .number()
        .optional()
        .describe('Your confidence in this knowledge (0-1), server may adjust'),
    },
    async (args): Promise<{ content: Array<{ type: 'text'; text: string }> }> => {
      try {
        const parsed = CreateEntrySchema.parse(args);

        // Generate embedding for content
        const contentForEmbedding = `${parsed.title}\n\n${parsed.content}`;
        const entryEmbedding = await embedding.embed(contentForEmbedding);

        // Check for duplicates
        const similar = await storage.findSimilar(entryEmbedding, DUPLICATE_THRESHOLD, 3);

        if (similar.length > 0 && similar[0].similarity >= DUPLICATE_THRESHOLD) {
          const dup = similar[0];
          return {
            content: [
              {
                type: 'text',
                text: `REJECTED: Duplicate detected

Similar entry exists (${(dup.similarity * 100).toFixed(1)}% similarity):
- ID: ${dup.entry.id}
- Title: ${dup.entry.title}

Suggestion: Use propose_memory_update to refine or supersede the existing entry instead.`,
              },
            ],
          };
        }

        // Compute confidence
        const confidence = computeConfidence({
          type: parsed.type,
          content: parsed.content,
          source: parsed.source,
          confidenceHint: parsed.confidence_hint,
        });

        // Create entry
        const id = await storage.create({
          type: parsed.type,
          title: parsed.title,
          content: parsed.content,
          tags: parsed.tags ?? [],
          source: parsed.source,
          confidence,
          embedding: entryEmbedding,
        });

        // Format response
        let responseText = `ACCEPTED: Memory entry created

ID: ${id}
Type: ${parsed.type}
Title: ${parsed.title}
Confidence: ${(confidence * 100).toFixed(0)}%`;

        // Note similar entries if any (below duplicate threshold)
        if (similar.length > 0) {
          const similarList = similar
            .map(s => `- ${s.entry.title} (${(s.similarity * 100).toFixed(0)}% similar)`)
            .join('\n');
          responseText += `\n\nNote: Similar entries exist:\n${similarList}`;
        }

        return {
          content: [{ type: 'text', text: responseText }],
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          const issues = error.issues.map(i => `- ${i.path.join('.')}: ${i.message}`).join('\n');
          return {
            content: [
              {
                type: 'text',
                text: `REJECTED: Validation failed\n\n${issues}`,
              },
            ],
          };
        }

        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [{ type: 'text', text: `Error creating memory: ${message}` }],
        };
      }
    },
  );

  // Tool 3: propose_memory_update
  server.tool(
    'propose_memory_update',
    'Propose an update to existing knowledge. Use "refine" to improve in-place, or "supersede" to replace with new version.',
    {
      target_id: z.string().describe('ID of the entry to update'),
      action: z
        .enum(['supersede', 'refine'])
        .describe('supersede: create new entry marking old as replaced | refine: update in-place'),
      title: z
        .string()
        .optional()
        .describe('New title (required for supersede, optional for refine)'),
      content: z.string().describe('Updated content'),
      justification: z.string().describe('Why this update is needed'),
      tags: z.array(z.string()).optional().describe('Updated tags'),
    },
    async (args): Promise<{ content: Array<{ type: 'text'; text: string }> }> => {
      try {
        const parsed = UpdateEntrySchema.parse(args);

        // Get existing entry
        const existing = await storage.getById(parsed.target_id);
        if (!existing) {
          return {
            content: [
              {
                type: 'text',
                text: `REJECTED: Entry not found with ID: ${parsed.target_id}`,
              },
            ],
          };
        }

        if (existing.supersededBy) {
          return {
            content: [
              {
                type: 'text',
                text: `REJECTED: Entry has been superseded by ${existing.supersededBy}. Please target the newer entry.`,
              },
            ],
          };
        }

        // Check if content, title, and tags are actually different
        const tagsEqual =
          parsed.tags === undefined ||
          (existing.tags.length === parsed.tags.length &&
            [...existing.tags].sort().every((t, i) => t === [...parsed.tags!].sort()[i]));
        const contentEqual = existing.content === parsed.content;
        const titleUnchanged = !parsed.title;

        if (contentEqual && titleUnchanged && tagsEqual) {
          return {
            content: [
              {
                type: 'text',
                text: 'REJECTED: Content, title, and tags are identical to existing entry. No update needed.',
              },
            ],
          };
        }

        // Generate new embedding
        const title = parsed.title ?? existing.title;
        const contentForEmbedding = `${title}\n\n${parsed.content}`;
        const newEmbedding = await embedding.embed(contentForEmbedding);

        // Compute new confidence (slightly boost for updates with justification)
        const confidence = Math.min(
          1,
          computeConfidence({
            type: existing.type,
            content: parsed.content,
            source: existing.source,
          }) + 0.05,
        );

        if (parsed.action === 'supersede') {
          if (!parsed.title) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'REJECTED: Title is required for supersede action.',
                },
              ],
            };
          }

          const newId = await storage.supersede(parsed.target_id, {
            type: existing.type,
            title: parsed.title,
            content: parsed.content,
            tags: parsed.tags ?? existing.tags,
            source: existing.source,
            confidence,
            embedding: newEmbedding,
          });

          return {
            content: [
              {
                type: 'text',
                text: `ACCEPTED: Entry superseded

New ID: ${newId}
Superseded ID: ${parsed.target_id}
Title: ${parsed.title}
Confidence: ${(confidence * 100).toFixed(0)}%

Justification recorded: ${parsed.justification}`,
              },
            ],
          };
        } else {
          // Refine action
          await storage.update(parsed.target_id, {
            title: parsed.title,
            content: parsed.content,
            tags: parsed.tags,
            confidence,
            embedding: newEmbedding,
          });

          return {
            content: [
              {
                type: 'text',
                text: `ACCEPTED: Entry refined

ID: ${parsed.target_id}
Version: ${existing.version + 1}
Confidence: ${(confidence * 100).toFixed(0)}%

Justification recorded: ${parsed.justification}`,
              },
            ],
          };
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          const issues = error.issues.map(i => `- ${i.path.join('.')}: ${i.message}`).join('\n');
          return {
            content: [
              {
                type: 'text',
                text: `REJECTED: Validation failed\n\n${issues}`,
              },
            ],
          };
        }

        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [{ type: 'text', text: `Error updating memory: ${message}` }],
        };
      }
    },
  );
}
