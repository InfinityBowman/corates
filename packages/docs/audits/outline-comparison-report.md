# Codebase Comparison Report: CoRATES vs Outline

## Overview

- **Primary**: CoRATES - Collaborative Research Appraisal Tool for Evidence Synthesis
  - Path: `/Users/jacobmaynard/Documents/Repos/corates`
  - Stack: SolidJS frontend, Cloudflare Workers backend, Drizzle ORM, Better-Auth

- **Reference**: Outline - Fast, collaborative knowledge base
  - Path: `/Users/jacobmaynard/Documents/Repos/corates/reference/outline`
  - Stack: React + MobX frontend, Koa backend, Sequelize ORM, Passport auth

- **Focus**: Architecture patterns, security, error handling, code organization

## Executive Summary

### Key Takeaways

**Outline's Strengths**:
- Mature, production-tested command pattern for complex operations
- Comprehensive policy-based authorization system using cancan
- Rich domain models with extensive business logic encapsulation
- Sophisticated error transformation and normalization
- Well-structured monorepo with clear separation of concerns
- Comprehensive testing coverage with factory patterns

**CoRATES's Strengths**:
- Modern serverless-first architecture optimized for Cloudflare
- Type-safe API layer with OpenAPI integration (Hono + Zod)
- Centralized error domain system with structured error codes
- Lightweight, reactive state management (SolidJS stores)
- Clear separation between frontend and backend concerns

### Critical Differences

| Aspect | CoRATES | Outline |
|--------|---------|---------|
| **Architecture** | Serverless (Workers + DO) | Traditional Node.js server |
| **State Management** | SolidJS createStore | MobX observables + decorators |
| **ORM** | Drizzle (SQL-first) | Sequelize (model-first) |
| **API Style** | OpenAPI/Hono REST | Koa custom RPC-style |
| **Authorization** | Function-based checks | Policy objects (cancan) |
| **Business Logic** | Route handlers + utils | Command pattern + model methods |

---

## 1. Architecture Patterns

### 1.1 Backend Architecture

#### Outline's Approach: Layered Architecture with Commands

**Structure**:
```
server/
├── routes/          - API endpoints (thin controllers)
├── commands/        - Complex multi-model operations
├── models/          - Rich domain models with business logic
├── policies/        - Authorization rules (cancan)
├── presenters/      - Data serialization layer
├── queues/          - Background job processing
├── middlewares/     - Request processing pipeline
└── utils/           - Shared utilities
```

**Example - Document Creation Flow**:
```typescript
// Route handler (thin)
router.post("documents.create", auth(), validate(schema), async (ctx) => {
  const document = await documentCreator(ctx, {
    title: ctx.input.body.title,
    collectionId: ctx.input.body.collectionId,
    // ...
  });

  ctx.body = {
    data: presentDocument(document),
    policies: presentPolicies(ctx.state.auth.user, [document]),
  };
});

// Command (complex business logic)
export default async function documentCreator(
  ctx: APIContext,
  props: Props
): Promise<Document> {
  const { user } = ctx.state.auth;
  const { transaction } = ctx.state;

  // Validation, template processing, state management
  // Multi-table operations, event emission
  // All in one transactional boundary

  return await Document.create({...}, { transaction });
}

// Model (domain logic)
class Document extends ArchivableModel {
  // Instance methods for document-specific operations
  async publish(user: User) { /* ... */ }
  async archive(user: User) { /* ... */ }

  // Hooks for lifecycle events
  @BeforeCreate
  static async setUrlId(model: Document) { /* ... */ }
}
```

**Benefits**:
- Clear separation: routes handle HTTP, commands handle business logic
- Reusable commands can be called from routes, queues, or tests
- Rich models encapsulate domain behavior
- Transaction boundaries are explicit
- Easy to test each layer independently

**Drawbacks**:
- More files and indirection (3+ files per feature)
- Sequelize models can become very large
- Decorator magic can obscure behavior

---

#### CoRATES's Approach: Function-Based with Route Handlers

**Structure**:
```
packages/workers/src/
├── routes/          - API endpoints with business logic
├── middleware/      - Request processing (auth, validation)
├── lib/            - Shared utilities and helpers
├── db/             - Schema and database queries
└── durable-objects/ - Stateful coordination (Yjs sync)
```

**Example - Project Creation Flow**:
```javascript
// Route handler (contains business logic)
const createProjectRoute = createRoute({
  method: 'post',
  path: '/',
  // OpenAPI schema definition
});

projectRoutes.openapi(createProjectRoute, async (c) => {
  const db = createDb(c.env.DB);
  const { user } = getAuth(c);
  const body = c.req.valid('json');

  // Check quota
  await requireQuota(c, 'projects', 1);

  // Create project (direct DB query)
  const [project] = await db.insert(projects).values({
    id: nanoid(),
    name: body.name,
    description: body.description,
    createdBy: user.id,
  }).returning();

  // Sync to Durable Object
  await syncProjectToDO(c.env, project.id, { meta: {...} });

  return c.json({ success: true, projectId: project.id });
});
```

**Benefits**:
- Fewer files, easier to follow the full flow
- Explicit database queries (Drizzle)
- OpenAPI schema co-located with routes
- Optimized for serverless execution
- Type safety from request to response

**Drawbacks**:
- Business logic mixed with HTTP concerns
- Harder to reuse logic across different contexts
- No clear transaction boundary pattern
- Limited model encapsulation

---

### Recommendation: Adopt Command Pattern for Complex Operations

**What to Adopt from Outline**:

1. **Command Functions for Multi-Step Operations**
   ```javascript
   // packages/workers/src/commands/projectCreator.js
   /**
    * Creates a project with all associated setup
    * Handles: validation, quota, DB creation, DO sync, member setup
    */
   export async function createProject(env, user, params) {
     const db = createDb(env.DB);

     // All business logic here, reusable from routes/tests/cron
     await validateProjectQuota(db, user.orgId);

     const project = await db.transaction(async (tx) => {
       const [p] = await tx.insert(projects).values({...}).returning();
       await tx.insert(projectMembers).values({
         projectId: p.id,
         userId: user.id,
         role: 'owner'
       });
       return p;
     });

     await syncProjectToDO(env, project.id, {...});

     return project;
   }
   ```

2. **Keep Routes Thin**
   ```javascript
   projectRoutes.openapi(createProjectRoute, async (c) => {
     const { user } = getAuth(c);
     const body = c.req.valid('json');

     // Just orchestrate, don't implement
     const project = await createProject(c.env, user, body);

     return c.json({ success: true, projectId: project.id });
   });
   ```

**Benefits for CoRATES**:
- Easier testing (test commands without HTTP layer)
- Reusable from cron jobs, webhooks, admin scripts
- Clearer transaction boundaries
- Better separation of concerns

**What to Keep from CoRATES**:
- OpenAPI schema co-location
- Drizzle's explicit query style
- Simpler file structure (don't go overboard with layers)

---

### 1.2 Frontend State Management

#### Outline's Approach: MobX with Rich Domain Models

**Structure**:
```typescript
// Store (collection management)
class DocumentsStore extends Store<Document> {
  @observable
  data: Map<string, Document> = new Map();

  @computed
  get all(): Document[] {
    return filter(this.orderedData, d => !d.archivedAt);
  }

  @action
  async fetch(id: string): Promise<Document> {
    const res = await client.post('/api/documents.info', { id });
    const doc = new Document(res.data, this);
    this.data.set(id, doc);
    return doc;
  }
}

// Model (instance logic)
class Document extends ArchivableModel {
  @Field
  @observable
  title: string;

  @observable
  isSaving = false;

  @computed
  get isStarred(): boolean {
    return !!this.store.rootStore.stars.orderedData.find(
      s => s.documentId === this.id
    );
  }

  @action
  async save(options?: SaveOptions) {
    this.isSaving = true;
    try {
      const res = await client.post('/api/documents.update', {
        id: this.id,
        title: this.title,
        // ...
      });
      set(this, res.data);
    } finally {
      this.isSaving = false;
    }
  }
}
```

**Benefits**:
- Rich models with computed properties and methods
- Automatic reactivity via decorators
- Natural object-oriented patterns
- Easy to traverse relationships (document.collection.team)

**Drawbacks**:
- Decorator overhead and magic
- Tightly coupled to MobX
- Can lead to large model files
- Class-based instead of functional

---

#### CoRATES's Approach: Lightweight Stores with Direct State

**Structure**:
```javascript
// Store (plain functions + createStore)
function createProjectStore() {
  const [store, setStore] = createStore({
    projects: {},
    activeProjectId: null,
    connections: {},
  });

  function setProjectData(projectId, data) {
    setStore(produce(s => {
      if (!s.projects[projectId]) {
        s.projects[projectId] = { meta: {}, members: [], studies: [] };
      }
      if (data.meta) s.projects[projectId].meta = data.meta;
      if (data.studies) s.projects[projectId].studies = data.studies;
    }));
  }

  return { store, setProjectData, getProject, /* ... */ };
}

// Usage in components (direct access)
import { projectStore } from '@/stores/projectStore';

function ProjectView() {
  const project = () => projectStore.getProject(props.projectId);

  return <div>{project()?.meta.name}</div>;
}
```

**Benefits**:
- Simple, functional patterns
- Explicit state updates
- Less magic, easier to debug
- Lightweight (no class instances)
- SolidJS fine-grained reactivity

**Drawbacks**:
- Less structure, can become ad-hoc
- No computed properties (use createMemo in components)
- Repeated patterns across stores

---

### Recommendation: Enhance Store Structure

**What to Adopt from Outline**:

1. **Consistent Store API Pattern**
   ```javascript
   // Base store factory
   function createStoreFactory(name) {
     return {
       create(initialData = {}) {
         const [store, setStore] = createStore({
           data: {},
           loading: false,
           error: null,
           ...initialData
         });

         return {
           // Standard methods every store has
           get(id) { return store.data[id]; },
           getAll() { return Object.values(store.data); },
           set(id, value) { setStore('data', id, value); },
           remove(id) { setStore('data', id, undefined); },
           setLoading(val) { setStore('loading', val); },
           setError(err) { setStore('error', err); },
         };
       }
     };
   }
   ```

2. **Computed Values as Functions**
   ```javascript
   function createProjectStore() {
     const [store, setStore] = createStore({...});

     // Computed-like functions
     const activeProject = () =>
       store.activeProjectId ? store.projects[store.activeProjectId] : null;

     const projectsByOrg = (orgId) =>
       Object.values(store.projects).filter(p => p.orgId === orgId);

     return { store, activeProject, projectsByOrg, /* ... */ };
   }
   ```

**What to Keep from CoRATES**:
- Simple function-based stores (no classes)
- Explicit setters (no decorator magic)
- Direct imports in components (no context/injection overhead)

---

## 2. Security Patterns

### 2.1 Authorization

#### Outline's Approach: Policy-Based Authorization (cancan)

**Structure**:
```typescript
// Policy definition (server/policies/document.ts)
import { allow, can, cannot } from './cancan';

allow(User, 'read', Document, (actor, document) =>
  and(
    isTeamModel(actor, document),
    or(
      includesMembership(document, [
        DocumentPermission.Read,
        DocumentPermission.ReadWrite,
        DocumentPermission.Admin,
      ]),
      and(!!document?.isDraft, actor.id === document?.createdById),
      can(actor, 'readDocument', document?.collection)
    )
  )
);

allow(User, 'update', Document, (actor, document) =>
  and(
    !!document?.isActive,
    isTeamMutable(actor),
    can(actor, 'read', document),
    or(
      includesMembership(document, [DocumentPermission.ReadWrite]),
      can(actor, 'updateDocument', document?.collection)
    )
  )
);

// Usage in routes
import { authorize } from '@server/policies';

router.post('documents.update', auth(), async (ctx) => {
  const document = await Document.findByPk(ctx.input.body.id);
  authorize(ctx.state.auth.user, 'update', document);

  // Proceed with update
});

// Frontend gets policies too
ctx.body = {
  data: presentDocument(document),
  policies: presentPolicies(ctx.state.auth.user, [document]),
};
```

**Benefits**:
- Declarative, centralized authorization logic
- Complex nested conditions are readable
- Reusable across routes, models, frontend
- Type-safe (TypeScript knows actions and resources)
- Easy to audit (all policies in one place)
- Frontend can show/hide UI based on policies

**Drawbacks**:
- Learning curve (cancan DSL)
- Can become complex for deeply nested permissions
- Requires policy computation on every request

---

#### CoRATES's Approach: Inline Authorization Checks

**Structure**:
```javascript
// Inline checks in routes
import { hasRole } from '@/lib/access';

projectRoutes.openapi(updateProjectRoute, async (c) => {
  const db = createDb(c.env.DB);
  const { user } = getAuth(c);
  const { id } = c.req.param();

  // Check membership and role
  const [membership] = await db
    .select()
    .from(projectMembers)
    .where(and(
      eq(projectMembers.projectId, id),
      eq(projectMembers.userId, user.id)
    ))
    .limit(1);

  if (!membership) {
    throw createDomainError(PROJECT_ERRORS.NOT_FOUND);
  }

  if (!EDIT_ROLES.includes(membership.role)) {
    throw createDomainError(AUTH_ERRORS.INSUFFICIENT_PERMISSIONS);
  }

  // Proceed with update
});

// Some reusable helpers
export function hasActiveAccess(subscription) {
  if (!subscription) return false;
  if (subscription.status !== 'active') return false;
  if (!subscription.currentPeriodEnd) return true;
  const now = Math.floor(Date.now() / 1000);
  return subscription.currentPeriodEnd > now;
}
```

**Benefits**:
- Simple, explicit (no magic)
- Easy to understand flow
- No additional framework to learn
- Flexible (can do arbitrary checks)

**Drawbacks**:
- Duplicated authorization logic across routes
- Hard to audit (scattered across files)
- No frontend policy information
- Easy to forget checks
- Difficult to refactor permission rules

---

### Recommendation: Implement Centralized Authorization

**Adopt from Outline**:

1. **Policy Module Pattern** (lighter than cancan)
   ```javascript
   // packages/workers/src/policies/projects.js

   /**
    * Check if user can read project
    */
   export async function canReadProject(db, userId, projectId) {
     const [membership] = await db
       .select()
       .from(projectMembers)
       .where(and(
         eq(projectMembers.projectId, projectId),
         eq(projectMembers.userId, userId)
       ))
       .limit(1);

     return !!membership;
   }

   /**
    * Check if user can edit project
    */
   export async function canEditProject(db, userId, projectId) {
     const [membership] = await db
       .select()
       .from(projectMembers)
       .where(and(
         eq(projectMembers.projectId, projectId),
         eq(projectMembers.userId, userId)
       ))
       .limit(1);

     return membership && EDIT_ROLES.includes(membership.role);
   }

   /**
    * Assert user can perform action on project (throws on failure)
    */
   export async function requireProjectAccess(db, userId, projectId, action = 'read') {
     const canAccess = action === 'edit'
       ? await canEditProject(db, userId, projectId)
       : await canReadProject(db, userId, projectId);

     if (!canAccess) {
       throw createDomainError(
         action === 'edit'
           ? AUTH_ERRORS.INSUFFICIENT_PERMISSIONS
           : PROJECT_ERRORS.NOT_FOUND
       );
     }
   }
   ```

2. **Use in Routes**
   ```javascript
   import { requireProjectAccess } from '@/policies/projects';

   projectRoutes.openapi(updateProjectRoute, async (c) => {
     const db = createDb(c.env.DB);
     const { user } = getAuth(c);
     const { id } = c.req.param();

     // Simple, reusable, auditable
     await requireProjectAccess(db, user.id, id, 'edit');

     // Proceed with update
   });
   ```

3. **Policy Middleware Pattern**
   ```javascript
   // middleware/requireProjectAccess.js
   export function requireProjectAccess(action = 'read') {
     return async (c, next) => {
       const db = createDb(c.env.DB);
       const { user } = getAuth(c);
       const projectId = c.req.param('id') || c.req.valid('json').projectId;

       await requireProjectAccess(db, user.id, projectId, action);

       // Attach to context for use in handler
       c.set('projectId', projectId);

       await next();
     };
   }

   // Usage
   projectRoutes.openapi(
     updateProjectRoute,
     requireProjectAccess('edit'),
     async (c) => {
       // Authorization already done
       const projectId = c.get('projectId');
       // ...
     }
   );
   ```

**Benefits**:
- Centralized, reusable, auditable
- Easy to update permission rules
- Testable in isolation
- Clear separation of concerns
- Can compute policies for frontend

---

### 2.2 Input Validation

#### Outline's Approach: Zod Schemas Co-located with Routes

**Structure**:
```typescript
// server/routes/api/documents/schema.ts
import { z } from 'zod';

export const DocumentsCreateSchema = z.object({
  body: z.object({
    title: z.string().default(''),
    text: z.string().optional(),
    collectionId: z.string().uuid(),
    parentDocumentId: z.string().uuid().optional(),
    template: z.boolean().optional(),
    // ...
  }),
});

// server/routes/api/documents/documents.ts
import validate from '@server/middlewares/validate';
import * as T from './schema';

router.post(
  'documents.create',
  auth(),
  validate(T.DocumentsCreateSchema),
  async (ctx: APIContext<T.DocumentsCreateReq>) => {
    // ctx.input.body is typed and validated
    const { title, collectionId } = ctx.input.body;
    // ...
  }
);
```

**Benefits**:
- Type safety (Zod schema = TypeScript type)
- Co-located with routes (easy to find)
- Reusable schemas
- Clear validation errors

---

#### CoRATES's Approach: Zod + OpenAPI Integration

**Structure**:
```javascript
// Inline schema with OpenAPI metadata
const CreateProjectRequestSchema = z
  .object({
    name: z.string().min(1).max(100).openapi({ example: 'My Project' }),
    description: z.string().max(500).optional(),
  })
  .openapi('CreateProjectRequest');

// Route definition includes schema
const createProjectRoute = createRoute({
  method: 'post',
  path: '/',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateProjectRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: { /* ... */ },
    400: { /* ... */ },
  },
});

// Handler gets validated input
projectRoutes.openapi(createProjectRoute, async (c) => {
  const body = c.req.valid('json'); // Typed and validated
  // ...
});
```

**Benefits**:
- Automatic OpenAPI documentation
- Type safety + API docs from same schema
- Custom validation hook for user-friendly errors

**Drawbacks**:
- More verbose route definitions
- Schema mixed with route config

---

### Recommendation: Keep OpenAPI Integration

**What CoRATES Does Well**:
- OpenAPI schema generation is invaluable for documentation
- Custom validation error handler provides good UX
- Inline schemas work well for simple routes

**What to Adopt from Outline**:
- Extract complex schemas to separate files when routes get large
  ```javascript
  // routes/projects/schemas.js
  export const CreateProjectSchema = z.object({...}).openapi('CreateProject');
  export const UpdateProjectSchema = z.object({...}).openapi('UpdateProject');

  // routes/projects/routes.js
  import * as S from './schemas';
  ```

---

## 3. Error Handling

### 3.1 Backend Error Handling

#### Outline's Approach: Error Transformation Pipeline

**Structure**:
```typescript
// Custom error classes with metadata
export function ValidationError(message = 'Validation error') {
  return httpErrors(400, message, {
    id: 'validation_error',
  });
}

export function NotFoundError(message = 'Not found') {
  return httpErrors(404, message, {
    id: 'not_found',
  });
}

// Middleware transforms errors
export default function apiErrorHandler() {
  return async function(ctx, next) {
    try {
      await next();
    } catch (err) {
      let transformedErr = err;

      // Transform Sequelize errors
      if (err instanceof SequelizeValidationError) {
        transformedErr = ValidationError(
          `${err.errors[0].message} (${err.errors[0].path})`
        );
      }

      if (err instanceof SequelizeEmptyResultError) {
        transformedErr = NotFoundError();
      }

      throw transformedErr;
    }
  };
}
```

**Benefits**:
- Consistent error responses
- Hides implementation details (Sequelize errors become domain errors)
- Error IDs for frontend to handle specific cases

**Drawbacks**:
- Error transformation can obscure root cause
- Lost type information through transformations

---

#### CoRATES's Approach: Structured Error Domains

**Structure**:
```javascript
// Centralized error codes (packages/shared/dist/errors/domains/domain.js)
export const PROJECT_ERRORS = {
  NOT_FOUND: {
    code: 'PROJECT_NOT_FOUND',
    message: 'Project not found',
    statusCode: 404,
  },
  NAME_REQUIRED: {
    code: 'PROJECT_NAME_REQUIRED',
    message: 'Project name is required',
    statusCode: 400,
  },
};

// Error creation helpers
export function createDomainError(errorDef, details = null) {
  return {
    code: errorDef.code,
    message: errorDef.message,
    statusCode: errorDef.statusCode,
    details,
  };
}

// Centralized error handler
export function errorHandler(err, c) {
  console.error(`[${c.req.method}] ${c.req.path}:`, err);

  // Domain errors pass through
  if (isDomainError(err)) {
    return c.json(err, err.statusCode);
  }

  // Zod validation errors
  if (isZodError(err)) {
    const error = createDomainError(SYSTEM_ERRORS.VALIDATION_ERROR, {
      validationErrors: err.errors,
    });
    return c.json(error, error.statusCode);
  }

  // Database-specific errors
  if (err?.message?.includes('UNIQUE constraint failed')) {
    const error = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'unique_constraint_violation',
    });
    return c.json(error, 409);
  }

  // Fallback
  const error = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR);
  return c.json(error, error.statusCode);
}
```

**Benefits**:
- Structured error codes shared between frontend and backend
- Type-safe error handling (errors defined in one place)
- Easy to add new error types
- Frontend can handle specific error codes

**Drawbacks**:
- Requires maintaining error catalog
- Can become large with many error types

---

### Recommendation: CoRATES's Approach is Superior

**Why CoRATES's Error System is Better**:

1. **Shared Error Definitions**: Frontend and backend use the same error codes
2. **Type Safety**: Error codes are defined once, imported everywhere
3. **Structured**: `{ code, message, statusCode, details }` format is consistent
4. **Frontend-Friendly**: Components can handle specific error codes:
   ```javascript
   catch (err) {
     if (err.code === PROJECT_ERRORS.NOT_FOUND.code) {
       navigate('/projects');
     } else if (err.code === AUTH_ERRORS.INSUFFICIENT_PERMISSIONS.code) {
       showToast('You don\'t have permission to do that');
     }
   }
   ```

**What to Improve**:
- Add error codes to OpenAPI schema responses
- Document error codes in API documentation
- Consider error tracking/monitoring integration (Sentry)

---

### 3.2 Frontend Error Handling

#### Outline's Approach: Error Boundary + Logger

**Structure**:
```typescript
class ErrorBoundary extends React.Component {
  @observable error: Error | null;
  @observable isRepeatedError = false;

  componentDidCatch(error: Error) {
    this.error = error;
    this.trackError();

    // Auto-reload on chunk loading errors
    if (
      this.props.reloadOnChunkMissing &&
      error.message.match(/dynamically imported module/) &&
      !this.isRepeatedError
    ) {
      window.location.reload();
      return;
    }

    Logger.error('ErrorBoundary', error);
  }

  private trackError = () => {
    // Track errors in localStorage to prevent infinite reload loops
    const errors = JSON.parse(Storage.get(ERROR_TRACKING_KEY) || '[]');
    const cutoff = Date.now() - ERROR_TRACKING_WINDOW_MS;
    const updatedErrors = [
      ...errors.filter(t => t > cutoff),
      Date.now(),
    ];
    Storage.set(ERROR_TRACKING_KEY, JSON.stringify(updatedErrors));
    this.isRepeatedError = updatedErrors.length > 1;
  };
}
```

**Benefits**:
- Graceful degradation (error UI instead of crash)
- Smart auto-reload for chunk errors (common in SPAs)
- Prevents infinite reload loops
- Centralized error logging

---

#### CoRATES's Approach: Error Boundary + Normalization

**Structure**:
```javascript
function ErrorDisplay(props) {
  const error = props.error;
  const reset = props.reset;

  // Determine error type from structured error
  const isProgrammerError = error?.code === 'UNKNOWN_PROGRAMMER_ERROR';
  const isTransportError = error?.code?.startsWith('TRANSPORT_');

  const title = isProgrammerError ? 'Something went wrong'
    : isTransportError ? 'Connection Error'
    : 'An error occurred';

  return (
    <div class="error-container">
      <h2>{title}</h2>
      <p>{error?.message}</p>
      <button onClick={reset}>Try Again</button>
      <button onClick={() => navigate('/dashboard')}>Go Home</button>
    </div>
  );
}

export default function ErrorBoundary(props) {
  return (
    <SolidErrorBoundary
      fallback={(error, reset) => {
        const normalizedError = normalizeError(error);
        logError(normalizedError);
        return <ErrorDisplay error={normalizedError} reset={reset} />;
      }}
    >
      {props.children}
    </SolidErrorBoundary>
  );
}
```

**Benefits**:
- Error normalization ensures consistent structure
- Domain-aware error messages
- Recovery options (retry or navigate home)

---

### Recommendation: Combine Both Approaches

**Adopt from Outline**:
1. **Chunk Error Auto-Reload** (very useful for SPAs)
   ```javascript
   function ErrorBoundary(props) {
     return (
       <SolidErrorBoundary
         fallback={(error, reset) => {
           const normalizedError = normalizeError(error);

           // Auto-reload on chunk errors (with repeat protection)
           if (isChunkError(error) && !isRepeatedError(error)) {
             trackError(error);
             window.location.reload();
             return null;
           }

           logError(normalizedError);
           return <ErrorDisplay error={normalizedError} reset={reset} />;
         }}
       >
         {props.children}
       </SolidErrorBoundary>
     );
   }
   ```

**Keep from CoRATES**:
- Error normalization for consistent handling
- Structured error display based on error codes

---

## 4. Code Organization

### 4.1 Monorepo Structure

#### Outline's Structure

```
outline/
├── app/              - React frontend
│   ├── actions/      - Reusable actions
│   ├── components/   - UI components
│   ├── hooks/        - Custom hooks
│   ├── models/       - MobX models
│   ├── routes/       - Route definitions
│   ├── scenes/       - Page-level components
│   ├── stores/       - MobX stores
│   └── utils/        - Frontend utilities
├── server/           - Koa backend
│   ├── routes/       - API endpoints
│   ├── commands/     - Business logic
│   ├── models/       - Sequelize models
│   ├── policies/     - Authorization
│   ├── presenters/   - Response formatting
│   ├── queues/       - Background jobs
│   └── utils/        - Backend utilities
├── shared/           - Shared code
│   ├── components/   - Shared React components
│   ├── editor/       - ProseMirror editor
│   ├── styles/       - Design tokens
│   └── utils/        - Shared utilities
└── plugins/          - Plugin system
```

**Benefits**:
- Clear separation of concerns
- Shared code is truly shared
- Plugin system for extensibility

**Drawbacks**:
- Large top-level folders (app, server)
- Can be hard to find related files

---

#### CoRATES's Structure

```
corates/
├── packages/
│   ├── web/          - SolidJS frontend
│   │   ├── src/
│   │   │   ├── components/  - UI components
│   │   │   ├── stores/      - State management
│   │   │   ├── lib/         - Utilities
│   │   │   └── routes/      - Route definitions
│   ├── workers/      - Cloudflare Workers backend
│   │   ├── src/
│   │   │   ├── routes/      - API endpoints
│   │   │   ├── middleware/  - Request processing
│   │   │   ├── lib/         - Utilities
│   │   │   ├── db/          - Schema and queries
│   │   │   └── durable-objects/  - Stateful coordination
│   ├── ui/           - Shared UI components (Ark UI)
│   ├── shared/       - Shared utilities and errors
│   ├── landing/      - Marketing site
│   ├── docs/         - VitePress documentation
│   └── mcp/          - MCP server
└── reference/        - Reference implementations
```

**Benefits**:
- True monorepo with independent packages
- Clear package boundaries
- Can version packages independently
- Easy to extract packages to separate repos

**Drawbacks**:
- Some duplication between packages
- Package interdependencies can be complex

---

### Recommendation: CoRATES's Structure is Better

**Why CoRATES's Monorepo is Superior**:

1. **True Package Separation**: Each package has its own dependencies
2. **Clear Boundaries**: Can't accidentally import backend code in frontend
3. **Independently Deployable**: Workers and web can deploy separately
4. **Scalable**: Easy to add new packages (mobile app, CLI, etc.)

**What to Adopt from Outline**:

1. **Feature-Based Folders in Large Packages**
   ```
   packages/workers/src/
   ├── features/
   │   ├── projects/
   │   │   ├── routes.js
   │   │   ├── policies.js
   │   │   ├── commands.js
   │   │   └── __tests__/
   │   ├── members/
   │   │   ├── routes.js
   │   │   ├── policies.js
   │   │   └── __tests__/
   ```

   This reduces the number of top-level folders and groups related code.

---

### 4.2 Testing Patterns

#### Outline's Testing Approach

**Structure**:
- Tests co-located with source files (`.test.ts` next to `.ts`)
- Factory functions for test data
- Transactional test database

**Example**:
```typescript
// server/test/factories.ts
export async function buildDocument(
  overrides?: Partial<Document>
): Promise<Document> {
  const team = await buildTeam();
  const user = await buildUser({ teamId: team.id });
  const collection = await buildCollection({ teamId: team.id });

  return Document.create({
    title: 'Test Document',
    text: 'Test content',
    userId: user.id,
    teamId: team.id,
    collectionId: collection.id,
    ...overrides,
  });
}

// server/models/Document.test.ts
describe('#delete', () => {
  test('should soft delete and set last modified', async () => {
    const document = await buildDocument();
    const user = await buildUser();
    await document.delete(user);

    const newDocument = await Document.findByPk(document.id, {
      paranoid: false,
    });
    expect(newDocument?.lastModifiedById).toBe(user.id);
    expect(newDocument?.deletedAt).toBeTruthy();
  });
});
```

**Benefits**:
- Factory functions make test data creation easy
- Tests are close to implementation
- Comprehensive model testing

---

#### CoRATES's Testing Approach

**Structure**:
- Tests in `__tests__` folders
- Test helpers in setup files
- Direct database seeding

**Example**:
```javascript
// packages/workers/src/__tests__/projects.test.js
describe('Projects API', () => {
  let env;
  let testUserId;

  beforeEach(async () => {
    env = await setupTestEnv();
    const user = await createTestUser(env.DB);
    testUserId = user.id;
  });

  test('POST /api/projects creates a project', async () => {
    const res = await createTestRequest(env)
      .post('/api/projects')
      .set('Cookie', await getAuthCookie(env, testUserId))
      .send({ name: 'Test Project' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
```

**Benefits**:
- Integration tests cover full request/response cycle
- Realistic testing with actual HTTP

**Drawbacks**:
- Slower than unit tests
- Less coverage of edge cases

---

### Recommendation: Adopt Factory Pattern

**What to Adopt from Outline**:

1. **Factory Functions for Test Data**
   ```javascript
   // packages/workers/src/__tests__/factories.js

   export async function buildProject(db, overrides = {}) {
     const [project] = await db.insert(projects).values({
       id: nanoid(),
       name: 'Test Project',
       description: 'Test description',
       createdBy: await buildUser(db).then(u => u.id),
       ...overrides,
     }).returning();
     return project;
   }

   export async function buildUser(db, overrides = {}) {
     const [user] = await db.insert(user).values({
       id: nanoid(),
       email: `test-${nanoid()}@example.com`,
       name: 'Test User',
       ...overrides,
     }).returning();
     return user;
   }

   export async function buildProjectMember(db, overrides = {}) {
     const project = overrides.projectId
       ? { id: overrides.projectId }
       : await buildProject(db);
     const user = overrides.userId
       ? { id: overrides.userId }
       : await buildUser(db);

     const [member] = await db.insert(projectMembers).values({
       projectId: project.id,
       userId: user.id,
       role: 'editor',
       ...overrides,
     }).returning();
     return member;
   }
   ```

2. **Use in Tests**
   ```javascript
   test('User can only update projects they are a member of', async () => {
     const user1 = await buildUser(db);
     const user2 = await buildUser(db);
     const project = await buildProject(db, { createdBy: user1.id });
     await buildProjectMember(db, { projectId: project.id, userId: user1.id });

     // user2 tries to update user1's project
     const res = await createTestRequest(env)
       .put(`/api/projects/${project.id}`)
       .set('Cookie', await getAuthCookie(env, user2.id))
       .send({ name: 'Hacked!' });

     expect(res.status).toBe(404); // Project not found (due to access check)
   });
   ```

**Benefits**:
- Easy to create test data with specific configurations
- Reduces test setup boilerplate
- More comprehensive test coverage

---

## 5. Implementation Priorities

### High Priority (Do First)

1. **Command Pattern for Complex Operations** (Week 1-2)
   - Extract project creation, member management into command functions
   - Implement transaction pattern for multi-step operations
   - Benefits: Reusability, testability, clearer code

2. **Centralized Authorization Policies** (Week 1-2)
   - Create `packages/workers/src/policies/` directory
   - Implement policy functions for projects, checklists, org access
   - Benefits: Security, maintainability, auditability

3. **Factory Pattern for Tests** (Week 2)
   - Create factory functions in `__tests__/factories.js`
   - Refactor existing tests to use factories
   - Benefits: Faster test writing, better coverage

### Medium Priority (Do Next)

4. **Enhanced Store Structure** (Week 3)
   - Standardize store APIs across all stores
   - Add computed-like functions for derived state
   - Benefits: Consistency, easier maintenance

5. **Error Boundary Improvements** (Week 3)
   - Add chunk error auto-reload
   - Implement error tracking to prevent infinite loops
   - Benefits: Better UX, fewer support tickets

6. **Feature-Based Folder Organization** (Week 4)
   - Reorganize large packages by feature
   - Benefits: Easier to find related code

### Low Priority (Nice to Have)

7. **Presenter Pattern for API Responses** (Future)
   - Separate data serialization from route handlers
   - Benefits: Consistent API responses, easier versioning

8. **Background Job Queue** (Future)
   - Implement for long-running operations (imports, exports)
   - Benefits: Better performance, scalability

9. **Policy Computation for Frontend** (Future)
   - Return what user can do in API responses
   - Benefits: Better UX (show/hide UI elements)

---

## 6. Code Examples

### Example 1: Refactoring Project Creation with Command Pattern

**Before (Current CoRATES)**:
```javascript
// Route handler with all business logic
projectRoutes.openapi(createProjectRoute, async (c) => {
  const db = createDb(c.env.DB);
  const { user } = getAuth(c);
  const body = c.req.valid('json');

  // Check quota
  const [org] = await db.select().from(orgs)
    .where(eq(orgs.id, user.orgId)).limit(1);

  const [{ count: projectCount }] = await db.select({
    count: count()
  }).from(projects).where(eq(projects.orgId, user.orgId));

  const quota = await getQuota(db, user.orgId);
  if (projectCount >= quota.projects) {
    throw createDomainError(PROJECT_ERRORS.QUOTA_EXCEEDED);
  }

  // Create project
  const [project] = await db.insert(projects).values({
    id: nanoid(),
    name: body.name,
    description: body.description,
    createdBy: user.id,
    orgId: user.orgId,
  }).returning();

  // Add creator as owner
  await db.insert(projectMembers).values({
    projectId: project.id,
    userId: user.id,
    role: 'owner',
  });

  // Sync to DO
  await syncProjectToDO(c.env, project.id, {
    meta: { name: project.name, description: project.description },
  });

  return c.json({ success: true, projectId: project.id });
});
```

**After (With Command Pattern)**:
```javascript
// packages/workers/src/commands/projectCreator.js

/**
 * Creates a project with all associated setup
 *
 * @param {Object} env - Cloudflare environment bindings
 * @param {Object} user - Authenticated user
 * @param {Object} params - Project creation parameters
 * @param {string} params.name - Project name
 * @param {string} [params.description] - Project description
 * @returns {Promise<Object>} Created project
 * @throws {DomainError} If quota exceeded or creation fails
 */
export async function createProject(env, user, { name, description }) {
  const db = createDb(env.DB);

  // Check quota
  await requireQuota(db, user.orgId, 'projects', 1);

  // Create project and membership in transaction
  const project = await db.transaction(async (tx) => {
    // Create project
    const [p] = await tx.insert(projects).values({
      id: nanoid(),
      name,
      description,
      createdBy: user.id,
      orgId: user.orgId,
    }).returning();

    // Add creator as owner
    await tx.insert(projectMembers).values({
      projectId: p.id,
      userId: user.id,
      role: 'owner',
      addedAt: new Date(),
    });

    return p;
  });

  // Sync to Durable Object (outside transaction)
  await syncProjectToDO(env, project.id, {
    meta: {
      name: project.name,
      description: project.description,
      createdBy: user.id,
      createdAt: project.createdAt,
    },
  });

  return project;
}

// Route handler (thin)
projectRoutes.openapi(createProjectRoute, async (c) => {
  const { user } = getAuth(c);
  const body = c.req.valid('json');

  const project = await createProject(c.env, user, body);

  return c.json({ success: true, projectId: project.id });
});
```

**Benefits**:
- Route handler is 5 lines instead of 40
- `createProject` can be called from routes, tests, cron jobs, admin scripts
- Transaction boundary is explicit
- Easy to test in isolation
- Business logic is reusable

---

### Example 2: Centralized Authorization

**Before (Current CoRATES)**:
```javascript
// Duplicated in many route handlers
projectRoutes.openapi(updateProjectRoute, async (c) => {
  const db = createDb(c.env.DB);
  const { user } = getAuth(c);
  const { id } = c.req.param();

  // Check membership and role (duplicated everywhere)
  const [membership] = await db.select()
    .from(projectMembers)
    .where(and(
      eq(projectMembers.projectId, id),
      eq(projectMembers.userId, user.id)
    ))
    .limit(1);

  if (!membership) {
    throw createDomainError(PROJECT_ERRORS.NOT_FOUND);
  }

  if (!['owner', 'admin', 'editor'].includes(membership.role)) {
    throw createDomainError(AUTH_ERRORS.INSUFFICIENT_PERMISSIONS);
  }

  // ... update logic
});
```

**After (With Policies)**:
```javascript
// packages/workers/src/policies/projects.js

/**
 * Get user's membership for a project
 */
async function getProjectMembership(db, userId, projectId) {
  const [membership] = await db.select()
    .from(projectMembers)
    .where(and(
      eq(projectMembers.projectId, projectId),
      eq(projectMembers.userId, userId)
    ))
    .limit(1);

  return membership || null;
}

/**
 * Check if user can read project
 */
export async function canReadProject(db, userId, projectId) {
  const membership = await getProjectMembership(db, userId, projectId);
  return !!membership;
}

/**
 * Check if user can edit project
 */
export async function canEditProject(db, userId, projectId) {
  const membership = await getProjectMembership(db, userId, projectId);
  return membership && ['owner', 'admin', 'editor'].includes(membership.role);
}

/**
 * Check if user can manage project (add/remove members, delete)
 */
export async function canManageProject(db, userId, projectId) {
  const membership = await getProjectMembership(db, userId, projectId);
  return membership && ['owner', 'admin'].includes(membership.role);
}

/**
 * Require user can perform action on project
 * Throws appropriate error if not authorized
 */
export async function requireProjectAccess(db, userId, projectId, action = 'read') {
  let canAccess = false;
  let errorDef = PROJECT_ERRORS.NOT_FOUND; // Default: pretend it doesn't exist

  switch (action) {
    case 'read':
      canAccess = await canReadProject(db, userId, projectId);
      break;
    case 'edit':
      canAccess = await canEditProject(db, userId, projectId);
      errorDef = AUTH_ERRORS.INSUFFICIENT_PERMISSIONS;
      break;
    case 'manage':
      canAccess = await canManageProject(db, userId, projectId);
      errorDef = AUTH_ERRORS.INSUFFICIENT_PERMISSIONS;
      break;
    default:
      throw new Error(`Unknown project action: ${action}`);
  }

  if (!canAccess) {
    throw createDomainError(errorDef);
  }
}

// Route handler (clean and simple)
import { requireProjectAccess } from '@/policies/projects';

projectRoutes.openapi(updateProjectRoute, async (c) => {
  const db = createDb(c.env.DB);
  const { user } = getAuth(c);
  const { id } = c.req.param();

  // One line for authorization
  await requireProjectAccess(db, user.id, id, 'edit');

  // ... update logic (no authorization clutter)
});
```

**Benefits**:
- Authorization logic in one place (easy to audit and update)
- Consistent error responses
- Testable in isolation
- Self-documenting (clear what action requires what permission)
- Easy to add new permission checks

---

## Conclusion

### What CoRATES Should Adopt from Outline

1. **Command Pattern** - Separate business logic from HTTP handlers
2. **Centralized Authorization** - Policy functions for consistent security
3. **Factory Pattern for Tests** - Easier test data creation
4. **Error Transformation** - Hide implementation details in errors
5. **Chunk Error Handling** - Auto-reload on code split errors

### What CoRATES Should Keep

1. **OpenAPI Integration** - Automatic API documentation is invaluable
2. **Structured Error System** - Shared error codes between frontend/backend
3. **Monorepo Structure** - True package separation is superior
4. **Lightweight Stores** - Simpler than MobX, works well with SolidJS
5. **Drizzle ORM** - Explicit SQL is better than Sequelize magic

### Final Recommendation

CoRATES has a solid foundation, but can benefit significantly from Outline's patterns around:
- **Business logic organization** (commands)
- **Security** (policies)
- **Testing** (factories)

These changes will make the codebase more maintainable, secure, and easier to extend as the application grows.

The most important improvement is implementing the **command pattern** and **centralized authorization**. These two changes will have the biggest impact on code quality and security.
