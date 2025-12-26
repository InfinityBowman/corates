# CoRATES Documentation

**Collaborative Research Appraisal Tool for Evidence Synthesis**

Welcome to the CoRATES documentation. This site provides comprehensive guides and architecture documentation for developers working on CoRATES.

## What is CoRATES?

CoRATES is a web application designed to streamline the entire quality and risk-of-bias appraisal process with intuitive workflows, real-time collaboration, and automation, creating greater transparency and efficiency at every step. Built for researchers conducting evidence synthesis, it enables real-time collaboration, offline support, and PDF annotation.

## Tech Stack

- **Frontend**: SolidJS, SolidStart, Tailwind CSS, Vite, Ark UI
- **Backend**: Cloudflare Workers, Durable Objects
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2 (PDF documents)
- **Sync**: Yjs (CRDT), y-indexeddb for local persistence
- **Auth**: BetterAuth

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

### [Guides](/guides/)

Practical guides for common development tasks and patterns.

- [Error Handling](/guides/error-handling) - How to handle errors consistently across the application
- [Style Guide](/guides/style-guide) - UI/UX guidelines and design system

## Getting Started

For setup instructions and contributing guidelines, see the main repository README in the project root.

## License

PolyForm Noncommercial License 1.0.0
