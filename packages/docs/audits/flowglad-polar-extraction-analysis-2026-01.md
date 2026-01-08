# Flowglad & Polar Extraction Analysis: Admin Dashboard & Stripe Hardening

**Date:** January 8, 2026  
**Context:** Building internal admin dashboard + hardening CoRATES Stripe implementation  
**CoRATES Stack:** SolidJS, BetterAuth, Stripe, Drizzle ORM, Cloudflare Workers  
**New Objective:** Create local Next.js admin tool + bulletproof payment processing

---

## Executive Summary

**Updated Strategy:**

This analysis has been refocused to support two critical goals:

1. **Build Internal Admin Dashboard** - A local-only Next.js app for managing CoRATES operations
2. **Harden Stripe Integration** - Identify and fix gaps in CoRATES' current payment processing

**Repository Analysis:**

| Repository   | Admin Dashboard Value                 | Stripe Hardening Value                  | Use For                  |
| ------------ | ------------------------------------- | --------------------------------------- | ------------------------ |
| **Polar**    | ⭐⭐⭐⭐⭐ Custom admin UI components | ⭐⭐⭐ Python (not directly usable)     | **🎯 Admin UI patterns** |
| **Flowglad** | ⭐⭐⭐ Standard shadcn/ui only        | ⭐⭐⭐⭐⭐ Bulletproof webhook patterns | **🎯 Stripe logic only** |

**Important Clarification:**

- **Flowglad's `components/ui/`** = Auto-generated shadcn/ui components (can regenerate with CLI)
- **Polar's `@polar-sh/ui` + `web/src/components/`** = Custom-built components (60+ folders of original work)
- For admin UI, learn from **Polar's architecture**, generate shadcn via CLI

### Critical Findings

**CoRATES Stripe Implementation Gaps (Identified):**

After reviewing CoRATES' current implementation against Flowglad's battle-tested patterns, several critical gaps emerged:

🚨 **High Priority Issues:**

1. ❌ **No subscription webhook handling** - Only handles one-time purchases
2. ❌ **Missing payment failure recovery** - No dunning logic
3. ❌ **No customer sync** - Stripe customers not properly linked
4. ❌ **Missing subscription lifecycle events** - updated/canceled/deleted
5. ❌ **No invoice events** - payment_succeeded/failed not handled
6. ❌ **Incomplete idempotency** - Only hash-based, missing event ID dedupe
7. ❌ **No payment method events** - setup_intent not fully handled
8. ⚠️ **Limited observability** - Webhook ledger exists but gaps in coverage

⚠️ **Medium Priority:**

- Missing tax automation (Stripe Tax)
- No currency handling utilities
- Limited Stripe metadata usage
- No background job processing
- Basic error recovery

✅ **What CoRATES Does Well:**

- Two-phase trust webhook model (excellent pattern!)
- Payload hash deduplication
- Proper signature verification
- Structured logging

**Polar Advantages for Admin Dashboard:**

- ✅ **Custom `@polar-sh/ui` package** with enhanced atoms (ShadowBox, MoneyInput, DataTable, Paginator)
- ✅ **60+ business component folders** (Metrics, Charts, Subscriptions, Transactions, etc.)
- ✅ **Custom GenericChart** component wrapping Recharts
- ✅ **MetricChartBox** with comparison periods and sharing
- ✅ **DataTable** with TanStack Table integration (sorting, filtering, pagination)
- ✅ **Dashboard architecture** with context providers and navigation
- ✅ Real SaaS admin patterns (TransactionsList, SubscriptionDetails, etc.)

**Flowglad Advantages (Limited):**

- ✅ Standard shadcn/ui (can regenerate with CLI)
- ✅ BetterAuth integration patterns
- ✅ Next.js 14 App Router structure

**Flowglad Advantages for Stripe Hardening:**

- ✅ 2,066 lines of production Stripe utilities
- ✅ Comprehensive webhook event handling (20+ events)
- ✅ Trigger.dev background job processing
- ✅ Double-entry ledger integration
- ✅ Tax automation (Stripe Tax)
- ✅ Currency conversion utilities
- ✅ Payment intent lifecycle management
- ✅ Customer/subscription sync patterns
- ✅ Idempotency everywhere

---

## 1. Internal Admin Dashboard Package

### 1.1 Package Structure

**Proposed Location:** `packages/admin/`

**Why a Separate Package:**

- Local development only (not deployed)
- Can use React/Next.js (different from SolidJS main app)
- Direct database access (no API layer needed)
- Admin-specific features (user management, data inspection, Stripe tools)
- Rapid development with Flowglad's UI components

**Package Architecture:**

```
packages/admin/
├── package.json              # Next.js 14 + dependencies
├── next.config.mjs
├── tsconfig.json
├── .env.local                # Local DB connection, Stripe keys
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx          # Dashboard home
│   │   ├── users/            # User management
│   │   ├── organizations/    # Org management
│   │   ├── projects/         # Project explorer
│   │   ├── billing/          # Billing admin tools
│   │   │   ├── subscriptions/
│   │   │   ├── invoices/
│   │   │   ├── webhook-logs/ # Stripe event ledger UI
│   │   │   └── stripe-tools/ # Manual Stripe ops
│   │   └── settings/         # Admin settings
│   ├── components/           # ← shadcn/ui + LEARN FROM POLAR
│   │   ├── ui/               # shadcn components (generate via CLI)
│   │   ├── atoms/            # Custom atoms (inspired by @polar-sh/ui)
│   │   ├── tables/           # Data tables
│   │   └── admin/            # Admin-specific components
│   ├── lib/
│   │   ├── db.ts             # Direct DB connection (Drizzle)
│   │   ├── stripe.ts         # Stripe SDK
│   │   └── auth.ts           # Admin auth (simple, local-only)
│   └── utils/                # Helper functions
└── README.md
```

**Development Workflow:**

```bash
# Run locally only
cd packages/admin
pnpm dev

# Access at http://localhost:3001
# Direct connection to CoRATES database
# Full admin privileges
```

### 1.2 Admin Dashboard Features

**Core Pages to Build:**

#### A. Dashboard Home (/)

- System health metrics
- Recent activity
- Quick actions
- Key stats (users, orgs, projects)

**Learn from Polar:**

- `DashboardProvider.tsx` context pattern
- `Metrics/MetricChartBox.tsx` for KPI displays
- `Charts/GenericChart.tsx` for flexible charting
- `Dashboard/navigation.tsx` for sidebar structure

#### B. User Management (/users)

- List all users (table with search/filter)
- User details modal
- Subscription status
- Activity logs
- Impersonation (for support)

**Learn from Polar:**

- `@polar-sh/ui` DataTable component (TanStack Table)
- `Customer/` components for user detail views
- Search/filter patterns from various list components
- `Paginator` atom for pagination

#### C. Organization Management (/organizations)

- Org list and details
- Member management
- Subscription status
- Project counts
- Billing info

**Learn from Polar:**

- `Organization/` components
- `Subscriptions/SubscriptionDetails.tsx`
- `Transactions/TransactionsList.tsx` for billing history

#### D. Billing Administration (/billing)

**Subscription Management:**

- View all subscriptions
- Cancel/refund manually
- Modify subscription plans
- View payment history

**Webhook Log Viewer:**

- Display `stripeEventLedger` table
- Filter by status, type, date
- Re-process failed webhooks
- Debug webhook issues

**Stripe Tools:**

- Manual invoice creation
- Customer portal links
- Refund interface
- Sync Stripe → DB

**Learn from Polar (UI patterns):**

- `Finance/` components for billing dashboards
- `Subscriptions/` for subscription management UI
- `Metrics/CashflowChart.tsx` for revenue displays
- `Transactions/TransactionsList.tsx` for payment history

**Learn from Flowglad (Stripe logic only):**

- Webhook processing patterns
- Stripe SDK usage patterns
- Payment intent handling

#### E. Project Explorer (/projects)

- Browse all projects
- View project details
- Access control overview
- Usage stats

### 1.3 Component Extraction Strategy

**Phase 1: Core UI Library via shadcn CLI (Day 1-2)**

Generate shadcn/ui components with CLI (don't copy from Flowglad - they're the same auto-generated files):

```bash
# Create admin package
mkdir -p packages/admin
cd packages/admin

# Initialize Next.js with shadcn
pnpm create next-app@latest . --typescript --tailwind --app
pnpm dlx shadcn@latest init

# Add all needed components
pnpm dlx shadcn@latest add button card dialog table form input \
  select dropdown-menu sheet tabs avatar badge separator \
  command popover tooltip skeleton alert calendar chart
```

**Then learn from Polar's custom atoms:**

```bash
# Study Polar's enhanced components for inspiration
ls reference/polar/clients/packages/ui/src/components/atoms/
# ShadowBox.tsx, MoneyInput.tsx, Paginator.tsx, datatable/, etc.

# Copy patterns (not verbatim) into your own atoms
mkdir -p src/components/atoms
```

**Components to Build (Inspired by Polar):**

- ✅ `ShadowBox` - Card variant with shadow styling
- ✅ `DataTable` - TanStack Table wrapper with pagination
- ✅ `MoneyInput` - Currency-aware input
- ✅ `Paginator` - Consistent pagination controls
- ✅ `Status` badge variants

**Phase 2: Dashboard Layouts (Day 3-4)**

Learn from Polar's dashboard architecture:

```tsx
// Study Polar's patterns:
// - reference/polar/clients/apps/web/src/components/Dashboard/
// - DashboardProvider.tsx - Context for dashboard state
// - navigation.tsx - Sidebar navigation structure
// - Tabs.tsx - Tab navigation

// src/app/layout.tsx - Inspired by Polar's architecture
import { Sidebar } from '@/components/admin/Sidebar';
import { Header } from '@/components/admin/Header';
import { AdminProvider } from '@/components/admin/AdminProvider';

export default function AdminLayout({ children }) {
  return (
    <AdminProvider>
      <div className='flex h-screen'>
        <Sidebar />
        <div className='flex flex-1 flex-col overflow-hidden'>
          <Header />
          <main className='flex-1 overflow-auto p-6'>{children}</main>
        </div>
      </div>
    </AdminProvider>
  );
}
```

**Phase 3: Data Tables (Day 5-7)**

Build tables inspired by Polar's DataTable pattern:

```tsx
// Study Polar's implementation:
// - reference/polar/clients/packages/ui/src/components/atoms/datatable/
// - DataTable.tsx - Main component using TanStack Table
// - DataTableColumnHeader.tsx - Sortable headers
// - DataTablePagination.tsx - Pagination controls
//
// - reference/polar/clients/apps/web/src/components/Transactions/TransactionsList.tsx
// - Real-world usage example with columns, formatting, etc.

// src/components/admin/UserTable.tsx - Your implementation
import { useReactTable, getCoreRowModel, flexRender, ColumnDef } from '@tanstack/react-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export function UserTable({ users }) {
  const columns: ColumnDef<User>[] = [
    { accessorKey: 'email', header: 'Email' },
    { accessorKey: 'name', header: 'Name' },
    {
      accessorKey: 'subscriptionStatus',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.subscriptionStatus === 'active' ? 'default' : 'secondary'}>
          {row.original.subscriptionStatus}
        </Badge>
      ),
    },
  ];

  const table = useReactTable({
    data: users,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  // ... render table
}
```

**Phase 4: Admin-Specific Features (Week 2-3)**

Build CoRATES-specific admin features:

- **Webhook log viewer** - Custom (display `stripeEventLedger` table)
- **Stripe sync tools** - Custom (use Flowglad's Stripe patterns)
- **Metrics dashboard** - Learn from Polar's `Metrics/MetricChartBox.tsx`
- **Revenue charts** - Learn from Polar's `Charts/GenericChart.tsx`
- **Subscription management** - Learn from Polar's `Subscriptions/` folder
- **Transaction history** - Learn from Polar's `Transactions/TransactionsList.tsx`

### 1.4 Database Access Pattern

**Direct Drizzle Connection (No API):**

```typescript
// packages/admin/src/lib/db.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../../workers/src/db/schema';

const connectionString = process.env.DATABASE_URL!;

const client = postgres(connectionString);
export const db = drizzle(client, { schema });

// Now you can query directly
export async function getAllUsers() {
  return db.query.users.findMany({
    with: {
      subscriptions: true,
      organizations: true,
    },
  });
}
```

**Why This Works:**

- Admin app runs locally (trusted environment)
- No API layer latency
- Full database access for complex queries
- Easy debugging
- Fast development

### 1.5 Security Considerations

**Local-Only Deployment:**

```json
// package.json
{
  "scripts": {
    "dev": "next dev -p 3001",
    "build": "echo 'Admin app is local-only, no build needed'",
    "start": "echo 'Admin app is local-only, use dev mode'"
  }
}
```

**Simple Auth (Optional):**

```typescript
// src/middleware.ts
import { NextResponse } from 'next/server';

export function middleware(request) {
  // Simple password protection
  const auth = request.cookies.get('admin-auth');

  if (!auth || auth.value !== process.env.ADMIN_PASSWORD) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}
```

**Or No Auth:**
Since it's local-only, you may not need authentication at all. Just restrict access via:

- Runs on localhost only
- Database credentials in `.env.local` (not committed)
- VPN/network restrictions if needed

---

## 2. Stripe Implementation Hardening

---

## 2. Stripe Implementation Hardening

### 2.1 Current CoRATES Implementation Analysis

**What CoRATES Has:**

✅ **Good Patterns:**

- Two-phase webhook trust model (excellent!)
- Payload hash deduplication
- Proper signature verification
- `stripeEventLedger` table for observability
- Test mode detection
- Structured logging

**Location:** `packages/workers/src/routes/billing/webhooks.js`

**Current Event Coverage:**

```javascript
// CoRATES only handles:
- checkout.session.completed (ONE-TIME PURCHASES ONLY)

// That's it! 🚨
```

**Critical Gap:** CoRATES uses Better Auth Stripe plugin for subscriptions, but there's **no visibility** into what events it handles or how it processes them.

### 2.2 Flowglad's Comprehensive Stripe Implementation

**What Flowglad Handles:**

📦 **Primary Webhook Events** (20+ events):

```typescript
// Payment Intent Lifecycle
-payment_intent.processing - // ACH pending
  payment_intent.succeeded - // Payment completed
  payment_intent.canceled - // Payment canceled
  payment_intent.payment_failed - // Payment failed
  charge.failed - // Charge failed
  // Setup Intent (Payment Methods)
  setup_intent.succeeded - // Payment method added
  setup_intent.setup_failed - // Payment method failed
  setup_intent.canceled - // Setup canceled
  setup_intent.requires_action - // 3D Secure required
  // Customer Management
  customer.created -
  customer.updated -
  customer.deleted -
  // Subscription Lifecycle
  customer.subscription.created -
  customer.subscription.updated -
  customer.subscription.deleted -
  customer.subscription.paused -
  customer.subscription.resumed -
  // Invoice Events
  invoice.created -
  invoice.finalized -
  invoice.payment_succeeded -
  invoice.payment_failed -
  invoice.paid -
  invoice.voided -
  // Stripe Connect (for multi-tenant)
  account.updated; // Connect account status
```

**Location:** `reference/flowglad/platform/flowglad-next/src/utils/processStripeEvents.ts`

### 2.3 Gap Analysis: CoRATES vs Flowglad

| Feature                      | CoRATES         | Flowglad                    | Severity        | Impact                     |
| ---------------------------- | --------------- | --------------------------- | --------------- | -------------------------- |
| **Subscription Events**      | ❌ None visible | ✅ Full lifecycle           | 🔴 **CRITICAL** | Subscriptions may not sync |
| **Payment Failure Handling** | ❌ None         | ✅ Comprehensive            | 🔴 **CRITICAL** | Lost revenue, bad UX       |
| **Invoice Events**           | ❌ None         | ✅ payment_succeeded/failed | 🔴 **CRITICAL** | Billing status desync      |
| **Customer Sync**            | ⚠️ Partial      | ✅ Complete                 | 🟡 **HIGH**     | Data inconsistency         |
| **Payment Method Events**    | ⚠️ Partial      | ✅ Full setup_intent flow   | 🟡 **HIGH**     | Failed payment methods     |
| **Dunning Logic**            | ❌ None         | ✅ Automated retries        | 🟡 **HIGH**     | Churn from failed payments |
| **Idempotency**              | ⚠️ Hash-only    | ✅ Hash + Event ID          | 🟡 **MEDIUM**   | Rare duplicate processing  |
| **Background Processing**    | ❌ Sync         | ✅ Trigger.dev              | 🟡 **MEDIUM**   | Webhook timeouts           |
| **Currency Utilities**       | ❌ None         | ✅ Full conversion          | 🟢 **LOW**      | Manual formatting needed   |
| **Tax Automation**           | ❌ None         | ✅ Stripe Tax               | 🟢 **LOW**      | Manual tax handling        |
| **Metadata Usage**           | ⚠️ Basic        | ✅ Extensive                | 🟢 **LOW**      | Limited tracking           |

### 2.4 Critical Missing Events in CoRATES

#### 🚨 Issue #1: No Subscription Event Handling

**Problem:**

```javascript
// CoRATES Better Auth plugin handles subscriptions
// But there's NO webhook visibility or custom handling
// You're blind to subscription changes!
```

**What Can Go Wrong:**

- Subscription updated in Stripe but not in DB
- Subscription canceled externally but still active in app
- Plan changes not reflected
- Proration not tracked
- Trials ending without notification

**Flowglad Solution:**

```typescript
case 'customer.subscription.updated':
  await handleSubscriptionUpdated(event)
  // - Update DB subscription status
  // - Update current_period_end
  // - Handle plan changes
  // - Track proration
  // - Update usage limits
  break

case 'customer.subscription.deleted':
  await handleSubscriptionDeleted(event)
  // - Mark subscription as canceled
  // - Update user access
  // - Send cancelation email
  // - Archive subscription data
  break
```

**CoRATES Fix Needed:**

```javascript
// packages/workers/src/routes/billing/webhooks.js
// ADD NEW ROUTE: /api/billing/webhook/subscriptions

export async function handleSubscriptionWebhook(event) {
  switch (event.type) {
    case 'customer.subscription.updated':
      await syncSubscriptionStatus(event.data.object);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionCancellation(event.data.object);
      break;
    // ... more events
  }
}
```

---

#### 🚨 Issue #2: No Invoice Payment Failure Handling

**Problem:**

```javascript
// When a subscription renewal payment fails:
// 1. Stripe sends invoice.payment_failed
// 2. CoRATES doesn't listen for it
// 3. User still has access
// 4. No dunning emails sent
// 5. Subscription eventually canceled by Stripe
// 6. User surprised when access revoked
```

**What Can Go Wrong:**

- Failed payments go unnoticed
- No retry attempts
- No customer communication
- Higher churn rate
- Revenue loss

**Flowglad Solution:**

```typescript
case 'invoice.payment_failed':
  await stripeInvoicePaymentFailedTask.trigger(event)

  // In the task:
  async function handleInvoicePaymentFailed(invoice) {
    // 1. Update subscription status to 'past_due'
    await db.update(subscriptions)
      .set({ status: 'past_due', lastPaymentFailed: new Date() })
      .where(eq(subscriptions.stripeSubscriptionId, invoice.subscription))

    // 2. Send dunning email to customer
    await sendDunningEmail({
      userId: subscription.userId,
      invoiceUrl: invoice.hosted_invoice_url,
      amountDue: invoice.amount_due,
      attemptNumber: invoice.attempt_count
    })

    // 3. Log for follow-up
    await createBillingAlert({
      type: 'payment_failed',
      subscriptionId: subscription.id,
      severity: 'high'
    })
  }
  break

case 'invoice.payment_succeeded':
  // Update status back to active
  await db.update(subscriptions)
    .set({ status: 'active', lastPaymentAt: new Date() })
  break
```

**CoRATES Fix Needed:**

```javascript
// Add to webhooks.js
case 'invoice.payment_failed':
  const invoice = event.data.object

  // Update subscription to past_due
  await db.update(subscriptions)
    .set({
      status: 'past_due',
      lastFailedPaymentAt: new Date(),
      failedPaymentAttempts: sql`failed_payment_attempts + 1`
    })
    .where(eq(subscriptions.stripeSubscriptionId, invoice.subscription))

  // Send email alert
  await sendPaymentFailedEmail(invoice)
  break
```

---

#### 🚨 Issue #3: No Payment Intent Lifecycle Tracking

**Problem:**

```javascript
// Payment intents go through multiple states:
// 1. created
// 2. processing (ACH)
// 3. succeeded
// 4. payment_failed
// 5. canceled

// CoRATES doesn't track ANY of these!
```

**What Can Go Wrong:**

- ACH payments appear as "pending" forever
- Failed payments not logged
- No status updates to users
- Customer confusion
- Support burden

**Flowglad Solution:**

```typescript
case 'payment_intent.processing':
  // ACH takes 3-5 business days
  await db.update(payments)
    .set({ status: 'processing' })
    .where(eq(payments.stripePaymentIntentId, paymentIntent.id))

  await sendEmail({
    template: 'payment_processing',
    message: 'Your ACH payment is processing. Access granted in 3-5 days.'
  })
  break

case 'payment_intent.succeeded':
  await db.update(payments)
    .set({
      status: 'succeeded',
      paidAt: new Date(),
      amount: paymentIntent.amount
    })

  // Grant access
  await activateSubscription(paymentIntent.metadata.subscriptionId)
  break

case 'payment_intent.payment_failed':
  await db.update(payments)
    .set({ status: 'failed', failureReason: paymentIntent.last_payment_error?.message })

  // Notify customer
  await sendPaymentFailedEmail(paymentIntent)
  break
```

---

#### 🚨 Issue #4: No Customer Sync

**Problem:**

```javascript
// Stripe customers can be:
// - Updated (email change, address change)
// - Deleted (GDPR, account closure)

// CoRATES doesn't sync these changes!
```

**What Can Go Wrong:**

- Emails out of sync
- Failed payment notifications go to old email
- GDPR compliance issues (deleted in Stripe, still in DB)
- Customer support confusion

**Flowglad Solution:**

```typescript
case 'customer.updated':
  const customer = event.data.object

  await db.update(customers)
    .set({
      email: customer.email,
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      currency: customer.currency,
      updatedAt: new Date()
    })
    .where(eq(customers.stripeCustomerId, customer.id))
  break

case 'customer.deleted':
  // Mark as deleted, don't hard delete (audit trail)
  await db.update(customers)
    .set({
      deletedAt: new Date(),
      status: 'deleted'
    })
    .where(eq(customers.stripeCustomerId, customer.id))

  // Trigger GDPR deletion workflow if needed
  await triggerGDPRDeletion(customer.id)
  break
```

---

### 2.5 Flowglad's Stripe Utilities (2,066 Lines!)

**Key Utilities to Extract:**

#### A. Currency Handling

```typescript
// reference/flowglad/.../utils/stripe.ts

// Zero-decimal currencies (JPY, KRW, etc.)
export const isCurrencyZeroDecimal = (currency: CurrencyCode) => {
  return zeroDecimalCurrencies.includes(currency);
};

// Convert Stripe cents to human-readable
export const stripeCurrencyAmountToHumanReadableCurrencyAmount = (currency: CurrencyCode, amount: number) => {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  });

  if (!isCurrencyZeroDecimal(currency)) {
    return formatter.format(Number((amount / 100).toFixed(2)));
  }
  return formatter.format(amount);
};

// Get currency symbol separately
export const getCurrencyParts = (
  currency: CurrencyCode,
  amount: number,
  options?: { hideZeroCents?: boolean },
): { symbol: string; value: string } => {
  // Uses Intl.NumberFormat.formatToParts() for reliable i18n
  // ...
};
```

**CoRATES Should Add:**

```typescript
// packages/shared/src/utils/currency.ts
export function formatStripeCurrency(amount: number, currency: string): string {
  const isZeroDecimal = ['JPY', 'KRW'].includes(currency);
  const actualAmount = isZeroDecimal ? amount : amount / 100;

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(actualAmount);
}
```

---

#### B. Metadata Patterns

**Flowglad's Extensive Metadata:**

```typescript
// Checkout session metadata
const checkoutSession = await stripe.checkout.sessions.create({
  metadata: {
    // Organization tracking
    organizationId: org.id,
    customerId: customer.id,

    // Purchase tracking
    productId: product.id,
    priceId: price.id,
    purchaseId: purchase.id,

    // User tracking
    userId: user.id,
    userEmail: user.email,

    // Feature flags
    isTestPurchase: 'false',
    grantType: 'subscription',

    // Referral tracking
    referralCode: referral?.code,
    campaignId: campaign?.id,

    // Internal IDs
    checkoutSessionInternalId: checkoutSession.id,
  },
});
```

**CoRATES Current Metadata:**

```javascript
// Limited metadata
metadata: {
  orgId,
  grantType: 'single_project',
  purchaserUserId
}
```

**CoRATES Should Expand:**

```javascript
metadata: {
  // Core
  orgId,
  projectId,
  userId,
  userEmail,

  // Tracking
  source: 'dashboard', // or 'api', 'mobile'
  referrer: request.headers.get('referer'),

  // Feature flags
  environment: c.env.ENVIRONMENT,
  version: '1.0',

  // Idempotency
  requestId: crypto.randomUUID(),
}
```

---

#### C. Tax Calculation (Stripe Tax)

**Flowglad's Tax Automation:**

```typescript
// Automatic tax collection
const checkoutSession = await stripe.checkout.sessions.create({
  automatic_tax: {
    enabled: true,
  },
  tax_id_collection: {
    enabled: true, // Collect VAT/Tax ID from customers
  },
  // ...
});

// Manual tax calculation
import { calculateTaxForOrder } from './tax/stripe-tax';

const taxCalculation = await calculateTaxForOrder({
  items: [
    {
      amount: price.amount,
      reference: product.id,
      tax_code: 'txcd_10000000', // Digital products
    },
  ],
  customer: {
    address: billingAddress,
    tax_ids: customer.taxIds,
  },
  currency: 'usd',
});
```

**CoRATES Doesn't Have This:**

```javascript
// No tax automation
// Manual handling required
```

**Recommendation:**

- Add Stripe Tax for US/EU compliance
- Or document manual tax workflow

---

### 2.6 Background Job Processing

**Flowglad's Trigger.dev Pattern:**

```typescript
// Webhook handler triggers background job
case 'payment_intent.succeeded':
  await stripePaymentIntentSucceededTask.trigger(event)
  // Returns immediately, processing happens async
  break

// Background job (runs separately)
export const stripePaymentIntentSucceededTask = task({
  id: 'stripe-payment-intent-succeeded',
  run: async (event: Stripe.PaymentIntentSucceededEvent) => {
    // Heavy processing here
    // - Update database
    // - Send emails
    // - Calculate fees
    // - Update ledger
    // - Grant access
    // - Send webhooks

    // Can take 30+ seconds without blocking webhook response
  }
})
```

**Why This Matters:**

- Stripe webhooks timeout after 30 seconds
- Heavy processing should be async
- Prevents webhook delivery failures
- Better error recovery

**CoRATES Current:**

```javascript
// All processing is synchronous
// Risk of timeout on complex operations
```

**CoRATES Options:**

1. **Use Cloudflare Queues** (Recommended):

```javascript
// Webhook handler
case 'invoice.payment_succeeded':
  await c.env.BILLING_QUEUE.send({
    type: 'invoice.payment_succeeded',
    event: event
  })
  break

// Queue consumer (packages/workers/src/queues/billing.js)
export async function handleBillingQueue(batch, env) {
  for (const message of batch.messages) {
    await processStripeEvent(message.body)
  }
}
```

2. **Use Durable Objects** (Advanced):

```javascript
// Offload to Durable Object for processing
const do = c.env.STRIPE_PROCESSOR.get(id)
await do.fetch(request)
```

3. **Keep Sync** (Current):

- Only for simple operations
- Add timeout monitoring
- Optimize database queries

---

### 2.7 Idempotency Improvements

**Flowglad's Dual Idempotency:**

```typescript
// 1. Hash-based (before verification)
const payloadHash = await sha256(rawBody)
const existing = await getLedgerByPayloadHash(db, payloadHash)
if (existing) return { skipped: 'duplicate_payload' }

// 2. Event ID-based (after verification)
const event = stripe.webhooks.constructEvent(...)
const existingEvent = await getLedgerByStripeEventId(db, event.id)
if (existingEvent) return { skipped: 'duplicate_event' }
```

**CoRATES Has:**

```javascript
// Only hash-based dedupe (good!)
const payloadHash = await sha256(rawBody);
const existing = await getLedgerByPayloadHash(db, payloadHash);
```

**CoRATES Should Add:**

```javascript
// After signature verification
const event = await stripe.webhooks.constructEventAsync(...)

// Check for duplicate event ID
const existingEvent = await db.query.stripeEventLedger.findFirst({
  where: eq(stripeEventLedger.stripeEventId, event.id)
})

if (existingEvent) {
  logger.stripe('webhook_dedupe_event_id', {
    outcome: 'skipped_duplicate',
    stripeEventId: event.id,
    existingLedgerId: existingEvent.id
  })
  return c.json({ received: true, skipped: 'duplicate_event_id' }, 200)
}
```

---

### 2.8 Recommended Implementation Plan

**Phase 1: Critical Fixes (Week 1) 🔴**

1. **Add Subscription Webhook Handler**

   ```javascript
   // New route: /api/billing/webhook/subscriptions
   -customer.subscription.updated - customer.subscription.deleted - customer.subscription.paused;
   ```

2. **Add Invoice Event Handlers**

   ```javascript
   -invoice.payment_succeeded - invoice.payment_failed;
   ```

3. **Add Payment Intent Lifecycle**
   ```javascript
   -payment_intent.processing - payment_intent.succeeded - payment_intent.payment_failed;
   ```

**Phase 2: Stability (Week 2) 🟡**

4. **Add Event ID Dedupe**
   - Dual idempotency (hash + event ID)

5. **Customer Sync Events**

   ```javascript
   -customer.updated - customer.deleted;
   ```

6. **Payment Method Events**
   ```javascript
   -setup_intent.succeeded - setup_intent.setup_failed;
   ```

**Phase 3: Polish (Week 3-4) 🟢**

7. **Add Currency Utilities**
   - Format Stripe amounts properly
   - Handle zero-decimal currencies

8. **Expand Metadata**
   - Better tracking and debugging
   - More context in webhooks

9. **Background Processing**
   - Cloudflare Queues for heavy operations
   - Prevent webhook timeouts

10. **Tax Automation (Optional)**
    - Stripe Tax integration
    - Or document manual workflow

---

### 2.9 Code Snippets for CoRATES

#### Complete Subscription Webhook Handler

```javascript
// packages/workers/src/routes/billing/subscription-webhooks.js

import { Hono } from 'hono';
import { createDb } from '@/db/client.js';
import Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { subscriptions } from '@/db/schema.js';
import {
  insertLedgerEntry,
  updateLedgerWithVerifiedFields,
  getLedgerByPayloadHash,
  getLedgerByStripeEventId,
  LedgerStatus,
} from '@/db/stripeEventLedger.js';
import { createLogger, sha256 } from '@/lib/observability/logger.js';

const subscriptionWebhooks = new Hono();

subscriptionWebhooks.post('/webhook/subscriptions', async c => {
  const logger = createLogger({ c, service: 'subscription-webhooks' });
  const db = createDb(c.env.DB);
  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-11-17.clover',
  });

  // Phase 1: Trust-minimal receipt
  const signature = c.req.header('stripe-signature');
  const rawBody = await c.req.text();
  const payloadHash = await sha256(rawBody);

  // Check for duplicate by payload
  const existingPayload = await getLedgerByPayloadHash(db, payloadHash);
  if (existingPayload) {
    return c.json({ received: true, skipped: 'duplicate_payload' }, 200);
  }

  // Insert ledger entry
  const ledgerId = crypto.randomUUID();
  await insertLedgerEntry(db, {
    id: ledgerId,
    payloadHash,
    signaturePresent: !!signature,
    route: '/api/billing/webhook/subscriptions',
    requestId: logger.requestId,
    status: LedgerStatus.RECEIVED,
  });

  // Phase 2: Verify and process
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, c.env.STRIPE_WEBHOOK_SECRET_SUBSCRIPTIONS);
  } catch (err) {
    await updateLedgerStatus(db, ledgerId, {
      status: LedgerStatus.IGNORED_UNVERIFIED,
      error: 'invalid_signature',
      httpStatus: 403,
    });
    return c.json({ error: 'Invalid signature' }, 403);
  }

  // Check for duplicate by event ID
  const existingEvent = await getLedgerByStripeEventId(db, event.id);
  if (existingEvent) {
    return c.json({ received: true, skipped: 'duplicate_event_id' }, 200);
  }

  // Process event
  try {
    await processSubscriptionEvent(event, db, logger);

    // Update ledger with success
    await updateLedgerWithVerifiedFields(db, ledgerId, {
      stripeEventId: event.id,
      type: event.type,
      livemode: event.livemode,
      apiVersion: event.api_version,
      created: new Date(event.created * 1000),
      status: LedgerStatus.PROCESSED,
      httpStatus: 200,
      stripeSubscriptionId: event.data.object.id,
    });

    return c.json({ received: true }, 200);
  } catch (err) {
    await updateLedgerStatus(db, ledgerId, {
      status: LedgerStatus.FAILED,
      error: err.message,
      httpStatus: 500,
    });
    throw err;
  }
});

async function processSubscriptionEvent(event, db, logger) {
  const subscription = event.data.object;

  switch (event.type) {
    case 'customer.subscription.updated':
      await db
        .update(subscriptions)
        .set({
          status: subscription.status,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.stripeSubscriptionId, subscription.id));

      logger.stripe('subscription_updated', {
        subscriptionId: subscription.id,
        status: subscription.status,
      });
      break;

    case 'customer.subscription.deleted':
      await db
        .update(subscriptions)
        .set({
          status: 'canceled',
          canceledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.stripeSubscriptionId, subscription.id));

      logger.stripe('subscription_deleted', {
        subscriptionId: subscription.id,
      });
      break;

    case 'customer.subscription.paused':
      await db
        .update(subscriptions)
        .set({
          status: 'paused',
          pausedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
      break;

    default:
      logger.stripe('unhandled_event', { eventType: event.type });
  }
}

export default subscriptionWebhooks;
```

---

## 3. Flowglad Analysis (Original Content)

# Option 2: Use shadcn CLI to generate matching components

pnpm dlx shadcn@latest add button card dialog table

````

---

#### B. BetterAuth Configuration Patterns ⭐⭐⭐⭐⭐

**Location:** `/platform/flowglad-next/src/utils/auth.ts`

**What's Available:**

```typescript
// Flowglad's BetterAuth setup
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: { user, session, account, verification },
  }),
  plugins: [admin(), emailOTP(), magicLink()],
  emailAndPassword: {
    sendResetPassword: async ({ user, url }) => {
      // Custom email sending with Resend
    },
  },
  session: {
    updateAge: 24 * 60 * 60 * 1000,
  },
});
````

**Key Patterns to Adopt:**

1. **Session management** with Drizzle adapter
2. **Email OTP** and magic link flows
3. **Custom email handlers** (adapt for CoRATES email provider)
4. **Organization-scoped sessions**
5. **Admin plugin** for user management

**Extraction Effort:** ✅ **LOW** (1-2 days)

- CoRATES already uses BetterAuth
- Patterns are directly transferable
- Requires adaptation to CoRATES' schema

**CoRATES Implementation:**

```typescript
// packages/workers/src/better-auth.ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      /* CoRATES tables */
    },
  }),
  plugins: [
    emailOTP({
      sendVerificationEmail: async ({ email, url, token }) => {
        // Use CoRATES email service
      },
    }),
  ],
  // Adopt Flowglad's session patterns
});
```

---

#### C. Stripe Integration Patterns ⭐⭐⭐⭐

**Location:**

- `/platform/flowglad-next/src/utils/stripe.ts` (2,066 lines!)
- `/platform/flowglad-next/src/utils/processStripeEvents.ts`
- `/platform/flowglad-next/src/app/api/webhook-stripe/[mode]/route.ts`

**What's Available:**

**1. Stripe Utilities:**

```typescript
// Currency conversion
stripeCurrencyAmountToHumanReadableCurrencyAmount(amount, currency);

// Zero-decimal currencies handling
isZeroDecimalCurrency(currency);

// Payment intent handling
async function handlePaymentIntentSucceeded(event) {
  const paymentIntent = event.data.object;
  // Update subscription status
  // Record payment
  // Update customer
}
```

**2. Webhook Event Handling:**

```typescript
// Centralized event routing
export async function processStripeEvent(event: Stripe.Event, mode: 'livemode' | 'testmode') {
  switch (event.type) {
    case 'payment_intent.succeeded':
      return handlePaymentIntentSucceeded(event);
    case 'payment_intent.failed':
      return handlePaymentIntentFailed(event);
    case 'customer.subscription.updated':
      return handleSubscriptionUpdated(event);
    case 'invoice.payment_succeeded':
      return handleInvoicePaymentSucceeded(event);
    // ... 20+ more events
  }
}
```

**3. Webhook Endpoint Pattern:**

```typescript
// app/api/webhook-stripe/[mode]/route.ts
export async function POST(request: Request, { params }: { params: { mode: 'livemode' | 'testmode' } }) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  // Verify signature
  const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

  // Process event
  await processStripeEvent(event, params.mode);

  return Response.json({ received: true });
}
```

**Extraction Effort:** ⚠️ **MEDIUM** (1-2 weeks)

**Challenges:**

- Deep integration with Flowglad's database schema
- Ledger/accounting system dependencies
- Trigger.dev background job system
- Organization/multi-tenant architecture

**What You Can Extract:**

1. ✅ **Webhook routing structure** - Event handler pattern
2. ✅ **Currency utilities** - Formatting, zero-decimal handling
3. ✅ **Signature verification** - Security pattern
4. ⚠️ **Payment processing logic** - Requires heavy adaptation
5. ❌ **Subscription management** - Too coupled to their system

**Recommendation:** **Reference patterns, build simplified versions**

**CoRATES Adaptation:**

```typescript
// packages/workers/src/api/webhooks/stripe.ts
import Stripe from 'stripe';

export async function handleStripeWebhook(request: Request) {
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  const signature = request.headers.get('stripe-signature');
  const body = await request.text();

  // Verify (borrowed from Flowglad pattern)
  const event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);

  // Simplified routing (inspired by Flowglad)
  switch (event.type) {
    case 'invoice.payment_succeeded':
      await handlePaymentSuccess(event.data.object);
      break;
    case 'customer.subscription.updated':
      await syncSubscriptionStatus(event.data.object);
      break;
  }

  return new Response('OK', { status: 200 });
}

// Simplified handlers (not full Flowglad complexity)
async function handlePaymentSuccess(invoice: Stripe.Invoice) {
  await db
    .update(subscriptions)
    .set({ status: 'active', lastPaymentAt: new Date() })
    .where(eq(subscriptions.stripeSubscriptionId, invoice.subscription));
}
```

---

#### D. Dashboard Components ⭐⭐⭐⭐

**Location:** `/platform/flowglad-next/src/app/dashboard/`

**Components Available:**

- `InternalDashboard.tsx` - Main container
- `ActiveSubscribersChart.tsx`
- `RecurringRevenueChart.tsx`
- `RevenueChart.tsx`
- Date/interval pickers
- Chart configuration utilities

**Chart Infrastructure:**

- Recharts for visualization
- Date range selection
- Interval logic (day/week/month/year)
- Responsive layouts

**Extraction Effort:** ⚠️ **MEDIUM** (2-3 weeks)

**What's Portable:**

1. ✅ **Chart UI components** - Visual shells
2. ✅ **Layout patterns** - Dashboard structure
3. ✅ **Date pickers** - UI controls
4. ⚠️ **Data fetching** - Requires reimplementation
5. ❌ **Business logic** - Revenue calculations need rewrite

**CoRATES Adaptation:**

```tsx
// packages/web/src/components/dashboard/RevenueChart.tsx
import { LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';

// Extract visual structure from Flowglad
export function RevenueChart() {
  // Use CoRATES data fetching (not Flowglad's tRPC)
  const { data } = useQuery({
    queryKey: ['revenue'],
    queryFn: fetchRevenueData,
  });

  // Use Flowglad's chart configuration
  return (
    <LineChart data={data}>
      <Line dataKey='revenue' stroke='#8884d8' />
      {/* Copy Flowglad's chart styling */}
    </LineChart>
  );
}
```

---

#### E. Checkout Components ⭐⭐⭐

**Location:** `/platform/flowglad-next/src/app/checkout/`

**Components:**

- `CheckoutForm.tsx` - Stripe Elements integration
- `PaymentForm.tsx` - Payment method collection
- `CheckoutModal.tsx` - Modal wrapper
- Success/failure pages

**Features:**

- Stripe Elements (`@stripe/react-stripe-js`)
- Address collection
- Discount codes
- Payment status tracking

**Extraction Effort:** ⚠️ **MEDIUM-HIGH** (2-3 weeks)

**Challenges:**

- Checkout session management (database)
- Product/price configuration
- Customer record sync
- Server-side session creation

**Recommendation:** **Extract UI patterns, rebuild logic**

---

### 1.3 Flowglad Database Schema Insights

**Relevant Tables:**

```sql
-- User/Auth (BetterAuth standard)
better_auth_user
better_auth_session
better_auth_account
better_auth_verification

-- Billing (Flowglad-specific)
organizations
customers
subscriptions
payments
invoices
products
prices

-- Usage tracking
usage_meters
usage_records

-- Financial (complex - not recommended for extraction)
ledger_accounts
ledger_transactions
```

**CoRATES Takeaway:**

- Adopt BetterAuth table structure (standard)
- Design simplified billing tables inspired by Flowglad
- Skip complex ledger system unless needed

---

### 1.4 Flowglad Migration Utilities

**Location:** `/platform/flowglad-next/src/db/migrations/`

**What's Valuable:**

- Migration patterns for billing tables
- Drizzle ORM migration examples
- Index strategies for performance

**CoRATES Can Learn:**

- How to structure subscription tables
- Proper indexes for Stripe data
- Migration sequencing for billing features

---

## 2. Polar Analysis

### 2.1 Technology Stack

**Backend:**

- Framework: FastAPI (Python) ⚠️
- Database: PostgreSQL + SQLAlchemy
- Background: Dramatiq workers
- Payments: Stripe (as Merchant of Record)
- Auth: Custom (NOT BetterAuth) ❌

**Frontend:**

- Framework: Next.js 14
- UI: Custom components + Radix UI
- State: TanStack Query
- API: OpenAPI TypeScript codegen

**CoRATES Compatibility:** 🟡 40% - Frontend only, backend incompatible

---

### 2.2 Polar's Stripe Architecture

**Location:** `/server/polar/integrations/stripe/`

**What Makes Polar Interesting:**

#### Advanced Stripe Implementation ⭐⭐⭐⭐⭐

**1. Merchant of Record Pattern:**

```python
# Polar is the legal merchant, handles all compliance
class StripeService:
    async def create_account(self, account, name):
        """Create Stripe Connect Express account for sellers"""
        return await stripe.Account.create_async(
            country=account.country,
            type="express",
            capabilities={"transfers": {"requested": True}},
            settings={"payouts": {"schedule": {"interval": "manual"}}}
        )

    async def transfer(self, destination_account, amount, **kwargs):
        """Transfer funds to seller's account"""
        return await stripe.Transfer.create_async(
            amount=amount,
            currency="usd",
            destination=destination_account,
            metadata=kwargs.get('metadata', {})
        )
```

**2. Tax Calculation Service:**

```python
# /server/polar/tax/calculation/stripe.py
class StripeTaxService:
    async def calculate_tax(self, order_data):
        """Calculate tax using Stripe Tax API"""
        calculation = await stripe.tax.Calculation.create_async(
            currency=order_data.currency,
            line_items=[...],
            customer_details={
                "address": {...},
                "address_source": "billing"
            }
        )
        return calculation
```

**3. Webhook Processing:**

```python
# /server/polar/integrations/stripe/endpoints.py
@router.post("/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    signature = request.headers.get("stripe-signature")

    event = stripe.Webhook.construct_event(
        payload, signature, webhook_secret
    )

    # Queue for background processing
    await enqueue_task(ProcessStripeEvent, event_id=event.id)

    return {"status": "ok"}
```

**CoRATES Relevance:**

- ✅ Learn MOR architecture patterns (if switching to Polar/MOR model)
- ⚠️ Cannot extract Python code directly
- ✅ Can reference webhook patterns
- ✅ Tax calculation flow is valuable

**Recommendation:** **Study architecture, don't extract code**

---

### 2.3 Polar Dashboard Components

**Location:** `/clients/apps/web/src/components/Dashboard/`

**Components Available:**

- Organization dashboard
- Revenue charts
- Subscription metrics
- Customer analytics
- Payout tracking
- Order management

**Tech:**

- Next.js components (TypeScript)
- TanStack Query for data
- Radix UI primitives
- Custom chart library

**Extraction Effort:** ⚠️ **HIGH** (3-4 weeks)

**Challenges:**

1. Uses Polar's Python API (not compatible)
2. Complex data structures from backend
3. MOR-specific business logic
4. Custom authentication (not BetterAuth)

**What You Can Extract:**

1. ✅ **UI component patterns** - Visual structure
2. ✅ **Chart configurations** - Recharts setups
3. ⚠️ **Layout patterns** - Requires adaptation
4. ❌ **Data layer** - Completely different

**Recommendation:** **Visual inspiration only, rebuild data layer**

---

### 2.4 Polar's Payment Flow

**Unique Features:**

1. **Checkout Links** - Shareable payment links
2. **Customer Portal** - Self-service billing portal
3. **Discord Integration** - Grant access to Discord servers
4. **GitHub Repo Access** - Subscription-gated repositories
5. **License Key Generation** - Software licensing

**CoRATES Relevance:**

- ⚠️ These are Polar-specific features
- ✅ Checkout link pattern could inspire CoRATES sharing features
- ✅ Customer portal UX is excellent reference

---

### 2.5 Polar's Database Models

**Key Models (Python/SQLAlchemy):**

```python
# /server/polar/models/
- User
- Organization
- Account (Stripe Connect)
- Product
- ProductPrice
- Subscription
- Order
- Transaction
- Benefit (access grants)
- Webhook
- CustomerSession
```

**CoRATES Takeaway:**

- Study table relationships
- Understand MOR data model
- Don't copy schema directly (Python-specific)

---

## 3. Comparative Analysis

### 3.1 Which Repository to Prioritize?

| Criteria                   | Flowglad                        | Polar                          | Winner                    |
| -------------------------- | ------------------------------- | ------------------------------ | ------------------------- |
| **Tech Stack Match**       | BetterAuth + Stripe + Next.js   | Python + Custom Auth           | 🏆 **Flowglad**           |
| **Direct Code Extraction** | ✅ High (Stripe only)           | ❌ Low (Python)                | 🏆 **Flowglad** (Stripe)  |
| **UI Components**          | Standard shadcn (CLI-generated) | 60+ custom business components | 🏆 **Polar** (patterns)   |
| **Admin Dashboard**        | Basic structure                 | Full SaaS admin patterns       | 🏆 **Polar**              |
| **Stripe Patterns**        | Direct merchant                 | MOR patterns                   | 🏆 **Flowglad** (for now) |
| **Dashboard Quality**      | Good                            | Excellent                      | **Polar**                 |
| **Production Scale**       | Unknown                         | 6,500+ businesses              | **Polar**                 |
| **Auth Integration**       | BetterAuth                      | Custom                         | 🏆 **Flowglad**           |
| **Learning Value**         | High                            | High                           | **Tie**                   |

**Verdict:** **Flowglad for Stripe logic, Polar for admin UI patterns, shadcn CLI for components**

---

### 3.2 Extraction Priority Matrix

#### Phase 1: Immediate Wins (Week 1-2) ⭐⭐⭐⭐⭐

**Source: shadcn CLI + Polar patterns + Flowglad Stripe**

1. ✅ **UI Component Library**
   - Generate via shadcn CLI (same as Flowglad's)
   - Learn custom atoms from Polar's `@polar-sh/ui`
   - Effort: 1-2 days
   - Value: Immediate design system

2. ✅ **BetterAuth Patterns**
   - Study Flowglad's configuration
   - Adapt to CoRATES schema
   - Effort: 2-3 days
   - Value: Improved auth flows

3. ✅ **Webhook Structure**
   - Extract Flowglad's event routing pattern
   - Build simplified handlers
   - Effort: 3-5 days
   - Value: Robust Stripe integration

#### Phase 2: Medium-Term (Week 3-6) ⭐⭐⭐⭐

**Source: Polar for UI + Flowglad for Stripe**

4. ⚠️ **Dashboard Components**
   - Learn from Polar's `Metrics/`, `Charts/`, `Dashboard/`
   - Study `MetricChartBox.tsx`, `GenericChart.tsx`
   - Build CoRATES data layer
   - Effort: 2-3 weeks
   - Value: Professional analytics

5. ⚠️ **Checkout Components**
   - Extract Flowglad's Stripe Elements setup
   - Adapt checkout flow
   - Build session management
   - Effort: 2-3 weeks
   - Value: Better conversion

#### Phase 3: Long-Term (Week 7-12) ⭐⭐⭐

**Source: Both (inspiration)**

6. ⚠️ **Subscription Management**
   - Design simplified billing system
   - Inspired by both repositories
   - Custom implementation for CoRATES
   - Effort: 4-6 weeks
   - Value: Core business functionality

---

## 4. Actionable Extraction Plan

### 4.1 UI Component Setup

#### Step 1: shadcn/ui via CLI (Day 1-2)

```bash
# Navigate to admin package
cd packages/admin

# Initialize shadcn (generates same components as Flowglad)
pnpm dlx shadcn@latest init

# Add all needed components
pnpm dlx shadcn@latest add button card dialog dropdown-menu \
  form input label select table tabs tooltip sheet \
  avatar badge separator command popover skeleton alert
```

**Then study Polar's custom atoms for patterns:**

```bash
# Polar's enhanced components worth learning from:
# reference/polar/clients/packages/ui/src/components/atoms/
# - ShadowBox.tsx - Card variant with shadow styling
# - datatable/ - Full TanStack Table integration
# - MoneyInput.tsx - Currency-aware input
# - Paginator.tsx - Consistent pagination
# - Status.tsx - Status badge variants
```

**Build your own enhanced atoms inspired by Polar:**

```typescript
// src/components/atoms/ShadowBox.tsx (inspired by Polar)
import { cn } from '@/lib/utils'

export function ShadowBox({ className, children, ...props }) {
  return (
    <div
      className={cn(
        'w-full rounded-xl border border-transparent bg-gray-50 p-8',
        'dark:bg-gray-900 dark:border-gray-700',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
```

---

#### Step 2: BetterAuth Configuration (Day 3-4)

```typescript
// Study Flowglad's setup
// File: reference/flowglad/platform/flowglad-next/src/utils/auth.ts

// Adapt for CoRATES
// File: packages/workers/src/better-auth.ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from './db';
import { users, sessions, accounts, verifications } from './db/schema/auth';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
    },
  }),
  plugins: [
    emailOTP({
      sendVerificationEmail: async ({ email, url, token }) => {
        // Implement CoRATES email sending
        await sendEmail({
          to: email,
          subject: 'Verify your email',
          html: `Click here: ${url}`,
        });
      },
    }),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        // Implement magic link email
      },
    }),
  ],
  session: {
    updateAge: 24 * 60 * 60 * 1000, // 24 hours (from Flowglad)
  },
  trustedOrigins: [process.env.FRONTEND_URL, process.env.LANDING_URL],
});
```

---

#### Step 3: Stripe Webhook Handler (Day 5-7)

```typescript
// Inspired by Flowglad's pattern
// File: packages/workers/src/api/webhooks/stripe.ts
import Stripe from 'stripe';
import { Hono } from 'hono';

const app = new Hono();

export const stripeWebhooks = app.post('/webhooks/stripe', async c => {
  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY);
  const signature = c.req.header('stripe-signature');
  const body = await c.req.text();

  let event: Stripe.Event;

  try {
    // Verify signature (from Flowglad pattern)
    event = stripe.webhooks.constructEvent(body, signature!, c.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed', err);
    return c.json({ error: 'Invalid signature' }, 400);
  }

  // Event routing (inspired by Flowglad)
  try {
    await processStripeEvent(event, c.env);
    return c.json({ received: true });
  } catch (err) {
    console.error('Webhook processing failed', err);
    return c.json({ error: 'Processing failed' }, 500);
  }
});

// Simplified event processor (Flowglad pattern)
async function processStripeEvent(event: Stripe.Event, env: any) {
  const db = getDB(env);

  switch (event.type) {
    case 'invoice.payment_succeeded':
      await handleInvoicePaymentSucceeded(event.data.object, db);
      break;

    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object, db);
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object, db);
      break;

    // Add more handlers as needed
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }
}

// Simplified handlers (not full Flowglad complexity)
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice, db: any) {
  if (!invoice.subscription) return;

  await db
    .update(subscriptions)
    .set({
      status: 'active',
      currentPeriodEnd: new Date(invoice.period_end * 1000),
      lastPaymentAt: new Date(),
    })
    .where(eq(subscriptions.stripeSubscriptionId, invoice.subscription as string));
}
```

---

### 4.2 Polar Admin UI Patterns (Primary UI Reference)

**Key components to study:**

1. **Metrics & Charts** (`reference/polar/clients/apps/web/src/components/Metrics/`)
   - `MetricChartBox.tsx` - KPI displays with comparison periods
   - `MetricChart.tsx` - Actual chart rendering
   - `DateRangePicker.tsx` - Date selection patterns
   - `IntervalPicker.tsx` - Time interval selection

2. **Charts** (`reference/polar/clients/apps/web/src/components/Charts/`)
   - `GenericChart.tsx` - Flexible chart component (470 lines!)
   - Supports line, bar, area charts
   - Dark mode support
   - Custom tooltips and legends

3. **Data Tables** (`reference/polar/clients/packages/ui/src/components/atoms/datatable/`)
   - `DataTable.tsx` - TanStack Table integration
   - `DataTableColumnHeader.tsx` - Sortable headers
   - `DataTablePagination.tsx` - Pagination controls

4. **Business Components** (`reference/polar/clients/apps/web/src/components/`)
   - `Subscriptions/SubscriptionDetails.tsx` - Subscription UI
   - `Transactions/TransactionsList.tsx` - Payment history tables
   - `Finance/` - Financial dashboards
   - `Customer/` - Customer management UI

**Create inspiration document:**

```bash
# Document Polar patterns worth learning from
mkdir -p packages/docs/inspiration/polar-ui

# Key files to study:
# - MetricChartBox.tsx - How to display KPIs with trends
# - GenericChart.tsx - Flexible charting architecture
# - DataTable.tsx - TanStack Table patterns
# - TransactionsList.tsx - Real-world table usage
```

---

## 5. Integration with CoRATES Architecture

### 5.1 CoRATES Package Structure

**Where components fit (corrected attribution):**

```
packages/
├── admin/                 # ← NEW: Internal admin dashboard
│   └── src/
│       ├── components/
│       │   ├── ui/        # shadcn/ui via CLI
│       │   ├── atoms/     # Custom atoms (learn from Polar)
│       │   ├── charts/    # Charts (learn from Polar's GenericChart)
│       │   └── tables/    # Tables (learn from Polar's DataTable)
│       └── app/          # Dashboard pages
├── ui/                    # ← Shared UI (CoRATES has Ark UI)
│   └── src/
│       └── components/
├── web/                   # ← Frontend (SolidJS)
│   └── src/
│       ├── components/
│       └── routes/
├── workers/               # ← Backend
│   └── src/
│       ├── better-auth.ts # Adapted from Flowglad auth.ts
│       └── routes/
│           └── billing/
│               └── webhooks.js # Flowglad Stripe patterns
└── shared/                # ← Shared utilities
    └── src/
        └── stripe-utils.ts # Flowglad currency utils
```

### 5.2 Dependency Additions

**From Flowglad analysis, CoRATES may need:**

```json
{
  "dependencies": {
    "@stripe/react-stripe-js": "^2.8.0",
    "@stripe/stripe-js": "^4.5.0",
    "recharts": "^2.15.4",
    "@radix-ui/react-dialog": "latest",
    "@radix-ui/react-dropdown-menu": "latest",
    "@radix-ui/react-select": "latest",
    "date-fns": "^3.0.0",
    "react-hook-form": "^7.52.0",
    "zod": "^3.23.0"
  }
}
```

---

## 6. License & Legal Considerations

### 6.1 Flowglad License

**Status:** Open Source
**License File:** `/LICENSE`

**Action Required:**

1. ✅ Review Flowglad LICENSE file
2. ✅ Ensure commercial use is permitted
3. ✅ Add attribution if required
4. ⚠️ Contact Flowglad team for commercial clarification

### 6.2 Polar License

**Status:** Open Source (MIT-style)
**License File:** `/LICENSE`

**Restrictions:**

- ✅ Can study code
- ✅ Can reference patterns
- ⚠️ Check if components can be extracted
- ⚠️ MOR platform use may have restrictions

---

## 7. Risk Assessment

### 7.1 Extraction Risks

| Risk                         | Severity | Mitigation                                        |
| ---------------------------- | -------- | ------------------------------------------------- |
| **License violations**       | High     | Review licenses, seek permission, add attribution |
| **Code coupling**            | Medium   | Extract only loosely coupled components           |
| **Maintenance burden**       | Medium   | Document extracted code, own modifications        |
| **Security vulnerabilities** | Medium   | Audit extracted code, update dependencies         |
| **Technical debt**           | Low      | Refactor as needed, don't blindly copy            |

### 7.2 Implementation Risks

| Risk                       | Severity | Mitigation                                |
| -------------------------- | -------- | ----------------------------------------- |
| **Overengineering**        | High     | Extract only what CoRATES needs, simplify |
| **Feature creep**          | Medium   | Focus on core features first              |
| **Integration complexity** | Medium   | Test thoroughly, iterate gradually        |
| **Breaking changes**       | Low      | Version extracted components separately   |

---

## 8. Estimated Effort & Timeline

### 8.1 Phase 1: UI Foundation (Week 1-2) ✅ LOW RISK

**Tasks:**

- [x] Extract Flowglad UI components
- [x] Set up CoRATES UI package
- [x] Test components in CoRATES
- [x] Document component usage

**Effort:** 5-10 days  
**Team:** 1 developer  
**Value:** ⭐⭐⭐⭐⭐ (Immediate design system)

### 8.2 Phase 2: Auth & Webhooks (Week 3-4) ⚠️ MEDIUM RISK

**Tasks:**

- [ ] Adapt BetterAuth configuration
- [ ] Implement webhook handler
- [ ] Build event processors
- [ ] Test payment flows

**Effort:** 10-15 days  
**Team:** 1-2 developers  
**Value:** ⭐⭐⭐⭐⭐ (Core functionality)

### 8.3 Phase 3: Dashboard (Week 5-8) ⚠️ MEDIUM-HIGH RISK

**Tasks:**

- [ ] Extract chart components
- [ ] Build data fetching layer
- [ ] Implement metrics logic
- [ ] Design dashboard layouts

**Effort:** 20-30 days  
**Team:** 2 developers  
**Value:** ⭐⭐⭐⭐ (Business analytics)

### 8.4 Phase 4: Checkout (Week 9-12) ⚠️ HIGH RISK

**Tasks:**

- [ ] Extract checkout components
- [ ] Build session management
- [ ] Implement payment flow
- [ ] Test conversion funnel

**Effort:** 20-30 days  
**Team:** 2 developers  
**Value:** ⭐⭐⭐⭐ (Revenue generation)

**Total Timeline:** 12 weeks  
**Total Effort:** ~3 person-months  
**Risk Level:** Medium (UI extraction low, backend medium-high)

---

## 9. Success Criteria

### 9.1 Phase 1 Success Metrics

- [ ] 50+ UI components extracted and functional
- [ ] Components render correctly in CoRATES
- [ ] Tailwind styling matches CoRATES theme
- [ ] All components documented

### 9.2 Phase 2 Success Metrics

- [ ] BetterAuth configured with CoRATES schema
- [ ] Stripe webhook receives and verifies events
- [ ] Payment success/failure handled correctly
- [ ] Subscription status synced with Stripe

### 9.3 Phase 3 Success Metrics

- [ ] Dashboard displays key metrics
- [ ] Charts render revenue/subscription data
- [ ] Date range filtering works
- [ ] Performance acceptable (<2s load time)

### 9.4 Phase 4 Success Metrics

- [ ] Checkout flow completed end-to-end
- [ ] Stripe Elements integration works
- [ ] Payment intents created successfully
- [ ] Subscription created after payment

---

## 10. Recommendations

### 10.1 Immediate Actions (This Week)

1. ✅ **Extract Flowglad UI Components**
   - Lowest risk, highest value
   - 1-2 day effort
   - Immediate design system upgrade

2. ✅ **Study BetterAuth Patterns**
   - Review Flowglad configuration
   - Plan CoRATES adaptation
   - 1 day effort

3. ✅ **Document Extraction Plan**
   - Create detailed task list
   - Assign responsibilities
   - Set milestones

### 10.2 Short-Term (Next 2 Weeks)

1. ⚠️ **Adapt BetterAuth Setup**
   - Implement Flowglad patterns
   - Test authentication flows
   - 3-5 day effort

2. ⚠️ **Build Webhook Handler**
   - Extract routing pattern
   - Implement key events
   - 3-5 day effort

### 10.3 Medium-Term (Next 2 Months)

1. ⚠️ **Dashboard Components**
   - Extract chart UI
   - Build data layer
   - Implement metrics

2. ⚠️ **Checkout Flow**
   - Extract Stripe Elements
   - Build session management
   - Test payment processing

### 10.4 Long-Term (Next 6 Months)

1. ⚠️ **Consider Polar MOR Model**
   - If compliance burden grows
   - Reference Polar's architecture
   - Plan migration strategy

2. ✅ **Open Source Contribution**
   - Contribute improvements back
   - Build relationship with both projects
   - Share learnings with community

---

## 11. Key Files Reference

### 11.1 Flowglad Files to Study

**UI Components:**

- `/platform/flowglad-next/src/components/ui/*` - All UI components
- `/platform/flowglad-next/src/registry/` - Component registry

**Auth:**

- `/platform/flowglad-next/src/utils/auth.ts` - BetterAuth config
- `/platform/flowglad-next/src/db/schema/betterAuthSchema.ts` - Schema

**Stripe:**

- `/platform/flowglad-next/src/utils/stripe.ts` - Stripe utilities
- `/platform/flowglad-next/src/utils/processStripeEvents.ts` - Event handlers
- `/platform/flowglad-next/src/app/api/webhook-stripe/[mode]/route.ts` - Webhook endpoint

**Dashboard:**

- `/platform/flowglad-next/src/app/dashboard/InternalDashboard.tsx`
- `/platform/flowglad-next/src/app/dashboard/*Chart.tsx`
- `/platform/flowglad-next/src/utils/chartIntervalUtils.ts`

**Checkout:**

- `/platform/flowglad-next/src/app/checkout/CheckoutForm.tsx`
- `/platform/flowglad-next/src/app/checkout/PaymentForm.tsx`

### 11.2 Polar Files to Reference (Inspiration Only)

**Backend (Python - reference only):**

- `/server/polar/integrations/stripe/service.py` - Stripe service
- `/server/polar/integrations/stripe/payment.py` - Payment logic
- `/server/polar/tax/calculation/stripe.py` - Tax calculation

**Frontend (Next.js):**

- `/clients/apps/web/src/components/Dashboard/` - Dashboard components
- `/clients/apps/web/src/components/Checkout/` - Checkout components
- `/clients/apps/web/src/components/CustomerPortal/` - Portal components

---

## 12. Conclusion

### 12.1 Final Verdict

**Flowglad is the clear winner for extraction:**

- ✅ 95% tech stack compatibility (BetterAuth + Stripe + Next.js)
- ✅ Ready-to-use UI component library
- ✅ Directly applicable patterns
- ✅ Lower risk, faster implementation

**Polar is valuable for inspiration:**

- ✅ Production-grade architecture at scale
- ✅ MOR implementation reference (future consideration)
- ✅ Advanced dashboard UX patterns
- ⚠️ Cannot extract backend code (Python)
- ⚠️ Requires complete reimplementation

### 12.2 Recommended Approach

**Hybrid Strategy:**

1. **Extract from Flowglad:**
   - UI components (100% reusable)
   - BetterAuth patterns (directly applicable)
   - Webhook structure (adapt to CoRATES)

2. **Reference Polar:**
   - Dashboard UX inspiration
   - MOR architecture patterns (if needed)
   - Customer portal design

3. **Build Custom:**
   - CoRATES-specific business logic
   - Simplified billing system
   - Tailored to academic research workflows

### 12.3 Expected Outcomes

**3-month implementation:**

- ✅ Modern UI component library
- ✅ Robust BetterAuth integration
- ✅ Professional Stripe webhook handling
- ✅ Analytics dashboard with key metrics
- ✅ Checkout flow with Stripe Elements
- ⚠️ Simplified subscription management

**Benefits:**

- 🚀 Accelerated development (2-3x faster)
- 💰 Reduced development costs (~$50K saved)
- ✅ Production-grade patterns
- 📈 Professional user experience
- 🔐 Battle-tested security

**Risks:**

- ⚠️ License compliance
- ⚠️ Maintenance burden
- ⚠️ Over-engineering temptation
- ⚠️ Technical debt if not adapted properly

### 12.4 Go/No-Go Decision

**✅ GO if:**

- Team has 2-3 months for implementation
- UI design system is needed urgently
- Stripe integration needs improvement
- Dashboard analytics are priority

**❌ NO-GO if:**

- Team is < 1 developer
- Timeline is < 4 weeks
- CoRATES needs are very different
- License restrictions apply

**For CoRATES:** **✅ GO** - The benefits far outweigh the risks, especially for Flowglad UI extraction.

---

## 13. Implementation Roadmap

### 13.1 Priority 1: Stripe Hardening (Week 1-2) 🔴

**Goal:** Make CoRATES payment processing "rock solid"

**Critical Tasks:**

1. **Day 1-2: Subscription Webhooks**

   ```bash
   # Create new webhook handler
   touch packages/workers/src/routes/billing/subscription-webhooks.js

   # Add Stripe webhook secret to .dev.vars
   STRIPE_WEBHOOK_SECRET_SUBSCRIPTIONS=whsec_...

   # Register webhook endpoint in Stripe Dashboard
   # URL: https://api.corates.com/api/billing/webhook/subscriptions
   # Events: customer.subscription.* (all)
   ```

   **Deliverables:**
   - ✅ `customer.subscription.updated` handler
   - ✅ `customer.subscription.deleted` handler
   - ✅ `customer.subscription.paused` handler
   - ✅ Database sync for subscription status
   - ✅ Tests with Stripe CLI

2. **Day 3-4: Invoice Events**

   ```bash
   # Add invoice webhook handlers
   # Events: invoice.payment_succeeded, invoice.payment_failed
   ```

   **Deliverables:**
   - ✅ Payment success handler
   - ✅ Payment failure handler with dunning logic
   - ✅ Email notifications for failed payments
   - ✅ Database updates for payment status

3. **Day 5-7: Payment Intent Lifecycle**

   ```bash
   # Add payment intent webhook handlers
   # Events: payment_intent.processing, .succeeded, .payment_failed
   ```

   **Deliverables:**
   - ✅ ACH payment tracking
   - ✅ Payment failure logging
   - ✅ User status updates

4. **Day 8-9: Customer Sync**

   ```bash
   # Events: customer.updated, customer.deleted
   ```

   **Deliverables:**
   - ✅ Customer data sync
   - ✅ GDPR deletion handling

5. **Day 10: Idempotency Enhancement**

   **Deliverables:**
   - ✅ Dual idempotency (hash + event ID)
   - ✅ Tests for duplicate event handling

**Testing:**

```bash
# Use Stripe CLI to test all events
stripe listen --forward-to localhost:8787/api/billing/webhook/subscriptions
stripe trigger customer.subscription.updated
stripe trigger invoice.payment_failed
stripe trigger payment_intent.succeeded
```

**Validation Criteria:**

- [ ] All 15+ Stripe events have handlers
- [ ] No webhook delivery failures in Stripe Dashboard
- [ ] Database stays in sync with Stripe
- [ ] Payment failures trigger user notifications
- [ ] Tests achieve 90%+ coverage

---

### 13.2 Priority 2: Admin Dashboard Package (Week 2-4) 🟡

**Goal:** Build local-only Next.js admin tool for managing CoRATES

**Week 2: Setup & UI Extraction**

1. **Day 1: Create Admin Package**

   ```bash
   cd packages
   pnpm create next-app@latest admin --typescript --tailwind --app

   # Update package.json
   {
     "name": "@corates/admin",
     "version": "0.1.0",
     "scripts": {
       "dev": "next dev -p 3001",
       "build": "next build",
       "start": "next start"
     }
   }
   ```

2. **Day 2: Generate shadcn/ui + Study Polar Patterns**

   ```bash
   cd packages/admin

   # Generate shadcn/ui with CLI (same as what Flowglad uses)
   pnpm dlx shadcn@latest init
   pnpm dlx shadcn@latest add button card dialog table form input \
        select dropdown-menu sheet tabs avatar badge separator \
        command popover tooltip skeleton chart

   # Then study Polar's custom patterns for inspiration:
   # - reference/polar/clients/packages/ui/src/components/atoms/
   # - DataTable, ShadowBox, MoneyInput, Paginator, Status
   # - reference/polar/clients/apps/web/src/components/Metrics/
   # - MetricChartBox, GenericChart patterns
   ```

3. **Day 3-4: Database Connection**

   ```typescript
   // packages/admin/src/lib/db.ts
   import { drizzle } from 'drizzle-orm/postgres-js';
   import postgres from 'postgres';
   import * as schema from '@corates/workers/src/db/schema.js';

   const client = postgres(process.env.DATABASE_URL!);
   export const db = drizzle(client, { schema });
   ```

4. **Day 5: Basic Layout**

   ```bash
   # Create dashboard layout
   mkdir -p src/app/dashboard
   touch src/app/dashboard/layout.tsx
   touch src/app/dashboard/page.tsx

   # Add sidebar navigation
   touch src/components/dashboard/sidebar.tsx
   touch src/components/dashboard/header.tsx
   ```

**Week 3: Core Features**

5. **Day 1-2: User Management Page**

   ```typescript
   // src/app/dashboard/users/page.tsx
   - List all users with pagination
   - Search by email/name
   - View user details
   - Edit user metadata
   - Impersonate user (dev only)
   ```

6. **Day 3-4: Organization Management**

   ```typescript
   // src/app/dashboard/organizations/page.tsx
   - List all organizations
   - View organization projects
   - View organization members
   - Edit organization settings
   ```

7. **Day 5: Billing Dashboard**
   ```typescript
   // src/app/dashboard/billing/page.tsx
   - Revenue charts (daily/weekly/monthly)
   - Active subscriptions count
   - Failed payments list
   - Recent checkouts
   - Stripe webhook logs
   ```

**Week 4: Advanced Features**

8. **Day 1-2: Stripe Event Viewer**

   ```typescript
   // src/app/dashboard/stripe-events/page.tsx
   - Table of all webhook events from stripeEventLedger
   - Filter by event type, status
   - View full event payload
   - Retry failed events
   - Export to CSV
   ```

9. **Day 3-4: Project Management**

   ```typescript
   // src/app/dashboard/projects/page.tsx
   - List all projects
   - View project checklists
   - Project statistics
   - Delete test projects
   ```

10. **Day 5: Analytics & Reports**
    ```typescript
    // src/app/dashboard/analytics/page.tsx
    - User growth charts
    - Revenue trends
    - Conversion funnels
    - Export reports
    ```

**Validation Criteria:**

- [ ] Admin runs locally on port 3001
- [ ] All pages load without errors
- [ ] Database queries are optimized (< 100ms)
- [ ] UI matches Flowglad quality
- [ ] No production credentials in code

---

### 13.3 Quick Wins (Anytime)

**Can be done in parallel with main work:**

1. **Currency Formatting Utility** (30 min)

   ```bash
   touch packages/shared/src/utils/currency.ts
   # Copy formatStripeCurrency from Flowglad
   ```

2. **Expanded Metadata** (1 hour)

   ```javascript
   // Update checkout.js with richer metadata
   metadata: {
     orgId, userId, userEmail,
     source: 'dashboard',
     environment: c.env.ENVIRONMENT,
     requestId: crypto.randomUUID()
   }
   ```

3. **Webhook Observability** (2 hours)
   ```javascript
   // Add detailed logging to webhook handlers
   logger.stripe('webhook_processed', {
     eventType: event.type,
     processingTime: Date.now() - startTime,
     success: true,
   });
   ```

---

### 13.4 Testing Strategy

**Stripe Webhooks:**

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local
stripe listen --forward-to localhost:8787/api/billing/webhook/subscriptions

# Trigger test events
stripe trigger customer.subscription.updated
stripe trigger invoice.payment_failed
stripe trigger payment_intent.succeeded
```

**Admin Dashboard:**

```bash
# Local development
cd packages/admin
pnpm dev

# Visit http://localhost:3001/dashboard

# Test with production data copy (sanitized)
pg_dump $PROD_DB | psql $DEV_DB
```

---

### 13.5 Success Metrics

**Stripe Hardening:**

- ✅ Zero webhook delivery failures
- ✅ 100% subscription status sync
- ✅ Payment failure recovery < 24 hours
- ✅ Test coverage > 90%

**Admin Dashboard:**

- ✅ All core pages functional
- ✅ Page load time < 1 second
- ✅ Database queries optimized
- ✅ Zero production credential exposure

---

### 13.6 Risk Mitigation

**Stripe Webhook Changes:**

- ⚠️ Test extensively in Stripe test mode
- ⚠️ Use Stripe CLI for local testing
- ⚠️ Monitor webhook delivery in Stripe Dashboard
- ⚠️ Have rollback plan ready

**Admin Dashboard:**

- ⚠️ Never deploy to production
- ⚠️ Use read-only database user
- ⚠️ Require VPN for access
- ⚠️ Audit logs for all actions

---

## 14. Next Steps

### This Week (Stripe Priority)

1. **Day 1:**
   - [ ] Create subscription webhook handler file
   - [ ] Add Stripe webhook secret to environment
   - [ ] Register webhook endpoint in Stripe Dashboard

2. **Day 2:**
   - [ ] Implement `customer.subscription.updated` handler
   - [ ] Implement `customer.subscription.deleted` handler
   - [ ] Add database sync logic
   - [ ] Write unit tests

3. **Day 3:**
   - [ ] Implement invoice event handlers
   - [ ] Add dunning email logic
   - [ ] Test with Stripe CLI

4. **Day 4:**
   - [ ] Implement payment intent handlers
   - [ ] Add ACH tracking
   - [ ] Test payment failures

5. **Day 5:**
   - [ ] Add customer sync events
   - [ ] Enhance idempotency
   - [ ] Final testing and validation

### Next Week (Admin Dashboard)

1. **Week 2:**
   - [ ] Create admin package
   - [ ] Extract UI components
   - [ ] Set up database connection
   - [ ] Build basic layout

2. **Week 3:**
   - [ ] User management page
   - [ ] Organization management page
   - [ ] Billing dashboard

3. **Week 4:**
   - [ ] Stripe event viewer
   - [ ] Project management
   - [ ] Analytics and reports

### Month 2+ (Enhancements)

- [ ] Background job processing (Cloudflare Queues)
- [ ] Tax automation (Stripe Tax)
- [ ] Advanced admin features
- [ ] Monitoring and alerting

---

**Document Version:** 2.0  
**Last Updated:** January 8, 2026  
**Author:** GitHub Copilot  
**Focus:** Admin Dashboard + Stripe Hardening  
**Status:** Ready for Implementation
