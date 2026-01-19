```markdown
---
description: Guided production readiness audit with specialized agents for correctness, security, performance, reliability, and operations
argument-hint: Optional launch context (e.g., "First public launch, expecting ~5k MAU")
---

# Production Readiness Audit

You are conducting a comprehensive production readiness audit. Follow a systematic 9-phase approach: understand launch context, map the system, audit code health, review data safety, check security, evaluate performance, assess observability, verify operational readiness, then deliver a verdict.

## Core Principles

- **Default to pessimism**: Assume things will fail and look for how
- **Ask clarifying questions**: Launch context matters - risk tolerance, blast radius, success criteria
- **Read files identified by agents**: When agents return file lists, read them to build context
- **Block on critical issues**: Stop-ship findings must be addressed before proceeding
- **Use TodoWrite**: Track all progress throughout phases

---

## Phase 1: Launch Context and Risk Framing

**Goal**: Understand what kind of launch this is and what "failure" means

Initial context: $ARGUMENTS

**Actions**:

1. Create todo list with all 9 phases
2. Ask user about launch context:
   - Is this internal, beta, public, or paid/revenue-impacting?
   - Will real user data be stored?
   - Is there payment or billing involved?
   - What is the acceptable failure mode? (downtime vs data loss)
   - Expected traffic (rough order of magnitude)?
   - What would constitute a "stop-ship" issue for this launch?
3. Based on answers, establish:
   - Launch risk profile
   - Audit strictness level (Low / Medium / High)
   - Explicit stop-ship criteria
4. Confirm understanding before proceeding

---

## Phase 2: System and Architecture Mapping

**Goal**: Build a complete mental model of the system

**Actions**:

1. Launch 2-3 `system-explorer` agents in parallel with different focuses:
   - "Trace request lifecycle from entry points through persistence"
   - "Map external services, integrations, and their failure modes"
   - "Identify stateful components, data ownership, and trust boundaries"

2. Once agents return, consolidate into a system overview:
   - Entry points (APIs, webhooks, scheduled jobs)
   - Core state (databases, caches, file storage)
   - Critical paths (key user flows)
   - External dependencies
   - Trust boundaries

3. Present system map and confirm with user before proceeding

---

## Phase 3: Codebase Health Audit

**Goal**: Identify correctness issues, maintainability risks, and hidden footguns

**Actions**:

1. Launch 2-3 `code-auditor` agents with different focuses:
   - "Find error handling gaps, unhandled rejections, and partial failure scenarios"
   - "Identify implicit assumptions, race conditions, and concurrency issues"
   - "Locate TODOs, FIXMEs, commented code, and 'should never happen' branches"

2. Consolidate findings into categories:
   - High-Risk: Issues likely to cause production incidents
   - Medium-Risk: Issues that could cause problems under specific conditions
   - Technical Debt: Issues affecting maintainability

3. Present findings with file:line references
4. If any high-risk issues found, flag as potential stop-ship items

---

## Phase 4: Data Safety and Migration Review

**Goal**: Prevent irreversible data mistakes

**Actions**:

1. Review all write paths and destructive operations:
   - Hard deletes vs soft deletes
   - Cascade deletes
   - Bulk update operations
   - Data transformations

2. Review migrations and schema evolution:
   - Are migrations reversible?
   - Are they idempotent?
   - Is there a rollback strategy?

3. Evaluate backup and recovery:
   - Is data backed up?
   - Can you restore to a point in time?
   - Has recovery been tested?

4. Present findings and flag stop-ship issues

---

## Phase 5: Security and Abuse Audit

**Goal**: Ensure the system is safe under hostile conditions

**Actions**:

1. Launch 2-3 `security-auditor` agents with different focuses:
   - "Audit authentication flows, session management, and token handling"
   - "Check authorization boundaries, access control, and privilege escalation vectors"
   - "Find input validation gaps, injection risks, and secrets handling issues"

2. Consolidate security findings:
   - Critical: Exploitable vulnerabilities
   - High: Significant security gaps
   - Medium: Defense-in-depth improvements

3. Check for abuse vectors:
   - Rate limiting on sensitive endpoints
   - Resource exhaustion risks
   - Webhook verification
   - DOS vectors

4. Present findings - any critical/high security issues are stop-ship by default

---

## Phase 6: Performance and Load Readiness

**Goal**: Ensure the system survives real traffic

**Actions**:

1. Identify hot paths based on launch context:
   - High-frequency operations
   - User-facing latency-sensitive paths
   - Background job throughput

2. Review for scaling issues:
   - O(n) or worse operations on user data
   - Unbounded queries or fetches
   - Missing pagination
   - No backpressure mechanisms

3. Evaluate caching strategy:
   - What is cached vs computed?
   - Cache invalidation approach
   - Cold start penalties

4. Present performance risks with mitigation suggestions

---

## Phase 7: Observability and Debuggability

**Goal**: Ensure you can debug production issues at 2am

**Actions**:

1. Audit logging:
   - Are errors logged with sufficient context?
   - Are request correlation IDs present?
   - Can you trace a single user request?
   - Do logs leak sensitive data?

2. Check metrics and monitoring:
   - Are key business metrics tracked?
   - Are infrastructure metrics available?
   - Is there anomaly detection?

3. Review alerting:
   - Are critical failures surfaced?
   - Is there alert fatigue risk?
   - Are runbooks linked to alerts?

4. Present observability gaps

---

## Phase 8: Operational Readiness and Failure Modes

**Goal**: Ensure humans can operate the system safely

**Actions**:

1. Launch 1-2 `ops-auditor` agents:
   - "Review deployment process, rollback capability, and manual steps"
   - "Simulate failure scenarios and evaluate recovery procedures"

2. Review operational procedures:
   - Deploy process documentation
   - Rollback procedures
   - Incident response runbooks
   - On-call coverage

3. Simulate failure scenarios:
   - What happens if [external dependency] is down?
   - What happens during partial deployment?
   - What happens with schema mismatch?
   - Can you do a controlled degradation?

4. Present operational risks and gaps

---

## Phase 9: Launch Verdict and Remediation Plan

**Goal**: Decide whether to ship

**DO NOT SKIP THIS PHASE**

**Actions**:

1. Consolidate ALL findings from phases 2-8
2. Categorize each issue:
   - **Stop-Ship**: Must fix before launch, will cause production incidents
   - **Fix Soon**: Important but can ship with plan to address within days
   - **Acceptable Risk**: Acknowledged limitation, documented workaround or low impact

3. Generate final verdict:
   - READY: No stop-ship issues, acceptable risk profile
   - READY WITH CONDITIONS: No stop-ship issues but fix-soon items need timelines
   - NOT READY: Stop-ship issues must be resolved

4. Create remediation plan:
   - Prioritized list of issues to address
   - Suggested fix approach for each
   - Estimated effort

5. Save full audit report to `packages/docs/audits/prod-audit-[date].md`

6. Present verdict and recommendation clearly to user

---

## Verdict Criteria

**Stop-Ship (must block launch):**

- Exploitable security vulnerabilities
- Data loss or corruption risks
- Missing critical authorization checks
- Non-reversible migrations without backup
- Unverified webhook signatures on financial endpoints

**Fix Soon (ship with commitment):**

- Missing rate limiting
- Observability gaps
- Missing documentation
- Performance issues for non-critical paths
- Technical debt in non-critical code

**Acceptable Risk (document and proceed):**

- Cold start latency
- Minor UX degradation under extreme load
- Missing features that aren't launch-critical
- Known limitations with workarounds
```
