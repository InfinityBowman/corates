/**
 * Tests for customer webhook event handlers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { resetTestDatabase, seedUser } from '@/__tests__/helpers.js';
import { createDb } from '@/db/client.js';
import { handleCustomerUpdated, handleCustomerDeleted } from '../handlers/customerHandlers.js';
import { user } from '@/db/schema.js';
import { eq } from 'drizzle-orm';

// Create a test context with db and logger
function createTestContext(db) {
  return {
    db,
    logger: {
      stripe: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
}

describe('Customer Handlers', () => {
  let db;

  beforeEach(async () => {
    await resetTestDatabase();
    db = createDb(env.DB);
  });

  describe('handleCustomerUpdated', () => {
    it('returns user_not_found when no matching user exists', async () => {
      const customer = {
        id: 'cus_nonexistent',
        email: 'unknown@example.com',
        name: 'Unknown User',
      };

      const ctx = createTestContext(db);
      const result = await handleCustomerUpdated(customer, ctx);

      expect(result.handled).toBe(true);
      expect(result.result).toBe('user_not_found');
      expect(result.ledgerContext.reason).toBe('no_matching_user');
      expect(ctx.logger.stripe).toHaveBeenCalledWith('customer_updated_user_not_found', {
        stripeCustomerId: 'cus_nonexistent',
        customerEmail: 'unknown@example.com',
      });
    });

    it('logs email mismatch but does not update email', async () => {
      const nowSec = Math.floor(Date.now() / 1000);

      await seedUser({
        id: 'user-1',
        name: 'Test User',
        email: 'original@example.com',
        stripeCustomerId: 'cus_123',
        createdAt: nowSec,
        updatedAt: nowSec,
      });

      const customer = {
        id: 'cus_123',
        email: 'new@example.com',
        name: 'Test User',
      };

      const ctx = createTestContext(db);
      const result = await handleCustomerUpdated(customer, ctx);

      expect(result.handled).toBe(true);
      expect(ctx.logger.stripe).toHaveBeenCalledWith('customer_email_mismatch', {
        userId: 'user-1',
        localEmail: 'original@example.com',
        stripeEmail: 'new@example.com',
      });

      // Verify email was NOT changed
      const [updatedUser] = await db.select().from(user).where(eq(user.id, 'user-1'));
      expect(updatedUser.email).toBe('original@example.com');
    });

    it('updates name when it differs from local', async () => {
      const nowSec = Math.floor(Date.now() / 1000);

      await seedUser({
        id: 'user-1',
        name: 'Old Name',
        email: 'test@example.com',
        stripeCustomerId: 'cus_123',
        createdAt: nowSec,
        updatedAt: nowSec,
      });

      const customer = {
        id: 'cus_123',
        email: 'test@example.com',
        name: 'New Name',
      };

      const ctx = createTestContext(db);
      const result = await handleCustomerUpdated(customer, ctx);

      expect(result.handled).toBe(true);
      expect(result.result).toBe('user_updated');
      expect(result.ledgerContext.fieldsUpdated).toContain('name');
      expect(ctx.logger.stripe).toHaveBeenCalledWith('customer_updated_synced', {
        userId: 'user-1',
        stripeCustomerId: 'cus_123',
        fieldsUpdated: ['name'],
      });

      // Verify name was updated
      const [updatedUser] = await db.select().from(user).where(eq(user.id, 'user-1'));
      expect(updatedUser.name).toBe('New Name');
    });

    it('returns no_changes when nothing differs', async () => {
      const nowSec = Math.floor(Date.now() / 1000);

      await seedUser({
        id: 'user-1',
        name: 'Same Name',
        email: 'test@example.com',
        stripeCustomerId: 'cus_123',
        createdAt: nowSec,
        updatedAt: nowSec,
      });

      const customer = {
        id: 'cus_123',
        email: 'test@example.com',
        name: 'Same Name',
      };

      const ctx = createTestContext(db);
      const result = await handleCustomerUpdated(customer, ctx);

      expect(result.handled).toBe(true);
      expect(result.result).toBe('no_changes');
      expect(result.ledgerContext.fieldsUpdated).toEqual([]);
    });

    it('handles customer with no name gracefully', async () => {
      const nowSec = Math.floor(Date.now() / 1000);

      await seedUser({
        id: 'user-1',
        name: 'Original Name',
        email: 'test@example.com',
        stripeCustomerId: 'cus_123',
        createdAt: nowSec,
        updatedAt: nowSec,
      });

      const customer = {
        id: 'cus_123',
        email: 'test@example.com',
        name: null,
      };

      const ctx = createTestContext(db);
      const result = await handleCustomerUpdated(customer, ctx);

      expect(result.handled).toBe(true);
      expect(result.result).toBe('no_changes');

      // Verify name was NOT cleared
      const [updatedUser] = await db.select().from(user).where(eq(user.id, 'user-1'));
      expect(updatedUser.name).toBe('Original Name');
    });
  });

  describe('handleCustomerDeleted', () => {
    it('returns user_not_found when no matching user exists', async () => {
      const customer = {
        id: 'cus_nonexistent',
      };

      const ctx = createTestContext(db);
      const result = await handleCustomerDeleted(customer, ctx);

      expect(result.handled).toBe(true);
      expect(result.result).toBe('user_not_found');
      expect(result.ledgerContext.reason).toBe('no_matching_user');
      expect(ctx.logger.stripe).toHaveBeenCalledWith('customer_deleted_user_not_found', {
        stripeCustomerId: 'cus_nonexistent',
      });
    });

    it('clears stripeCustomerId when customer is deleted', async () => {
      const nowSec = Math.floor(Date.now() / 1000);

      await seedUser({
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        stripeCustomerId: 'cus_123',
        createdAt: nowSec,
        updatedAt: nowSec,
      });

      // Verify user has stripeCustomerId before deletion
      const [userBefore] = await db.select().from(user).where(eq(user.id, 'user-1'));
      expect(userBefore.stripeCustomerId).toBe('cus_123');

      const customer = {
        id: 'cus_123',
      };

      const ctx = createTestContext(db);
      const result = await handleCustomerDeleted(customer, ctx);

      expect(result.handled).toBe(true);
      expect(result.result).toBe('association_cleared');
      expect(result.ledgerContext).toEqual({
        userId: 'user-1',
        stripeCustomerId: 'cus_123',
        action: 'stripe_customer_id_cleared',
      });
      expect(ctx.logger.stripe).toHaveBeenCalledWith('customer_deleted_association_cleared', {
        userId: 'user-1',
        stripeCustomerId: 'cus_123',
      });

      // Verify stripeCustomerId was cleared
      const [updatedUser] = await db.select().from(user).where(eq(user.id, 'user-1'));
      expect(updatedUser.stripeCustomerId).toBeNull();
    });

    it('does not delete the user when customer is deleted', async () => {
      const nowSec = Math.floor(Date.now() / 1000);

      await seedUser({
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        stripeCustomerId: 'cus_123',
        createdAt: nowSec,
        updatedAt: nowSec,
      });

      const customer = {
        id: 'cus_123',
      };

      const ctx = createTestContext(db);
      await handleCustomerDeleted(customer, ctx);

      // Verify user still exists
      const [existingUser] = await db.select().from(user).where(eq(user.id, 'user-1'));
      expect(existingUser).toBeDefined();
      expect(existingUser.email).toBe('test@example.com');
      expect(existingUser.name).toBe('Test User');
    });

    it('updates updatedAt timestamp when clearing stripeCustomerId', async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const pastTimestamp = nowSec - 86400; // 1 day ago

      await seedUser({
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        stripeCustomerId: 'cus_123',
        createdAt: pastTimestamp,
        updatedAt: pastTimestamp,
      });

      const customer = {
        id: 'cus_123',
      };

      const ctx = createTestContext(db);
      await handleCustomerDeleted(customer, ctx);

      // Verify updatedAt was updated
      const [updatedUser] = await db.select().from(user).where(eq(user.id, 'user-1'));

      // updatedAt should be more recent than the past timestamp
      const updatedAtTimestamp = Math.floor(updatedUser.updatedAt.getTime() / 1000);
      expect(updatedAtTimestamp).toBeGreaterThan(pastTimestamp);
    });
  });
});
