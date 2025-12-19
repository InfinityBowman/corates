/**
 * Project member routes for Hono
 * Handles project membership management
 */

import { Hono } from 'hono';
import { createDb } from '../db/client.js';
import { projectMembers, user, projects } from '../db/schema.js';
import { eq, and, count } from 'drizzle-orm';
import { requireAuth, getAuth } from '../middleware/auth.js';
import { memberSchemas, validateRequest } from '../config/validation.js';
import { createErrorResponse, ERROR_CODES } from '../config/constants.js';

const memberRoutes = new Hono();

// Apply auth middleware to all routes
memberRoutes.use('*', requireAuth);

/**
 * Sync a member change to the Durable Object
 */
async function syncMemberToDO(env, projectId, action, memberData) {
  try {
    const doId = env.PROJECT_DOC.idFromName(projectId);
    const projectDoc = env.PROJECT_DOC.get(doId);

    await projectDoc.fetch(
      new Request('https://internal/sync-member', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Request': 'true',
        },
        body: JSON.stringify({ action, member: memberData }),
      }),
    );
  } catch (err) {
    console.error('Failed to sync member to DO:', err);
  }
}

/**
 * Middleware to verify project membership and set context
 */
async function projectMembershipMiddleware(c, next) {
  const { user: authUser } = getAuth(c);
  const projectId = c.req.param('projectId');

  if (!projectId) {
    return c.json(createErrorResponse(ERROR_CODES.MISSING_FIELD, 'Project ID required'), 400);
  }

  const db = createDb(c.env.DB);

  // Check if user has access to this project
  const membership = await db
    .select({ role: projectMembers.role })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, authUser.id)))
    .get();

  if (!membership) {
    return c.json(createErrorResponse(ERROR_CODES.PROJECT_ACCESS_DENIED), 404);
  }

  c.set('projectId', projectId);
  c.set('membership', membership);
  c.set('isOwner', membership.role === 'owner');

  await next();
}

// Apply project membership middleware to all routes
memberRoutes.use('*', projectMembershipMiddleware);

/**
 * GET /api/projects/:projectId/members
 * List all members of a project
 */
memberRoutes.get('/', async c => {
  const projectId = c.get('projectId');
  const db = createDb(c.env.DB);

  try {
    const results = await db
      .select({
        userId: projectMembers.userId,
        role: projectMembers.role,
        joinedAt: projectMembers.joinedAt,
        name: user.name,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        image: user.image,
      })
      .from(projectMembers)
      .innerJoin(user, eq(projectMembers.userId, user.id))
      .where(eq(projectMembers.projectId, projectId))
      .orderBy(projectMembers.joinedAt);

    return c.json(results);
  } catch (error) {
    console.error('Error listing members:', error);
    return c.json(createErrorResponse(ERROR_CODES.DB_ERROR, error.message), 500);
  }
});

/**
 * POST /api/projects/:projectId/members
 * Add a member to the project (owner only)
 */
memberRoutes.post('/', validateRequest(memberSchemas.add), async c => {
  const isOwner = c.get('isOwner');
  const projectId = c.get('projectId');

  if (!isOwner) {
    return c.json(
      createErrorResponse(ERROR_CODES.AUTH_FORBIDDEN, 'Only project owners can add members'),
      403,
    );
  }

  const db = createDb(c.env.DB);
  const { userId, email, role } = c.get('validatedBody');

  try {
    // Find user by userId or email
    let userToAdd;
    if (userId) {
      userToAdd = await db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          image: user.image,
        })
        .from(user)
        .where(eq(user.id, userId))
        .get();
    } else {
      userToAdd = await db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          image: user.image,
        })
        .from(user)
        .where(eq(user.email, email.toLowerCase()))
        .get();
    }

    if (!userToAdd) {
      return c.json(createErrorResponse(ERROR_CODES.NOT_FOUND, 'User not found'), 404);
    }

    // Check if already a member
    const existingMember = await db
      .select({ id: projectMembers.id })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userToAdd.id)))
      .get();

    if (existingMember) {
      return c.json(createErrorResponse(ERROR_CODES.PROJECT_MEMBER_EXISTS), 409);
    }

    const now = new Date();
    await db.insert(projectMembers).values({
      id: crypto.randomUUID(),
      projectId,
      userId: userToAdd.id,
      role,
      joinedAt: now,
    });

    // Get project name for notification
    const project = await db
      .select({ name: projects.name })
      .from(projects)
      .where(eq(projects.id, projectId))
      .get();

    // Send notification to the added user via their UserSession DO
    try {
      const userSessionId = c.env.USER_SESSION.idFromName(userToAdd.id);
      const userSession = c.env.USER_SESSION.get(userSessionId);
      await userSession.fetch(
        new Request('https://internal/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'project-invite',
            projectId,
            projectName: project?.name || 'Unknown Project',
            role,
            timestamp: Date.now(),
          }),
        }),
      );
    } catch (err) {
      console.error('Failed to send project invite notification:', err);
    }

    // Sync member to DO
    await syncMemberToDO(c.env, projectId, 'add', {
      userId: userToAdd.id,
      role,
      joinedAt: now.getTime(),
      name: userToAdd.name,
      email: userToAdd.email,
      displayName: userToAdd.displayName,
      image: userToAdd.image,
    });

    return c.json(
      {
        userId: userToAdd.id,
        name: userToAdd.name,
        email: userToAdd.email,
        username: userToAdd.username,
        displayName: userToAdd.displayName,
        image: userToAdd.image,
        role,
        joinedAt: now,
      },
      201,
    );
  } catch (error) {
    console.error('Error adding member:', error);
    return c.json(createErrorResponse(ERROR_CODES.DB_ERROR, error.message), 500);
  }
});

/**
 * PUT /api/projects/:projectId/members/:userId
 * Update a member's role (owner only)
 */
memberRoutes.put('/:userId', validateRequest(memberSchemas.updateRole), async c => {
  const isOwner = c.get('isOwner');
  const projectId = c.get('projectId');
  const memberId = c.req.param('userId');

  if (!isOwner) {
    return c.json(
      createErrorResponse(
        ERROR_CODES.AUTH_FORBIDDEN,
        'Only project owners can update member roles',
      ),
      403,
    );
  }

  const db = createDb(c.env.DB);
  const { role } = c.get('validatedBody');

  try {
    // Prevent removing the last owner
    if (role !== 'owner') {
      const ownerCountResult = await db
        .select({ count: count() })
        .from(projectMembers)
        .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.role, 'owner')))
        .get();

      const targetMember = await db
        .select({ role: projectMembers.role })
        .from(projectMembers)
        .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, memberId)))
        .get();

      if (targetMember?.role === 'owner' && ownerCountResult?.count <= 1) {
        return c.json(
          createErrorResponse(ERROR_CODES.PROJECT_LAST_OWNER, 'Assign another owner first'),
          400,
        );
      }
    }

    await db
      .update(projectMembers)
      .set({ role })
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, memberId)));

    // Sync role update to DO
    await syncMemberToDO(c.env, projectId, 'update', {
      userId: memberId,
      role,
    });

    return c.json({ success: true, userId: memberId, role });
  } catch (error) {
    console.error('Error updating member role:', error);
    return c.json(createErrorResponse(ERROR_CODES.DB_ERROR, error.message), 500);
  }
});

/**
 * DELETE /api/projects/:projectId/members/:userId
 * Remove a member from the project (owner only, or self-removal)
 */
memberRoutes.delete('/:userId', async c => {
  const { user: authUser } = getAuth(c);
  const isOwner = c.get('isOwner');
  const projectId = c.get('projectId');
  const memberId = c.req.param('userId');

  const isSelfRemoval = memberId === authUser.id;

  if (!isOwner && !isSelfRemoval) {
    return c.json(
      createErrorResponse(ERROR_CODES.AUTH_FORBIDDEN, 'Only project owners can remove members'),
      403,
    );
  }

  const db = createDb(c.env.DB);

  try {
    // Check target member exists
    const targetMember = await db
      .select({ role: projectMembers.role })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, memberId)))
      .get();

    if (!targetMember) {
      return c.json(createErrorResponse(ERROR_CODES.NOT_FOUND, 'Member not found'), 404);
    }

    // Prevent removing the last owner
    if (targetMember.role === 'owner') {
      const ownerCountResult = await db
        .select({ count: count() })
        .from(projectMembers)
        .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.role, 'owner')))
        .get();

      if (ownerCountResult?.count <= 1) {
        return c.json(
          createErrorResponse(
            ERROR_CODES.PROJECT_LAST_OWNER,
            'Assign another owner first or delete the project',
          ),
          400,
        );
      }
    }

    await db
      .delete(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, memberId)));

    // Sync member removal to DO (this also forces disconnect)
    await syncMemberToDO(c.env, projectId, 'remove', {
      userId: memberId,
    });

    // Send notification to removed user (if not self-removal)
    if (!isSelfRemoval) {
      try {
        // Get project name for notification
        const project = await db
          .select({ name: projects.name })
          .from(projects)
          .where(eq(projects.id, projectId))
          .get();

        const userSessionId = c.env.USER_SESSION.idFromName(memberId);
        const userSession = c.env.USER_SESSION.get(userSessionId);
        await userSession.fetch(
          new Request('https://internal/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'removed-from-project',
              projectId,
              projectName: project?.name || 'Unknown Project',
              removedBy: authUser.name || authUser.email,
              timestamp: Date.now(),
            }),
          }),
        );
      } catch (err) {
        console.error('Failed to send removal notification:', err);
      }
    }

    return c.json({ success: true, removed: memberId });
  } catch (error) {
    console.error('Error removing member:', error);
    return c.json(createErrorResponse(ERROR_CODES.DB_ERROR, error.message), 500);
  }
});

export { memberRoutes };
