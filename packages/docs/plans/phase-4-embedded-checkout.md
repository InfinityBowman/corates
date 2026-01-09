# Phase 4: Embedded Checkout Implementation Plan

**Date:** 2026-01-08  
**Prerequisite:** Phases 1-3 complete  
**Estimated Duration:** 4-6 weeks  
**Complexity:** High

---

## Executive Summary

This plan details how to replace the current Stripe Checkout redirect flow with an embedded payment form using Stripe Elements. This keeps users in the CoRATES app during the entire checkout experience.

### When to Implement This

Embedded checkout is worthwhile if:

- Users complain about being redirected away from the app
- You need custom checkout UI that matches CoRATES branding exactly
- You want to show real-time discount calculations inline
- You need complex multi-step checkout flows
- You want to handle failed payments without losing context

### When NOT to Implement This

Keep the redirect flow if:

- Current checkout conversion is acceptable
- You don't have 4+ weeks of dev time
- PCI compliance overhead is a concern
- The redirect experience is adequate for your users

---

## Architecture Overview

### Current Flow (Redirect)

```
User clicks "Subscribe"
    |
    v
Backend creates Checkout Session
    |
    v
User redirected to checkout.stripe.com
    |
    v
User enters payment details on Stripe's page
    |
    v
Stripe redirects back to CoRATES with success/cancel
    |
    v
Webhook processes subscription creation
```

### New Flow (Embedded)

```
User clicks "Subscribe"
    |
    v
Backend creates SetupIntent + returns clientSecret
    |
    v
Frontend renders Stripe Elements form (in-app)
    |
    v
User enters payment details in CoRATES UI
    |
    v
Frontend calls stripe.confirmSetup()
    |
    v
3D Secure modal appears (if required by bank)
    |
    v
Backend webhook receives setup_intent.succeeded
    |
    v
Backend creates subscription with saved payment method
    |
    v
Frontend shows success state
```

---

## Key Concepts

### SetupIntent vs PaymentIntent

| Type              | Use Case                           | When Charged                               |
| ----------------- | ---------------------------------- | ------------------------------------------ |
| **SetupIntent**   | Subscriptions, save card for later | Card saved, charged later via subscription |
| **PaymentIntent** | One-time purchases                 | Charged immediately                        |

For CoRATES subscriptions, we use **SetupIntent** because:

1. We want to save the payment method
2. Stripe's subscription billing handles the actual charges
3. It works better with free trials

### 3D Secure (SCA) Flow

European regulations require Strong Customer Authentication (SCA) for many payments. When triggered:

1. `stripe.confirmSetup()` returns `{ error: { type: 'card_error', code: 'authentication_required' } }`
2. Stripe automatically shows a modal for the user to authenticate
3. After authentication, the flow continues or fails

This is handled automatically by Stripe.js - we just need to handle the final success/failure states.

### Customer Sessions

Stripe's Customer Sessions allow showing saved payment methods to returning users:

```javascript
const customerSession = await stripe.customerSessions.create({
  customer: customerId,
  components: { payment_element: { enabled: true } },
});
// Returns clientSecret for frontend
```

---

## Implementation Steps

### Step 1: Backend - SetupIntent Creation Endpoint

**File:** `packages/workers/src/routes/billing/payment.js` (new file)

```javascript
/**
 * Payment intent management for embedded checkout
 */
import { Hono } from 'hono';
import { requireAuth, getAuth } from '@/middleware/auth.js';
import { createDb } from '@/db/client.js';
import { createDomainError, BILLING_ERRORS } from '@corates/shared';
import Stripe from 'stripe';
import { resolveOrgIdWithRole } from './helpers/orgContext.js';
import { getPlan } from '@corates/shared/plans';

const paymentRoutes = new Hono();

/**
 * POST /api/billing/setup-intent
 * Creates a SetupIntent for saving a payment method (subscriptions)
 *
 * Request body:
 *   - plan: string (e.g., 'team', 'unlimited_team')
 *   - interval: 'monthly' | 'yearly'
 *
 * Response:
 *   - clientSecret: string (for Stripe Elements)
 *   - customerSessionSecret: string (for saved payment methods)
 *   - customerId: string
 */
paymentRoutes.post('/setup-intent', requireAuth, async c => {
  const { user, session } = getAuth(c);
  const db = createDb(c.env.DB);
  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY);

  try {
    const body = await c.req.json();
    const { plan, interval } = body;

    // Validate plan exists
    const planConfig = getPlan(plan);
    if (!planConfig) {
      const error = createDomainError(BILLING_ERRORS.INVALID_PLAN, { plan });
      return c.json(error, error.statusCode);
    }

    // Get or create Stripe customer
    const { orgId } = await resolveOrgIdWithRole({ db, session, userId: user.id });
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
    });

    let customerId = org.stripeCustomerId;

    if (!customerId) {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: user.email,
        name: org.name,
        metadata: {
          orgId,
          userId: user.id,
        },
      });
      customerId = customer.id;

      // Save customer ID to org
      await db.update(organizations).set({ stripeCustomerId: customerId }).where(eq(organizations.id, orgId));
    }

    // Create SetupIntent
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      metadata: {
        orgId,
        userId: user.id,
        plan,
        interval,
      },
      usage: 'off_session', // Allow charging without user present (subscriptions)
    });

    // Create CustomerSession for showing saved payment methods
    const customerSession = await stripe.customerSessions.create({
      customer: customerId,
      components: {
        payment_element: {
          enabled: true,
          features: {
            payment_method_redisplay: 'enabled',
            payment_method_save: 'enabled',
            payment_method_save_usage: 'off_session',
            payment_method_remove: 'enabled',
          },
        },
      },
    });

    return c.json({
      clientSecret: setupIntent.client_secret,
      customerSessionSecret: customerSession.client_secret,
      customerId,
      setupIntentId: setupIntent.id,
    });
  } catch (error) {
    console.error('SetupIntent creation failed:', error);
    const billingError = createDomainError(BILLING_ERRORS.SETUP_INTENT_FAILED, {
      message: error.message,
    });
    return c.json(billingError, billingError.statusCode);
  }
});

/**
 * POST /api/billing/confirm-subscription
 * Called after SetupIntent succeeds to create the actual subscription
 *
 * This endpoint is called from the frontend after stripe.confirmSetup() succeeds.
 * It uses the saved payment method to create a subscription.
 */
paymentRoutes.post('/confirm-subscription', requireAuth, async c => {
  const { user, session } = getAuth(c);
  const db = createDb(c.env.DB);
  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY);

  try {
    const body = await c.req.json();
    const { setupIntentId, plan, interval } = body;

    // Retrieve the SetupIntent to get the payment method
    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);

    if (setupIntent.status !== 'succeeded') {
      const error = createDomainError(BILLING_ERRORS.SETUP_INTENT_INCOMPLETE, {
        status: setupIntent.status,
      });
      return c.json(error, error.statusCode);
    }

    const paymentMethodId = setupIntent.payment_method;
    const customerId = setupIntent.customer;

    // Get price ID for the plan
    const priceId = getPriceId(plan, interval); // Helper to map plan to Stripe price

    // Set this payment method as default for the customer
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      default_payment_method: paymentMethodId,
      payment_behavior: 'error_if_incomplete',
      metadata: {
        orgId: setupIntent.metadata.orgId,
        userId: user.id,
        plan,
      },
    });

    return c.json({
      subscriptionId: subscription.id,
      status: subscription.status,
    });
  } catch (error) {
    console.error('Subscription creation failed:', error);
    const billingError = createDomainError(BILLING_ERRORS.SUBSCRIPTION_CREATION_FAILED, {
      message: error.message,
    });
    return c.json(billingError, billingError.statusCode);
  }
});

export default paymentRoutes;
```

### Step 2: Frontend - Install Stripe React Elements

Since CoRATES uses SolidJS, we need the vanilla Stripe.js library (not React):

```bash
pnpm --filter @corates/web add @stripe/stripe-js
```

### Step 3: Frontend - Create Stripe Provider

**File:** `packages/web/src/providers/StripeProvider.jsx`

```jsx
/**
 * Stripe Elements Provider for embedded checkout
 *
 * This provider loads Stripe.js and provides Elements to children.
 * It handles the clientSecret management for SetupIntent/PaymentIntent.
 */
import { createContext, useContext, createSignal, createMemo, onMount } from 'solid-js';
import { loadStripe } from '@stripe/stripe-js';

const StripeContext = createContext();

export function StripeProvider(props) {
  const [stripe, setStripe] = createSignal(null);
  const [elements, setElements] = createSignal(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal(null);

  onMount(async () => {
    try {
      const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
      if (!stripeKey) {
        throw new Error('VITE_STRIPE_PUBLISHABLE_KEY not configured');
      }

      const stripeInstance = await loadStripe(stripeKey);
      setStripe(stripeInstance);
    } catch (err) {
      console.error('Failed to load Stripe:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  });

  const initElements = (clientSecret, customerSessionSecret) => {
    const stripeInstance = stripe();
    if (!stripeInstance) return null;

    const elementsInstance = stripeInstance.elements({
      clientSecret,
      customerSessionClientSecret: customerSessionSecret,
      appearance: {
        theme: 'stripe',
        variables: {
          colorPrimary: '#4f46e5', // indigo-600 to match CoRATES
          colorBackground: '#ffffff',
          colorText: '#1f2937', // gray-800
          colorDanger: '#dc2626', // red-600
          fontFamily: 'Inter, system-ui, sans-serif',
          borderRadius: '8px',
          spacingUnit: '4px',
        },
        rules: {
          '.Input': {
            border: '1px solid #d1d5db', // gray-300
            boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
          },
          '.Input:focus': {
            border: '1px solid #4f46e5',
            boxShadow: '0 0 0 3px rgb(79 70 229 / 0.1)',
          },
          '.Label': {
            fontWeight: '500',
            fontSize: '14px',
            marginBottom: '6px',
          },
          '.Error': {
            fontSize: '13px',
            marginTop: '4px',
          },
        },
      },
    });

    setElements(elementsInstance);
    return elementsInstance;
  };

  const value = {
    stripe,
    elements,
    initElements,
    loading,
    error,
  };

  return <StripeContext.Provider value={value}>{props.children}</StripeContext.Provider>;
}

export function useStripe() {
  const context = useContext(StripeContext);
  if (!context) {
    throw new Error('useStripe must be used within StripeProvider');
  }
  return context;
}
```

### Step 4: Frontend - Embedded Checkout Form Component

**File:** `packages/web/src/components/billing/EmbeddedCheckoutForm.jsx`

```jsx
/**
 * Embedded Checkout Form using Stripe Elements
 *
 * This component renders the payment form inline in the CoRATES UI.
 * It handles:
 * - Payment method collection
 * - 3D Secure authentication
 * - Error display
 * - Success callbacks
 */
import { createSignal, onMount, onCleanup, Show } from 'solid-js';
import { useStripe } from '@/providers/StripeProvider';
import { apiFetch } from '@/api/fetch';
import { Button, Alert } from '@corates/ui';
import { BiRegularCreditCard, BiRegularLoader } from 'solid-icons/bi';

export default function EmbeddedCheckoutForm(props) {
  // Props:
  // - plan: string
  // - interval: 'monthly' | 'yearly'
  // - onSuccess: () => void
  // - onCancel: () => void
  // - promoCode?: string

  const { stripe, initElements } = useStripe();

  const [loading, setLoading] = createSignal(true);
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal(null);
  const [setupIntentId, setSetupIntentId] = createSignal(null);

  let paymentElementContainer;
  let paymentElement;

  onMount(async () => {
    try {
      // 1. Create SetupIntent on backend
      const {
        clientSecret,
        customerSessionSecret,
        setupIntentId: intentId,
      } = await apiFetch.post('/api/billing/setup-intent', {
        plan: props.plan,
        interval: props.interval,
      });

      setSetupIntentId(intentId);

      // 2. Initialize Stripe Elements with the clientSecret
      const elements = initElements(clientSecret, customerSessionSecret);

      // 3. Create and mount the PaymentElement
      paymentElement = elements.create('payment', {
        layout: 'tabs', // 'tabs' | 'accordion' | 'auto'
        defaultValues: {
          billingDetails: {
            // Pre-fill if we have user data
          },
        },
        fields: {
          billingDetails: {
            address: 'auto', // Collect address inline
          },
        },
        terms: {
          card: 'never', // We show terms separately
        },
      });

      paymentElement.mount(paymentElementContainer);

      // 4. Listen for ready state
      paymentElement.on('ready', () => {
        setLoading(false);
      });

      // 5. Listen for validation changes
      paymentElement.on('change', event => {
        if (event.error) {
          setError(event.error.message);
        } else {
          setError(null);
        }
      });
    } catch (err) {
      console.error('Failed to initialize checkout:', err);
      setError(err.message || 'Failed to load payment form');
      setLoading(false);
    }
  });

  onCleanup(() => {
    if (paymentElement) {
      paymentElement.destroy();
    }
  });

  const handleSubmit = async e => {
    e.preventDefault();

    const stripeInstance = stripe();
    if (!stripeInstance || !paymentElement) return;

    setSubmitting(true);
    setError(null);

    try {
      // 1. Confirm the SetupIntent with Stripe
      // This handles card validation and 3D Secure
      const { error: confirmError, setupIntent } = await stripeInstance.confirmSetup({
        elements: paymentElement._elements, // Get the Elements instance
        confirmParams: {
          return_url: `${window.location.origin}/settings/billing?setup=complete`,
        },
        redirect: 'if_required', // Only redirect if 3DS is required
      });

      if (confirmError) {
        // Show error to user
        if (confirmError.type === 'card_error' || confirmError.type === 'validation_error') {
          setError(confirmError.message);
        } else {
          setError('An unexpected error occurred. Please try again.');
        }
        return;
      }

      // 2. SetupIntent succeeded - create the subscription
      if (setupIntent.status === 'succeeded') {
        await apiFetch.post('/api/billing/confirm-subscription', {
          setupIntentId: setupIntent.id,
          plan: props.plan,
          interval: props.interval,
        });

        // 3. Success callback
        props.onSuccess?.();
      }
    } catch (err) {
      console.error('Payment confirmation failed:', err);
      setError(err.message || 'Payment failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div class='embedded-checkout'>
      <form onSubmit={handleSubmit} class='space-y-6'>
        {/* Plan Summary Header */}
        <div class='rounded-lg border border-gray-200 bg-gray-50 p-4'>
          <div class='flex items-center justify-between'>
            <div>
              <h3 class='font-semibold text-gray-900'>{props.plan === 'team' ? 'Team Plan' : 'Unlimited Team Plan'}</h3>
              <p class='text-sm text-gray-500'>Billed {props.interval === 'yearly' ? 'annually' : 'monthly'}</p>
            </div>
            <div class='text-right'>
              <p class='text-2xl font-bold text-gray-900'>${props.interval === 'yearly' ? '99' : '12'}</p>
              <p class='text-sm text-gray-500'>/{props.interval === 'yearly' ? 'year' : 'month'}</p>
            </div>
          </div>

          <Show when={props.promoCode}>
            <div class='mt-3 border-t border-gray-200 pt-3'>
              <div class='flex justify-between text-sm'>
                <span class='text-green-600'>Promo: {props.promoCode}</span>
                <span class='text-green-600'>-20%</span>
              </div>
            </div>
          </Show>
        </div>

        {/* Loading State */}
        <Show when={loading()}>
          <div class='flex items-center justify-center py-12'>
            <BiRegularLoader class='h-6 w-6 animate-spin text-gray-400' />
            <span class='ml-2 text-gray-500'>Loading payment form...</span>
          </div>
        </Show>

        {/* Payment Element Container */}
        <div ref={paymentElementContainer} class={loading() ? 'hidden' : 'min-h-[200px]'} />

        {/* Error Display */}
        <Show when={error()}>
          <Alert variant='destructive'>
            <p class='text-sm'>{error()}</p>
          </Alert>
        </Show>

        {/* Terms */}
        <p class='text-xs text-gray-500'>
          By subscribing, you agree to our{' '}
          <a href='/terms' class='underline'>
            Terms of Service
          </a>{' '}
          and{' '}
          <a href='/privacy' class='underline'>
            Privacy Policy
          </a>
          . You can cancel your subscription at any time.
        </p>

        {/* Actions */}
        <div class='flex gap-3'>
          <Button type='button' variant='outline' onClick={props.onCancel} disabled={submitting()} class='flex-1'>
            Cancel
          </Button>
          <Button type='submit' disabled={loading() || submitting()} class='flex-1'>
            <Show
              when={submitting()}
              fallback={
                <>
                  <BiRegularCreditCard class='mr-2 h-4 w-4' />
                  Subscribe
                </>
              }
            >
              <BiRegularLoader class='mr-2 h-4 w-4 animate-spin' />
              Processing...
            </Show>
          </Button>
        </div>
      </form>
    </div>
  );
}
```

### Step 5: Frontend - Checkout Modal/Dialog

**File:** `packages/web/src/components/billing/CheckoutDialog.jsx`

```jsx
/**
 * Checkout Dialog - wraps the embedded checkout in a modal
 */
import { Dialog } from '@corates/ui';
import { StripeProvider } from '@/providers/StripeProvider';
import EmbeddedCheckoutForm from './EmbeddedCheckoutForm';

export default function CheckoutDialog(props) {
  // Props:
  // - open: boolean
  // - onOpenChange: (open: boolean) => void
  // - plan: string
  // - interval: string
  // - promoCode?: string
  // - onSuccess: () => void

  return (
    <Dialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Backdrop class='fixed inset-0 bg-black/50' />
      <Dialog.Positioner class='fixed inset-0 flex items-center justify-center p-4'>
        <Dialog.Content class='max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white shadow-xl'>
          <Dialog.Title class='border-b border-gray-200 px-6 py-4'>
            <h2 class='text-lg font-semibold'>Complete your subscription</h2>
          </Dialog.Title>

          <div class='p-6'>
            <StripeProvider>
              <EmbeddedCheckoutForm
                plan={props.plan}
                interval={props.interval}
                promoCode={props.promoCode}
                onSuccess={() => {
                  props.onSuccess?.();
                  props.onOpenChange(false);
                }}
                onCancel={() => props.onOpenChange(false)}
              />
            </StripeProvider>
          </div>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
```

### Step 6: Update PricingTable to Use Embedded Checkout

**File:** Modify `packages/web/src/components/billing/PricingTable.jsx`

```jsx
// Add state for checkout dialog
const [checkoutOpen, setCheckoutOpen] = createSignal(false);
const [selectedPlan, setSelectedPlan] = createSignal(null);
const [selectedInterval, setSelectedInterval] = createSignal('monthly');

// Replace redirect logic with dialog open
const handleSubscribe = (plan, interval) => {
  setSelectedPlan(plan);
  setSelectedInterval(interval);
  setCheckoutOpen(true);
};

// In JSX, add the dialog:
<CheckoutDialog
  open={checkoutOpen()}
  onOpenChange={setCheckoutOpen}
  plan={selectedPlan()}
  interval={selectedInterval()}
  promoCode={promoValidation()?.valid ? promoCode() : undefined}
  onSuccess={() => {
    // Refresh subscription data
    queryClient.invalidateQueries(['subscription']);
    // Show success toast
    toast.success('Subscription activated!');
  }}
/>;
```

### Step 7: Handle 3D Secure Redirect Return

When 3D Secure requires a redirect, handle the return:

**File:** `packages/web/src/components/settings/pages/BillingSettings.jsx`

Add handling for `?setup=complete` query param:

```jsx
onMount(async () => {
  const setupStatus = searchParams.setup;

  if (setupStatus === 'complete') {
    // User returned from 3D Secure
    const setupIntentId = searchParams.setup_intent;

    if (setupIntentId) {
      try {
        // Complete the subscription creation
        await apiFetch.post('/api/billing/confirm-subscription', {
          setupIntentId,
          plan: searchParams.plan,
          interval: searchParams.interval,
        });

        setCheckoutOutcome('success');
        refetch();
      } catch (error) {
        setCheckoutOutcome('failed');
        console.error('Subscription creation failed:', error);
      }
    }

    // Clear params
    setSearchParams({ setup: null, setup_intent: null, plan: null, interval: null });
  }
});
```

### Step 8: Webhook Updates

Add handler for `setup_intent.succeeded` events:

**File:** `packages/workers/src/routes/billing/webhooks.js`

```javascript
case 'setup_intent.succeeded': {
  const setupIntent = event.data.object;
  const { orgId, userId, plan } = setupIntent.metadata;

  logger.info('SetupIntent succeeded', {
    setupIntentId: setupIntent.id,
    orgId,
    plan,
  });

  // The subscription is created via /confirm-subscription endpoint,
  // but we log the event for observability
  break;
}

case 'setup_intent.setup_failed': {
  const setupIntent = event.data.object;

  logger.warn('SetupIntent failed', {
    setupIntentId: setupIntent.id,
    error: setupIntent.last_setup_error,
    orgId: setupIntent.metadata.orgId,
  });
  break;
}
```

---

## Error Handling Strategy

### Frontend Error Categories

| Error Type                | User Message                                                   | Action                     |
| ------------------------- | -------------------------------------------------------------- | -------------------------- |
| `card_declined`           | "Your card was declined. Please try a different card."         | Show inline                |
| `expired_card`            | "Your card has expired. Please use a different card."          | Show inline                |
| `incorrect_cvc`           | "The security code is incorrect."                              | Show inline                |
| `processing_error`        | "There was an issue processing your card. Please try again."   | Show inline + retry button |
| `authentication_required` | Modal handled by Stripe                                        | N/A                        |
| Network error             | "Connection failed. Please check your internet and try again." | Show + retry button        |
| Server error              | "Something went wrong. Please try again or contact support."   | Show + support link        |

### Backend Error Codes

Add to `packages/shared/src/errors/billing.ts`:

```typescript
export const BILLING_ERRORS = {
  // Setup Intent errors
  SETUP_INTENT_FAILED: {
    code: 'SETUP_INTENT_FAILED',
    message: 'Failed to initialize payment',
    statusCode: 500,
  },
  SETUP_INTENT_INCOMPLETE: {
    code: 'SETUP_INTENT_INCOMPLETE',
    message: 'Payment setup was not completed',
    statusCode: 400,
  },

  // Subscription errors
  SUBSCRIPTION_CREATION_FAILED: {
    code: 'SUBSCRIPTION_CREATION_FAILED',
    message: 'Failed to create subscription',
    statusCode: 500,
  },

  // Plan errors
  INVALID_PLAN: {
    code: 'INVALID_PLAN',
    message: 'The selected plan is not available',
    statusCode: 400,
  },
};
```

---

## Testing Strategy

### Unit Tests

1. **SetupIntent creation** - valid plan, invalid plan, missing auth
2. **Subscription confirmation** - valid intent, failed intent, already used intent
3. **Error mapping** - all Stripe error codes mapped correctly

### Integration Tests

1. **Full checkout flow** (mock Stripe)
   - Create SetupIntent
   - Mock successful confirmation
   - Verify subscription created
2. **3D Secure flow**
   - Create SetupIntent
   - Simulate redirect return
   - Verify subscription created

3. **Failure scenarios**
   - Card declined
   - Network timeout
   - Duplicate subscription attempt

### E2E Tests (Playwright)

1. Open pricing table
2. Select plan
3. Fill payment form with test card
4. Submit and verify success state
5. Verify subscription appears in billing page

Test cards:

- `4242424242424242` - Success
- `4000002500003155` - Requires 3D Secure
- `4000000000000002` - Declined

---

## Migration Strategy

### Phase 4a: Parallel Implementation (Week 1-2)

- Build embedded checkout alongside existing redirect
- Feature flag to toggle between them
- Internal testing only

### Phase 4b: Beta Rollout (Week 3)

- Enable for 10% of users
- Monitor error rates and conversion
- Gather feedback

### Phase 4c: Full Rollout (Week 4)

- Enable for all users
- Keep redirect as fallback for edge cases
- Monitor for 1 week

### Phase 4d: Cleanup (Week 5-6)

- Remove redirect code paths
- Remove feature flags
- Update documentation

---

## Files to Create

| File                                                                          | Purpose                 |
| ----------------------------------------------------------------------------- | ----------------------- |
| `packages/workers/src/routes/billing/payment.js`                              | SetupIntent endpoints   |
| `packages/web/src/providers/StripeProvider.jsx`                               | Stripe Elements context |
| `packages/web/src/components/billing/EmbeddedCheckoutForm.jsx`                | Payment form            |
| `packages/web/src/components/billing/CheckoutDialog.jsx`                      | Modal wrapper           |
| `packages/shared/src/errors/billing.ts`                                       | Billing error codes     |
| `packages/workers/src/routes/billing/__tests__/payment.test.js`               | Backend tests           |
| `packages/web/src/components/billing/__tests__/EmbeddedCheckoutForm.test.jsx` | Frontend tests          |

## Files to Modify

| File                                                             | Changes                         |
| ---------------------------------------------------------------- | ------------------------------- |
| `packages/workers/src/routes/billing/index.js`                   | Mount payment routes            |
| `packages/workers/src/routes/billing/webhooks.js`                | Add setup_intent handlers       |
| `packages/web/src/components/billing/PricingTable.jsx`           | Use CheckoutDialog              |
| `packages/web/src/components/settings/pages/BillingSettings.jsx` | Handle 3DS return               |
| `.env.example`                                                   | Add VITE_STRIPE_PUBLISHABLE_KEY |

---

## Environment Variables

```bash
# Frontend (.env)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx

# Backend (wrangler.jsonc)
STRIPE_SECRET_KEY=sk_test_xxx  # Already exists
```

---

## Success Criteria

- [ ] Users can complete checkout without leaving CoRATES
- [ ] 3D Secure flow works correctly
- [ ] Saved payment methods shown for returning customers
- [ ] Error messages are clear and actionable
- [ ] Checkout conversion rate >= existing redirect flow
- [ ] All test scenarios pass
- [ ] No increase in support tickets about checkout

---

## Risks & Mitigations

| Risk                             | Impact | Mitigation                                             |
| -------------------------------- | ------ | ------------------------------------------------------ |
| PCI compliance concerns          | High   | Stripe Elements handles all card data; we never see it |
| 3D Secure edge cases             | Medium | Keep redirect as fallback; extensive testing           |
| Browser compatibility            | Medium | Test on Safari, Firefox, Chrome; polyfills if needed   |
| Increased complexity             | Medium | Good error handling; feature flag for rollback         |
| User confusion during transition | Low    | Clear UI; in-app help text                             |
