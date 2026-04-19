/**
 * Admin Stripe customer lookup
 *
 * GET /api/admin/stripe/customer?email=...|customerId=... — lookup a customer
 * directly in Stripe and join with our D1 user/org rows. Returns `found: false`
 * with a message when the customer doesn't exist or has been deleted.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { organization, subscription, user } from '@corates/db/schema';
import { eq } from 'drizzle-orm';
import {
  createDomainError,
  createValidationError,
  SYSTEM_ERRORS,
  VALIDATION_ERRORS,
} from '@corates/shared';
import { createStripeClient } from '@corates/workers/stripe';
import type Stripe from 'stripe';
import { adminMiddleware } from '@/server/middleware/admin';

interface LinkedUser {
  id: string;
  email: string;
  name: string;
  givenName: string | null;
  stripeCustomerId?: string | null;
}

interface LinkedOrg {
  id: string;
  name: string | null;
  slug: string | null;
}

export const handleGet = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const email = url.searchParams.get('email') || undefined;
  const customerId = url.searchParams.get('customerId') || undefined;

  if (!email && !customerId) {
    return Response.json(
      createValidationError('email or customerId', VALIDATION_ERRORS.FIELD_REQUIRED.code),
      { status: 400 },
    );
  }

  if (!env.STRIPE_SECRET_KEY) {
    return Response.json(
      createDomainError(SYSTEM_ERRORS.SERVICE_UNAVAILABLE, { message: 'Stripe is not configured' }),
      { status: 500 },
    );
  }

  const stripe = createStripeClient(env);

  try {
    let customer: Stripe.Customer | null = null;

    if (customerId) {
      try {
        const retrieved = await stripe.customers.retrieve(customerId);
        if ((retrieved as Stripe.DeletedCustomer).deleted) {
          return Response.json(
            { found: false, message: 'Customer has been deleted in Stripe', customerId },
            { status: 200 },
          );
        }
        customer = retrieved as Stripe.Customer;
      } catch (err) {
        const stripeErr = err as Stripe.errors.StripeError;
        if (stripeErr.code === 'resource_missing') {
          return Response.json(
            { found: false, message: 'Customer not found in Stripe', customerId },
            { status: 200 },
          );
        }
        throw err;
      }
    } else if (email) {
      const customers = await stripe.customers.list({ email: email.toLowerCase(), limit: 1 });
      if (customers.data.length === 0) {
        return Response.json(
          { found: false, message: 'No customer found with this email', email },
          { status: 200 },
        );
      }
      customer = customers.data[0];
    }

    if (!customer) {
      return Response.json({ found: false, message: 'Customer not found' }, { status: 200 });
    }

    const db = createDb(env.DB);

    let linkedUser: LinkedUser | null = null;
    let linkedOrg: LinkedOrg | null = null;

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

    return Response.json(
      {
        found: true,
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
      },
      { status: 200 },
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error looking up Stripe customer:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
        service: 'Stripe',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/admin/stripe/customer')({
  server: {
    middleware: [adminMiddleware],
    handlers: { GET: handleGet },
  },
});
