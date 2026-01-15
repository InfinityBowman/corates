/**
 * Admin Stripe tools routes
 * Provides direct Stripe customer lookup, portal link generation, and invoice viewing
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { createDb } from '@/db/client.js';
import { user, organization, subscription } from '@/db/schema.js';
import { eq } from 'drizzle-orm';
import { createDomainError, SYSTEM_ERRORS, VALIDATION_ERRORS } from '@corates/shared';
import Stripe from 'stripe';
import { validationHook } from '@/lib/honoValidationHook.js';

const stripeToolsRoutes = new OpenAPIHono({
  defaultHook: validationHook,
});

// Response schemas
const StripeCustomerSchema = z
  .object({
    id: z.string(),
    email: z.string().nullable(),
    name: z.string().nullable(),
    phone: z.string().nullable(),
    created: z.number(),
    currency: z.string().nullable(),
    defaultSource: z.string().nullable(),
    invoicePrefix: z.string().nullable(),
    balance: z.number(),
    delinquent: z.boolean(),
    metadata: z.record(z.string()),
    livemode: z.boolean(),
  })
  .openapi('StripeCustomer');

const LinkedUserSchema = z
  .object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
    displayName: z.string().nullable(),
    stripeCustomerId: z.string().optional(),
  })
  .nullable()
  .openapi('LinkedUser');

const LinkedOrgSchema = z
  .object({
    id: z.string(),
    name: z.string().nullable(),
    slug: z.string().nullable(),
  })
  .nullable()
  .openapi('LinkedOrg');

const CustomerLookupResponseSchema = z
  .object({
    found: z.boolean(),
    message: z.string().optional(),
    email: z.string().optional(),
    customerId: z.string().optional(),
    customer: StripeCustomerSchema.optional(),
    linkedUser: LinkedUserSchema.optional(),
    linkedOrg: LinkedOrgSchema.optional(),
    stripeDashboardUrl: z.string().optional(),
  })
  .openapi('CustomerLookupResponse');

const PortalLinkResponseSchema = z
  .object({
    success: z.boolean(),
    url: z.string(),
    expiresAt: z.number(),
  })
  .openapi('PortalLinkResponse');

const InvoiceSchema = z
  .object({
    id: z.string(),
    number: z.string().nullable(),
    status: z.string().nullable(),
    currency: z.string(),
    amountDue: z.number(),
    amountPaid: z.number(),
    amountRemaining: z.number(),
    total: z.number(),
    subtotal: z.number(),
    created: z.number(),
    dueDate: z.number().nullable(),
    paidAt: z.number().nullable(),
    hostedInvoiceUrl: z.string().nullable(),
    invoicePdf: z.string().nullable(),
    subscriptionId: z.string().nullable(),
    periodStart: z.number().nullable(),
    periodEnd: z.number().nullable(),
  })
  .openapi('StripeInvoice');

const InvoicesResponseSchema = z
  .object({
    customerId: z.string(),
    invoices: z.array(InvoiceSchema),
    hasMore: z.boolean(),
  })
  .openapi('InvoicesResponse');

const PaymentMethodCardSchema = z
  .object({
    brand: z.string(),
    last4: z.string(),
    expMonth: z.number(),
    expYear: z.number(),
    funding: z.string(),
    country: z.string().nullable(),
  })
  .nullable()
  .openapi('PaymentMethodCard');

const PaymentMethodSchema = z
  .object({
    id: z.string(),
    type: z.string(),
    card: PaymentMethodCardSchema,
    created: z.number(),
  })
  .openapi('PaymentMethod');

const PaymentMethodsResponseSchema = z
  .object({
    customerId: z.string(),
    paymentMethods: z.array(PaymentMethodSchema),
  })
  .openapi('PaymentMethodsResponse');

const SubscriptionItemSchema = z
  .object({
    id: z.string(),
    priceId: z.string(),
    productId: z.union([z.string(), z.record(z.unknown())]),
    unitAmount: z.number().nullable(),
    interval: z.string().nullable(),
    quantity: z.number().nullable(),
  })
  .openapi('SubscriptionItem');

const StripeSubscriptionSchema = z
  .object({
    id: z.string(),
    status: z.string(),
    currency: z.string(),
    currentPeriodStart: z.number(),
    currentPeriodEnd: z.number(),
    cancelAtPeriodEnd: z.boolean(),
    cancelAt: z.number().nullable(),
    canceledAt: z.number().nullable(),
    endedAt: z.number().nullable(),
    trialStart: z.number().nullable(),
    trialEnd: z.number().nullable(),
    created: z.number(),
    items: z.array(SubscriptionItemSchema),
    defaultPaymentMethod: z.string().nullable(),
    latestInvoice: z.string().nullable(),
    metadata: z.record(z.string()),
  })
  .openapi('StripeSubscription');

const SubscriptionsResponseSchema = z
  .object({
    customerId: z.string(),
    subscriptions: z.array(StripeSubscriptionSchema),
    hasMore: z.boolean(),
  })
  .openapi('SubscriptionsResponse');

const StripeErrorSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    statusCode: z.number(),
    details: z.record(z.unknown()).optional(),
  })
  .openapi('StripeToolsError');

// Route definitions
const customerLookupRoute = createRoute({
  method: 'get',
  path: '/stripe/customer',
  tags: ['Admin - Stripe Tools'],
  summary: 'Look up Stripe customer',
  description: 'Look up a Stripe customer by email or customer ID. Admin only.',
  request: {
    query: z.object({
      email: z.string().optional().openapi({ description: 'Customer email' }),
      customerId: z.string().optional().openapi({ description: 'Stripe customer ID' }),
    }),
  },
  responses: {
    200: {
      description: 'Customer details',
      content: {
        'application/json': {
          schema: CustomerLookupResponseSchema,
        },
      },
    },
    400: {
      description: 'Missing required parameter',
      content: {
        'application/json': {
          schema: StripeErrorSchema,
        },
      },
    },
    500: {
      description: 'Stripe API error',
      content: {
        'application/json': {
          schema: StripeErrorSchema,
        },
      },
    },
  },
});

const portalLinkRoute = createRoute({
  method: 'post',
  path: '/stripe/portal-link',
  tags: ['Admin - Stripe Tools'],
  summary: 'Generate portal link',
  description: 'Generate a customer portal link for a Stripe customer. Admin only.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            customerId: z.string().openapi({ description: 'Stripe customer ID' }),
            returnUrl: z
              .string()
              .optional()
              .openapi({ description: 'Return URL after portal session' }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Portal link generated',
      content: {
        'application/json': {
          schema: PortalLinkResponseSchema,
        },
      },
    },
    400: {
      description: 'Validation error',
      content: {
        'application/json': {
          schema: StripeErrorSchema,
        },
      },
    },
    500: {
      description: 'Stripe API error',
      content: {
        'application/json': {
          schema: StripeErrorSchema,
        },
      },
    },
  },
});

const invoicesRoute = createRoute({
  method: 'get',
  path: '/stripe/customer/{customerId}/invoices',
  tags: ['Admin - Stripe Tools'],
  summary: 'Get customer invoices',
  description: 'Get recent invoices for a Stripe customer. Admin only.',
  request: {
    params: z.object({
      customerId: z.string().openapi({ description: 'Stripe customer ID' }),
    }),
    query: z.object({
      limit: z.string().optional().openapi({ description: 'Max invoices (max 50)', example: '10' }),
    }),
  },
  responses: {
    200: {
      description: 'Customer invoices',
      content: {
        'application/json': {
          schema: InvoicesResponseSchema,
        },
      },
    },
    500: {
      description: 'Stripe API error',
      content: {
        'application/json': {
          schema: StripeErrorSchema,
        },
      },
    },
  },
});

const paymentMethodsRoute = createRoute({
  method: 'get',
  path: '/stripe/customer/{customerId}/payment-methods',
  tags: ['Admin - Stripe Tools'],
  summary: 'Get payment methods',
  description: 'Get payment methods for a Stripe customer. Admin only.',
  request: {
    params: z.object({
      customerId: z.string().openapi({ description: 'Stripe customer ID' }),
    }),
  },
  responses: {
    200: {
      description: 'Payment methods',
      content: {
        'application/json': {
          schema: PaymentMethodsResponseSchema,
        },
      },
    },
    500: {
      description: 'Stripe API error',
      content: {
        'application/json': {
          schema: StripeErrorSchema,
        },
      },
    },
  },
});

const subscriptionsRoute = createRoute({
  method: 'get',
  path: '/stripe/customer/{customerId}/subscriptions',
  tags: ['Admin - Stripe Tools'],
  summary: 'Get Stripe subscriptions',
  description: 'Get subscriptions for a Stripe customer directly from Stripe. Admin only.',
  request: {
    params: z.object({
      customerId: z.string().openapi({ description: 'Stripe customer ID' }),
    }),
  },
  responses: {
    200: {
      description: 'Customer subscriptions',
      content: {
        'application/json': {
          schema: SubscriptionsResponseSchema,
        },
      },
    },
    500: {
      description: 'Stripe API error',
      content: {
        'application/json': {
          schema: StripeErrorSchema,
        },
      },
    },
  },
});

/**
 * GET /api/admin/stripe/customer
 * Look up a Stripe customer by email or customer ID
 */
stripeToolsRoutes.openapi(customerLookupRoute, async c => {
  const query = c.req.valid('query');
  const email = query.email;
  const customerId = query.customerId;

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
    apiVersion: '2025-12-15.clover',
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
 */
stripeToolsRoutes.openapi(portalLinkRoute, async c => {
  const body = c.req.valid('json');
  const { customerId, returnUrl } = body;

  if (!c.env.STRIPE_SECRET_KEY) {
    const error = createDomainError(SYSTEM_ERRORS.SERVICE_UNAVAILABLE, {
      message: 'Stripe is not configured',
    });
    return c.json(error, error.statusCode);
  }

  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-12-15.clover',
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
stripeToolsRoutes.openapi(invoicesRoute, async c => {
  const { customerId } = c.req.valid('param');
  const query = c.req.valid('query');
  const parsedLimit = parseInt(query.limit || '10', 10);
  const limit = Math.min(Number.isNaN(parsedLimit) ? 10 : parsedLimit, 50);

  if (!c.env.STRIPE_SECRET_KEY) {
    const error = createDomainError(SYSTEM_ERRORS.SERVICE_UNAVAILABLE, {
      message: 'Stripe is not configured',
    });
    return c.json(error, error.statusCode);
  }

  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-12-15.clover',
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
stripeToolsRoutes.openapi(paymentMethodsRoute, async c => {
  const { customerId } = c.req.valid('param');

  if (!c.env.STRIPE_SECRET_KEY) {
    const error = createDomainError(SYSTEM_ERRORS.SERVICE_UNAVAILABLE, {
      message: 'Stripe is not configured',
    });
    return c.json(error, error.statusCode);
  }

  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-12-15.clover',
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
stripeToolsRoutes.openapi(subscriptionsRoute, async c => {
  const { customerId } = c.req.valid('param');

  if (!c.env.STRIPE_SECRET_KEY) {
    const error = createDomainError(SYSTEM_ERRORS.SERVICE_UNAVAILABLE, {
      message: 'Stripe is not configured',
    });
    return c.json(error, error.statusCode);
  }

  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-12-15.clover',
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
