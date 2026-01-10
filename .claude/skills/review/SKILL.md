---
name: Review
description: This skill should be used when the user asks to "review code", "check for anti-patterns", "audit my code", "find issues in code", "review this file", "check this component", or mentions code review, linting, or pattern checking. Identifies CoRATES-specific anti-patterns in SolidJS components and Hono API routes.
---

# Code Review for CoRATES

Review code for anti-patterns specific to this codebase.

## Review Process

1. Read the file(s) to review
2. Check against anti-pattern categories below
3. Report issues with file path, line number, and fix
4. Summarize findings by severity

## Report Format

```
## Review: [filename]

### Critical Issues
- **[file:line]** [Issue description]
  - Problem: [What's wrong]
  - Fix: [How to fix]

### Warnings
- **[file:line]** [Issue description]

### Suggestions
- [Optional improvements]

### Summary
- Critical: X issues
- Warnings: Y issues
- Overall: [PASS/NEEDS FIXES]
```

---

## SolidJS Anti-Patterns

### Critical: Prop Destructuring

Breaks reactivity. Props must be accessed via `props.field`.

```javascript
// BAD - breaks reactivity
function Component({ title, items, onSelect }) {
  return <h1>{title}</h1>;
}

// GOOD
function Component(props) {
  return <h1>{props.title}</h1>;
}
```

**Detection:** Function parameters with `{ }` destructuring pattern.

### Critical: Prop Drilling

Shared state should be imported from stores, not passed through props.

```javascript
// BAD - drilling shared state
function Parent() {
  return <Child user={user()} projects={projects()} settings={settings()} />;
}

// GOOD - import stores where needed
import projectStore from '@/stores/projectStore.js';

function Child(props) {
  const projects = () => projectStore.getProjects();
}
```

**Detection:** Components passing 5+ props, or passing stores/auth/global state as props.

### Warning: Too Many Props

Components should receive 1-5 props max (local config only).

**Detection:** More than 5 parameters in component props.

### Critical: Wrong Ark UI Import

Ark UI components must come from `@corates/ui`, not local wrappers.

```javascript
// BAD
import { Dialog } from '@/components/ark/Dialog.jsx';
import { Dialog } from '~/components/Dialog';

// GOOD
import { Dialog, Select, Toast } from '@corates/ui';
```

**Detection:** Ark component names (Dialog, Select, Toast, Avatar, Tooltip, Collapsible) imported from paths other than `@corates/ui`.

### Warning: Missing Cleanup

Effects with event listeners, timers, or subscriptions need `onCleanup`.

```javascript
// BAD
onMount(() => {
  document.addEventListener('click', handler);
});

// GOOD
onMount(() => {
  document.addEventListener('click', handler);
  onCleanup(() => document.removeEventListener('click', handler));
});
```

**Detection:** `addEventListener`, `setInterval`, `setTimeout` without corresponding `onCleanup`.

---

## API Route Anti-Patterns

### Critical: Missing Validation

Request bodies must be validated with Zod via `validateRequest` middleware.

```javascript
// BAD
routes.post('/', async c => {
  const body = await c.req.json();  // Unvalidated!
});

// GOOD
routes.post('/', validateRequest(schema), async c => {
  const data = c.get('validatedBody');
});
```

**Detection:** `c.req.json()` called directly in handler without `validateRequest` middleware.

### Critical: Missing Auth

Protected routes need `requireAuth` middleware.

```javascript
// BAD - no auth
routes.get('/me', async c => { ... });

// GOOD
routes.use('*', requireAuth);
routes.get('/me', async c => { ... });
```

**Detection:** Routes accessing user data without `requireAuth` in middleware chain.

### Warning: Raw Error Returns

Use `createDomainError` from `@corates/shared`, not raw objects.

```javascript
// BAD
return c.json({ error: 'Not found' }, 404);

// GOOD
const error = createDomainError(PROJECT_ERRORS.NOT_FOUND, { projectId });
return c.json(error, error.statusCode);
```

**Detection:** `c.json({ error:` patterns without using `createDomainError`.

### Warning: Missing Try-Catch

Database operations should be wrapped in try-catch with proper error handling.

```javascript
// BAD
const result = await db.select().from(items);
return c.json(result);

// GOOD
try {
  const result = await db.select().from(items);
  return c.json(result);
} catch (error) {
  console.error('Error:', error);
  const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, { operation: 'fetch' });
  return c.json(dbError, dbError.statusCode);
}
```

**Detection:** `db.select/insert/update/delete` calls not within try-catch blocks.

### Warning: Direct Context Access

Use getter functions instead of `c.get()` for standard context.

```javascript
// BAD
const user = c.get('user');

// GOOD
const { user } = getAuth(c);
const { orgId } = getOrgContext(c);
```

**Detection:** `c.get('user')` or `c.get('session')` instead of `getAuth(c)`.

---

## General Anti-Patterns

### Critical: Emojis/Unicode Symbols

Never use emojis or unicode symbols anywhere in code, comments, or strings.

```javascript
// BAD
const status = '✓ Complete';
// Great work! 🎉

// GOOD
const status = 'Complete';
import { FiCheck } from 'solid-icons/fi';
```

**Detection:** Any emoji or unicode symbol characters.

### Warning: Wrong Import Paths

Use path aliases from jsconfig.json.

```javascript
// BAD
import store from '../../../stores/projectStore.js';
import Component from '../../components/Feature/Component.jsx';

// GOOD
import store from '@/stores/projectStore.js';
import Component from '@components/Feature/Component.jsx';
```

**Detection:** Relative imports with `../` that could use `@/`, `@components/`, etc.

### Warning: Narrating Comments

Comments should explain WHY, not WHAT.

```javascript
// BAD - narrates the code
// Increment counter by 1
counter += 1;

// GOOD - explains why
// Rate limit requires tracking failed attempts
counter += 1;
```

**Detection:** Comments that repeat variable/function names or describe obvious operations.

### Warning: Over-Engineering

Avoid unnecessary abstractions, feature flags, and backwards-compat code.

- Single-use helper functions
- Feature flags for non-production code
- Unused re-exports or renamed variables
- `// removed` or `// deprecated` comments for deleted code

**Detection:** Unused exports, single-call functions, compatibility shims.

---

## File-Specific Checks

### Components (packages/web/src/components/)

1. Prop destructuring in function signature
2. Props accessed via `props.field`
3. Stores imported directly (not prop-drilled)
4. Icons from `solid-icons/*`
5. UI components from `@corates/ui`
6. Effects have cleanup when needed
7. No emojis

### API Routes (packages/workers/src/routes/)

1. `requireAuth` applied to protected routes
2. `validateRequest` for POST/PATCH/PUT bodies
3. `createDomainError` for error responses
4. Try-catch around database operations
5. Context accessed via getters (`getAuth`, `getOrgContext`)
6. Schemas defined in config/validation.js

### Stores (packages/web/src/stores/)

1. Exports are signals/functions, not raw values
2. State mutations through setter functions
3. `produce` used for nested store updates

---

## Quick Grep Patterns

Use these to find common issues:

```bash
# Prop destructuring
grep -rn "function.*({.*})" packages/web/src/components/

# Direct c.get('user')
grep -rn "c\.get('user')" packages/workers/src/routes/

# Raw error objects
grep -rn "c\.json({ error:" packages/workers/src/routes/

# Wrong Ark imports
grep -rn "from.*components.*Dialog\|Select\|Toast" packages/web/src/

# Emojis (basic check)
grep -rPn "[\x{1F300}-\x{1F9FF}]" packages/

# Relative imports
grep -rn "from '\.\./\.\./\.\." packages/web/src/components/
```

---

## Additional Resources

### Reference Files

For detailed patterns and edge cases:
- **`references/checklist.md`** - Complete review checklist by file type
- **`references/fixes.md`** - Common fixes with before/after examples
