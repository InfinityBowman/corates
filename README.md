# CoRATES

**Collaborative Research Appraisal Tool for Evidence Synthesis**

CoRATES is a web application designed to streamline AMSTAR-2 quality assessments for systematic studies. Built for researchers conducting evidence synthesis, it enables real-time collaboration, offline support, and seamless PDF annotation.

## Features

- **AMSTAR-2 Checklists** - Complete implementation of the AMSTAR-2 assessment tool with all 16 items and detailed signaling questions
- **Real-time Collaboration** - Work simultaneously with team members using CRDT-based sync (Yjs). Changes merge automatically without conflicts
- **Offline Support** - Keep working without internet. Progress saves locally (IndexedDB) and syncs when you're back online
- **PDF Annotation** - View and annotate PDFs alongside your checklists in a split-screen layout
- **Project Management** - Organize studies into projects, invite team members, and track progress

## Tech Stack

- **Frontend**: SolidJS, Tailwind CSS, Vite
- **Backend**: Cloudflare Workers, Durable Objects
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2 (PDF documents)
- **Sync**: Yjs (CRDT), y-indexeddb for local persistence
- **Auth**: BetterAuth

## Getting Started

### Prerequisites

- Node.js >= 24.0.0
- pnpm >= 10.0.0

## Architecture

CoRATES uses a CRDT-based sync layer backed by per-project Durable Objects:

- **One Durable Object per project** - Holds the Yjs document, validates domain constraints, and broadcasts updates
- **Local-first** - Clients persist data to IndexedDB and sync when connected
- **Conflict-free** - Yjs CRDTs ensure all changes merge automatically

## License

GNU GPLv3 - see [LICENSE](./LICENSE) for details.

## Author

Jacob Maynard
