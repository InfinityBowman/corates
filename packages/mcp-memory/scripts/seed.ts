#!/usr/bin/env tsx
/**
 * Seed script for initial CoRATES knowledge
 *
 * Run with: pnpm --filter @corates/mcp-memory seed
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { SqliteStorage } from '../src/storage/sqlite.js';
import { LocalEmbeddingService } from '../src/embedding/local.js';
import { computeConfidence } from '../src/confidence.js';
import type { KnowledgeType, SourceType } from '../src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');

interface SeedEntry {
  type: KnowledgeType;
  title: string;
  content: string;
  tags: string[];
  source?: {
    type: SourceType;
    reference?: string;
  };
}

const SEED_DATA: SeedEntry[] = [
  // Facts
  {
    type: 'fact',
    title: 'CoRATES Tech Stack Overview',
    content:
      'CoRATES is built with SolidJS for the frontend, deployed on Cloudflare Workers. It uses D1 (SQLite) for the database, R2 for file storage, and Yjs for real-time collaboration. Authentication is handled by Better-Auth.',
    tags: ['architecture', 'tech-stack'],
    source: { type: 'documentation', reference: 'AGENTS.md' },
  },
  {
    type: 'fact',
    title: 'Package Structure',
    content:
      'The monorepo has packages under packages/: web (SolidJS frontend), workers (Cloudflare Workers backend), landing (marketing site), shared (TypeScript utilities), mcp (MCP server for dev tools), mcp-memory (persistent agent memory), and docs (VitePress documentation).',
    tags: ['architecture', 'packages'],
    source: { type: 'documentation', reference: 'AGENTS.md' },
  },
  {
    type: 'fact',
    title: 'Required Libraries',
    content:
      'All code must use these libraries: Zod for schema validation (backend), Drizzle ORM for all database interactions, Better-Auth for authentication, Ark UI (@ark-ui/solid) for UI components, and solid-icons for icons.',
    tags: ['libraries', 'requirements'],
    source: { type: 'documentation', reference: '.github/copilot-instructions.md' },
  },
  {
    type: 'fact',
    title: 'Database Technology',
    content:
      'CoRATES uses Cloudflare D1 (SQLite) as the database. All database access must go through Drizzle ORM. Manual SQL or direct database access is prohibited. DrizzleKit is used for generating migrations.',
    tags: ['database', 'drizzle'],
    source: { type: 'documentation', reference: 'packages/docs/guides/database.md' },
  },
  {
    type: 'fact',
    title: 'Drizzle D1 Batch Transactions',
    content:
      'Drizzle ORM supports real D1 transactions using the batch API. Use db.batch([...queries]) to execute multiple queries in a single transaction. This is the only way to get atomic transactions on D1. Individual queries outside of batch are not transactional.',
    tags: ['database', 'drizzle', 'transactions'],
    source: { type: 'documentation', reference: 'https://orm.drizzle.team/docs/batch-api' },
  },

  // Decisions
  {
    type: 'decision',
    title: 'SolidJS over React',
    content:
      'SolidJS was chosen over React for its fine-grained reactivity, smaller bundle size, and better performance.',
    tags: ['frontend', 'architecture'],
    source: { type: 'discussion' },
  },
  {
    type: 'fact',
    title: 'Better-Auth for Authentication',
    content:
      'Better-Auth was chosen because it is the best auth solution for TypeScript. It has native Cloudflare Workers support, built-in organization/team features, excellent TypeScript types, and a clean API design.',
    tags: ['auth', 'architecture'],
    source: { type: 'documentation' },
  },
  {
    type: 'decision',
    title: 'Drizzle ORM over Prisma',
    content:
      'Drizzle was chosen over Prisma because Prisma does not support Cloudflare D1. Drizzle has excellent D1 support, TypeScript-first design, and generates efficient SQL.',
    tags: ['database', 'architecture'],
    source: { type: 'discussion' },
  },
  {
    type: 'decision',
    title: 'No Emojis or Unicode Symbols',
    content:
      'Emojis and unicode symbols are prohibited everywhere in the codebase: code, comments, documentation, plan files, commit messages, and examples. For UI icons, use solid-icons library or SVGs only.',
    tags: ['style', 'requirements'],
    source: { type: 'documentation', reference: '.github/copilot-instructions.md' },
  },

  // Procedures
  {
    type: 'procedure',
    title: 'Adding a New API Route',
    content: `To add a new API route:
1. Create a new file in packages/workers/src/routes/
2. Define the route handler with Hono
3. Add Zod schemas for request validation
4. Use Drizzle for any database operations
5. Register the route in the main router (src/index.ts)
6. Add tests in __tests__/ directory`,
    tags: ['api', 'backend', 'howto'],
    source: { type: 'documentation', reference: 'packages/docs/guides/api-development.md' },
  },
  {
    type: 'procedure',
    title: 'Creating Database Migrations',
    content: `To create database migrations:
1. Modify the schema in packages/workers/src/db/schema/
2. Run 'pnpm --filter workers db:generate' to generate migration
3. Review the generated SQL in packages/workers/migrations/
4. Never manually create migration files (0002_xxx.sql, etc.)
5. Only use DrizzleKit for migration generation`,
    tags: ['database', 'migrations', 'howto'],
    source: { type: 'documentation', reference: 'packages/docs/guides/database.md' },
  },
  {
    type: 'procedure',
    title: 'Running Tests',
    content: `To run tests:
- All tests: 'turbo test'
- Frontend tests: 'pnpm --filter web test'
- Backend tests: 'pnpm --filter workers test'
- Watch mode: 'pnpm --filter <package> test:watch'
- With coverage: 'pnpm --filter <package> test -- --coverage'`,
    tags: ['testing', 'howto'],
    source: { type: 'documentation', reference: 'packages/docs/guides/testing.md' },
  },

  // Patterns
  {
    type: 'pattern',
    title: 'SolidJS Props - Never Destructure',
    content:
      "Never destructure props in SolidJS components as it breaks reactivity. Access props directly with props.field or wrap in a function: () => props.field. Destructuring creates a one-time snapshot that won't update when props change.",
    tags: ['solidjs', 'reactivity', 'critical'],
    source: { type: 'documentation', reference: '.github/instructions/solidjs.instructions.md' },
  },
  {
    type: 'pattern',
    title: 'Store Pattern - No Prop Drilling',
    content:
      'Do not prop-drill application state. Import stores directly where needed. Shared state lives in packages/web/src/stores/. Components should receive at most 1-5 props (local config only, not shared state).',
    tags: ['solidjs', 'state', 'stores'],
    source: { type: 'documentation', reference: '.github/copilot-instructions.md' },
  },
  {
    type: 'pattern',
    title: 'Error Handling with AppError',
    content:
      'All errors should use the AppError class from @corates/shared. Use AppError.from() to wrap unknown errors. Backend routes should return structured error responses with appropriate HTTP status codes.',
    tags: ['errors', 'backend', 'frontend'],
    source: {
      type: 'documentation',
      reference: '.github/instructions/error-handling.instructions.md',
    },
  },
  {
    type: 'pattern',
    title: 'API Route Validation with Zod',
    content:
      'All API routes must validate input using Zod schemas. Define schemas at the top of the route file. Use schema.parse() for required fields and schema.safeParse() when you need to handle errors gracefully.',
    tags: ['api', 'validation', 'zod'],
    source: { type: 'documentation', reference: '.github/instructions/api-routes.instructions.md' },
  },
  {
    type: 'pattern',
    title: 'Component File Organization',
    content:
      'Keep component files small and focused. Each file should handle one coherent responsibility. Extract large files into sub-modules or separate utilities. Group related components in subdirectories with barrel exports (index.ts).',
    tags: ['components', 'organization'],
    source: { type: 'documentation', reference: '.github/copilot-instructions.md' },
  },
];

async function main(): Promise<void> {
  console.log('Initializing storage and embedding service...');

  const storage = new SqliteStorage(repoRoot);
  await storage.initialize();

  const embedding = new LocalEmbeddingService();
  console.log('Loading embedding model (first run may download ~50MB)...');
  await embedding.initialize();

  console.log(`\nSeeding ${SEED_DATA.length} knowledge entries...\n`);

  let created = 0;
  let skipped = 0;

  for (const entry of SEED_DATA) {
    // Generate embedding
    const contentForEmbedding = `${entry.title}\n\n${entry.content}`;
    const entryEmbedding = await embedding.embed(contentForEmbedding);

    // Check for existing similar entries
    const similar = await storage.findSimilar(entryEmbedding, 0.9, 1);
    if (similar.length > 0) {
      console.log(`  SKIP: "${entry.title}" (similar to "${similar[0].entry.title}")`);
      skipped++;
      continue;
    }

    // Compute confidence
    const confidence = computeConfidence({
      type: entry.type,
      content: entry.content,
      source: entry.source,
    });

    // Create entry
    const id = await storage.create({
      type: entry.type,
      title: entry.title,
      content: entry.content,
      tags: entry.tags,
      source: entry.source,
      confidence,
      embedding: entryEmbedding,
    });

    console.log(`  ADD: [${entry.type.toUpperCase()}] ${entry.title} (${id.slice(0, 8)}...)`);
    created++;
  }

  await storage.close();

  console.log(`\nSeed complete: ${created} created, ${skipped} skipped`);
}

main().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
