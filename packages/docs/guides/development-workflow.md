# Development Workflow Guide

This guide covers getting started, development commands, code organization, and common development tasks.

## Getting Started

### Prerequisites

- **Node.js** v18 or higher
- **pnpm** (package manager) - Install via `npm install -g pnpm`
- **Cloudflare account** (for Workers/D1 development)
- **Git** (for version control)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd corates

# Install dependencies
pnpm install

# Setup local development environment
# See package.json scripts for available commands
```

### Initial Setup

1. **Environment Variables**: Copy `.env.example` to `.env` and fill in required values
2. **Database**: Create local D1 database via Wrangler
3. **Run Migrations**: Apply database migrations
4. **Start Dev Server**: Run `pnpm dev` to start development servers

## Development Commands

### Package Scripts

From the root directory:

```bash
# Development
pnpm dev              # Start all development servers
pnpm dev:web          # Start frontend dev server
pnpm dev:workers      # Start backend dev server
pnpm dev:docs         # Start docs dev server

# Building
pnpm build            # Build all packages
pnpm build:web        # Build frontend
pnpm build:workers    # Build backend
pnpm build:docs       # Build docs

# Testing
pnpm test             # Run all tests
pnpm test:watch       # Run tests in watch mode
pnpm lint             # Lint all packages
pnpm lint:fix         # Lint and fix issues

# Database
pnpm db:migrate       # Run database migrations (local)
pnpm db:generate      # Generate migrations from schema
```

### Package-Specific Commands

Each package has its own scripts in `packages/*/package.json`:

```bash
# From package directory
cd packages/web
pnpm dev              # Start dev server for this package
pnpm build            # Build this package
pnpm test             # Run tests for this package
```

## Code Organization

### File Structure

```
packages/
├── web/              # Frontend application
│   └── src/
│       ├── components/   # UI components
│       ├── stores/       # State management
│       ├── primitives/   # Reusable hooks
│       ├── routes/       # Routes
│       ├── lib/          # Utilities
│       └── config/       # Configuration
├── workers/          # Backend API
│   └── src/
│       ├── routes/       # API routes
│       ├── db/           # Database schema
│       ├── middleware/   # Middleware
│       ├── auth/         # Authentication
│       └── config/       # Configuration
├── ui/               # Shared UI components
└── shared/           # Shared utilities
```

### Naming Conventions

- **Components**: PascalCase (e.g., `ProjectCard.jsx`)
- **Stores**: camelCase with `Store` suffix (e.g., `projectStore.js`)
- **Primitives**: camelCase with `use` prefix (e.g., `useProject.js`)
- **Utilities**: camelCase (e.g., `errorUtils.js`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `API_BASE`)

### Code Comments

Comments should explain **why**, not **what**:

```js
// GOOD - explains why
// Some APIs occasionally return 500s on valid requests. We retry up to 3 times
// before surfacing an error.
retries += 1;

// BAD - narrates what the code does
retries += 1; // Increment retries counter
```

## Git Workflow

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation changes
- `refactor/description` - Code refactoring

### Commit Messages

Follow conventional commits:

```
feat: add project creation form
fix: handle offline state in project store
docs: update API development guide
refactor: simplify error handling
```

### Pull Requests

- Keep PRs focused and small
- Include description of changes
- Reference related issues
- Ensure tests pass
- Update documentation if needed

## Common Development Tasks

### Adding a New API Route

1. Create route file in `packages/workers/src/routes/`
2. Add validation schema in `packages/workers/src/config/validation.js`
3. Add route to main app in `packages/workers/src/index.js`
4. Write tests in `packages/workers/src/routes/__tests__/`
5. Update API documentation if needed

### Adding a New Component

1. Create component file in appropriate directory under `packages/web/src/components/`
2. Use path aliases for imports
3. Follow component patterns (see [Component Guide](/guides/components))
4. Add to barrel export if in a feature directory
5. Write tests if component has complex logic

### Adding a New Store

1. Create store file in `packages/web/src/stores/`
2. Create corresponding actions store if needed
3. Export as singleton
4. Document store structure in comments
5. Use in components via direct imports

### Adding Database Schema Changes

1. Update schema in `packages/workers/src/db/schema.js`
2. Generate migrations: `pnpm db:generate` (creates new migration files)
3. Regenerate test SQL: `pnpm db:generate:test`
4. Run migrations locally: `pnpm db:migrate`
5. Test changes with database operations

### Debugging

#### Frontend Debugging

- Use browser DevTools
- Check SolidJS DevTools extension
- Inspect store state in console
- Use `console.log` for debugging (remove before commit)

#### Backend Debugging

- Use `console.log` in Workers (visible in Wrangler logs)
- Check D1 database via Wrangler CLI
- Use `wrangler tail` for real-time logs
- Test routes with curl or Postman

## Common Issues and Solutions

### Issue: Tests failing with database errors

**Solution:** Ensure database is reset between tests:

```js
beforeEach(async () => {
  await resetTestDatabase();
});
```

### Issue: Import aliases not working

**Solution:** Check `jsconfig.json` paths are correct, restart dev server

### Issue: Durable Object state persisting between tests

**Solution:** This is expected with `isolatedStorage: false`. Reset database instead.

### Issue: CORS errors in development

**Solution:** Check CORS middleware configuration in `packages/workers/src/index.js`

### Issue: Build errors after dependency updates

**Solution:** Clear node_modules and reinstall:

```bash
rm -rf node_modules packages/*/node_modules
pnpm install
```

## Best Practices

### DO

- Run tests before committing
- Lint code before committing
- Write tests for new features
- Update documentation when adding features
- Use TypeScript types/JSDoc for better IDE support
- Follow existing code patterns
- Keep components small and focused
- Use stores for shared state

### DON'T

- Don't commit console.log statements
- Don't skip tests
- Don't ignore linting errors
- Don't prop-drill state (use stores)
- Don't destructure props in SolidJS components
- Don't use raw SQL (use Drizzle ORM)
- Don't create circular dependencies

## Resources

- [Architecture Diagrams](/architecture/) - System architecture
- [Error Handling Guide](/guides/error-handling) - Error handling patterns
- [Style Guide](/guides/style-guide) - UI/UX guidelines

## Related Guides

- [Configuration Guide](/guides/configuration) - Configuration details
- [Testing Guide](/guides/testing) - Testing patterns
- [API Development Guide](/guides/api-development) - Backend development
- [Component Development Guide](/guides/components) - Frontend development
