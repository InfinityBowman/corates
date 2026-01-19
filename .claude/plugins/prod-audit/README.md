````markdown
# Production Readiness Audit Plugin

A comprehensive, structured workflow for auditing a codebase before production launch, with specialized agents for correctness, security, performance, reliability, and operational readiness.

## Overview

The Production Readiness Audit Plugin provides a 9-phase, production-grade audit workflow designed to catch issues before users do. Instead of relying on informal checklists or last-minute gut checks, this plugin performs a systematic review of your code, architecture, infrastructure assumptions, and operational readiness.

It is designed to answer one question:

**"Is this application actually safe to launch to production?"**

## Philosophy

Shipping to production is not just "feature complete." A production-ready system must:

- Be correct under real-world conditions
- Fail gracefully
- Be secure by default
- Be observable and debuggable
- Handle scale, latency, and abuse
- Have clear operational ownership

This plugin encodes these concerns into a structured, repeatable workflow you can run before every major launch.

## Command: `/prod-audit`

Launches a guided production-readiness audit.

**Usage:**

```bash
/prod-audit
```

Or with context:

```bash
/prod-audit First public launch, expecting ~5k MAU
```

The workflow runs interactively and blocks progression when critical risks are found.

## The 9-Phase Audit Workflow

### Phase 1: Launch Context and Risk Framing

**Goal**: Understand what kind of launch this is and what "failure" means

**What happens:**

- Identifies launch type (internal, beta, public, paid/revenue-impacting)
- Identifies blast radius (data loss, downtime, security breach, reputation damage)
- Establishes risk tolerance
- Confirms success criteria

**Output:**

- Launch risk profile
- Audit strictness level (Low / Medium / High)
- Explicit "stop-ship" criteria

### Phase 2: System and Architecture Mapping

**Goal**: Build a mental model of the entire system

**What happens:**

- Launches multiple `system-explorer` agents in parallel
- Each agent maps a different axis: runtime architecture, data flow, external dependencies, trust boundaries
- Produces a full system map

### Phase 3: Codebase Health Audit

**Goal**: Identify correctness, maintainability, and hidden footguns

**What happens:**

- Launches `code-auditor` agents with different focuses
- Reviews correctness, invariants, error handling, edge cases, concurrency, async behavior
- Traces real execution paths, not just files

**Focus areas:**

- Unhandled promise rejections
- Partial failures
- Implicit assumptions
- "Should never happen" branches
- TODOs, FIXMEs, commented-out code

### Phase 4: Data Safety and Migration Review

**Goal**: Prevent irreversible data mistakes

**What happens:**

- Audits all write paths
- Identifies destructive operations
- Reviews migrations and schema evolution
- Evaluates rollback strategies

**Questions answered:**

- Can data be corrupted?
- Can data be deleted accidentally?
- Is rollback possible?
- Is data versioned?

### Phase 5: Security and Abuse Audit

**Goal**: Ensure the system is safe under hostile conditions

**What happens:**

- Launches `security-auditor` agents
- Reviews auth flows, authorization boundaries, input validation, secrets handling, abuse vectors

**Focus areas:**

- Privilege escalation
- IDORs (Insecure Direct Object References)
- Token leakage
- Webhook verification
- Rate limiting
- DOS vectors

### Phase 6: Performance and Load Readiness

**Goal**: Ensure the system survives real traffic

**What happens:**

- Identifies hot paths
- Reviews algorithmic complexity
- Flags unbounded operations
- Evaluates caching strategy

**Questions answered:**

- What slows down as users grow?
- What scales linearly but shouldn't?
- What happens during traffic spikes?

### Phase 7: Observability and Debuggability

**Goal**: Ensure you can debug production issues at 2am

**What happens:**

- Audits logging, metrics, and error reporting
- Evaluates signal-to-noise ratio
- Checks correlation IDs
- Reviews alertability

**Checklist:**

- Are errors logged with context?
- Can you trace a single user request?
- Are critical failures surfaced?
- Do logs leak sensitive data?

### Phase 8: Operational Readiness and Failure Modes

**Goal**: Ensure humans can operate the system safely

**What happens:**

- Reviews deploy process
- Identifies manual steps
- Simulates failures (dependency outage, partial deploy, schema mismatch)
- Reviews runbooks (or lack thereof)

### Phase 9: Launch Verdict and Remediation Plan

**Goal**: Decide whether to ship

**What happens:**

- Consolidates all findings
- Categorizes issues: Stop-Ship, Fix Soon, Acceptable Risk
- Produces a final launch verdict

**Example output:**

```
Production Readiness Verdict: NOT READY

Stop-Ship Issues (3):
1. Unverified Stripe webhooks
2. Non-reversible production migration
3. Missing authorization checks on project access

Fix-Soon (6):
- Rate limiting
- Logging gaps
- Backup strategy

Acceptable Risks:
- Cold start latency
- Minor UX degradation under load

Recommendation:
Do not launch until Stop-Ship issues are resolved.
```

## Agents

### `system-explorer`

Maps architecture, data flow, and trust boundaries.

### `code-auditor`

Finds correctness, async, and edge-case issues by tracing execution paths.

### `security-auditor`

Analyzes auth, authorization, secrets, and abuse vectors.

### `reliability-auditor`

Evaluates failure modes, retries, idempotency, and recoverability.

### `ops-auditor`

Reviews deploys, rollbacks, migrations, and operational ergonomics.

## Usage Patterns

**Full pre-launch audit (recommended):**

```bash
/prod-audit
```

**Targeted audits:**

```
"Run a security audit on auth and billing paths"
"Audit data migrations for production safety"
"Check observability and logging readiness"
```

## When to Use This Plugin

**Use for:**

- First production launch
- Public or paid launches
- Major architectural changes
- New data models
- High-risk feature releases

**Do NOT use for:**

- Minor internal tools
- Experimental prototypes
- Non-persistent demos

## Design Principles

- Default to pessimism
- Assume partial failure
- Prefer explicit invariants
- Humans are part of the system
- If it can fail, it will

## Output Location

All audit reports are saved to `packages/docs/audits/` with:

- Timestamped file name
- Summary of findings
- Stop-ship / fix-soon / acceptable-risk categorization
- Specific file:line references
- Prioritized remediation plan

## Components

```
prod-audit/
  .claude-plugin/
    plugin.json           # Plugin manifest
  agents/
    system-explorer.md    # Architecture mapping
    code-auditor.md       # Correctness analysis
    security-auditor.md   # Security review
    reliability-auditor.md # Failure mode analysis
    ops-auditor.md        # Operational readiness
  commands/
    prod-audit.md         # /prod-audit command
  skills/
    data-safety/          # Data and migration review criteria
    performance/          # Performance analysis criteria
    observability/        # Logging and monitoring criteria
```
````
