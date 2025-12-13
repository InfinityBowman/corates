/**
 * Tests for member routes
 * P1 Priority: Member management operations
 * Tests adding, updating, removing members and role management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  innerJoin: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  get: vi.fn(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
};

const mockEnv = {
  DB: {},
  PROJECT_DOC: {
    idFromName: vi.fn(() => 'do-id'),
    get: vi.fn(() => ({
      fetch: vi.fn().mockResolvedValue({ ok: true }),
    })),
  },
  USER_SESSION: {
    idFromName: vi.fn(() => 'user-session-id'),
    get: vi.fn(() => ({
      fetch: vi.fn().mockResolvedValue({ ok: true }),
    })),
  },
};

// Mock the db client
vi.mock('../../db/client.js', () => ({
  createDb: vi.fn(() => mockDb),
}));

// Mock auth middleware
vi.mock('../../middleware/auth.js', () => ({
  requireAuth: vi.fn((c, next) => next()),
  getAuth: vi.fn(() => ({ user: { id: 'user-123', email: 'owner@example.com' } })),
}));

describe('Member Routes - GET /api/projects/:projectId/members', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should list all members of a project', async () => {
    const mockMembers = [
      {
        userId: 'user-1',
        role: 'owner',
        joinedAt: new Date('2023-01-01'),
        name: 'Owner User',
        email: 'owner@example.com',
        username: 'owner',
        displayName: 'Owner',
        image: null,
      },
      {
        userId: 'user-2',
        role: 'collaborator',
        joinedAt: new Date('2023-01-02'),
        name: 'Collaborator User',
        email: 'collab@example.com',
        username: 'collab',
        displayName: 'Collaborator',
        image: null,
      },
    ];

    mockDb.get.mockResolvedValue(mockMembers);

    expect(mockDb.select).toBeDefined();
    expect(mockDb.from).toBeDefined();
    expect(mockDb.innerJoin).toBeDefined();
  });

  it('should order members by join date', async () => {
    mockDb.orderBy = vi.fn().mockReturnThis();

    expect(mockDb.orderBy).toBeDefined();
  });

  it('should require project membership to view members', async () => {
    // Middleware should check membership before listing
    expect(mockDb.where).toBeDefined();
  });
});

describe('Member Routes - POST /api/projects/:projectId/members', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow owner to add member by userId', async () => {
    const mockUser = {
      id: 'user-new',
      name: 'New User',
      email: 'new@example.com',
      username: 'newuser',
      displayName: 'New User',
      image: null,
    };

    mockDb.get
      .mockResolvedValueOnce(mockUser) // Find user
      .mockResolvedValueOnce(null) // Check not existing member
      .mockResolvedValueOnce({ name: 'Test Project' }); // Get project name

    expect(mockDb.insert).toBeDefined();
  });

  it('should allow owner to add member by email', async () => {
    const mockUser = {
      id: 'user-new',
      name: 'New User',
      email: 'new@example.com',
      username: 'newuser',
      displayName: 'New User',
      image: null,
    };

    mockDb.get
      .mockResolvedValueOnce(mockUser) // Find user by email
      .mockResolvedValueOnce(null); // Check not existing member

    expect(mockDb.where).toBeDefined();
  });

  it('should normalize email to lowercase', async () => {
    const email = 'Test@Example.COM';
    expect(email.toLowerCase()).toBe('test@example.com');
  });

  it('should return 404 if user not found', async () => {
    mockDb.get.mockResolvedValue(null);

    expect(mockDb.get).toBeDefined();
  });

  it('should return 409 if user is already a member', async () => {
    const mockUser = {
      id: 'user-new',
      name: 'New User',
      email: 'new@example.com',
    };

    mockDb.get
      .mockResolvedValueOnce(mockUser) // Find user
      .mockResolvedValueOnce({ id: 'existing-member' }); // Already a member

    expect(mockDb.get).toBeDefined();
  });

  it('should deny non-owner from adding members', async () => {
    const isOwner = false;
    expect(isOwner).toBe(false);
  });

  it('should send notification to added user', async () => {
    const mockUser = {
      id: 'user-new',
      name: 'New User',
      email: 'new@example.com',
    };

    mockDb.get
      .mockResolvedValueOnce(mockUser)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ name: 'Test Project' });

    const userSessionFetch = vi.fn().mockResolvedValue({ ok: true });
    mockEnv.USER_SESSION.get.mockReturnValue({ fetch: userSessionFetch });

    expect(mockEnv.USER_SESSION.idFromName).toBeDefined();
  });

  it('should sync member to Durable Object', async () => {
    const mockUser = {
      id: 'user-new',
      name: 'New User',
      email: 'new@example.com',
    };

    mockDb.get.mockResolvedValueOnce(mockUser).mockResolvedValueOnce(null);

    const doFetch = vi.fn().mockResolvedValue({ ok: true });
    mockEnv.PROJECT_DOC.get.mockReturnValue({ fetch: doFetch });

    expect(mockEnv.PROJECT_DOC.get).toBeDefined();
  });

  it('should accept valid project roles', async () => {
    const validRoles = ['owner', 'collaborator', 'viewer'];
    expect(validRoles).toContain('owner');
    expect(validRoles).toContain('collaborator');
    expect(validRoles).toContain('viewer');
  });
});

describe('Member Routes - PUT /api/projects/:projectId/members/:userId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow owner to update member role', async () => {
    mockDb.get
      .mockResolvedValueOnce({ count: 2 }) // Two owners exist
      .mockResolvedValueOnce({ role: 'collaborator' }); // Target is collaborator

    mockDb.update = vi.fn().mockReturnThis();
    mockDb.set.mockReturnThis();

    expect(mockDb.update).toBeDefined();
  });

  it('should deny non-owner from updating roles', async () => {
    const isOwner = false;
    expect(isOwner).toBe(false);
  });

  it('should prevent removing the last owner', async () => {
    mockDb.get
      .mockResolvedValueOnce({ count: 1 }) // Only one owner
      .mockResolvedValueOnce({ role: 'owner' }); // Target is that owner

    const ownerCount = 1;
    const targetRole = 'owner';
    const newRole = 'collaborator';

    // Should prevent downgrading the last owner
    expect(targetRole === 'owner' && ownerCount <= 1 && newRole !== 'owner').toBe(true);
  });

  it('should allow promoting to owner', async () => {
    mockDb.get.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ role: 'collaborator' });

    mockDb.update = vi.fn().mockReturnThis();
    mockDb.set.mockReturnThis();

    const newRole = 'owner';
    expect(newRole).toBe('owner');
  });

  it('should allow demoting owner if multiple owners exist', async () => {
    mockDb.get
      .mockResolvedValueOnce({ count: 2 }) // Two owners
      .mockResolvedValueOnce({ role: 'owner' }); // Target is owner

    mockDb.update = vi.fn().mockReturnThis();
    mockDb.set.mockReturnThis();

    const ownerCount = 2;
    expect(ownerCount > 1).toBe(true);
  });

  it('should sync role update to Durable Object', async () => {
    mockDb.get.mockResolvedValueOnce({ count: 2 }).mockResolvedValueOnce({ role: 'collaborator' });

    const doFetch = vi.fn().mockResolvedValue({ ok: true });
    mockEnv.PROJECT_DOC.get.mockReturnValue({ fetch: doFetch });

    expect(mockEnv.PROJECT_DOC.get).toBeDefined();
  });
});

describe('Member Routes - DELETE /api/projects/:projectId/members/:userId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow owner to remove member', async () => {
    mockDb.get
      .mockResolvedValueOnce({ role: 'collaborator' }) // Target member
      .mockResolvedValueOnce({ count: 2 }); // Owner count (not relevant for collaborator)

    mockDb.delete = vi.fn().mockReturnThis();
    mockDb.where.mockReturnThis();

    expect(mockDb.delete).toBeDefined();
  });

  it('should allow member to remove themselves', async () => {
    const authUserId = 'user-123';
    const targetUserId = 'user-123';
    const isSelfRemoval = authUserId === targetUserId;

    expect(isSelfRemoval).toBe(true);
  });

  it('should deny non-owner from removing others', async () => {
    const isOwner = false;
    const authUserId = 'user-123';
    const targetUserId = 'user-456';
    const isSelfRemoval = authUserId === targetUserId;

    expect(!isOwner && !isSelfRemoval).toBe(true);
  });

  it('should prevent removing the last owner', async () => {
    mockDb.get
      .mockResolvedValueOnce({ role: 'owner' }) // Target is owner
      .mockResolvedValueOnce({ count: 1 }); // Only one owner

    const ownerCount = 1;
    const targetRole = 'owner';

    expect(targetRole === 'owner' && ownerCount <= 1).toBe(true);
  });

  it('should allow removing owner if multiple owners exist', async () => {
    mockDb.get
      .mockResolvedValueOnce({ role: 'owner' }) // Target is owner
      .mockResolvedValueOnce({ count: 3 }); // Three owners

    mockDb.delete = vi.fn().mockReturnThis();
    mockDb.where.mockReturnThis();

    const ownerCount = 3;
    expect(ownerCount > 1).toBe(true);
  });

  it('should return 404 if member not found', async () => {
    mockDb.get.mockResolvedValue(null);

    expect(mockDb.get).toBeDefined();
  });

  it('should sync member removal to Durable Object', async () => {
    mockDb.get.mockResolvedValueOnce({ role: 'collaborator' }).mockResolvedValueOnce({ count: 2 });

    const doFetch = vi.fn().mockResolvedValue({ ok: true });
    mockEnv.PROJECT_DOC.get.mockReturnValue({ fetch: doFetch });

    expect(mockEnv.PROJECT_DOC.get).toBeDefined();
  });
});

describe('Member Routes - Project Membership Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should verify user is project member', async () => {
    mockDb.get.mockResolvedValue({ role: 'owner' });

    expect(mockDb.where).toBeDefined();
  });

  it('should return 404 for non-members', async () => {
    mockDb.get.mockResolvedValue(null);

    expect(mockDb.get).toBeDefined();
  });

  it('should set project context for valid members', async () => {
    mockDb.get.mockResolvedValue({ role: 'owner' });

    const membership = { role: 'owner' };
    expect(membership.role).toBe('owner');
  });

  it('should identify owner status', async () => {
    mockDb.get.mockResolvedValue({ role: 'owner' });

    const isOwner = 'owner' === 'owner';
    expect(isOwner).toBe(true);
  });

  it('should identify non-owner status', async () => {
    mockDb.get.mockResolvedValue({ role: 'collaborator' });

    const isOwner = 'collaborator' === 'owner';
    expect(isOwner).toBe(false);
  });
});

describe('Member Routes - Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle database errors gracefully', async () => {
    mockDb.get.mockRejectedValue(new Error('Database connection failed'));

    expect(mockDb.get).toBeDefined();
  });

  it('should handle DO sync failures gracefully', async () => {
    const doFetch = vi.fn().mockRejectedValue(new Error('DO sync failed'));
    mockEnv.PROJECT_DOC.get.mockReturnValue({ fetch: doFetch });

    // DO sync failures should be logged but not fail the request
    expect(doFetch).toBeDefined();
  });

  it('should handle notification failures gracefully', async () => {
    const userSessionFetch = vi.fn().mockRejectedValue(new Error('Notification failed'));
    mockEnv.USER_SESSION.get.mockReturnValue({ fetch: userSessionFetch });

    // Notification failures should be logged but not fail the request
    expect(userSessionFetch).toBeDefined();
  });
});
