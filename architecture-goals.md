# Architecture Goals

Date: 2025-11-24
Author: Automation (drafted by GitHub Copilot assistant)

---

## Goal (summary)

Implement a Yjs-based CRDT sync layer backed by per-project Durable Objects (DOs). Clients will use Yjs and persist locally with y-indexeddb for offline support. Users will be stored centrally in D1 and authenticated through a dedicated worker (BetterAuth). One project => one Durable Object is the recommended partitioning strategy.

We will standardize on UUIDs for entity IDs. D1 is used only for the global users table. R2 will be used to store PDF documents uploaded by users for projects.

---

## High-level architecture (target)

Client (browser) -- WebSocket/HTTP/WebAuth --> Edge Worker (auth check) --> Durable Object (per-project)

Durable Object: holds Y.Doc (Yjs) for the project, validates domain constraints, and broadcasts updates to connected clients.

Persistence: Users table is handled globally by the BetterAuth worker + D1. R2 is used for storing PDF documents uploaded by users for projects.

UI Local Persistence: Client persists Y.Doc to IndexedDB using y-indexeddb for offline support. When device reconnects, the Y.Doc merges with the DO and resolves conflicts automatically.

Official diagram (conceptual):

Client A <-> Edge Worker (auth) <-> Durable Object (Y.Doc)
^
Client B ----------------------------------------|

---

## Data model mapping

Mapping choices follow the approach of keeping per-project Y.Doc (single document) with typed collections for each logical table.

Top-level Y.Doc maps (example):

- meta: Y.Map (project metadata)
- users: Y.Map (userId => Y.Map fields) — if per-project user cache is needed
- reviews: Y.Map (reviewId => Y.Map)
- checklists: Y.Map (checklistId => Y.Map)
- checklist_answers: Y.Map (answerId => Y.Map) where answers is a Y.Array
- project_members: Y.Map (userId => Y.Map({role, user_id})) OR Y.Map keyed by id if you prefer composite-string IDs
- review_assignments: Y.Map keyed by assignmentId or userId

Examples of Yjs types per entry:

```js
const ydoc = new Y.Doc();
const reviews = ydoc.getMap('reviews');
reviews.set('review-uuid', new Y.Map({ id: 'review-uuid', project_id: 'project-uuid', name: 'Initial review', created_at: Date.now() }));

const answers = ydoc.getMap('checklist_answers');
answers.set(
  'answer-uuid',
  new Y.Map({
    id: 'answer-uuid',
    checklist_id: 'checklist-uuid',
    question_key: 'q1',
    answers: new Y.Array(['yes', 'no']),
    critical: true,
    updated_at: Date.now(),
  }),
);
```

Why Y.Map + Y.Array: fine-grained CRDT updates and efficient merges. Use Y.Map for key/value documents (row-like) and Y.Array for ordered, repeatable fields (answers array).

---

## ID strategy

- Use UUIDs across clients and servers to avoid temp-id swap headaches. Generates deterministic unique ids (v4) on creation.

---

## Durable Object responsibilities

- Own the authoritative Y.Doc for the project.
- Authenticate and authorize connecting clients (validate tokens via BetterAuth worker/service).

---

## Client responsibilities

- Use Yjs (Y.Doc) and y-indexeddb for local persistence and offline use.
- Connect to DO via secure WebSocket provider (or a worker that routes to DO and validates auth token).
- Translate Yjs document to the UI data model (you can either use Yjs directly in UI or maintain a lightweight local mirror if necessary).

---

## Authentication & Users

- Global users table and authentication lives outside project DOs.
- Store users in D1 (Cloudflare). BetterAuth worker handles secure token minting and validation.
- On client connect, the worker validates the user and checks membership/permission for requested project. Connection allowed only for authorized member roles.

## Project Documents (PDFs)

- User-uploaded PDF documents for projects are stored in R2 (Cloudflare object storage).

---

## Architecture Implementation Roadmap

This roadmap outlines the step-by-step plan for implementing the new architecture in this project, transitioning from previous approaches to a Yjs + Durable Objects + D1 model.

**Phase 1 — Foundation & Pilot**

- Establish UUID strategy and implement generation utilities with tests.
- Build initial Durable Object (DO) for a single project, syncing a simple `checklist_answers` array using Yjs.

**Phase 2 — Core Expansion**

- Extend DO to support reviews, checklists, and assignments.
- Add permission checks and role logic within DOs (owner/member rules).

**Phase 3 — Authentication & Integration**

- Deploy BetterAuth worker and global D1 user table.
- Integrate client authentication flow to obtain tokens for WebSocket connections.

**Phase 4 — Testing & Hardening**

- Develop and run tests for offline reconciliation and conflict scenarios.
- Harden system for reliability and edge cases.

**Phase 5 — Analytics & Monitoring**

- Add monitoring and metrics for DO performance.

---

## Example minimal DO + client pseudocode (PoC)

DO (high-level pseudocode):

```js
// Durable Object pseudocode
class ProjectDoc {
  constructor() {
    this.ydoc = new Y.Doc();
    this.clients = [];
  }

  onConnect(client, user) {
    // Auth done by Edge Worker
    this.clients.push(client);
    // Send current snapshot to client
    client.send(Y.encodeStateAsUpdate(this.ydoc));
  }

  onMessage(client, update) {
    // update is a Yjs update (Uint8Array)
    Y.applyUpdate(this.ydoc, update);
    // DO-side validation hooks here for domain invariants

    // Broadcast to other clients
    this.clients.forEach((c) => c !== client && c.send(update));
  }
}
```

Client (pseudocode):

```js
const ydoc = new Y.Doc();
const provider = new WebsocketProvider('wss://example.com/project', projectId, ydoc, { params: { token } });

// Persist locally
const persistence = new IndexeddbPersistence(projectKey, ydoc);

// UI can read from ydoc.getMap('checklist_answers') directly
const answers = ydoc.getMap('checklist_answers');

// create a new answer
const ansId = uuidv4();
answers.set(ansId, new Y.Map({ id: ansId, checklist_id, question_key, answers: new Y.Array(['yes']), critical: false }));

// Yjs + provider handles sync, DO enforces validation.
```

## Project-level Y.Doc (checklist PoC)

To start small we keep _one Y.Doc per project_ (a Durable Object). Each project doc exposes a top-level `checklists` Y.Map where each checklist is a `Y.Map` with fields like `title` and `items` (a `Y.Array`).

Server (DO): implement a `ProjectDoc` Durable Object which:

- holds a Y.Doc for the project
- persists the Y.Doc to the DO state
- handles WebSocket connections for real-time sync

Client: connect to the worker WebSocket at `/api/projects/:projectId`. When connected the server sends the current state as a Yjs update; clients apply updates and push local updates back as encoded Yjs updates.

Notes:

- We intentionally do not provide per-checklist HTTP fetch routes; clients read the container Y.Doc and use the `checklistId` inside the document.
- You will need an environment binding for `PROJECT_DOC` in your worker configuration to enable the DO route.
