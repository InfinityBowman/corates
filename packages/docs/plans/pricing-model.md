# CoRATES pricing model (proposal)

Status: draft
Last updated: 2026-01-03

This document proposes a pricing model for CoRATES that is:

- simple for individuals and teams to buy without sales
- aligned with the product architecture where organizations are the billing boundary
- competitive with Rayyan (affordable, accessible pricing) rather than premium tools like Covidence/DistillerSR
- positioned as a simpler, more affordable alternative to feature-heavy competitors

This is a product plan, not an implementation spec.

## Market Positioning

CoRATES is positioned as an **affordable, accessible alternative** to premium systematic review tools:

- **More affordable than**: Covidence ($289/year per review), DistillerSR ($85-176/month)
- **Competitive with**: Rayyan ($8-25/user/month)
- **Value proposition**: Simpler, more focused tool at a lower price point
- **Target market**: Individual researchers, small teams, and labs who need core functionality without enterprise features

We acknowledge that CoRATES is less feature-full than competitors, and our pricing reflects that while still providing clear value.

## Goals

- Keep pricing accessible and competitive with Rayyan
- Provide clear value at every tier
- Simple purchasing decision (no per-user or per-review complexity)
- Grant-friendly options for students and small projects
- Clear upgrade path as teams grow

## Non-goals (for now)

- Complex usage-based billing (per user (org seats), per AI token, etc.)
- Per-user pricing (we use flat-rate org subscriptions)
- Per-review pricing (we use project limits)
- Enterprise features (SSO, advanced governance, procurement terms)

## Core Model: Single Owner with Personal Orgs

### Architecture

- **Personal org per user**: Each user automatically gets a personal organization
- **Org-scoped subscriptions**: Subscriptions belong to organizations (personal orgs initially)
- **Owner pays**: One account (the owner) pays for the org's subscription
- **Collaborators free**: Invited reviewers/collaborators don't pay
- **No multi-owner management**: For now, single owner model (can extend to lab orgs later)

This avoids:

- Institutional procurement complexity
- Account management overhead
- Permission sprawl
- Per-seat billing confusion

### Key Definitions

- **Owning organization**: The org that owns a project and has the subscription
- **Owner**: The user who pays for the org's subscription (billing contact)
- **Project**: A research project workspace (all projects are active; no archiving yet)
- **Collaborator**: A user invited to a project (does not pay, access granted by owner)

## Universal Trial

**14-Day Free Trial**

- Full access to selected plan features
- No feature gating during trial
- Clear conversion path at day 14
- Required for project creation (free tier only allows single-study appraisal)
- One project during trial (to focus evaluation)

**Rationale:**

- Automation value is immediately obvious
- Trial is long enough to complete double coding on a subset
- Reduces friction for evaluation
- Allows users to experience project-based workflows before purchasing
- We can provide a demo project with a tour

## Pricing Axes

We price on:

- **Total projects** (all projects are active; no archiving feature yet)
- **Time window** (for entry tier - 6 months)
- **Owner scope** (one owner per org)

We do NOT price on:

- PDFs (unlimited)
- Automation actions (unlimited)
- Storage (generous limits, not a pricing axis)
- Per-collaborator fees (collaborators are free)

## Plan Definitions

### Free Tier

**$0 / month - Completely free, no account required**

Includes:

- Single-study appraisals, completely anonymous
- No account creation needed
- Local device PDF upload and markup
- Local device simple automated scoring
- No server costs (runs entirely in browser)
- No project creation (projects require a paid plan or trial)

**Target:**

- Students learning systematic review
- One-off appraisals
- Evaluation and teaching
- Quick single-study checks
- Zero-friction evaluation

**Limitations:**

- No project creation (must use trial or paid plan)
- No consensus workflows
- No collaboration
- No advanced visualizations
- No audit trails
- No server-side features (everything is local)

**Cost to CoRATES:**

- Zero server costs (static site serving only, same as marketing pages)
- No compute, storage, or websocket usage
- Pure marketing/lead generation tool

---

### Single Project (Time-boxed)

**$39 for 6 months** (~$6.50/month)

Includes:

- 1 project
- Up to 3 reviewers
- Unlimited PDFs
- Automated AMSTAR-2, ROBINS-I, RoB-2
- PDF markup & consensus workflows
- Visualizations and exports

**Constraints:**

- Single project only
- Fixed 6-month access
- Project remains accessible after expiration (read-only, until archive feature is added)

**Why this works:**

- Extremely grant-friendly (one-time payment)
- Perfect for:
  - Student projects
  - Pilots
  - One-off reviews
- Easy purchasing decision
- Competitive with Rayyan Professional ($8.33/month) but time-boxed

This is your low-friction entry point.

---

### Starter Team

**$9.99 / month** ($100 / year with annual discount)

Includes:

- 2-3 projects
- Up to 5 collaborators
- All automation features
- Consensus & disagreement views
- Exports & figures
- Email support

**Constraints:**

- Single owner
- No org management UI
- Email support only

**Why this works:**

- Encourages real collaboration
- Scales naturally from single-project tier
- Competitive with Rayyan Pro Team ($8.33/user/month for small teams)
- Feels generous without being exploitable

---

### Team

**$29 / month** ($290 / year with annual discount)

Includes:

- Up to 10 projects
- Up to 15 collaborators
- Full audit trails
- Version history
- Priority support

**Target:**

- Active research labs
- Review groups running multiple reviews per year

**Why this works:**

- Competitive with DistillerSR Faculty ($85/month) but much more affordable
- Clear upgrade from Starter Team
- Supports serious research workflows

---

### Unlimited Team

**$49 / month** ($490 / year with annual discount)

Includes:

- Unlimited projects
- Unlimited collaborators
- All current features
- Early access to new tools

**Target:**

- Power users
- Labs running many concurrent reviews
- "Don't think about limits" tier

**Why this works:**

- Still cheaper than DistillerSR Research Project ($176/month)
- Clear value for high-volume users
- Simple mental model: unlimited everything

---

## Feature Comparison by Tier

| Feature                     | Free       | Single Project             | Starter Team               | Team                       | Unlimited Team             |
| --------------------------- | ---------- | -------------------------- | -------------------------- | -------------------------- | -------------------------- |
| Project creation            | ❌         | ✅ (1 project)             | ✅ (2-3 projects)          | ✅ (up to 10)              | ✅ (unlimited)             |
| Projects                    | N/A        | 1 (6 months)               | 2-3                        | Up to 10                   | Unlimited                  |
| Collaborators               | N/A        | Up to 3                    | Up to 5                    | Up to 15                   | Unlimited                  |
| Automation (AMSTAR-2, etc.) | ❌         | ✅                         | ✅                         | ✅                         | ✅                         |
| Consensus workflows         | ❌         | ✅                         | ✅                         | ✅                         | ✅                         |
| PDF markup                  | Local only | ✅                         | ✅                         | ✅                         | ✅                         |
| Audit trails                | ❌         | ❌                         | ❌                         | ✅                         | ✅                         |
| Version history             | ❌         | ❌                         | ❌                         | ✅                         | ✅                         |
| Visualizations              | Basic      | ✅                         | ✅                         | ✅                         | ✅                         |
| Support                     | Community  | Email                      | Email                      | Priority                   | Priority                   |
| Trial required              | N/A        | Yes (for project creation) | Yes (for project creation) | Yes (for project creation) | Yes (for project creation) |

## Owner-Centric Mental Model

**All plans are: "One account owns everything."**

**Collaborators:**

- Do not need to pay
- Are invited per project
- Do not manage billing
- Access is granted by owner

This is extremely attractive to:

- PIs (Principal Investigators)
- Lead authors
- Methodologists

And it avoids:

- Seat counting
- Reviewer churn issues
- Billing confusion

## Classroom Compatibility

Your model already supports classrooms:

- Instructor = Owner
- Student teams = projects
- Unlimited collaborators per project (within tier limits)

You can later offer:

- Semester-length coupons
- Course-specific landing page
- Auto-archive after term

Without changing pricing architecture.

## Annual Pricing

**Annual discount: 2 months free** (pay 10 months)

- Single Project: Not applicable (one-time payment)
- Starter Team: $100/year (vs $120/monthly)
- Team: $290/year (vs $348/monthly)
- Unlimited Team: $490/year (vs $588/monthly)

This matches industry standard and improves cash flow.

## Academic Discounts

- **Students**: 25% off all tiers (simple email verification)
- **Academic institutions**: 25% off Team and Unlimited Team
- **Nonprofits**: 25% off Team and Unlimited Team

Keep discounts simple to verify and apply.

## Subscription Architecture

### Org-Scoped Subscriptions

Subscriptions belong to organizations:

```typescript
subscriptions {
  id: string
  orgId: string (unique, not null)  // Subscription belongs to this org
  userId: string (not null)          // Who pays (billing contact)
  tier: string
  status: string
  trialEndsAt: timestamp (nullable)
  // ... Stripe fields
}
```

**On user signup (for paid plans/trial):**

1. Auto-create personal org
2. Add user as org owner
3. Create subscription for that org (trial or paid tier)

**Note:** Free tier users do not create accounts or orgs - they use the app completely anonymously and locally.

**Entitlement checks:**

- Get subscription by `orgId` (not `userId`)
- Check entitlements for that org's subscription
- All projects in that org use that subscription

### Future Extensibility

When adding lab/team orgs later:

- Lab orgs can have their own subscriptions
- Personal org subscriptions continue to work
- No migration needed - model already supports it

## Feature-to-Entitlement Mapping

**Org-scoped entitlements:**

- Project creation and limits
- Collaborator limits
- Automation features (AMSTAR-2, ROBINS-I, RoB-2)
- Consensus workflows
- Audit trails
- Version history
- Storage quotas

**Always available (free tier - no account/subscription needed):**

- Basic checklists
- Single-study appraisal (no project creation)
- PDF viewing and local markup
- Basic exports
- Completely anonymous and local (no server usage)

## Rollout Plan

1. **Phase 1**: Free + Single Project + Starter Team
   - Validate pricing and feature limits
   - Focus on individual researchers and small teams

2. **Phase 2**: Add Team and Unlimited Team
   - After validating Starter Team adoption
   - Target active labs and review groups

3. **Phase 3**: Add lab org subscriptions (future)
   - Allow multiple owners per org
   - Org admin UI for billing
   - Extend to institutional customers

4. **Enforcement**: Start "soft" (warnings + upgrade CTAs)
   - Validate thresholds before hard limits
   - Instrument upgrade funnels

## Cost Drivers

Based on the application architecture:

**Primary cost drivers:**

- **Compute (WebSockets)**: Real-time collaboration via Yjs requires persistent WebSocket connections to Durable Objects
  - Each user/device has their own WebSocket connection
  - Connections are only active for projects currently being viewed (not all projects)
  - Cost scales with concurrent active viewing sessions (one connection per active user)
  - Multiple collaborators viewing the same project each have their own connection, but all connect to the same Durable Object instance
- **Storage**: R2 storage for PDFs, Durable Object storage for project data
  - Scales with total project count and PDF usage
- **Support**: Time spent on customer support (scales with user count)

**Free tier cost:**

- Zero server costs (runs entirely in browser, no backend usage)
- Only marketing site serving (same cost as landing page)

**Paid tier costs scale with:**

- Concurrent active viewing sessions (WebSocket connections)
- Total number of projects (storage costs)
- Number of collaborators (potential for more concurrent sessions)
- PDF storage usage (R2 costs)
- Support requests

**Key insight:** Project limits are primarily about storage costs, not compute. WebSocket costs are driven by concurrent active users (one connection per user viewing/editing), not how many projects exist. Multiple users can be viewing the same project (each with their own connection to the same Durable Object), or different projects (each with their own connection to different Durable Objects).

## Open Questions

1. Which is the larger cost driver: WebSocket compute or R2 storage? (Need to monitor usage)
2. Should Single Project tier allow renewal/extension, or require upgrade?
3. Do we add an archive feature?
