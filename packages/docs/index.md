# CoRATES Documentation

**Collaborative Research Appraisal Tool for Evidence Synthesis**

Welcome to the CoRATES documentation. This site provides comprehensive guides and architecture documentation for developers working on CoRATES.

## What is CoRATES?

CoRATES is a web application designed to streamline the entire quality and risk-of-bias appraisal process with intuitive workflows, real-time collaboration, and automation, creating greater transparency and efficiency at every step. Built for researchers conducting evidence synthesis, it enables real-time collaboration, offline support, and PDF annotation.

## Tech Stack

- **Frontend**: React 19, TanStack Start, TanStack Router, TanStack Query, Zustand, Tailwind CSS, Vite, shadcn/ui
- **Backend**: TanStack Start server routes on Cloudflare Workers, Durable Objects
- **Database**: Cloudflare D1 (SQLite) via Drizzle ORM
- **Storage**: Cloudflare R2 (PDF documents)
- **Sync**: Yjs (CRDT), y-dexie for local persistence (Y.Doc stored alongside app data in a single IndexedDB via Dexie)
- **Auth**: Better Auth
- **Payments**: Stripe (isolated `stripe-purchases` Worker using Hono for webhook delivery)

## Documentation Sections

### [Architecture](/architecture/)

Learn about the system architecture, package structure, data models, and how different components interact.

- Package Architecture
- System Architecture
- Sync Flow
- Data Model
- Routes (Frontend & API)
- API Actions
- Yjs Sync

### [Plans](/plans/)

Design docs and implementation plans (product, architecture, and major features).

### [Guides](/guides/)

Practical guides for common development tasks and patterns.

- [Error Handling](/guides/error-handling) - How to handle errors consistently across the application
- [Style Guide](/guides/style-guide) - UI/UX guidelines and design system
- [Pricing Model (Proposal)](/plans/pricing-model) - Proposed pricing model and billing scopes

## Getting Started

For setup instructions and contributing guidelines, see the main repository README in the project root.

## License

PolyForm Noncommercial License 1.0.0
