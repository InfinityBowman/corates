/**
 * Project member management route handlers
 */

import { createDb } from '../db/client.js';
import { projectMembers, user } from '../db/schema.js';
import { eq, and, count } from 'drizzle-orm';
import { requireAuth } from '../auth/config.js';
import { jsonResponse, errorResponse } from '../middleware/cors.js';

/**
 * Handle project member routes
 * - GET /api/projects/:projectId/members - List all members
 * - POST /api/projects/:projectId/members - Add a member
 * - PUT /api/projects/:projectId/members/:userId - Update member role
 * - DELETE /api/projects/:projectId/members/:userId - Remove a member
 */
export async function handleMembers(request, env, path) {
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) {
    return authResult;
  }

  const pathParts = path.split('/');
  const projectId = pathParts[3];
  const memberId = pathParts[5]; // userId for specific member operations

  if (!projectId) {
    return errorResponse('Project ID required', 400, request);
  }

  const db = createDb(env.DB);

  try {
    // Check if user has access to this project
    const membership = await db
      .select({ role: projectMembers.role })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, authResult.user.id)))
      .get();

    if (!membership) {
      return errorResponse('Project not found or access denied', 404, request);
    }

    const isOwner = membership.role === 'owner';

    switch (request.method) {
      case 'GET':
        if (!memberId) {
          return await listMembers(request, db, projectId);
        }
        break;
      case 'POST':
        return await addMember(request, db, projectId, isOwner);
      case 'PUT':
        if (memberId) {
          return await updateMemberRole(request, db, projectId, memberId, isOwner);
        }
        break;
      case 'DELETE':
        if (memberId) {
          return await removeMember(request, db, projectId, memberId, isOwner, authResult.user.id);
        }
        break;
    }

    return errorResponse('Method not allowed', 405, request);
  } catch (error) {
    console.error('Error managing project members:', error);
    return errorResponse('Failed to manage project members', 500, request);
  }
}

/**
 * List all members of a project
 */
async function listMembers(request, db, projectId) {
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

  return jsonResponse(results, {}, request);
}

/**
 * Add a member to the project (owner only)
 */
async function addMember(request, db, projectId, isOwner) {
  if (!isOwner) {
    return errorResponse('Only project owners can add members', 403, request);
  }

  const { email, role = 'member' } = await request.json();

  if (!email) {
    return errorResponse('Email is required', 400, request);
  }

  // Validate role
  const validRoles = ['owner', 'collaborator', 'member', 'viewer'];
  if (!validRoles.includes(role)) {
    return errorResponse('Invalid role. Must be one of: owner, collaborator, member, viewer', 400, request);
  }

  // Find user by email
  const userToAdd = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
    })
    .from(user)
    .where(eq(user.email, email.toLowerCase()))
    .get();

  if (!userToAdd) {
    return errorResponse('User not found with that email', 404, request);
  }

  // Check if already a member
  const existingMember = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userToAdd.id)))
    .get();

  if (existingMember) {
    return errorResponse('User is already a member of this project', 409, request);
  }

  const now = new Date();
  await db.insert(projectMembers).values({
    id: crypto.randomUUID(),
    projectId,
    userId: userToAdd.id,
    role,
    joinedAt: now,
  });

  return jsonResponse(
    {
      userId: userToAdd.id,
      name: userToAdd.name,
      email: userToAdd.email,
      username: userToAdd.username,
      displayName: userToAdd.displayName,
      role,
      joinedAt: now,
    },
    { status: 201 },
    request,
  );
}

/**
 * Update a member's role (owner only)
 */
async function updateMemberRole(request, db, projectId, memberId, isOwner) {
  if (!isOwner) {
    return errorResponse('Only project owners can update member roles', 403, request);
  }

  const { role } = await request.json();

  // Validate role
  const validRoles = ['owner', 'collaborator', 'member', 'viewer'];
  if (!validRoles.includes(role)) {
    return errorResponse('Invalid role. Must be one of: owner, collaborator, member, viewer', 400, request);
  }

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
      return errorResponse('Cannot remove the last owner. Assign another owner first.', 400, request);
    }
  }

  await db
    .update(projectMembers)
    .set({ role })
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, memberId)));

  return jsonResponse({ success: true, userId: memberId, role }, {}, request);
}

/**
 * Remove a member from the project (owner only, or self-removal)
 */
async function removeMember(request, db, projectId, memberId, isOwner, currentUserId) {
  const isSelfRemoval = memberId === currentUserId;

  if (!isOwner && !isSelfRemoval) {
    return errorResponse('Only project owners can remove members', 403, request);
  }

  // Check target member exists
  const targetMember = await db
    .select({ role: projectMembers.role })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, memberId)))
    .get();

  if (!targetMember) {
    return errorResponse('Member not found', 404, request);
  }

  // Prevent removing the last owner
  if (targetMember.role === 'owner') {
    const ownerCountResult = await db
      .select({ count: count() })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.role, 'owner')))
      .get();

    if (ownerCountResult?.count <= 1) {
      return errorResponse('Cannot remove the last owner. Assign another owner first or delete the project.', 400, request);
    }
  }

  await db.delete(projectMembers).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, memberId)));

  return jsonResponse({ success: true, removed: memberId }, {}, request);
}
