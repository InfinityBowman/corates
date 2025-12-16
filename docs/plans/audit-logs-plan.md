# Audit Logs Implementation Plan

## Overview

Corates currently has **no audit logging** - only scattered console logs. This plan outlines adding a comprehensive audit logging system to track user actions, admin operations, and system events.

**Tech Stack Context:**
- Backend: Hono.js on Cloudflare Workers
- Database: Cloudflare D1 (SQLite) with Drizzle ORM
- Auth: Better Auth v1.4.5
- Frontend: SolidJS

---

## 1. Database Schema

Add a new `audit_logs` table to `packages/workers/src/db/schema.js`:

```javascript
export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  timestamp: integer('timestamp').notNull().default(sql`(unixepoch())`),
  actorId: text('actor_id').references(() => user.id, { onDelete: 'set null' }),
  actorType: text('actor_type').notNull(), // 'user', 'admin', 'system', 'webhook'
  action: text('action').notNull(), // 'user.created', 'project.deleted', etc.
  resourceType: text('resource_type'), // 'user', 'project', 'member', 'subscription'
  resourceId: text('resource_id'), // ID of affected resource
  changes: text('changes', { mode: 'json' }), // { before: {...}, after: {...} }
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  requestId: text('request_id'), // Correlation ID for tracing
  status: text('status').notNull().default('success'), // 'success', 'failure', 'denied'
  errorMessage: text('error_message'),
  metadata: text('metadata', { mode: 'json' }), // Additional context
});
```

**Migration SQL:**

```sql
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL DEFAULT (unixepoch()),
  actor_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  actor_type TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  changes TEXT,
  ip_address TEXT,
  user_agent TEXT,
  request_id TEXT,
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  metadata TEXT
);

CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
```

---

## 2. Events to Audit

### Critical Priority (Implement First)

| Category | Action | Data to Capture |
|----------|--------|-----------------|
| **Admin Actions** | `admin.user_banned` | Target user ID, reason |
| **Admin Actions** | `admin.user_unbanned` | Target user ID |
| **Admin Actions** | `admin.impersonation_started` | Target user ID |
| **Admin Actions** | `admin.impersonation_stopped` | Target user ID, duration |
| **Admin Actions** | `admin.session_revoked` | Target user ID, session count |
| **Admin Actions** | `admin.user_deleted` | Target user email (anonymized) |
| **Authentication** | `auth.login` | IP, user agent, method (password/magic-link/oauth) |
| **Authentication** | `auth.logout` | Session ID |
| **Authentication** | `auth.login_failed` | Email attempted, reason |
| **Authentication** | `auth.magic_link_sent` | Email |
| **Authentication** | `auth.password_reset` | Email |

### High Priority

| Category | Action | Data to Capture |
|----------|--------|-----------------|
| **2FA** | `auth.2fa_enabled` | Method (totp) |
| **2FA** | `auth.2fa_disabled` | — |
| **2FA** | `auth.2fa_verified` | — |
| **User Lifecycle** | `user.created` | Email, signup method |
| **User Lifecycle** | `user.updated` | Changed fields (name, persona, etc.) |
| **User Lifecycle** | `user.deleted` | Self-deletion |
| **Billing** | `subscription.created` | Plan, Stripe subscription ID |
| **Billing** | `subscription.updated` | Old plan → new plan |
| **Billing** | `subscription.cancelled` | Plan, reason |

### Medium Priority

| Category | Action | Data to Capture |
|----------|--------|-----------------|
| **Projects** | `project.created` | Title |
| **Projects** | `project.updated` | Changed fields |
| **Projects** | `project.deleted` | Title |
| **Members** | `member.added` | Project ID, user ID, role |
| **Members** | `member.removed` | Project ID, user ID |
| **Members** | `member.role_changed` | Old role → new role |
| **Data** | `pdf.uploaded` | Filename, size |
| **Data** | `pdf.deleted` | Filename |
| **Data** | `gdrive.imported` | File count |

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Hono Request                         │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Audit Middleware (injects auditLog helper into ctx)    │
│  - Generates request ID                                 │
│  - Captures IP/User-Agent                               │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Route Handler                                          │
│  - Performs action                                      │
│  - Calls ctx.audit.log({...}) after action              │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  AuditLogger Service                                    │
│  - Formats log entry                                    │
│  - Uses waitUntil() for async writes (non-blocking)     │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  D1 Database (audit_logs table)                         │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `packages/workers/src/services/auditLogger.js` | Core audit logging service |
| `packages/workers/src/middleware/audit.js` | Middleware to inject logger into context |
| `packages/workers/src/routes/audit.js` | Admin API to query audit logs |
| `packages/workers/migrations/0002_audit_logs.sql` | Database migration |

### Files to Modify

| File | Changes |
|------|---------|
| `packages/workers/src/db/schema.js` | Add `auditLogs` table definition |
| `packages/workers/src/index.js` | Mount audit middleware and routes |
| `packages/workers/src/routes/admin.js` | Add audit calls to ban/impersonate/delete |
| `packages/workers/src/routes/projects.js` | Add audit calls to CRUD operations |
| `packages/workers/src/routes/members.js` | Add audit calls to member changes |
| `packages/workers/src/routes/users.js` | Add audit calls to user deletion |
| `packages/workers/src/auth/config.js` | Add Better Auth hooks for auth events |
| `packages/workers/src/routes/billing.js` | Add audit calls to subscription events |
| `packages/workers/src/routes/pdfs.js` | Add audit calls to upload/delete |

---

## 5. Service Implementation

### Audit Logger Service

```javascript
// src/services/auditLogger.js
import { auditLogs } from '../db/schema.js';

export function createAuditLogger(db, executionCtx, request) {
  const requestId = crypto.randomUUID();
  const ipAddress = request.headers.get('CF-Connecting-IP') ||
                    request.headers.get('X-Forwarded-For');
  const userAgent = request.headers.get('User-Agent');

  return {
    requestId,

    log: ({ action, actorId, actorType = 'user', resourceType, resourceId, changes, status = 'success', errorMessage, metadata }) => {
      const entry = {
        id: crypto.randomUUID(),
        timestamp: Math.floor(Date.now() / 1000),
        actorId,
        actorType,
        action,
        resourceType,
        resourceId,
        changes: changes ? JSON.stringify(changes) : null,
        ipAddress,
        userAgent,
        requestId,
        status,
        errorMessage,
        metadata: metadata ? JSON.stringify(metadata) : null,
      };

      // Use waitUntil to write asynchronously without blocking response
      executionCtx.waitUntil(
        db.insert(auditLogs).values(entry).run().catch(err => {
          console.error('[AuditLog] Failed to write:', err);
        })
      );
    },

    // Helper for admin actions
    logAdmin: (action, targetUserId, details = {}) => {
      return this.log({
        action: `admin.${action}`,
        actorType: 'admin',
        resourceType: 'user',
        resourceId: targetUserId,
        ...details,
      });
    },

    // Helper for auth events
    logAuth: (action, userId, details = {}) => {
      return this.log({
        action: `auth.${action}`,
        actorId: userId,
        actorType: userId ? 'user' : 'system',
        resourceType: 'session',
        ...details,
      });
    },
  };
}
```

### Audit Middleware

```javascript
// src/middleware/audit.js
import { createAuditLogger } from '../services/auditLogger.js';

export function auditMiddleware() {
  return async (c, next) => {
    const db = drizzle(c.env.DB);
    c.set('audit', createAuditLogger(db, c.executionCtx, c.req.raw));
    await next();
  };
}
```

---

## 6. Better Auth Integration

Add hooks to `packages/workers/src/auth/config.js`:

```javascript
// Inside betterAuth config
hooks: {
  after: [
    {
      matcher: (ctx) => true,
      handler: async (ctx) => {
        const audit = ctx.context.audit;
        if (!audit) return;

        const path = ctx.path;
        const user = ctx.context.session?.user;

        // Sign in events
        if (path === '/sign-in/email' && ctx.context.returned?.user) {
          audit.logAuth('login', ctx.context.returned.user.id, {
            metadata: { method: 'password' }
          });
        }

        // Magic link sent
        if (path === '/sign-in/magic-link') {
          audit.logAuth('magic_link_sent', null, {
            metadata: { email: ctx.body?.email }
          });
        }

        // Sign up
        if (path === '/sign-up/email' && ctx.context.returned?.user) {
          audit.log({
            action: 'user.created',
            actorId: ctx.context.returned.user.id,
            resourceType: 'user',
            resourceId: ctx.context.returned.user.id,
            metadata: { method: 'email' }
          });
        }

        // 2FA events
        if (path.includes('/two-factor')) {
          // Log 2FA enable/disable/verify
        }
      }
    }
  ]
}
```

---

## 7. Admin Audit Log API

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /api/admin/audit-logs` | GET | List logs with filters & pagination |
| `GET /api/admin/audit-logs/:id` | GET | Get single log entry |
| `GET /api/admin/audit-logs/export` | GET | Export as CSV |

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `actorId` | string | Filter by actor user ID |
| `action` | string | Filter by action (supports prefix: `admin.*`) |
| `resourceType` | string | Filter by resource type |
| `resourceId` | string | Filter by resource ID |
| `status` | string | Filter by status (success/failure/denied) |
| `startDate` | integer | Unix timestamp, logs after this time |
| `endDate` | integer | Unix timestamp, logs before this time |
| `limit` | integer | Results per page (default: 50, max: 100) |
| `offset` | integer | Pagination offset |

### Route Implementation

```javascript
// src/routes/audit.js
import { Hono } from 'hono';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { auditLogs } from '../db/schema.js';
import { eq, and, gte, lte, like, desc } from 'drizzle-orm';

const app = new Hono();

app.use('/*', requireAdmin);

app.get('/', async (c) => {
  const db = drizzle(c.env.DB);
  const { actorId, action, resourceType, resourceId, status, startDate, endDate, limit = 50, offset = 0 } = c.req.query();

  const conditions = [];
  if (actorId) conditions.push(eq(auditLogs.actorId, actorId));
  if (action) conditions.push(like(auditLogs.action, `${action}%`));
  if (resourceType) conditions.push(eq(auditLogs.resourceType, resourceType));
  if (resourceId) conditions.push(eq(auditLogs.resourceId, resourceId));
  if (status) conditions.push(eq(auditLogs.status, status));
  if (startDate) conditions.push(gte(auditLogs.timestamp, parseInt(startDate)));
  if (endDate) conditions.push(lte(auditLogs.timestamp, parseInt(endDate)));

  const logs = await db
    .select()
    .from(auditLogs)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(auditLogs.timestamp))
    .limit(Math.min(parseInt(limit), 100))
    .offset(parseInt(offset));

  return c.json({ logs });
});

export default app;
```

---

## 8. Usage Examples

### In Route Handlers

```javascript
// In admin.js - ban user
app.post('/:userId/ban', async (c) => {
  const { userId } = c.req.param();
  const session = c.get('session');
  const audit = c.get('audit');

  // Perform ban...
  await db.update(user).set({ banned: true }).where(eq(user.id, userId));

  // Log the action
  audit.log({
    action: 'admin.user_banned',
    actorId: session.user.id,
    actorType: 'admin',
    resourceType: 'user',
    resourceId: userId,
    metadata: { reason: c.req.json().reason }
  });

  return c.json({ success: true });
});
```

```javascript
// In projects.js - delete project
app.delete('/:id', async (c) => {
  const { id } = c.req.param();
  const session = c.get('session');
  const audit = c.get('audit');

  const project = await db.select().from(projects).where(eq(projects.id, id)).get();

  await db.delete(projects).where(eq(projects.id, id));

  audit.log({
    action: 'project.deleted',
    actorId: session.user.id,
    resourceType: 'project',
    resourceId: id,
    changes: { before: { title: project.title } }
  });

  return c.json({ success: true });
});
```

---

## 9. Retention & Cleanup

Add scheduled cleanup to `wrangler.jsonc`:

```jsonc
{
  "triggers": {
    "crons": ["0 3 * * *"] // Run daily at 3 AM UTC
  }
}
```

Implement scheduled handler:

```javascript
// In src/index.js
export default {
  fetch: app.fetch,

  async scheduled(event, env, ctx) {
    const db = drizzle(env.DB);
    const retentionDays = 90;
    const cutoff = Math.floor(Date.now() / 1000) - (retentionDays * 24 * 60 * 60);

    const result = await db
      .delete(auditLogs)
      .where(lt(auditLogs.timestamp, cutoff))
      .run();

    console.log(`[AuditCleanup] Deleted ${result.changes} logs older than ${retentionDays} days`);
  }
};
```

---

## 10. Security Considerations

1. **Sensitive Data**: Never log passwords, tokens, API keys, or full credit card numbers
2. **PII Handling**: For GDPR compliance, implement user data anonymization/deletion from logs
3. **Access Control**: Audit logs API is admin-only
4. **Immutability**: No UPDATE/DELETE endpoints exposed via API
5. **Rate Limiting**: Apply rate limits to audit log queries to prevent abuse

---

## 11. Implementation Order

### Phase 1: Foundation
1. [ ] Create migration file `0002_audit_logs.sql`
2. [ ] Add `auditLogs` table to `schema.js`
3. [ ] Run migration
4. [ ] Create `auditLogger.js` service
5. [ ] Create `audit.js` middleware
6. [ ] Mount middleware in `index.js`

### Phase 2: Critical Events
7. [ ] Add audit logging to admin routes (ban, unban, impersonate, delete)
8. [ ] Add Better Auth hooks for login/logout events
9. [ ] Add audit logging to user deletion

### Phase 3: High Priority Events
10. [ ] Add audit logging to 2FA events
11. [ ] Add audit logging to billing/subscription events
12. [ ] Add audit logging to user profile updates

### Phase 4: Medium Priority Events
13. [ ] Add audit logging to project CRUD
14. [ ] Add audit logging to member management
15. [ ] Add audit logging to PDF upload/delete

### Phase 5: Admin UI & Maintenance
16. [ ] Create audit logs query API (`/api/admin/audit-logs`)
17. [ ] Add export endpoint
18. [ ] Implement scheduled cleanup job
19. [ ] Add audit logs viewer to admin dashboard (frontend)

---

## 12. Testing Checklist

- [ ] Audit logs are written without blocking response
- [ ] Failed audit writes don't crash the request
- [ ] All critical admin actions are logged
- [ ] Auth events are captured correctly
- [ ] Query filters work as expected
- [ ] Pagination works correctly
- [ ] Retention cleanup deletes old logs
- [ ] Sensitive data is not logged
