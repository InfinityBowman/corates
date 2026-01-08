/**
 * Admin Stripe tools routes
 * Provides direct Stripe customer lookup, portal link generation, and invoice viewing
 */

import { Hono } from 'hono';
import { createDb } from '@/db/client.js';
import { user, organization, subscription } from '@/db/schema.js';
import { eq } from 'drizzle-orm';
import { createDomainError, SYSTEM_ERRORS, VALIDATION_ERRORS } from '@corates/shared';
import Stripe from 'stripe';

const stripeToolsRoutes = new Hono();

/**
 * GET /api/admin/stripe/customer
 * Look up a Stripe customer by email or customer ID
 * Query params: email, customerId (one required)
 */
stripeToolsRoutes.get('/stripe/customer', async c => {
  const email = c.req.query('email');
  const customerId = c.req.query('customerId');

  if (!email && !customerId) {
    const error = createDomainError(VALIDATION_ERRORS.FIELD_REQUIRED, {
      field: 'email or customerId',
    });
    return c.json(error, error.statusCode);
  }

  if (!c.env.STRIPE_SECRET_KEY) {
    const error = createDomainError(SYSTEM_ERRORS.SERVICE_UNAVAILABLE, {
      message: 'Stripe is not configured',
    });
    return c.json(error, error.statusCode);
  }

  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-11-17.clover',
  });

  try {
    let customer = null;

    if (customerId) {
      // Direct lookup by ID
      try {
        customer = await stripe.customers.retrieve(customerId);
        if (customer.deleted) {
          return c.json({
            found: false,
            message: 'Customer has been deleted in Stripe',
            customerId,
          });
        }
      } catch (err) {
        if (err.code === 'resource_missing') {
          return c.json({
            found: false,
            message: 'Customer not found in Stripe',
            customerId,
          });
        }
        throw err;
      }
    } else if (email) {
      // Search by email
      const customers = await stripe.customers.list({
        email: email.toLowerCase(),
        limit: 1,
      });

      if (customers.data.length === 0) {
        return c.json({
          found: false,
          message: 'No customer found with this email',
          email,
        });
      }

      customer = customers.data[0];
    }

    // Look up associated user and org in our database
    const db = createDb(c.env.DB);

    let linkedUser = null;
    let linkedOrg = null;

    // Find user by stripeCustomerId
    const [userByStripe] = await db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        displayName: user.displayName,
      })
      .from(user)
      .where(eq(user.stripeCustomerId, customer.id))
      .limit(1);

    if (userByStripe) {
      linkedUser = userByStripe;
    } else if (customer.email) {
      // Try to find by email
      const [userByEmail] = await db
        .select({
          id: user.id,
          email: user.email,
          name: user.name,
          displayName: user.displayName,
          stripeCustomerId: user.stripeCustomerId,
        })
        .from(user)
        .where(eq(user.email, customer.email))
        .limit(1);

      if (userByEmail) {
        linkedUser = userByEmail;
      }
    }

    // Find org by stripeCustomerId in subscription table
    const [subWithOrg] = await db
      .select({
        orgId: subscription.referenceId,
        orgName: organization.name,
        orgSlug: organization.slug,
      })
      .from(subscription)
      .leftJoin(organization, eq(subscription.referenceId, organization.id))
      .where(eq(subscription.stripeCustomerId, customer.id))
      .limit(1);

    if (subWithOrg) {
      linkedOrg = {
        id: subWithOrg.orgId,
        name: subWithOrg.orgName,
        slug: subWithOrg.orgSlug,
      };
    }

    return c.json({
      found: true,
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        phone: customer.phone,
        created: customer.created,
        currency: customer.currency,
        defaultSource: customer.default_source,
        invoicePrefix: customer.invoice_prefix,
        balance: customer.balance,
        delinquent: customer.delinquent,
        metadata: customer.metadata,
        livemode: customer.livemode,
      },
      linkedUser,
      linkedOrg,
      stripeDashboardUrl: `https://dashboard.stripe.com/customers/${customer.id}`,
    });
  } catch (error) {
    console.error('Error looking up Stripe customer:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.EXTERNAL_SERVICE_ERROR, {
      service: 'Stripe',
      message: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * POST /api/admin/stripe/portal-link
 * Generate a customer portal link for a Stripe customer
 * Body: { customerId, returnUrl? }
 */
stripeToolsRoutes.post('/stripe/portal-link', async c => {
  const body = await c.req.json();
  const { customerId, returnUrl } = body;

  if (!customerId) {
    const error = createDomainError(VALIDATION_ERRORS.FIELD_REQUIRED, {
      field: 'customerId',
    });
    return c.json(error, error.statusCode);
  }

  if (!c.env.STRIPE_SECRET_KEY) {
    const error = createDomainError(SYSTEM_ERRORS.SERVICE_UNAVAILABLE, {
      message: 'Stripe is not configured',
    });
    return c.json(error, error.statusCode);
  }

  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-11-17.clover',
  });

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || c.env.APP_URL || 'https://corates.com',
    });

    return c.json({
      success: true,
      url: session.url,
      expiresAt: session.created + 300, // Portal links typically expire in 5 minutes
    });
  } catch (error) {
    console.error('Error creating portal link:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.EXTERNAL_SERVICE_ERROR, {
      service: 'Stripe',
      message: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * GET /api/admin/stripe/customer/:customerId/invoices
 * Get recent invoices for a Stripe customer
 */
stripeToolsRoutes.get('/stripe/customer/:customerId/invoices', async c => {
  const customerId = c.req.param('customerId');
  const limit = Math.min(parseInt(c.req.query('limit') || '10', 10), 50);

  if (!c.env.STRIPE_SECRET_KEY) {
    const error = createDomainError(SYSTEM_ERRORS.SERVICE_UNAVAILABLE, {
      message: 'Stripe is not configured',
    });
    return c.json(error, error.statusCode);
  }

  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-11-17.clover',
  });

  try {
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit,
    });

    return c.json({
      customerId,
      invoices: invoices.data.map(inv => ({
        id: inv.id,
        number: inv.number,
        status: inv.status,
        currency: inv.currency,
        amountDue: inv.amount_due,
        amountPaid: inv.amount_paid,
        amountRemaining: inv.amount_remaining,
        total: inv.total,
        subtotal: inv.subtotal,
        created: inv.created,
        dueDate: inv.due_date,
        paidAt: inv.status_transitions?.paid_at,
        hostedInvoiceUrl: inv.hosted_invoice_url,
        invoicePdf: inv.invoice_pdf,
        subscriptionId: inv.subscription,
        periodStart: inv.period_start,
        periodEnd: inv.period_end,
      })),
      hasMore: invoices.has_more,
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.EXTERNAL_SERVICE_ERROR, {
      service: 'Stripe',
      message: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * GET /api/admin/stripe/customer/:customerId/payment-methods
 * Get payment methods for a Stripe customer
 */
stripeToolsRoutes.get('/stripe/customer/:customerId/payment-methods', async c => {
  const customerId = c.req.param('customerId');

  if (!c.env.STRIPE_SECRET_KEY) {
    const error = createDomainError(SYSTEM_ERRORS.SERVICE_UNAVAILABLE, {
      message: 'Stripe is not configured',
    });
    return c.json(error, error.statusCode);
  }

  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-11-17.clover',
  });

  try {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });

    return c.json({
      customerId,
      paymentMethods: paymentMethods.data.map(pm => ({
        id: pm.id,
        type: pm.type,
        card:
          pm.card ?
            {
              brand: pm.card.brand,
              last4: pm.card.last4,
              expMonth: pm.card.exp_month,
              expYear: pm.card.exp_year,
              funding: pm.card.funding,
              country: pm.card.country,
            }
          : null,
        created: pm.created,
      })),
    });
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.EXTERNAL_SERVICE_ERROR, {
      service: 'Stripe',
      message: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * GET /api/admin/stripe/customer/:customerId/subscriptions
 * Get subscriptions for a Stripe customer directly from Stripe
 */
stripeToolsRoutes.get('/stripe/customer/:customerId/subscriptions', async c => {
  const customerId = c.req.param('customerId');

  if (!c.env.STRIPE_SECRET_KEY) {
    const error = createDomainError(SYSTEM_ERRORS.SERVICE_UNAVAILABLE, {
      message: 'Stripe is not configured',
    });
    return c.json(error, error.statusCode);
  }

  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-11-17.clover',
  });

  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 20,
    });

    return c.json({
      customerId,
      subscriptions: subscriptions.data.map(sub => ({
        id: sub.id,
        status: sub.status,
        currency: sub.currency,
        currentPeriodStart: sub.current_period_start,
        currentPeriodEnd: sub.current_period_end,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        cancelAt: sub.cancel_at,
        canceledAt: sub.canceled_at,
        endedAt: sub.ended_at,
        trialStart: sub.trial_start,
        trialEnd: sub.trial_end,
        created: sub.created,
        items: sub.items.data.map(item => ({
          id: item.id,
          priceId: item.price.id,
          productId: item.price.product,
          unitAmount: item.price.unit_amount,
          interval: item.price.recurring?.interval,
          quantity: item.quantity,
        })),
        defaultPaymentMethod: sub.default_payment_method,
        latestInvoice: sub.latest_invoice,
        metadata: sub.metadata,
      })),
      hasMore: subscriptions.has_more,
    });
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.EXTERNAL_SERVICE_ERROR, {
      service: 'Stripe',
      message: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

export { stripeToolsRoutes };
