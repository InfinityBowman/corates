# Database Guide

This guide covers the database schema, Drizzle ORM patterns, migrations, and query patterns in CoRATES.

## Overview

CoRATES uses Cloudflare D1 (SQLite) with Drizzle ORM for type-safe database operations. All database interactions must use Drizzle - raw SQL queries are not allowed.

## Schema Overview

The database schema is defined in `packages/workers/src/db/schema.js` using Drizzle's SQLite schema builder.

### Core Tables

#### Users

```js
export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('emailVerified', { mode: 'boolean' }).default(false),
  image: text('image'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  username: text('username').unique(),
  displayName: text('displayName'),
  avatarUrl: text('avatarUrl'),
  role: text('role'), // Better Auth admin/plugin role (e.g. 'user', 'admin')
  persona: text('persona'), // optional: researcher, student, librarian, other
  profileCompletedAt: integer('profileCompletedAt'),
  twoFactorEnabled: integer('twoFactorEnabled', { mode: 'boolean' }).default(false),
  banned: integer('banned', { mode: 'boolean' }).default(false),
  banReason: text('banReason'),
  banExpires: integer('banExpires', { mode: 'timestamp' }),
});
```

#### Organizations (Better Auth Plugin)

Organizations are managed by the Better Auth organization plugin:

```js
export const organization = sqliteTable('organization', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').unique(),
  logo: text('logo'),
  metadata: text('metadata'), // JSON string for additional org data
  createdAt: integer('createdAt', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});
```

#### Organization Members (Better Auth Plugin)

```js
export const member = sqliteTable('member', {
  id: text('id').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  organizationId: text('organizationId')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('member'), // owner, admin, member
  createdAt: integer('createdAt', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});
```

**Org role hierarchy:** `owner > admin > member`

#### Organization Invitations (Better Auth Plugin)

```js
export const invitation = sqliteTable('invitation', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  inviterId: text('inviterId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  organizationId: text('organizationId')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('member'),
  status: text('status').notNull().default('pending'), // pending, accepted, rejected, canceled
  expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});
```

#### Projects

Projects now belong to an organization:

```js
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  orgId: text('orgId')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  createdBy: text('createdBy')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  createdAt: integer('createdAt', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});
```

#### Project Members

```js
export const projectMembers = sqliteTable('project_members', {
  id: text('id').primaryKey(),
  projectId: text('projectId')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  role: text('role').default('member'), // owner, member
  joinedAt: integer('joinedAt', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});
```

**Project role hierarchy:** `owner > member`

#### Project Invitations

Project invitations include org context for combined membership flow:

```js
export const projectInvitations = sqliteTable('project_invitations', {
  id: text('id').primaryKey(),
  orgId: text('orgId')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  projectId: text('projectId')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role').default('member'), // project role to assign
  orgRole: text('orgRole').default('member'), // org role if user isn't already a member
  token: text('token').notNull().unique(),
  invitedBy: text('invitedBy')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
  acceptedAt: integer('acceptedAt', { mode: 'timestamp' }),
  createdAt: integer('createdAt', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});
```

### Table Relationships

- **organizations** ↔ **projects**: One-to-many (orgId)
- **organizations** ↔ **member**: One-to-many (organizationId)
- **users** ↔ **member**: Many-to-many (through member table)
- **users** ↔ **projects**: One-to-many (createdBy)
- **users** ↔ **project_members**: Many-to-many (through projectMembers table)
- **projects** ↔ **project_members**: One-to-many

See the [Organizations Guide](/guides/organizations) for details on how org and project membership interact.

## Drizzle ORM Patterns

### Database Client

Always create DB client from environment:

```js
import { createDb } from '../db/client.js';

async c => {
  const db = createDb(c.env.DB);
  // Use db
};
```

### Query Patterns

#### Select Single Record

```js
import { eq } from 'drizzle-orm';

const project = await db.select().from(projects).where(eq(projects.id, projectId)).get();
```

#### Select Multiple Records

```js
const allProjects = await db.select().from(projects).where(eq(projects.createdBy, userId)).all();
```

#### Select with Joins

```js
import { eq, and } from 'drizzle-orm';

const projectWithMembers = await db
  .select({
    project: projects,
    member: projectMembers,
  })
  .from(projects)
  .innerJoin(projectMembers, eq(projects.id, projectMembers.projectId))
  .where(eq(projects.id, projectId))
  .all();
```

#### Count Records

```js
import { count } from 'drizzle-orm';

const [result] = await db.select({ count: count() }).from(projects).where(eq(projects.createdBy, userId));

const projectCount = result?.count || 0;
```

#### Insert Records

```js
const newProject = await db
  .insert(projects)
  .values({
    id: crypto.randomUUID(),
    name: 'My Project',
    description: 'Project description',
    createdBy: userId,
  })
  .returning()
  .get();
```

#### Update Records

```js
await db
  .update(projects)
  .set({
    name: 'Updated Name',
    updatedAt: new Date(),
  })
  .where(eq(projects.id, projectId));
```

#### Delete Records

```js
await db.delete(projects).where(eq(projects.id, projectId));
```

### Batch Operations

**Always use `db.batch()` for related operations that must be atomic:**

```js
// CORRECT - Atomic operations
const batchOps = [
  db.insert(projects).values({ id, name, createdBy }),
  db.insert(projectMembers).values({ projectId: id, userId, role: 'owner' }),
];
await db.batch(batchOps);

// WRONG - Not atomic
await db.insert(projects).values({ id, name });
await db.insert(projectMembers).values({ projectId: id, userId });
```

Use batch when operations must succeed or fail together. Single independent operations don't need batch.

### Where Conditions

Combine conditions with `and`, `or`:

```js
import { and, or, eq, like } from 'drizzle-orm';

// AND condition
const result = await db
  .select()
  .from(projects)
  .where(and(eq(projects.id, projectId), eq(projects.createdBy, userId)))
  .get();

// OR condition
const results = await db
  .select()
  .from(projects)
  .where(
    or(
      eq(projects.createdBy, userId),
      // User is member via join
    ),
  )
  .all();

// LIKE (string search)
const results = await db
  .select()
  .from(projects)
  .where(like(projects.name, `%${searchTerm}%`))
  .all();
```

## Schema Management

### Architecture: Single Source of Truth

The database schema follows a single source of truth pattern:

```
Drizzle Schema (src/db/schema.js)
    ↓
DrizzleKit generates migrations (migrations/0000_*.sql, 0001_*.sql, etc.)
    ↓
Test SQL Constant (src/__tests__/migration-sql.js) [generated]
```

**Key Principle:** Only the Drizzle schema (`src/db/schema.js`) needs to be maintained manually. Migrations are automatically generated by DrizzleKit.

### Files Overview

#### Source Files (Maintained Manually)

- **`src/db/schema.js`** - Drizzle ORM schema definitions
  - This is the single source of truth
  - All table definitions, columns, relationships, and constraints are defined here

#### Generated Files (Auto-generated)

- **`migrations/0000_*.sql`, `migrations/0001_*.sql`, etc.** - SQL migration files
  - Generated by DrizzleKit using `pnpm db:generate`
  - Each migration file represents a schema change
  - Managed automatically by DrizzleKit's migration system
  - Used by Wrangler to apply migrations to D1 databases
  - **Do not edit manually** - regenerate if needed

- **`migrations/meta/`** - DrizzleKit migration metadata
  - Tracks migration history and snapshots
  - **Do not edit manually**

- **`src/__tests__/migration-sql.js`** - Test SQL constant
  - Generated by `scripts/generate-test-sql.mjs`
  - Exported as `MIGRATION_SQL` constant
  - Used by test helpers for database reset
  - **Do not edit manually** - it will be overwritten

## Migrations

### Migration Process

Migrations are managed by **DrizzleKit**, which automatically generates migration files based on schema changes.

**Do NOT manually edit migration files.** Always update the schema first, then generate migrations.

### Migration Structure

DrizzleKit generates migration files with sequential numbering:

- `migrations/0000_acoustic_power_pack.sql` - Initial migration
- `migrations/0001_*.sql` - Subsequent migrations
- `migrations/meta/` - Migration metadata and snapshots

Each migration file contains SQL statements to apply the schema changes:

```sql
-- Example migration file
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  createdBy TEXT NOT NULL,
  createdAt INTEGER DEFAULT (unixepoch()),
  updatedAt INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (createdBy) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(createdBy);
```

### Migration Workflow

#### Step 1: Update Drizzle Schema

Edit `src/db/schema.js` to add/modify tables, columns, or constraints:

```typescript
export const myTable = sqliteTable('my_table', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  // ... other columns
});
```

#### Step 2: Generate Migrations

Run DrizzleKit to generate migration files:

```bash
pnpm db:generate
```

This will:

- Compare the current schema with existing migrations
- Generate new migration file(s) in `migrations/` directory
- Update migration metadata in `migrations/meta/`

**Review the generated migration files** to ensure they match your intended changes.

#### Step 3: Regenerate Test SQL Constant

After generating migrations:

```bash
pnpm db:generate:test
```

This ensures test helpers use the latest schema by reading all migration files.

#### Step 4: Apply Migration to Database

**Local development:**

```bash
pnpm db:migrate
```

This applies all pending migrations to your local D1 database.

**Production:**

```bash
pnpm db:migrate:prod
```

This applies all pending migrations to your production D1 database.

### Available Scripts

#### Generate Migration SQL from Schema

```bash
pnpm db:generate
```

This runs `drizzle-kit generate` which:

- Reads the Drizzle schema from `src/db/schema.js`
- Compares it with existing migrations
- Generates new migration SQL files in `migrations/` (e.g., `0001_*.sql`)
- Updates migration metadata in `migrations/meta/`

**When to run:** After making any changes to `src/db/schema.js`

#### Generate Test SQL Constant

```bash
pnpm db:generate:test
```

This runs `scripts/generate-test-sql.mjs` which:

- Reads all migration files from `migrations/` directory
- Generates `src/__tests__/migration-sql.js` with the SQL as an exported constant
- Used by test helpers to reset the database schema in tests

**When to run:** After generating new migrations with `pnpm db:generate`

## Indexes

Create indexes for frequently queried columns:

```sql
-- Index on foreign keys
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(projectId);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(userId);

-- Index on searchable fields
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);

-- Unique indexes (enforced by schema)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_email ON user(email);
```

## Common Query Patterns

### Check Existence

```js
const exists = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId)).get();

if (!exists) {
  // Project doesn't exist
}
```

### Pagination

```js
import { desc, limit, offset } from 'drizzle-orm';

const page = 1;
const pageSize = 20;

const results = await db
  .select()
  .from(projects)
  .where(eq(projects.createdBy, userId))
  .orderBy(desc(projects.createdAt))
  .limit(pageSize)
  .offset((page - 1) * pageSize)
  .all();
```

### Update with Current Timestamp

```js
await db
  .update(projects)
  .set({
    name: newName,
    updatedAt: new Date(),
  })
  .where(eq(projects.id, projectId));
```

### Upsert Pattern

```js
// Check if exists, then insert or update
const existing = await db.select().from(projects).where(eq(projects.id, projectId)).get();

if (existing) {
  await db.update(projects).set({ name: newName }).where(eq(projects.id, projectId));
} else {
  await db.insert(projects).values({ id: projectId, name: newName, createdBy: userId });
}
```

## Data Types

### Timestamps

Timestamps are stored as integers (Unix epoch in seconds):

```js
createdAt: integer('createdAt', { mode: 'timestamp' }).default(sql`(unixepoch())`);
```

Convert between Date and integer:

```js
// Store
const now = Math.floor(Date.now() / 1000); // seconds
await db.insert(projects).values({ createdAt: new Date() }); // Drizzle converts

// Read
const project = await db.select().from(projects).get();
const date = project.createdAt; // Date object (if mode: 'timestamp')
```

### Booleans

Booleans stored as integers (0/1):

```js
emailVerified: integer('emailVerified', { mode: 'boolean' }).default(false);
```

Drizzle automatically converts between boolean and integer.

## Test Helpers

Test seed functions use Drizzle ORM and Zod validation:

### Seed Functions

All seed functions (`seedUser`, `seedProject`, `seedProjectMember`, `seedSession`, `seedSubscription`) now:

- Use Drizzle ORM `insert()` operations (no raw SQL)
- Validate inputs with Zod schemas (`src/__tests__/seed-schemas.js`)
- Automatically convert timestamps and handle type transformations

### Example Usage

```javascript
import { seedUser, seedProject } from './helpers.js';

// Timestamps can be Date objects or Unix timestamps (seconds)
await seedUser({
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  createdAt: Math.floor(Date.now() / 1000), // Unix timestamp
  updatedAt: Math.floor(Date.now() / 1000),
  role: 'researcher', // optional, defaults to 'researcher'
  emailVerified: true, // boolean or 0/1
});

await seedProject({
  id: 'project-1',
  name: 'Test Project',
  description: 'A test project',
  createdBy: 'user-1',
  createdAt: Math.floor(Date.now() / 1000),
  updatedAt: Math.floor(Date.now() / 1000),
});
```

### Validation

All seed function parameters are validated using Zod schemas:

- Required fields are enforced
- Email format is validated
- Enums (roles, tiers, statuses) are validated
- Timestamps accept both Date objects and Unix timestamps
- Boolean fields accept both boolean and number (0/1) values

## Configuration

### Drizzle Kit Config

`drizzle.config.ts`:

```typescript
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.js',
  out: './migrations',
});
```

### Dependencies

- **`drizzle-orm`** - ORM for database operations (runtime)
- **`drizzle-kit`** - CLI tool for migrations (dev dependency)

## Best Practices

### DO

- Always use Drizzle ORM queries (never raw SQL)
- Use `db.batch()` for atomic operations
- Create indexes for frequently queried columns
- Use transactions for related operations
- Handle errors gracefully
- Use proper types (text, integer, etc.)
- Always update the schema first - Edit `src/db/schema.js` before generating migrations
- Use DrizzleKit for migrations - Run `pnpm db:generate` to create migration files
- Regenerate test SQL - Run `pnpm db:generate:test` after generating migrations
- Use Drizzle ORM in tests - Seed functions use Drizzle, not raw SQL
- Validate inputs - All seed functions validate with Zod schemas

### DON'T

- Don't use raw SQL queries
- Don't skip batch operations for related writes
- Don't forget indexes on foreign keys
- Don't store timestamps as strings (use integer with timestamp mode)
- Don't forget to handle null/undefined values

## Troubleshooting

### Test SQL is out of sync

If tests fail with schema errors:

```bash
pnpm db:generate:test
```

### Migration SQL doesn't match schema

1. Review `src/db/schema.js` for the intended schema
2. Run `pnpm db:generate` to regenerate migrations from the schema
3. Run `pnpm db:generate:test` to update test helpers

### Seed function validation errors

Check the Zod schema in `src/__tests__/seed-schemas.js`:

- Required fields must be provided
- Enums must match valid values
- Timestamps can be Date objects or Unix timestamps (seconds)

## Related Files

- `src/db/schema.js` - Drizzle schema definitions
- `src/db/client.js` - Drizzle client factory
- `migrations/` - Generated migration SQL files (do not edit manually)
- `migrations/meta/` - DrizzleKit migration metadata (do not edit manually)
- `src/__tests__/helpers.js` - Test utilities and seed functions
- `src/__tests__/seed-schemas.js` - Zod validation schemas for seed functions
- `src/__tests__/migration-sql.js` - Generated test SQL constant (do not edit)
- `scripts/generate-test-sql.mjs` - Script to generate test SQL constant
- `drizzle.config.ts` - DrizzleKit configuration

## Related Guides

- [Organizations Guide](/guides/organizations) - For org model and membership patterns
- [API Development Guide](/guides/api-development) - For database usage in routes
- [Architecture Diagrams](/architecture/diagrams/04-data-model) - For entity relationships
