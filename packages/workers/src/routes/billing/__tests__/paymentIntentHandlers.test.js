/**
 * Tests for payment intent webhook event handlers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handlePaymentIntentProcessing,
  handlePaymentIntentSucceeded,
  handlePaymentIntentFailed,
} from '../handlers/paymentIntentHandlers.js';

function createTestContext() {
  return {
    logger: {
      stripe: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
}

describe('Payment Intent Handlers', () => {
  describe('handlePaymentIntentProcessing', () => {
    it('logs payment intent processing details', async () => {
      const paymentIntent = {
        id: 'pi_123',
        amount: 2999,
        currency: 'usd',
        payment_method_types: ['card'],
        customer: 'cus_123',
        metadata: { orderId: 'order-1' },
      };

      const ctx = createTestContext();
      const result = await handlePaymentIntentProcessing(paymentIntent, ctx);

      expect(result.handled).toBe(true);
      expect(result.result).toBe('processing_logged');
      expect(result.ledgerContext.stripePaymentIntentId).toBe('pi_123');
      expect(result.ledgerContext.stripeCustomerId).toBe('cus_123');
      expect(ctx.logger.stripe).toHaveBeenCalledWith('payment_intent_processing', {
        stripePaymentIntentId: 'pi_123',
        amount: 2999,
        currency: 'usd',
        paymentMethodTypes: ['card'],
        isACH: false,
        metadata: { orderId: 'order-1' },
      });
    });

    it('detects ACH payment method', async () => {
      const paymentIntent = {
        id: 'pi_ach_123',
        amount: 5000,
        currency: 'usd',
        payment_method_types: ['us_bank_account'],
        customer: 'cus_456',
        metadata: {},
      };

      const ctx = createTestContext();
      const result = await handlePaymentIntentProcessing(paymentIntent, ctx);

      expect(result.handled).toBe(true);
      expect(ctx.logger.stripe).toHaveBeenCalledWith(
        'payment_intent_processing',
        expect.objectContaining({
          isACH: true,
          paymentMethodTypes: ['us_bank_account'],
        }),
      );
    });

    it('handles customer object instead of string ID', async () => {
      const paymentIntent = {
        id: 'pi_123',
        amount: 2999,
        currency: 'usd',
        payment_method_types: ['card'],
        customer: { id: 'cus_obj_123' },
        metadata: {},
      };

      const ctx = createTestContext();
      const result = await handlePaymentIntentProcessing(paymentIntent, ctx);

      expect(result.ledgerContext.stripeCustomerId).toBe('cus_obj_123');
    });

    it('handles null customer gracefully', async () => {
      const paymentIntent = {
        id: 'pi_guest',
        amount: 1000,
        currency: 'usd',
        payment_method_types: ['card'],
        customer: null,
        metadata: {},
      };

      const ctx = createTestContext();
      const result = await handlePaymentIntentProcessing(paymentIntent, ctx);

      expect(result.handled).toBe(true);
      expect(result.ledgerContext.stripeCustomerId).toBeUndefined();
    });
  });

  describe('handlePaymentIntentSucceeded', () => {
    it('logs payment intent success details', async () => {
      const paymentIntent = {
        id: 'pi_success_123',
        amount: 4999,
        currency: 'usd',
        payment_method_types: ['card'],
        customer: 'cus_123',
        metadata: { productId: 'prod-1' },
        invoice: 'in_123',
      };

      const ctx = createTestContext();
      const result = await handlePaymentIntentSucceeded(paymentIntent, ctx);

      expect(result.handled).toBe(true);
      expect(result.result).toBe('succeeded_logged');
      expect(result.ledgerContext.stripePaymentIntentId).toBe('pi_success_123');
      expect(ctx.logger.stripe).toHaveBeenCalledWith('payment_intent_succeeded', {
        stripePaymentIntentId: 'pi_success_123',
        amount: 4999,
        currency: 'usd',
        paymentMethodTypes: ['card'],
        metadata: { productId: 'prod-1' },
        invoice: 'in_123',
      });
    });

    it('handles missing invoice field', async () => {
      const paymentIntent = {
        id: 'pi_no_invoice',
        amount: 2999,
        currency: 'usd',
        payment_method_types: ['card'],
        customer: 'cus_123',
        metadata: {},
      };

      const ctx = createTestContext();
      const result = await handlePaymentIntentSucceeded(paymentIntent, ctx);

      expect(result.handled).toBe(true);
      expect(ctx.logger.stripe).toHaveBeenCalledWith(
        'payment_intent_succeeded',
        expect.objectContaining({
          invoice: undefined,
        }),
      );
    });
  });

  describe('handlePaymentIntentFailed', () => {
    it('logs payment failure with error details', async () => {
      const paymentIntent = {
        id: 'pi_failed_123',
        amount: 2999,
        currency: 'usd',
        payment_method_types: ['card'],
        customer: 'cus_123',
        metadata: {},
        last_payment_error: {
          code: 'card_declined',
          message: 'Your card was declined.',
          type: 'card_error',
          decline_code: 'insufficient_funds',
        },
      };

      const ctx = createTestContext();
      const result = await handlePaymentIntentFailed(paymentIntent, ctx);

      expect(result.handled).toBe(true);
      expect(result.result).toBe('failure_logged');
      expect(result.ledgerContext.stripePaymentIntentId).toBe('pi_failed_123');
      expect(ctx.logger.stripe).toHaveBeenCalledWith('payment_intent_failed', {
        stripePaymentIntentId: 'pi_failed_123',
        amount: 2999,
        currency: 'usd',
        errorCode: 'card_declined',
        errorMessage: 'Your card was declined.',
        errorType: 'card_error',
        declineCode: 'insufficient_funds',
        paymentMethodTypes: ['card'],
        metadata: {},
      });
    });

    it('handles missing error details gracefully', async () => {
      const paymentIntent = {
        id: 'pi_failed_no_error',
        amount: 2999,
        currency: 'usd',
        payment_method_types: ['card'],
        customer: 'cus_123',
        metadata: {},
        last_payment_error: null,
      };

      const ctx = createTestContext();
      const result = await handlePaymentIntentFailed(paymentIntent, ctx);

      expect(result.handled).toBe(true);
      expect(ctx.logger.stripe).toHaveBeenCalledWith(
        'payment_intent_failed',
        expect.objectContaining({
          errorCode: undefined,
          errorMessage: undefined,
          errorType: undefined,
          declineCode: undefined,
        }),
      );
    });

    it('handles authentication failure error', async () => {
      const paymentIntent = {
        id: 'pi_auth_failed',
        amount: 5000,
        currency: 'eur',
        payment_method_types: ['card'],
        customer: { id: 'cus_eu_123' },
        metadata: {},
        last_payment_error: {
          code: 'authentication_required',
          message: 'This payment requires authentication.',
          type: 'card_error',
        },
      };

      const ctx = createTestContext();
      const result = await handlePaymentIntentFailed(paymentIntent, ctx);

      expect(result.handled).toBe(true);
      expect(result.ledgerContext.stripeCustomerId).toBe('cus_eu_123');
      expect(ctx.logger.stripe).toHaveBeenCalledWith(
        'payment_intent_failed',
        expect.objectContaining({
          errorCode: 'authentication_required',
        }),
      );
    });
  });
});
