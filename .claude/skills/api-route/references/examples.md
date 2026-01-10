# Real API Route Examples

Working examples from the CoRATES workers codebase.

## Project Routes (Org-Scoped)

Location: `packages/workers/src/routes/orgs/projects.js`

Full CRUD with middleware chain:

```javascript
import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { createDb } from '@/db/client.js';
import { projects, projectMembers, user } from '@/db/schema.js';
import { requireAuth, getAuth } from '@/middleware/auth.js';
import { requireOrgMembership, getOrgContext } from '@/middleware/requireOrg.js';
import { requireOrgWriteAccess } from '@/middleware/requireOrgWriteAccess.js';
import { requireEntitlement } from '@/middleware/requireEntitlement.js';
import { requireQuota } from '@/middleware/requireQuota.js';
import { validateRequest, projectSchemas } from '@/config/validation.js';
import { createDomainError, PROJECT_ERRORS, SYSTEM_ERRORS } from '@corates/shared';
import { syncProjectToDO } from '@/lib/project-sync.js';

const orgProjectRoutes = new Hono();

// Auth required for all routes
orgProjectRoutes.use('*', requireAuth);

// Helper for quota check
async function getProjectCount(c, user) {
  const { orgId } = getOrgContext(c);
  const db = createDb(c.env.DB);
  const [result] = await db
    .select({ count: count() })
    .from(projects)
    .where(eq(projects.orgId, orgId));
  return result?.count || 0;
}

// GET /api/orgs/:orgId/projects - List org projects
orgProjectRoutes.get('/', requireOrgMembership(), async c => {
  const { user: authUser } = getAuth(c);
  const { orgId } = getOrgContext(c);
  const db = createDb(c.env.DB);

  try {
    const results = await db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        role: projectMembers.role,
      })
      .from(projects)
      .innerJoin(projectMembers, eq(projects.id, projectMembers.projectId))
      .where(
        and(
          eq(projects.orgId, orgId),
          eq(projectMembers.userId, authUser.id),
        ),
      )
      .orderBy(desc(projects.updatedAt));

    return c.json(results);
  } catch (error) {
    console.error('Error fetching org projects:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_org_projects',
    });
    return c.json(dbError, dbError.statusCode);
  }
});

// POST /api/orgs/:orgId/projects - Create project
orgProjectRoutes.post(
  '/',
  requireOrgMembership(),
  requireOrgWriteAccess(),
  requireEntitlement('project.create'),
  requireQuota('projects.max', getProjectCount, 1),
  validateRequest(projectSchemas.create),
  async c => {
    const { user: authUser } = getAuth(c);
    const { orgId } = getOrgContext(c);
    const { name, description } = c.get('validatedBody');
    const db = createDb(c.env.DB);

    const projectId = crypto.randomUUID();
    const memberId = crypto.randomUUID();
    const now = new Date();

    try {
      await db.batch([
        db.insert(projects).values({
          id: projectId,
          orgId,
          name: name.trim(),
          description: description?.trim() || null,
          createdBy: authUser.id,
          createdAt: now,
          updatedAt: now,
        }),
        db.insert(projectMembers).values({
          id: memberId,
          projectId,
          userId: authUser.id,
          role: 'owner',
          joinedAt: now,
        }),
      ]);

      // Get creator info for DO sync
      const creator = await db
        .select({ name: user.name, email: user.email, image: user.image })
        .from(user)
        .where(eq(user.id, authUser.id))
        .get();

      const newProject = {
        id: projectId,
        orgId,
        name: name.trim(),
        description: description?.trim() || null,
        role: 'owner',
        createdAt: now,
        updatedAt: now,
      };

      // Sync to Durable Object (best-effort)
      try {
        await syncProjectToDO(c.env, projectId, {
          meta: { title: name.trim(), description: description?.trim() || '' },
        }, [{
          odId: authUser.id,
          name: creator?.name || '',
          email: creator?.email || '',
          image: creator?.image || '',
          role: 'owner',
        }]);
      } catch (err) {
        console.error('Failed to sync project to DO:', err);
      }

      return c.json(newProject, 201);
    } catch (error) {
      console.error('Error creating project:', error);
      const dbError = createDomainError(SYSTEM_ERRORS.DB_TRANSACTION_FAILED, {
        operation: 'create_project',
      });
      return c.json(dbError, dbError.statusCode);
    }
  },
);

// GET /api/orgs/:orgId/projects/:projectId - Get project
orgProjectRoutes.get('/:projectId', requireOrgMembership(), async c => {
  const { user: authUser } = getAuth(c);
  const projectId = c.req.param('projectId');
  const db = createDb(c.env.DB);

  try {
    const result = await db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        role: projectMembers.role,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .innerJoin(projectMembers, eq(projects.id, projectMembers.projectId))
      .where(
        and(
          eq(projects.id, projectId),
          eq(projectMembers.userId, authUser.id),
        ),
      )
      .get();

    if (!result) {
      const error = createDomainError(PROJECT_ERRORS.NOT_FOUND, { projectId });
      return c.json(error, error.statusCode);
    }

    return c.json(result);
  } catch (error) {
    console.error('Error fetching project:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_project',
    });
    return c.json(dbError, dbError.statusCode);
  }
});

// PATCH /api/orgs/:orgId/projects/:projectId - Update project
orgProjectRoutes.patch(
  '/:projectId',
  requireOrgMembership(),
  requireOrgWriteAccess(),
  validateRequest(projectSchemas.update),
  async c => {
    const { user: authUser } = getAuth(c);
    const projectId = c.req.param('projectId');
    const updates = c.get('validatedBody');
    const db = createDb(c.env.DB);

    try {
      // Check membership
      const membership = await db
        .select({ role: projectMembers.role })
        .from(projectMembers)
        .where(
          and(
            eq(projectMembers.projectId, projectId),
            eq(projectMembers.userId, authUser.id),
          ),
        )
        .get();

      if (!membership) {
        const error = createDomainError(PROJECT_ERRORS.NOT_FOUND, { projectId });
        return c.json(error, error.statusCode);
      }

      // Build update object
      const updateData = { updatedAt: new Date() };
      if (updates.name !== undefined) updateData.name = updates.name.trim();
      if (updates.description !== undefined) {
        updateData.description = updates.description?.trim() || null;
      }

      await db.update(projects)
        .set(updateData)
        .where(eq(projects.id, projectId));

      return c.json({ success: true, projectId });
    } catch (error) {
      console.error('Error updating project:', error);
      const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'update_project',
      });
      return c.json(dbError, dbError.statusCode);
    }
  },
);

// DELETE /api/orgs/:orgId/projects/:projectId - Delete project
orgProjectRoutes.delete('/:projectId', requireOrgMembership('owner'), async c => {
  const { user: authUser } = getAuth(c);
  const projectId = c.req.param('projectId');
  const db = createDb(c.env.DB);

  try {
    // Verify owner role
    const membership = await db
      .select({ role: projectMembers.role })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, authUser.id),
        ),
      )
      .get();

    if (!membership || membership.role !== 'owner') {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'not_project_owner',
      });
      return c.json(error, error.statusCode);
    }

    // Cascade delete
    await db.batch([
      db.delete(projectMembers).where(eq(projectMembers.projectId, projectId)),
      db.delete(invitations).where(eq(invitations.projectId, projectId)),
      db.delete(projects).where(eq(projects.id, projectId)),
    ]);

    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'delete_project',
    });
    return c.json(dbError, dbError.statusCode);
  }
});

export { orgProjectRoutes };
```

---

## User Search Route

Location: `packages/workers/src/routes/users.js`

Search with privacy controls:

```javascript
import { Hono } from 'hono';
import { eq, or, like, sql } from 'drizzle-orm';
import { createDb } from '@/db/client.js';
import { user, projectMembers } from '@/db/schema.js';
import { requireAuth, getAuth } from '@/middleware/auth.js';
import { searchRateLimit } from '@/middleware/rateLimit.js';
import { createDomainError, createValidationError, VALIDATION_ERRORS, SYSTEM_ERRORS } from '@corates/shared';

const userRoutes = new Hono();

userRoutes.use('*', requireAuth);

// Helper to mask email for privacy
function maskEmail(email) {
  if (!email) return '';
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const maskedLocal = local.charAt(0) + '***';
  return `${maskedLocal}@${domain}`;
}

// GET /api/users/search - Search users
userRoutes.get('/search', searchRateLimit, async c => {
  const { user: currentUser } = getAuth(c);
  const query = c.req.query('q')?.trim();
  const projectId = c.req.query('projectId');
  const limit = Math.min(parseInt(c.req.query('limit') || '10', 10), 20);

  // Validate query
  if (!query || query.length < 2) {
    const error = createValidationError('query', VALIDATION_ERRORS.FIELD_TOO_SHORT.code);
    return c.json(error, error.statusCode);
  }

  const db = createDb(c.env.DB);
  const searchPattern = `%${query.toLowerCase()}%`;

  try {
    // Search across multiple fields
    let results = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        displayName: user.displayName,
        image: user.image,
      })
      .from(user)
      .where(
        or(
          like(sql`lower(${user.email})`, searchPattern),
          like(sql`lower(${user.name})`, searchPattern),
          like(sql`lower(${user.displayName})`, searchPattern),
        ),
      )
      .limit(limit);

    // Filter out users already in project
    if (projectId) {
      const existingMembers = await db
        .select({ userId: projectMembers.userId })
        .from(projectMembers)
        .where(eq(projectMembers.projectId, projectId));

      const existingUserIds = new Set(existingMembers.map(m => m.userId));
      results = results.filter(u => !existingUserIds.has(u.id));
    }

    // Exclude current user
    results = results.filter(u => u.id !== currentUser.id);

    // Privacy: mask email unless exact match
    const sanitizedResults = results.map(u => ({
      id: u.id,
      name: u.name || u.displayName,
      email: query.includes('@') ? u.email : maskEmail(u.email),
      image: u.image,
    }));

    return c.json(sanitizedResults);
  } catch (error) {
    console.error('Error searching users:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'search_users',
    });
    return c.json(dbError, dbError.statusCode);
  }
});

export { userRoutes };
```

---

## Contact Form Route (Public)

Location: `packages/workers/src/routes/contact.js`

Public endpoint with rate limiting:

```javascript
import { Hono } from 'hono';
import { z } from 'zod';
import { PostmarkClient } from 'postmark';
import { contactRateLimit } from '@/middleware/rateLimit.js';
import { createDomainError, createValidationError, SYSTEM_ERRORS, VALIDATION_ERRORS } from '@corates/shared';

const contact = new Hono();

// Rate limit public endpoint
contact.use('*', contactRateLimit);

const contactSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().email().trim().min(1).max(254),
  subject: z.string().trim().max(150).optional().default(''),
  message: z.string().trim().min(1).max(2000),
});

contact.post('/', async c => {
  // Parse body
  let body;
  try {
    body = await c.req.json();
  } catch {
    const error = createValidationError('body', VALIDATION_ERRORS.INVALID_INPUT.code);
    return c.json(error, error.statusCode);
  }

  // Validate
  const result = contactSchema.safeParse(body);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const fieldName = firstIssue?.path[0] || 'input';
    const error = createValidationError(fieldName, VALIDATION_ERRORS.INVALID_INPUT.code);
    return c.json(error, error.statusCode);
  }

  const { name, email, subject, message } = result.data;

  // Check service availability
  if (!c.env.POSTMARK_SERVER_TOKEN) {
    const error = createDomainError(SYSTEM_ERRORS.SERVICE_UNAVAILABLE, {
      service: 'email',
    });
    return c.json(error, error.statusCode);
  }

  try {
    const postmark = new PostmarkClient(c.env.POSTMARK_SERVER_TOKEN);

    const response = await postmark.sendEmail({
      From: `CoRATES Contact <${c.env.EMAIL_FROM}>`,
      To: c.env.CONTACT_EMAIL,
      ReplyTo: email,
      Subject: `[Contact Form] ${subject || 'New Inquiry'}`,
      TextBody: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
      HtmlBody: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Subject:</strong> ${subject || 'None'}</p>
        <hr />
        <p>${message.replace(/\n/g, '<br />')}</p>
      `,
    });

    if (response.ErrorCode !== 0) {
      console.error('[Contact] Postmark error:', response);
      const error = createDomainError(SYSTEM_ERRORS.EMAIL_SEND_FAILED);
      return c.json(error, error.statusCode);
    }

    return c.json({ success: true, messageId: response.MessageID });
  } catch (err) {
    console.error('[Contact] Exception:', err.message);
    const error = createDomainError(SYSTEM_ERRORS.EMAIL_SEND_FAILED);
    return c.json(error, error.statusCode);
  }
});

export { contact as contactRoutes };
```

---

## Avatar Upload Route

Location: `packages/workers/src/routes/avatars.js`

File upload with R2:

```javascript
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { createDb } from '@/db/client.js';
import { user } from '@/db/schema.js';
import { requireAuth, getAuth } from '@/middleware/auth.js';
import { createDomainError, createValidationError, SYSTEM_ERRORS, VALIDATION_ERRORS } from '@corates/shared';

const avatarRoutes = new Hono();

avatarRoutes.use('*', requireAuth);

// POST /api/avatars - Upload avatar
avatarRoutes.post('/', async c => {
  const { user: authUser } = getAuth(c);

  const formData = await c.req.formData();
  const file = formData.get('file');

  // Validate file exists
  if (!file || !(file instanceof File)) {
    const error = createValidationError('file', VALIDATION_ERRORS.FIELD_REQUIRED.code);
    return c.json(error, error.statusCode);
  }

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    const error = createValidationError('file', VALIDATION_ERRORS.FIELD_INVALID_FORMAT.code);
    return c.json(error, error.statusCode);
  }

  // Validate file size (2MB max)
  const maxSize = 2 * 1024 * 1024;
  if (file.size > maxSize) {
    const error = createValidationError('file', VALIDATION_ERRORS.FIELD_TOO_LONG.code);
    return c.json(error, error.statusCode);
  }

  try {
    const buffer = await file.arrayBuffer();
    const key = `avatars/${authUser.id}`;

    // Upload to R2
    await c.env.BUCKET.put(key, buffer, {
      httpMetadata: {
        contentType: file.type,
      },
    });

    // Generate public URL
    const avatarUrl = `${c.env.R2_PUBLIC_URL}/${key}`;

    // Update user record
    const db = createDb(c.env.DB);
    await db.update(user)
      .set({ image: avatarUrl, updatedAt: new Date() })
      .where(eq(user.id, authUser.id));

    return c.json({ success: true, url: avatarUrl });
  } catch (error) {
    console.error('Error uploading avatar:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.UPLOAD_FAILED, {
      operation: 'upload_avatar',
    });
    return c.json(dbError, dbError.statusCode);
  }
});

// DELETE /api/avatars - Remove avatar
avatarRoutes.delete('/', async c => {
  const { user: authUser } = getAuth(c);
  const db = createDb(c.env.DB);

  try {
    const key = `avatars/${authUser.id}`;

    // Delete from R2
    await c.env.BUCKET.delete(key);

    // Clear image in database
    await db.update(user)
      .set({ image: null, updatedAt: new Date() })
      .where(eq(user.id, authUser.id));

    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting avatar:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'delete_avatar',
    });
    return c.json(dbError, dbError.statusCode);
  }
});

export { avatarRoutes };
```
