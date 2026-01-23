# Project Archiving Implementation Plan

## Overview

When users downgrade their subscription, they may have more projects than their new plan allows. This plan implements a project archiving system where users select which projects to archive. Archived projects become read-only (viewable but not editable).

### Key Design Decisions

1. **Per-project archiving** - Users choose which projects to archive (not org-wide)
2. **Read-only, not locked out** - Users can still view archived project data
3. **Yjs-based enforcement** - Disable Y.Doc mutations for archived projects
4. **Server-side enforcement** - Backend rejects mutations as the source of truth
5. **Reversible** - Users can unarchive by upgrading or deleting other projects

---

## Phase 1: Database Schema

### 1.1 Add Archive Fields to Projects Table

**File**: `packages/workers/src/db/schema.ts`

```typescript
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
  // NEW FIELDS
  isArchived: integer('isArchived', { mode: 'boolean' }).default(false).notNull(),
  archivedAt: integer('archivedAt', { mode: 'timestamp' }),
  archivedBy: text('archivedBy').references(() => user.id, { onDelete: 'set null' }),
});
```

### 1.2 Generate Migration

```bash
pnpm --filter workers db:generate
```

---

## Phase 2: Backend API Changes

### 2.1 Archive/Unarchive Endpoints

**File**: `packages/workers/src/routes/orgs/projects.ts`

Add two new endpoints:

```typescript
// POST /api/orgs/:orgId/projects/:projectId/archive
app.post(
  '/:projectId/archive',
  requireAuth,
  requireOrgMembership(),
  requireOrgWriteAccess(),
  requireProjectAccess('owner'),
  async c => {
    const { projectId } = c.req.param();
    const user = c.get('user');
    const db = c.get('db');

    await db
      .update(projects)
      .set({
        isArchived: true,
        archivedAt: new Date(),
        archivedBy: user.id,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId));

    // Disconnect all active Yjs sessions
    await disconnectAllFromProject(c.env, projectId, 'project-archived');

    return c.json({ success: true });
  },
);

// POST /api/orgs/:orgId/projects/:projectId/unarchive
app.post(
  '/:projectId/unarchive',
  requireAuth,
  requireOrgMembership(),
  requireOrgWriteAccess(),
  requireProjectAccess('owner'),
  async c => {
    const { projectId } = c.req.param();
    const db = c.get('db');
    const orgId = c.get('orgId');

    // Check if unarchiving would exceed quota
    const billing = c.get('orgBilling');
    const activeProjects = await db
      .select({ count: count() })
      .from(projects)
      .where(and(eq(projects.orgId, orgId), eq(projects.isArchived, false)))
      .get();

    const projectLimit = billing.quotas['projects.max'];
    if (!isUnlimitedQuota(projectLimit) && activeProjects.count >= projectLimit) {
      throw new ForbiddenError(
        'Cannot unarchive: you have reached your project limit. Upgrade or archive another project first.',
      );
    }

    await db
      .update(projects)
      .set({
        isArchived: false,
        archivedAt: null,
        archivedBy: null,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId));

    return c.json({ success: true });
  },
);
```

### 2.2 Bulk Archive Endpoint (for downgrade flow)

```typescript
// POST /api/orgs/:orgId/projects/bulk-archive
app.post(
  '/bulk-archive',
  requireAuth,
  requireOrgMembership('owner'),
  requireOrgWriteAccess(),
  zValidator(
    'json',
    z.object({
      projectIds: z.array(z.string()).min(1),
    }),
  ),
  async c => {
    const { projectIds } = c.req.valid('json');
    const user = c.get('user');
    const db = c.get('db');
    const orgId = c.get('orgId');

    // Verify all projects belong to this org
    const projectsToArchive = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.orgId, orgId), inArray(projects.id, projectIds), eq(projects.isArchived, false)))
      .all();

    if (projectsToArchive.length !== projectIds.length) {
      throw new BadRequestError('Some projects not found or already archived');
    }

    // Archive all
    await db
      .update(projects)
      .set({
        isArchived: true,
        archivedAt: new Date(),
        archivedBy: user.id,
        updatedAt: new Date(),
      })
      .where(inArray(projects.id, projectIds));

    // Disconnect all Yjs sessions
    for (const project of projectsToArchive) {
      await disconnectAllFromProject(c.env, project.id, 'project-archived');
    }

    return c.json({ success: true, archivedCount: projectsToArchive.length });
  },
);
```

### 2.3 Middleware: Block Mutations on Archived Projects

**File**: `packages/workers/src/middleware/requireActiveProject.ts` (new file)

```typescript
import { createMiddleware } from 'hono/factory';
import { ForbiddenError } from '@corates/shared/errors';

export const requireActiveProject = createMiddleware(async (c, next) => {
  const project = c.get('project');

  if (project?.isArchived) {
    throw new ForbiddenError('This project is archived. Upgrade your plan or unarchive to make changes.');
  }

  return next();
});
```

### 2.4 Update requireProjectAccess to Include isArchived

**File**: `packages/workers/src/middleware/requireOrg.ts` (lines 99-107)

```typescript
// Update the select to include isArchived
projectData = await db
  .select({
    id: projects.id,
    name: projects.name,
    orgId: projects.orgId,
    isArchived: projects.isArchived, // ADD THIS
  })
  .from(projects)
  .where(eq(projects.id, projectId))
  .get();

// Set on context for downstream use
c.set('project', projectData);
```

### 2.5 Apply Middleware to Mutation Routes

Update all project mutation routes to use `requireActiveProject`:

**File**: `packages/workers/src/routes/orgs/projects.ts`

```typescript
// Update project
app.put(
  '/:projectId',
  requireAuth,
  requireOrgMembership(),
  requireOrgWriteAccess(),
  requireProjectAccess('member'),
  requireActiveProject, // ADD THIS
  updateProjectHandler,
);

// Similar for: member routes, invitation routes, PDF routes
```

### 2.6 Update List Projects to Include Archive Status

**File**: `packages/workers/src/routes/orgs/projects.ts` (lines 316-330)

```typescript
// Add isArchived to the select
const userProjects = await db
  .select({
    id: projects.id,
    name: projects.name,
    description: projects.description,
    orgId: projects.orgId,
    createdAt: projects.createdAt,
    isArchived: projects.isArchived, // ADD THIS
    archivedAt: projects.archivedAt, // ADD THIS
    role: projectMembers.role,
  })
  .from(projects);
// ... rest of query
```

### 2.7 Extend Existing `/billing/subscription` Endpoint

Instead of creating a new endpoint, extend the existing `GET /billing/subscription` to include quota status.

**File**: `packages/workers/src/routes/billing/subscription.ts`

Update the subscription route handler to include quota information:

```typescript
// Update the response schema to include quotas
const SubscriptionResponseSchema = z
  .object({
    tier: z.string(),
    status: z.string(),
    tierInfo: z.object({
      name: z.string(),
      description: z.string(),
    }),
    stripeSubscriptionId: z.string().nullable(),
    currentPeriodEnd: z.number().nullable(),
    cancelAtPeriodEnd: z.boolean(),
    accessMode: z.string(),
    source: z.string(),
    // UPDATED: More detailed project info
    quotas: z.object({
      projects: z.object({
        active: z.number(),
        archived: z.number(),
        limit: z.number(),
        isUnlimited: z.boolean(),
        overBy: z.number(),
      }),
      collaborators: z.object({
        used: z.number(),
        limit: z.number(),
        isUnlimited: z.boolean(),
      }),
    }),
    requiresArchiving: z.boolean(),
  })
  .openapi('SubscriptionResponse');

// In the route handler, update the query and response:
billingSubscriptionRoutes.openapi(subscriptionRoute, async c => {
  // ... existing auth and db setup ...

  const orgBilling = await resolveOrgAccess(db, orgId);

  const { projects } = await import('@/db/schema.js');
  const { eq, and, count } = await import('drizzle-orm');
  const { isUnlimitedQuota } = await import('@corates/shared/plans');

  // Count active and archived projects separately
  const [activeProjectsResult] = await db
    .select({ count: count() })
    .from(projects)
    .where(and(eq(projects.orgId, orgId), eq(projects.isArchived, false)));

  const [archivedProjectsResult] = await db
    .select({ count: count() })
    .from(projects)
    .where(and(eq(projects.orgId, orgId), eq(projects.isArchived, true)));

  // Get collaborator count (existing logic from /usage endpoint)
  const [collaboratorCountResult] = await db
    .select({ count: countDistinct(projectMembers.userId) })
    .from(projectMembers)
    .innerJoin(projects, eq(projectMembers.projectId, projects.id))
    .where(eq(projects.orgId, orgId));

  const activeCount = Number(activeProjectsResult?.count ?? 0);
  const archivedCount = Number(archivedProjectsResult?.count ?? 0);
  const collaboratorCount = Number(collaboratorCountResult?.count ?? 0);

  const projectLimit = orgBilling.quotas['projects.max'];
  const collaboratorLimit = orgBilling.quotas['collaborators.org.max'];
  const isOverQuota = !isUnlimitedQuota(projectLimit) && activeCount > projectLimit;

  // ... existing effectivePlan and currentPeriodEnd logic ...

  return c.json({
    tier: orgBilling.effectivePlanId,
    status: orgBilling.subscription?.status || (orgBilling.source === 'free' ? 'inactive' : 'active'),
    tierInfo: {
      name: effectivePlan.name,
      description: `Plan: ${effectivePlan.name}`,
    },
    stripeSubscriptionId: orgBilling.subscription?.id || null,
    currentPeriodEnd,
    cancelAtPeriodEnd: orgBilling.subscription?.cancelAtPeriodEnd || false,
    accessMode: orgBilling.accessMode,
    source: orgBilling.source,
    // NEW: Detailed quota information
    quotas: {
      projects: {
        active: activeCount,
        archived: archivedCount,
        limit: projectLimit,
        isUnlimited: isUnlimitedQuota(projectLimit),
        overBy: isOverQuota ? activeCount - projectLimit : 0,
      },
      collaborators: {
        used: collaboratorCount,
        limit: collaboratorLimit,
        isUnlimited: isUnlimitedQuota(collaboratorLimit),
      },
    },
    requiresArchiving: isOverQuota,
  });
});
```

This consolidates quota checking into the existing endpoint that the billing page already uses.

---

## Phase 3: Yjs Durable Object Changes

### 3.1 Check Archive Status on Connection

**File**: `packages/workers/src/durable-objects/ProjectDoc.ts`

In `handleWebSocket()`, after membership verification (around line 556):

```typescript
// Check if project is archived
const projectData = await db
  .select({ isArchived: projects.isArchived })
  .from(projects)
  .where(eq(projects.id, projectId))
  .get();

// Store archived status in session
this.sessions.set(server, {
  user,
  awarenessClientId: null,
  isArchived: projectData?.isArchived ?? false,
});

// Send archived status to client in initial sync
if (projectData?.isArchived) {
  // Send a custom message to inform client of archived status
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_ARCHIVED_STATUS);
  encoding.writeUint8(encoder, 1); // 1 = archived
  server.send(encoding.toUint8Array(encoder));
}
```

### 3.2 Block Sync Writes for Archived Projects

In the message handler (around line 620):

```typescript
case messageSync: {
  const session = this.sessions.get(server);

  // For archived projects, only allow sync step 1 (state vector request)
  // and sync step 2 responses, but NOT updates
  if (session?.isArchived) {
    const messageType = decoding.readVarUint(decoder);

    // messageYjsSyncStep1 = 0, messageYjsSyncStep2 = 1, messageYjsUpdate = 2
    if (messageType === 2) { // Update message
      // Reject the update - send error and close
      server.close(4003, 'project-archived');
      this.sessions.delete(server);
      return;
    }

    // Reset decoder position for allowed messages
    decoder = decoding.createDecoder(new Uint8Array(message));
    decoding.readVarUint(decoder); // skip message type byte
  }

  // ... rest of sync handling
}
```

### 3.3 Handle Archive Status Change

Add method to update archived status for connected sessions:

```typescript
async updateArchivedStatus(projectId: string, isArchived: boolean) {
  // Update all sessions
  for (const [ws, session] of this.sessions) {
    session.isArchived = isArchived;

    // Notify client
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_ARCHIVED_STATUS);
    encoding.writeUint8(encoder, isArchived ? 1 : 0);
    ws.send(encoding.toUint8Array(encoder));

    // If now archived, close with specific reason
    if (isArchived) {
      ws.close(4003, 'project-archived');
    }
  }
}
```

---

## Phase 4: Frontend Changes

### 4.1 Update Project Store

**File**: `packages/web/src/stores/projectStore.js`

Add archived status to project data structure:

```javascript
// The project list query already includes isArchived from the API
// Just ensure the store preserves it

export function getProject(projectId) {
  const projects = store.projects;
  return projects[projectId];
}

export function isProjectArchived(projectId) {
  const project = getProject(projectId);
  return project?.isArchived ?? false;
}
```

### 4.2 Update Project Context

**File**: `packages/web/src/components/project/ProjectContext.jsx`

```javascript
export function ProjectContextProvider(props) {
  // ... existing code ...

  const isArchived = createMemo(() => {
    const project = projectStore.getProject(props.projectId);
    return project?.isArchived ?? false;
  });

  const value = {
    projectId: () => props.projectId,
    orgId: () => props.orgId,
    userRole,
    isOwner,
    isArchived, // ADD THIS
  };

  return <ProjectContext.Provider value={value}>{props.children}</ProjectContext.Provider>;
}
```

### 4.3 Archive Banner Component

**File**: `packages/web/src/components/project/ArchivedBanner.jsx` (new file)

```jsx
import { useProjectContext } from './ProjectContext';
import { Show } from 'solid-js';
import { FiArchive } from 'solid-icons/fi';

export function ArchivedBanner() {
  const { isArchived, isOwner } = useProjectContext();

  return (
    <Show when={isArchived()}>
      <div class='bg-warning/10 border-warning text-warning-foreground flex items-center gap-3 border-b px-4 py-3'>
        <FiArchive class='h-5 w-5 flex-shrink-0' />
        <div class='flex-1'>
          <p class='font-medium'>This project is archived</p>
          <p class='text-sm opacity-80'>
            You can view all data but cannot make changes.
            {isOwner() && ' Upgrade your plan or unarchive to restore editing.'}
          </p>
        </div>
        <Show when={isOwner()}>
          <button
            class='bg-warning text-warning-foreground hover:bg-warning/90 rounded px-3 py-1.5 text-sm font-medium'
            onClick={() => {
              /* open unarchive modal */
            }}
          >
            Unarchive
          </button>
        </Show>
      </div>
    </Show>
  );
}
```

### 4.4 Update ProjectView

**File**: `packages/web/src/components/project/ProjectView.jsx`

```jsx
import { ArchivedBanner } from './ArchivedBanner';

export function ProjectView() {
  // ... existing code ...

  return (
    <div class='flex h-full flex-col'>
      <ArchivedBanner />
      <ProjectHeader />
      {/* ... rest of component */}
    </div>
  );
}
```

### 4.5 Update ProjectHeader

**File**: `packages/web/src/components/project/ProjectHeader.jsx`

```javascript
const canEdit = createMemo(() => {
  const { isArchived } = useProjectContext();
  if (isArchived()) return false; // ADD THIS CHECK

  const role = userRole();
  return role === 'owner' || role === 'collaborator';
});
```

### 4.6 Update useProject Hook

**File**: `packages/web/src/primitives/useProject/index.js`

Handle archived status from WebSocket:

```javascript
// Add constant for archived message type
const MESSAGE_ARCHIVED_STATUS = 3;

// In WebSocket message handler
provider.on('message', message => {
  const decoder = decoding.createDecoder(message);
  const messageType = decoding.readVarUint(decoder);

  if (messageType === MESSAGE_ARCHIVED_STATUS) {
    const isArchived = decoding.readUint8(decoder) === 1;
    setConnectionState(projectId, { isArchived });

    if (isArchived) {
      // Disable all mutation operations
      connectionEntry.isArchived = true;
    }
  }
});

// Wrap mutation operations
function createStudy(name, description = '', metadata = {}) {
  if (connectionEntry.isArchived) {
    console.warn('Cannot create study: project is archived');
    toast.error('This project is archived and cannot be edited');
    return null;
  }
  // ... existing implementation
}
```

### 4.7 Project Card Updates

**File**: `packages/web/src/components/project/ProjectCard.jsx`

```jsx
export function ProjectCard(props) {
  const project = () => props.project;

  return (
    <div class={cn('bg-card border-border relative rounded-lg border p-4', project().isArchived && 'opacity-60')}>
      <Show when={project().isArchived}>
        <div class='bg-muted text-muted-foreground absolute top-2 right-2 rounded px-2 py-0.5 text-xs'>Archived</div>
      </Show>

      {/* ... rest of card */}
    </div>
  );
}
```

### 4.8 Archive Selection Modal

**File**: `packages/web/src/components/billing/ArchiveProjectsModal.jsx` (new file)

```jsx
import { Dialog } from '@ark-ui/solid';
import { createSignal, For, Show } from 'solid-js';
import { FiArchive, FiCheck } from 'solid-icons/fi';

export function ArchiveProjectsModal(props) {
  const [selectedIds, setSelectedIds] = createSignal(new Set());
  const [isSubmitting, setIsSubmitting] = createSignal(false);

  const requiredCount = () => props.overBy;
  const canSubmit = () => selectedIds().size >= requiredCount();

  const toggleProject = id => {
    const next = new Set(selectedIds());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleArchive = async () => {
    if (!canSubmit()) return;

    setIsSubmitting(true);
    try {
      await api.post(`/orgs/${props.orgId}/projects/bulk-archive`, {
        projectIds: Array.from(selectedIds()),
      });
      props.onComplete();
    } catch (err) {
      toast.error('Failed to archive projects');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Backdrop class='fixed inset-0 bg-black/50' />
      <Dialog.Positioner class='fixed inset-0 flex items-center justify-center'>
        <Dialog.Content class='bg-card w-full max-w-lg rounded-lg p-6 shadow-xl'>
          <Dialog.Title class='text-lg font-semibold'>Archive Projects to Continue</Dialog.Title>
          <Dialog.Description class='text-muted-foreground mt-2'>
            Your plan allows {props.limit} project{props.limit !== 1 ? 's' : ''}, but you have {props.used}. Please
            select {requiredCount()} project
            {requiredCount() !== 1 ? 's' : ''} to archive.
          </Dialog.Description>

          <div class='mt-4 max-h-64 space-y-2 overflow-y-auto'>
            <For each={props.projects}>
              {project => (
                <button
                  class={cn(
                    'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition',
                    selectedIds().has(project.id) ?
                      'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50',
                  )}
                  onClick={() => toggleProject(project.id)}
                >
                  <div
                    class={cn(
                      'flex h-5 w-5 items-center justify-center rounded border',
                      selectedIds().has(project.id) ?
                        'border-primary bg-primary text-primary-foreground'
                      : 'border-muted-foreground',
                    )}
                  >
                    <Show when={selectedIds().has(project.id)}>
                      <FiCheck class='h-3 w-3' />
                    </Show>
                  </div>
                  <div class='flex-1'>
                    <p class='font-medium'>{project.name}</p>
                    <p class='text-muted-foreground text-sm'>{project.studyCount} studies</p>
                  </div>
                </button>
              )}
            </For>
          </div>

          <div class='mt-6 flex justify-end gap-3'>
            <Dialog.CloseTrigger class='btn-secondary'>Cancel</Dialog.CloseTrigger>
            <button
              class='btn-primary flex items-center gap-2'
              disabled={!canSubmit() || isSubmitting()}
              onClick={handleArchive}
            >
              <FiArchive class='h-4 w-4' />
              Archive {selectedIds().size} Project{selectedIds().size !== 1 ? 's' : ''}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
```

### 4.9 App-Level Quota Check (Using Existing Subscription Query)

The frontend likely already has a subscription query for the billing page. Reuse that query to detect over-quota status.

**File**: `packages/web/src/components/layout/AppLayout.jsx`

```jsx
import { useSubscription } from '@/primitives/useSubscription'; // existing hook
import { ArchiveProjectsModal } from '@/components/billing/ArchiveProjectsModal';

export function AppLayout(props) {
  const { orgId } = useOrgContext();
  const subscription = useSubscription(orgId); // existing query to GET /billing/subscription
  const [showArchiveModal, setShowArchiveModal] = createSignal(false);

  // Show modal when over quota (using extended subscription response)
  createEffect(() => {
    if (subscription.data?.requiresArchiving) {
      setShowArchiveModal(true);
    }
  });

  return (
    <>
      {props.children}

      <Show when={subscription.data?.requiresArchiving}>
        <ArchiveProjectsModal
          open={showArchiveModal()}
          onOpenChange={setShowArchiveModal}
          orgId={orgId()}
          used={subscription.data.quotas.projects.active}
          limit={subscription.data.quotas.projects.limit}
          overBy={subscription.data.quotas.projects.overBy}
          projects={/* fetch from projects list */}
          onComplete={() => {
            subscription.refetch();
            setShowArchiveModal(false);
          }}
        />
      </Show>
    </>
  );
}
```

**Note**: No new hook needed - reuse the existing subscription query that the billing page already uses. The extended response now includes `quotas` and `requiresArchiving` fields.

---

## Phase 5: Subscription Webhook Integration

### 5.1 Detect Downgrade in Webhook Handler

**File**: `packages/workers/src/routes/billing/handlers/subscriptionHandlers.ts`

```typescript
export async function handleSubscriptionUpdated(sub: Stripe.Subscription, ctx: WebhookContext): Promise<WebhookResult> {
  const { db } = ctx;

  // Get existing subscription
  const existing = await db.select().from(subscription).where(eq(subscription.stripeSubscriptionId, sub.id)).get();

  if (!existing) {
    return { action: 'subscription_not_found' };
  }

  const newPlan = sub.items.data[0]?.price?.lookup_key;
  const oldPlan = existing.plan;

  // Check if this is a downgrade
  if (newPlan && oldPlan && isPlanDowngrade(oldPlan, newPlan)) {
    // Check if org will be over quota
    const orgId = existing.referenceId;
    const validation = await validatePlanChange(db, orgId, newPlan);

    if (!validation.valid) {
      // Org is over quota - they'll need to archive projects
      // The frontend will detect this via /quota-status endpoint
      // Optionally: send email notification here
      await notifyOrgOverQuota(ctx, orgId, validation.violations);
    }
  }

  // ... rest of existing update logic
}

function isPlanDowngrade(oldPlan: string, newPlan: string): boolean {
  const planOrder = ['free', 'starter_team', 'team', 'unlimited_team'];
  return planOrder.indexOf(newPlan) < planOrder.indexOf(oldPlan);
}
```

---

## Phase 6: Testing Plan

### 6.1 Backend Tests

**File**: `packages/workers/src/routes/orgs/__tests__/project-archive.test.ts`

```typescript
describe('Project Archiving', () => {
  describe('POST /projects/:id/archive', () => {
    it('archives a project', async () => {});
    it('requires project owner role', async () => {});
    it('disconnects Yjs sessions', async () => {});
  });

  describe('POST /projects/:id/unarchive', () => {
    it('unarchives a project', async () => {});
    it('blocks unarchive when over quota', async () => {});
  });

  describe('POST /projects/bulk-archive', () => {
    it('archives multiple projects', async () => {});
    it('validates all projects belong to org', async () => {});
  });

  describe('Mutation blocking', () => {
    it('blocks updates to archived projects', async () => {});
    it('blocks member changes to archived projects', async () => {});
    it('allows reading archived projects', async () => {});
  });
});
```

### 6.2 Frontend Tests

```typescript
describe('Archive UI', () => {
  it('shows archived badge on project cards', () => {});
  it('shows archived banner in project view', () => {});
  it('disables edit controls when archived', () => {});
  it('shows archive selection modal when over quota', () => {});
});
```

### 6.3 E2E Tests

```typescript
describe('Subscription Downgrade Flow', () => {
  it('prompts user to archive when over quota after downgrade', () => {
    // 1. Create org with 5 projects on team plan
    // 2. Simulate downgrade to starter_team (3 projects)
    // 3. Verify archive modal appears
    // 4. Select 2 projects to archive
    // 5. Verify archived projects are read-only
    // 6. Verify active projects still work
  });
});
```

---

## Implementation Order

### Sprint 1: Core Backend

1. Database schema migration
2. Archive/unarchive API endpoints
3. `requireActiveProject` middleware
4. Update `requireProjectAccess` to include `isArchived`
5. Backend tests

### Sprint 2: Yjs Integration

1. ProjectDoc archived status tracking
2. Block sync updates for archived projects
3. Send archived status to clients
4. Handle archive status change for connected sessions

### Sprint 3: Frontend Core

1. Update project store and context
2. Archived banner component
3. Update ProjectHeader canEdit logic
4. Update ProjectCard with archived badge
5. Disable mutations in useProject hook

### Sprint 4: Quota Flow

1. Extend `/billing/subscription` endpoint with quota info
2. Archive selection modal
3. App-level quota check (using existing subscription query)
4. Bulk archive endpoint

### Sprint 5: Polish & Testing

1. E2E tests
2. Email notifications for over-quota
3. Admin dashboard for viewing archived projects
4. Documentation updates

---

## File Change Summary

| File                                                           | Change Type | Description                                             |
| -------------------------------------------------------------- | ----------- | ------------------------------------------------------- |
| `packages/workers/src/db/schema.ts`                            | Modify      | Add `isArchived`, `archivedAt`, `archivedBy` columns    |
| `packages/workers/src/middleware/requireActiveProject.ts`      | New         | Middleware to block mutations on archived projects      |
| `packages/workers/src/middleware/requireOrg.ts`                | Modify      | Include `isArchived` in project select                  |
| `packages/workers/src/routes/orgs/projects.ts`                 | Modify      | Add archive/unarchive endpoints, apply middleware       |
| `packages/workers/src/routes/billing/subscription.ts`          | Modify      | Extend response with `quotas` and `requiresArchiving`   |
| `packages/workers/src/durable-objects/ProjectDoc.ts`           | Modify      | Track archived status, block updates                    |
| `packages/web/src/stores/projectStore.js`                      | Modify      | Add `isProjectArchived` helper                          |
| `packages/web/src/components/project/ProjectContext.jsx`       | Modify      | Add `isArchived` to context                             |
| `packages/web/src/components/project/ArchivedBanner.jsx`       | New         | Banner component for archived projects                  |
| `packages/web/src/components/project/ProjectView.jsx`          | Modify      | Include ArchivedBanner                                  |
| `packages/web/src/components/project/ProjectHeader.jsx`        | Modify      | Check archived in canEdit                               |
| `packages/web/src/components/project/ProjectCard.jsx`          | Modify      | Show archived badge                                     |
| `packages/web/src/components/billing/ArchiveProjectsModal.jsx` | New         | Modal for selecting projects to archive                 |
| `packages/web/src/primitives/useProject/index.js`              | Modify      | Handle archived status, disable mutations               |
| `packages/web/src/components/layout/AppLayout.jsx`             | Modify      | Add quota check using existing subscription query       |

---

## Open Questions

1. **Grace period?** Should there be a grace period (e.g., 7 days) before requiring archiving after downgrade?

2. **Email notifications?** Should we send emails when:
   - Subscription is downgraded and archiving is required?
   - A project is archived?
   - Approaching quota limit?

3. **Admin override?** Should admins be able to:
   - Archive projects on behalf of users?
   - View/access archived projects?
   - Extend grace periods?

4. **Data retention?** How long should archived project data be retained? Forever, or should there be a cleanup policy for very old archived projects?

5. **Export before archive?** Should we prompt users to export their data before archiving?
