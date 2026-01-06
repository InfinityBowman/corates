## High Value:

**Security Audit** - Review auth flows, input sanitization, CSRF protection, rate limiting coverage, and secrets management. You have some security headers but there may be gaps in validation across routes.

**Performance/Bundle Size Audit** - You have bundle-analysis.html set up. An audit could identify heavy dependencies, code-splitting opportunities, and lazy loading candidates (especially the PDF viewer plugins).

**Accessibility (A11Y) Audit** - Ensure WCAG compliance across your Ark UI components, form labels, keyboard navigation, and screen reader support for the checklist/appraisal workflows.

**Testing Coverage Audit** - Identify gaps in test coverage, especially for critical paths like billing webhooks, Yjs sync edge cases, and auth flows.

## Medium Value:

**Technical Debt Audit** - Grep for TODO, FIXME, HACK comments and prioritize them. I noticed several TODOs in your codebase (e.g., Sentry integration, error monitoring).

**API Consistency Audit** - Review endpoint naming conventions, response shapes, error formats, and pagination patterns across your Hono routes.

**Offline/Sync Audit** - Document Yjs conflict resolution behavior, IndexedDB persistence reliability, and edge cases when users go offline mid-operation.

**Database Query Audit** - Review Drizzle queries for N+1 problems, missing indexes, and expensive operations (especially in admin analytics routes).

## Lower Priority but Useful:

**Dependency Freshness Audit** - Check for outdated packages, security vulnerabilities (pnpm audit), and deprecated APIs.

**Environment/Configuration Audit** - Ensure all env vars are documented, secrets are rotated, and dev/prod parity.

**Documentation Audit** - Verify docs accuracy vs implementation, especially for complex areas like Yjs sync and billing.
