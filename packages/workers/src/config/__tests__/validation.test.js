/**
 * Tests for Zod validation schemas and helpers
 */

import { describe, it, expect } from 'vitest';
import {
  validateBody,
  validateQuery,
  projectSchemas,
  memberSchemas,
  userSchemas,
  emailSchemas,
} from '../validation.js';

describe('validateBody', () => {
  it('should return success for valid data', () => {
    const schema = projectSchemas.create;
    const data = { name: 'Test Project', description: 'A test project' };

    const result = validateBody(schema, data);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.name).toBe('Test Project');
  });

  it('should return error for invalid data', () => {
    const schema = projectSchemas.create;
    const data = { name: '' }; // Empty name should fail

    const result = validateBody(schema, data);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error.message).toBe('Validation failed');
    expect(result.error.errors).toBeInstanceOf(Array);
  });

  it('should format error messages with field paths', () => {
    const schema = projectSchemas.create;
    const data = { name: '' };

    const result = validateBody(schema, data);

    expect(result.error.errors[0]).toHaveProperty('field');
    expect(result.error.errors[0]).toHaveProperty('message');
  });
});

describe('projectSchemas', () => {
  describe('create', () => {
    it('should accept valid project data', () => {
      const data = { name: 'My Project', description: 'Project description' };
      const result = validateBody(projectSchemas.create, data);

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('My Project');
    });

    it('should trim project name', () => {
      const data = { name: '  My Project  ', description: 'Test' };
      const result = validateBody(projectSchemas.create, data);

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('My Project');
    });

    it('should reject empty project name', () => {
      const data = { name: '' };
      const result = validateBody(projectSchemas.create, data);

      expect(result.success).toBe(false);
      expect(result.error.errors[0].message).toContain('required');
    });

    it('should reject project name > 255 characters', () => {
      const data = { name: 'a'.repeat(256) };
      const result = validateBody(projectSchemas.create, data);

      expect(result.success).toBe(false);
      expect(result.error.errors[0].message).toContain('255');
    });

    it('should reject description > 2000 characters', () => {
      const data = { name: 'Test', description: 'a'.repeat(2001) };
      const result = validateBody(projectSchemas.create, data);

      expect(result.success).toBe(false);
    });

    it('should allow missing description', () => {
      const data = { name: 'Test Project' };
      const result = validateBody(projectSchemas.create, data);

      expect(result.success).toBe(true);
    });

    it('should trim description and convert empty to null', () => {
      const data = { name: 'Test', description: '   ' };
      const result = validateBody(projectSchemas.create, data);

      expect(result.success).toBe(true);
      expect(result.data.description).toBeNull();
    });
  });

  describe('update', () => {
    it('should allow partial updates', () => {
      const data = { name: 'Updated Name' };
      const result = validateBody(projectSchemas.update, data);

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Updated Name');
    });

    it('should allow updating only description', () => {
      const data = { description: 'Updated description' };
      const result = validateBody(projectSchemas.update, data);

      expect(result.success).toBe(true);
    });

    it('should accept whitespace-only name and trim it', () => {
      // After trimming, whitespace becomes empty string which is optional in update schema
      const data = { name: '  ' };
      const result = validateBody(projectSchemas.update, data);

      expect(result.success).toBe(true);
    });
  });
});

describe('memberSchemas', () => {
  describe('add', () => {
    it('should accept userId and role', () => {
      const data = { userId: 'user-123', role: 'member' };
      const result = validateBody(memberSchemas.add, data);

      expect(result.success).toBe(true);
      expect(result.data.role).toBe('member');
    });

    it('should accept email instead of userId', () => {
      const data = { email: 'test@example.com', role: 'collaborator' };
      const result = validateBody(memberSchemas.add, data);

      expect(result.success).toBe(true);
    });

    it('should default role to member', () => {
      const data = { userId: 'user-123' };
      const result = validateBody(memberSchemas.add, data);

      expect(result.success).toBe(true);
      expect(result.data.role).toBe('member');
    });

    it('should require either userId or email', () => {
      const data = { role: 'member' };
      const result = validateBody(memberSchemas.add, data);

      expect(result.success).toBe(false);
      expect(result.error.errors[0].message).toContain('userId or email');
    });

    it('should reject invalid email', () => {
      const data = { email: 'not-an-email', role: 'member' };
      const result = validateBody(memberSchemas.add, data);

      expect(result.success).toBe(false);
    });

    it('should reject invalid role', () => {
      const data = { userId: 'user-123', role: 'invalid-role' };
      const result = validateBody(memberSchemas.add, data);

      expect(result.success).toBe(false);
    });
  });

  describe('updateRole', () => {
    it('should accept valid role update', () => {
      const data = { role: 'collaborator' };
      const result = validateBody(memberSchemas.updateRole, data);

      expect(result.success).toBe(true);
    });

    it('should reject invalid role', () => {
      const data = { role: 'superuser' };
      const result = validateBody(memberSchemas.updateRole, data);

      expect(result.success).toBe(false);
    });
  });
});

describe('userSchemas', () => {
  describe('search', () => {
    it('should accept valid search query', () => {
      const data = { q: 'john', limit: '10' };
      const result = validateQuery(userSchemas.search, data);

      expect(result.success).toBe(true);
      expect(result.data.q).toBe('john');
    });

    it('should reject search query < 2 characters', () => {
      const data = { q: 'a' };
      const result = validateQuery(userSchemas.search, data);

      expect(result.success).toBe(false);
    });

    it('should transform limit to number and cap at 20', () => {
      const data = { q: 'test', limit: '100' };
      const result = validateQuery(userSchemas.search, data);

      expect(result.success).toBe(true);
      expect(result.data.limit).toBe(20);
    });

    it('should default limit to 10', () => {
      const data = { q: 'test' };
      const result = validateQuery(userSchemas.search, data);

      expect(result.success).toBe(true);
      expect(result.data.limit).toBe(10);
    });

    it('should enforce minimum limit of 1', () => {
      const data = { q: 'test', limit: '-5' };
      const result = validateQuery(userSchemas.search, data);

      expect(result.success).toBe(true);
      expect(result.data.limit).toBe(1);
    });
  });
});

describe('emailSchemas', () => {
  describe('queue', () => {
    it('should accept email with html content', () => {
      const data = {
        to: 'user@example.com',
        subject: 'Test Email',
        html: '<p>Hello</p>',
      };
      const result = validateBody(emailSchemas.queue, data);

      expect(result.success).toBe(true);
    });

    it('should accept email with text content', () => {
      const data = {
        to: 'user@example.com',
        subject: 'Test Email',
        text: 'Hello',
      };
      const result = validateBody(emailSchemas.queue, data);

      expect(result.success).toBe(true);
    });

    it('should require either html or text', () => {
      const data = {
        to: 'user@example.com',
        subject: 'Test Email',
      };
      const result = validateBody(emailSchemas.queue, data);

      expect(result.success).toBe(false);
      expect(result.error.errors[0].message).toContain('html or text');
    });

    it('should reject invalid email address', () => {
      const data = {
        to: 'not-an-email',
        html: '<p>Test</p>',
      };
      const result = validateBody(emailSchemas.queue, data);

      expect(result.success).toBe(false);
    });

    it('should reject subject > 255 characters', () => {
      const data = {
        to: 'user@example.com',
        subject: 'a'.repeat(256),
        html: '<p>Test</p>',
      };
      const result = validateBody(emailSchemas.queue, data);

      expect(result.success).toBe(false);
    });
  });
});
