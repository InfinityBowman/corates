# Complete Review Checklist

Comprehensive checklist organized by file type.

---

## SolidJS Component Checklist

### Props & Reactivity

- [ ] **No prop destructuring** - Function uses `props` parameter, not `{ field1, field2 }`
- [ ] **Props accessed correctly** - Uses `props.field` or `() => props.field`, never destructured
- [ ] **Minimal props** - Component receives 1-5 props maximum
- [ ] **No prop drilling** - Shared state imported from stores, not passed as props
- [ ] **Derived values wrapped** - Complex prop access uses `createMemo` or arrow functions

### Imports

- [ ] **Ark UI from @corates/ui** - Dialog, Select, Toast, Avatar, Tooltip, Collapsible imported correctly
- [ ] **Icons from solid-icons** - Using `solid-icons/fi`, `solid-icons/ai`, etc.
- [ ] **Path aliases used** - Using `@/`, `@components/`, `@primitives/`, not deep relative paths
- [ ] **Stores imported directly** - Not receiving stores via props

### State & Effects

- [ ] **Correct state primitive** - `createSignal` for simple, `createStore` for complex, `createMemo` for derived
- [ ] **Effects have cleanup** - `onCleanup` called for event listeners, timers, subscriptions
- [ ] **No side effects in render** - Side effects in `createEffect` or `onMount`, not inline

### JSX & Styling

- [ ] **No emojis** - No emoji characters anywhere
- [ ] **Conditional rendering** - Using `<Show>` and `<Switch>/<Match>` correctly
- [ ] **List rendering** - Using `<For>` with proper key handling
- [ ] **Event handlers** - Using `onClick={() => handler()}` pattern, not `onClick={handler()}`

### Structure

- [ ] **Single responsibility** - Component does one thing well
- [ ] **Reasonable size** - Under 200 lines, extract if larger
- [ ] **Logic in stores/primitives** - Business logic not in component body

---

## API Route Checklist

### Authentication & Authorization

- [ ] **Auth middleware applied** - `requireAuth` for protected routes
- [ ] **Org membership checked** - `requireOrgMembership()` for org-scoped routes
- [ ] **Write access verified** - `requireOrgWriteAccess()` for mutations
- [ ] **Entitlements checked** - `requireEntitlement()` for feature-gated operations
- [ ] **Quotas enforced** - `requireQuota()` for resource creation

### Validation

- [ ] **Request body validated** - `validateRequest(schema)` middleware for POST/PATCH/PUT
- [ ] **Schema in validation.js** - Schemas defined centrally, not inline
- [ ] **Path params validated** - UUID format checked if needed
- [ ] **Query params sanitized** - Limits enforced, types parsed

### Database Operations

- [ ] **Drizzle ORM used** - No raw SQL queries
- [ ] **Try-catch wrapper** - Database operations wrapped in try-catch
- [ ] **Batch for atomicity** - Related inserts/deletes use `db.batch()`
- [ ] **Errors logged** - `console.error` with operation context

### Error Handling

- [ ] **Domain errors used** - `createDomainError` from `@corates/shared`
- [ ] **Proper status codes** - Using `error.statusCode` from domain error
- [ ] **Context included** - Error metadata includes operation name, IDs
- [ ] **No raw error objects** - Not using `{ error: 'message' }` directly

### Context & Response

- [ ] **Auth via getter** - Using `getAuth(c)` not `c.get('user')`
- [ ] **Org via getter** - Using `getOrgContext(c)` not `c.get('orgId')`
- [ ] **Validated body via context** - Using `c.get('validatedBody')`
- [ ] **Proper response format** - `c.json(data, statusCode)`

### Structure

- [ ] **Route file organization** - Hono instance, middleware, handlers, export
- [ ] **Middleware order correct** - Auth -> Org -> Entitlement -> Quota -> Validation
- [ ] **No business logic in handler** - Complex logic in lib/ or services/

---

## Store Checklist

### State Definition

- [ ] **Correct primitive** - `createSignal` for simple, `createStore` for complex
- [ ] **Initial state defined** - Clear initial values
- [ ] **Singleton pattern** - Store created once and exported

### Mutations

- [ ] **Setter functions exposed** - State changed via functions, not direct access
- [ ] **Produce for nested updates** - Using `produce` from solid-js/store
- [ ] **Immutable patterns** - Not mutating state directly

### Exports

- [ ] **Signals exported as getters** - Exporting `signal` not `signal()`
- [ ] **Clear interface** - Getters and setters clearly named
- [ ] **No internal state leaked** - Internal implementation hidden

---

## General Code Checklist

### No Emojis/Unicode

- [ ] **No emoji in code** - No emoji characters anywhere
- [ ] **No emoji in comments** - Comments are plain text
- [ ] **No emoji in strings** - UI text uses icons, not emojis
- [ ] **No unicode symbols** - No special unicode characters

### Comments

- [ ] **Explain WHY not WHAT** - Comments provide context, not narration
- [ ] **No stale comments** - Comments match current code
- [ ] **No commented-out code** - Dead code removed, not commented
- [ ] **No "removed" markers** - `// removed`, `// deprecated` cleaned up

### Imports

- [ ] **Path aliases used** - `@/`, `@components/`, not `../../../`
- [ ] **No unused imports** - All imports used
- [ ] **Grouped logically** - External, then internal, then relative

### Code Quality

- [ ] **No over-engineering** - No single-use abstractions
- [ ] **No feature flags** - No flags for pre-production code
- [ ] **No backwards compat** - No unused re-exports or renames
- [ ] **Focused functions** - Each function does one thing

---

## File Size Guidelines

| File Type  | Target     | Max | Action if exceeded     |
| ---------- | ---------- | --- | ---------------------- |
| Component  | <150 lines | 200 | Extract sub-components |
| Route file | <200 lines | 300 | Split into sub-routes  |
| Store      | <150 lines | 200 | Split by domain        |
| Utility    | <100 lines | 150 | Split by function      |

---

## Severity Levels

### Critical (Must Fix)

- Prop destructuring (breaks app)
- Missing auth on protected routes (security)
- Emojis (codebase standard)
- Wrong Ark UI imports (build issues)
- Unvalidated request bodies (security)

### Warning (Should Fix)

- Prop drilling (maintainability)
- Too many props (design smell)
- Missing try-catch (error handling)
- Raw error objects (consistency)
- Relative imports (maintainability)

### Suggestion (Nice to Have)

- Comment improvements
- Code organization
- Minor refactoring opportunities
