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

Durable Object: holds Y.Doc (Yjs) for the project, validates domain constraints, and broadcasts updates to connected clients. Also holds user roles for the project: owner or member.

D1 Persistence: Users table is handled globally by the BetterAuth worker + D1.

R2 is used for storing PDF documents uploaded by users for projects.

UI Local Persistence: Client persists Y.Doc to IndexedDB using y-indexeddb for offline support. When device reconnects, the Y.Doc merges with the DO and resolves conflicts automatically.

Official diagram (conceptual):

Client A <-> Edge Worker (auth) <-> Durable Object (Y.Doc)
^
Client B ----------------------------------------|

---

## Data model mapping

Hierarchical Y.Doc structure per project:

```
Project (1 Durable Object per project)
  - meta: Y.Map { name, description, createdAt, updatedAt }
  - members: Y.Map (userId => { role, joinedAt })
  - reviews: Y.Map (reviewId => {
      name, description, createdAt, updatedAt,
      checklists: Y.Map (checklistId => {
        title, assignedTo, status, createdAt, updatedAt,
        answers: Y.Map (questionKey => { value, notes, updatedAt, updatedBy })
      })
    })
```

Example Yjs usage:

```js
const ydoc = new Y.Doc();

// Create a review
const reviews = ydoc.getMap('reviews');
const reviewId = crypto.randomUUID();
const reviewMap = new Y.Map();
reviewMap.set('name', 'Sleep Study Review');
reviewMap.set('description', 'AMSTAR2 evaluation');
reviewMap.set('createdAt', Date.now());
reviewMap.set('checklists', new Y.Map());
reviews.set(reviewId, reviewMap);

// Add a checklist to the review
const checklistsMap = reviewMap.get('checklists');
const checklistId = crypto.randomUUID();
const checklistMap = new Y.Map();
checklistMap.set('title', 'Study 1 Assessment');
checklistMap.set('assignedTo', 'user-uuid'); // reviewer userId
checklistMap.set('status', 'pending'); // pending, in-progress, completed
checklistMap.set('createdAt', Date.now());
checklistMap.set('answers', new Y.Map());
checklistsMap.set(checklistId, checklistMap);

// Record an answer (AMSTAR2 format with boolean arrays per column)
const answersMap = checklistMap.get('answers');
answersMap.set(
  'q1',
  new Y.Map([
    // Each question stores: answers (nested boolean arrays), critical flag, notes
    ['answers', [[false, false, false, false], [false], [false, true]]], // matches column structure
    ['critical', false],
    ['notes', ''],
    ['updatedAt', Date.now()],
    ['updatedBy', 'user-uuid'],
  ]),
);
```

Why this structure:

- Hierarchical: Projects -> Reviews -> Checklists -> Answers
- Fine-grained CRDT: Each level is a Y.Map for efficient merges
- Assignments: Each checklist has `assignedTo` for reviewer assignment
- Status tracking: Checklists have status (pending/in-progress/completed)

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
    this.clients.forEach(c => c !== client && c.send(update));
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
answers.set(
  ansId,
  new Y.Map({ id: ansId, checklist_id, question_key, answers: new Y.Array(['yes']), critical: false }),
);

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
