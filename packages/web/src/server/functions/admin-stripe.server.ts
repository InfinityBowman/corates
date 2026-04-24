import { env } from 'cloudflare:workers';
import type { Database } from '@corates/db/client';
import { organization, subscription, user } from '@corates/db/schema';
import { eq } from 'drizzle-orm';
import { createDomainError, AUTH_ERRORS, SYSTEM_ERRORS } from '@corates/shared';
import { isAdminUser } from '@corates/workers/auth-admin';
import { createStripeClient } from '@corates/workers/stripe';
import type Stripe from 'stripe';
import type { Session } from '@/server/middleware/auth';

function assertAdmin(session: Session) {
  if (!isAdminUser(session.user as { role?: string | null })) {
    throw Response.json(
      createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'admin_required' }),
      { status: 403 },
    );
  }
}

function requireStripe() {
  if (!env.STRIPE_SECRET_KEY) {
    throw Response.json(
      createDomainError(SYSTEM_ERRORS.SERVICE_UNAVAILABLE, { message: 'Stripe is not configured' }),
      { status: 500 },
    );
  }
  return createStripeClient(env);
}

export async function lookupAdminStripeCustomer(
  session: Session,
  db: Database,
  params: { email?: string; customerId?: string },
) {
  assertAdmin(session);
  const stripe = requireStripe();

  const { email, customerId } = params;

  if (!email && !customerId) {
    throw Response.json(
      createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'email_or_customer_id_required' }),
      { status: 400 },
    );
  }

  let customer: Stripe.Customer | null = null;

  if (customerId) {
    try {
      const retrieved = await stripe.customers.retrieve(customerId);
      if ((retrieved as Stripe.DeletedCustomer).deleted) {
        return { found: false as const, message: 'Customer has been deleted in Stripe', customerId };
      }
      customer = retrieved as Stripe.Customer;
    } catch (err) {
      const stripeErr = err as Stripe.errors.StripeError;
      if (stripeErr.code === 'resource_missing') {
        return { found: false as const, message: 'Customer not found in Stripe', customerId };
      }
      throw err;
    }
  } else if (email) {
    const customers = await stripe.customers.list({ email: email.toLowerCase(), limit: 1 });
    if (customers.data.length === 0) {
      return { found: false as const, message: 'No customer found with this email', email };
    }
    customer = customers.data[0];
  }

  if (!customer) {
    return { found: false as const, message: 'Customer not found' };
  }

  let linkedUser: {
    id: string;
    email: string;
    name: string;
    givenName: string | null;
    stripeCustomerId?: string | null;
  } | null = null;

  const [userByStripe] = await db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      givenName: user.givenName,
    })
    .from(user)
    .where(eq(user.stripeCustomerId, customer.id))
    .limit(1);

  if (userByStripe) {
    linkedUser = userByStripe;
  } else if (customer.email) {
    const [userByEmail] = await db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        givenName: user.givenName,
        stripeCustomerId: user.stripeCustomerId,
      })
      .from(user)
      .where(eq(user.email, customer.email))
      .limit(1);

    if (userByEmail) linkedUser = userByEmail;
  }

  let linkedOrg: { id: string; name: string | null; slug: string | null } | null = null;
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
    linkedOrg = { id: subWithOrg.orgId, name: subWithOrg.orgName, slug: subWithOrg.orgSlug };
  }

  return {
    found: true as const,
    customer: {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      phone: customer.phone,
      created: customer.created,
      currency: customer.currency,
      defaultSource:
        typeof customer.default_source === 'string' ? customer.default_source : null,
      invoicePrefix: customer.invoice_prefix,
      balance: customer.balance,
      delinquent: customer.delinquent ?? false,
      metadata: customer.metadata as Record<string, string>,
      livemode: customer.livemode,
    },
    linkedUser,
    linkedOrg,
    stripeDashboardUrl: `https://dashboard.stripe.com/customers/${customer.id}`,
  };
}

export async function createAdminStripePortalLink(
  session: Session,
  params: { customerId: string; returnUrl?: string },
) {
  assertAdmin(session);
  const stripe = requireStripe();

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl || env.APP_URL || 'https://corates.com',
  });

  return {
    success: true,
    url: portalSession.url,
    expiresAt: portalSession.created + 300,
  };
}

interface InvoiceWithSubscription extends Stripe.Invoice {
  subscription?: string | Stripe.Subscription | null;
}

export async function getAdminStripeCustomerInvoices(
  session: Session,
  params: { customerId: string; limit?: number },
) {
  assertAdmin(session);
  const stripe = requireStripe();

  const parsedLimit = params.limit ?? 10;
  const limit = Math.min(Number.isNaN(parsedLimit) ? 10 : parsedLimit, 50);

  const invoices = await stripe.invoices.list({ customer: params.customerId, limit });

  return {
    customerId: params.customerId,
    invoices: invoices.data.map(inv => {
      const invWithSub = inv as InvoiceWithSubscription;
      return {
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
        paidAt: inv.status_transitions?.paid_at ?? null,
        hostedInvoiceUrl: inv.hosted_invoice_url,
        invoicePdf: inv.invoice_pdf,
        subscriptionId:
          typeof invWithSub.subscription === 'string' ?
            invWithSub.subscription
          : ((invWithSub.subscription as Stripe.Subscription)?.id ?? null),
        periodStart: inv.period_start,
        periodEnd: inv.period_end,
      };
    }),
    hasMore: invoices.has_more,
  };
}

export async function getAdminStripeCustomerPaymentMethods(
  session: Session,
  params: { customerId: string },
) {
  assertAdmin(session);
  const stripe = requireStripe();

  const paymentMethods = await stripe.paymentMethods.list({
    customer: params.customerId,
    type: 'card',
  });

  return {
    customerId: params.customerId,
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
  };
}

export async function getAdminStripeCustomerSubscriptions(
  session: Session,
  params: { customerId: string },
) {
  assertAdmin(session);
  const stripe = requireStripe();

  const subscriptions = await stripe.subscriptions.list({
    customer: params.customerId,
    status: 'all',
    limit: 20,
  });

  return {
    customerId: params.customerId,
    subscriptions: subscriptions.data.map(sub => ({
      id: sub.id,
      status: sub.status,
      currency: sub.currency,
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
        interval: item.price.recurring?.interval ?? null,
        currentPeriodStart: item.current_period_start,
        currentPeriodEnd: item.current_period_end,
        quantity: item.quantity,
      })),
      defaultPaymentMethod:
        typeof sub.default_payment_method === 'string' ?
          sub.default_payment_method
        : ((sub.default_payment_method as Stripe.PaymentMethod)?.id ?? null),
      latestInvoice:
        typeof sub.latest_invoice === 'string' ?
          sub.latest_invoice
        : ((sub.latest_invoice as Stripe.Invoice)?.id ?? null),
      metadata: sub.metadata as Record<string, string>,
    })),
    hasMore: subscriptions.has_more,
  };
}
