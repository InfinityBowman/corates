# Database Management Scripts

This directory contains scripts for managing CoRATES databases (local development and production).

## Overview

CoRATES uses Cloudflare D1 (SQLite) for the database. There are two database instances:

- **Local**: `corates-db` - Used for local development
- **Production**: `corates-db-prod` - Used for production deployment

## Available Scripts

All scripts are run from the `packages/workers` directory using pnpm.

### Migration Scripts

#### `db:generate`

Generate new migration files from schema changes.

```bash
pnpm db:generate
```

**When to use:**

- After modifying `src/db/schema.js`
- Before committing schema changes

**What it does:**

- Compares current schema with existing migrations
- Generates new migration file(s) in `migrations/` directory
- Updates migration metadata in `migrations/meta/`

**Important:** Always review generated migration files before applying them.

#### `db:generate:test`

Generate test SQL constant from migration files.

```bash
pnpm db:generate:test
```

**When to use:**

- After running `db:generate` to create new migrations
- When test helpers need updated schema

**What it does:**

- Reads all migration SQL files from `migrations/` directory
- Combines them into a single SQL string
- Writes to `src/__tests__/migration-sql.js` as `MIGRATION_SQL` constant

#### `db:migrate`

Apply migrations to local database.

```bash
pnpm db:migrate
```

**When to use:**

- After generating new migrations
- When setting up local development environment
- After pulling changes that include new migrations

**What it does:**

- Applies all pending migrations to local D1 database (`corates-db`)
- Auto-confirms prompts (uses `y |` prefix)

#### `db:migrate:prod`

Apply migrations to production database.

```bash
pnpm db:migrate:prod
```

**When to use:**

- After deploying new migrations to production
- When production database schema needs updating

**What it does:**

- Applies all pending migrations to production D1 database (`corates-db-prod`)
- Requires Cloudflare authentication and production access

**Warning:** This modifies the production database. Ensure migrations are tested locally first.

#### `db:setup:prod`

Initial setup of production database (alias for `db:migrate:prod`).

```bash
pnpm db:setup:prod
```

**When to use:**

- Initial production database setup
- Same as `db:migrate:prod`

### Reset Scripts

#### `db:reset:prod`

Completely reset production database and redeploy workers.

```bash
pnpm db:reset:prod
```

**When to use:**

- When production database needs to be completely wiped
- During major schema changes that require a fresh start
- For testing production deployments from scratch

**What it does:**

1. Drops all existing tables (in reverse dependency order)
2. Runs all migrations to recreate schema
3. Deploys workers to production

**Warning:** This **destroys all production data**. Use with extreme caution.

**Note:** R2 bucket clearing is currently commented out in the script. Uncomment if needed.

#### `clear-workers`

Clear local Wrangler state and reapply migrations.

```bash
pnpm clear-workers
```

**When to use:**

- When local database state is corrupted
- When Wrangler cache needs clearing
- When starting fresh with local development

**What it does:**

- Deletes `.wrangler/state` directory (clears local D1 database and DO state)
- Runs `db:migrate` to recreate database schema

**Note:** This only affects local development. Production is not affected.

### User Management Scripts

#### `user:make-admin:local`

Promote a user to admin in local database.

```bash
pnpm user:make-admin:local -- --email user@example.com
# Or with environment variable:
ADMIN_EMAIL=user@example.com pnpm user:make-admin:local
```

**Options:**

- `--email, -e`: Email address to promote (required if `ADMIN_EMAIL` not set)
- `--dry-run`: Print SQL without executing

**When to use:**

- Setting up admin access for local development
- Testing admin features locally

#### `user:make-admin:prod`

Promote a user to admin in production database.

```bash
pnpm user:make-admin:prod -- --email user@example.com --yes
```

**Options:**

- `--email, -e`: Email address to promote (required if `ADMIN_EMAIL` not set)
- `--yes, -y`: Required confirmation flag for production changes
- `--dry-run`: Print SQL without executing

**When to use:**

- Promoting users to admin in production
- Recovering admin access

**Warning:** Requires `--yes` flag to prevent accidental production changes.

#### `user:create-orcid:local`

Create a test user with ORCID account in local database.

```bash
pnpm user:create-orcid:local -- --email test@example.com --orcid-id 0000-0001-2345-6789
```

**Options:**

- `--email, -e`: Email address (required)
- `--orcid-id, -o`: ORCID ID in format `0000-0001-2345-6789` (required)
- `--name, -n`: Display name (optional, defaults to email)
- `--dry-run`: Print SQL without executing

**When to use:**

- Testing ORCID authentication locally
- Testing account linking features

## Database Configuration

### Local Database

- **Name**: `corates-db`
- **Location**: `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/`
- **Binding**: `DB` (in `wrangler.jsonc`)
- **Database ID**: `7ac6d425-2a7c-4087-9f42-0cd1a2ab367b`

### Production Database

- **Name**: `corates-db-prod`
- **Location**: Cloudflare D1 (remote)
- **Binding**: `DB` (in `wrangler.jsonc` production env)
- **Database ID**: `bd15994e-1308-41b3-a91c-e30ab6c947da`

## Migration Workflow

### Standard Workflow

1. **Modify schema** in `src/db/schema.js`

2. **Generate migrations:**

   ```bash
   pnpm db:generate
   ```

3. **Review generated migration files** in `migrations/` directory

4. **Generate test SQL:**

   ```bash
   pnpm db:generate:test
   ```

5. **Test locally:**

   ```bash
   pnpm db:migrate
   ```

6. **Run tests:**

   ```bash
   pnpm test
   ```

7. **Deploy to production:**

   ```bash
   pnpm deploy
   ```

8. **Apply migrations to production:**
   ```bash
   pnpm db:migrate:prod
   ```

### Fresh Local Setup

If you need to start with a clean local database:

```bash
pnpm clear-workers
```

This will:

- Clear all local Wrangler state (database, DOs, cache)
- Recreate database with latest migrations

### Production Reset (DANGEROUS)

Only use when you need to completely wipe production:

```bash
pnpm db:reset:prod
```

This will:

- Drop all tables in production
- Recreate schema from migrations
- Redeploy workers

**Warning:** This destroys all production data. There is no recovery.

## Troubleshooting

### Migration fails with "table already exists"

This usually means migrations were partially applied. Options:

1. **Local**: Use `clear-workers` to start fresh
2. **Production**: Check migration status with `wrangler d1 migrations list`

### Database not found

**Local:**

- Run `pnpm dev` at least once to create the local database
- Or run `pnpm db:migrate` to create it

**Production:**

- Ensure you're authenticated with Cloudflare: `wrangler login`
- Verify database exists in Cloudflare dashboard
- Check `wrangler.jsonc` has correct database configuration

### Script fails with authentication error

**Production scripts:**

- Ensure you're logged in: `wrangler login`
- Verify you have access to the production account
- Check Cloudflare API token if using CI/CD

### Wrong database name error

If you see errors about wrong database names:

- Check `wrangler.jsonc` has correct database names
- Local: `corates-db`
- Production: `corates-db-prod`
- Verify script uses correct database name

## Script Files

- `reset-db-prod.mjs` - Production database reset script
- `generate-test-sql.mjs` - Test SQL generation script
- `make-admin-local.mjs` - Local admin promotion script
- `make-admin-prod.mjs` - Production admin promotion script
- `create-test-orcid-user.mjs` - Local ORCID test user creation

## Related Documentation

- [Database Guide](/guides/database) - Comprehensive database documentation
- [Development Workflow](/guides/development-workflow) - Development setup and workflows
- [API Development](/guides/api-development) - Backend API patterns
