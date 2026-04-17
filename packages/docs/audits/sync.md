so maybe a new sync engine is needed for native cloudflare syncing durable objects to client database?Apr 14Yeah honestly there's a real gap there. The options are either:

Too heavy (Zero needs Postgres)
Too thin (TinyBase has no write authority)
Too general (LiveStore's one-user-one-DB limitation)

Nobody has built a sync engine that's designed from the ground up around the Cloudflare primitive model — where a DO is the authoritative database, D1 is the persistent backing store, and the client has a local SQLite (via wa-sqlite or similar in the browser).
What a native CF sync engine would look like:

Client: wa-sqlite or OPFS-backed SQLite in the browser
Server: DO owns the canonical state, backed by D1 for durability
Transport: WebSocket via DO (already great at this)
Write path: typed mutations sent to DO, DO validates + applies + broadcasts diffs
Read path: DO streams row-level diffs to subscribed clients
Conflict resolution: DO is single-writer so you get linearizability for free — no CRDTs needed, the DO is the lock

The DO architecture actually solves the hardest sync problems:
The reason sync engines are hard is that you need a canonical ordering of writes and a way to resolve conflicts. CRDTs are one solution. But a DO gives you something better — a single global instance per name, with synchronous writes and output gates that ensure clients never see confirmation of data that hasn't been persisted. Ashleypeacock That's basically linearizable storage, which means you can do simple last-write-wins or optimistic locking without a CRDT layer at all.
What's missing to build this:

A diff/patch protocol for SQLite row changes (like a mini WAL streamed over WebSocket)
A client-side SQLite that can apply those patches reactively
A mutation framework with server-side validation hooks
Schema-awareness so the client knows what tables/rows it's subscribed to

Is it a startup idea?
Possibly — the Cloudflare ecosystem is big enough and the gap is real. Turso tried to own the "SQLite everywhere" story, LiveStore owns the event-sourcing angle, but nobody owns "D1/DO as the sync primitive with a great client SDK." The closest thing is what tldraw built internally but they never extracted it into a general library.
The risk is that Cloudflare itself could build this — they've been aggressively expanding the DO feature set and their Agents SDK already broadcasts state to all clients on every change. Cloudflare That's one step away from a proper sync engine.would i want to build on top of agents sdk then or use tldraw as inspiration?Apr 14Good question — they're pretty different foundations:

Cloudflare Agents SDK
The Agents SDK already broadcasts state to all clients on every change, and has a built-in SQL API that runs within the same context as the Agent itself — zero-latency storage access with no round-trip. Cloudflare
So you'd get:

State broadcast for free
SQL built in
WebSocket handling abstracted
Cloudflare's full ecosystem (auth, queues, etc.)

The downside is it's designed around AI agents, not general sync. The mental model is "agent with memory" not "database with subscribers." You'd be fighting the abstraction if your use case is pure data sync rather than agentic workflows.

tldraw-sync as inspiration
tldraw's approach is minimal — one DO instance per room, WebSocket connections to it, R2 for assets. Each room handles ~50 simultaneous collaborators and they've never had to worry about scale because Cloudflare handles instance routing. GitHub
The insight from tldraw is: don't over-abstract. Their sync is just:

Client sends ops over WebSocket
DO applies them to its SQLite
DO broadcasts to other connected clients
On connect, DO sends current state snapshot

That's it. No CRDT library, no fancy protocol.

Honest recommendation:
Use tldraw as the architectural inspiration, but look at the Agents SDK for the WebSocket and state management primitives — it handles hibernation, reconnection, and broadcast boilerplate that you'd otherwise write yourself. Then layer your own:

Schema definition (what tables/rows a client subscribes to)
Mutation functions (server-validated writes)
Diff protocol (send row-level changes, not full state snapshots)

The Agents SDK gets you 60% there on infrastructure. tldraw shows you the right level of simplicity to aim for. The remaining work — typed mutations, partial subscriptions, row-level diffs — is what would make it a real general-purpose sync engine rather than a room-based collaboration tool.
The key architectural question you'd need to answer that neither solves well: partial sync. tldraw syncs the whole document. The Agents SDK broadcasts all state. A general sync engine needs to let clients subscribe to a subset of the data (like "only rows where user_id = me"), which requires query-aware diffing — and that's the genuinely hard part.yeah but i really just want to sync the whole thingApr 14Then honestly you don't need much. If whole-database sync is acceptable, the architecture collapses to something really simple:
The whole thing is basically:

Client connects to DO via WebSocket
DO sends full SQLite snapshot on connect
Client applies it to local wa-sqlite
Client sends mutations as JSON to DO
DO validates + writes to its SQLite
DO broadcasts the mutation to all connected clients
Clients apply the same mutation locally

That's it. No diff protocol, no partial subscriptions, no CRDT. Just operation broadcasting.
The Agents SDK is probably the right base then — it already handles the WebSocket lifecycle, hibernation, and state broadcasting. You're really just adding:

A mutation schema (typed operations the client can send)
Server-side validation hooks on those mutations
Initial snapshot delivery on connect
wa-sqlite or OPFS on the client to apply them

Size constraint matters though — whole-database sync only works if the DB stays reasonably small. If someone's syncing a 500MB SQLite that's a different problem. But if you're thinking app-state scale (a few MB at most), a full snapshot on connect is totally fine and way simpler than any diff protocol.
Closest reference implementation is actually the Agents SDK todo example — it's almost exactly this pattern, just without the client-side SQLite piece. You'd be adding wa-sqlite on the client and a slightly more structured mutation format, and you'd basically have a working sync engine in maybe a few hundred lines.well what if i want offline first or the client already has most of the data? what about concurrent edits?Apr 14Those three requirements are exactly what push you from "simple broadcaster" into needing a real sync protocol. Let me break each one down:

Offline first
You need the client to queue mutations while offline and replay them when reconnected. This means:

Client writes to local wa-sqlite immediately (optimistic)
Mutations get queued in IndexedDB or OPFS so they survive page reloads
On reconnect, client sends the queue to the DO in order
DO applies them and broadcasts to others

The tricky part is what happens if the DO rejected or modified some of those mutations while the client was offline — you need to reconcile the client's optimistic state with what the server actually has.
Delta sync (client already has data)
You need a way to say "I have state as of version N, send me everything since then." This means:

DO needs to maintain a log of mutations with sequence numbers
Client sends its last known sequence number on reconnect
DO replays only the delta since then
This is basically a WAL (write-ahead log)

Without this, every reconnect is a full snapshot — fine for small DBs, expensive for larger ones.
Concurrent edits
This is the hardest one. Since the DO is single-writer you get linearizability, which is great — but you still need to handle the case where two clients both edited the same row while one was offline. Your options are:

Last write wins — simplest, often acceptable, loses data
Reject and notify — server rejects the stale mutation, client has to reconcile manually
Operational transforms — complex, what Google Docs does
CRDTs — merge-friendly data structures, what TinyBase does
Optimistic with server reconciliation — client applies optimistically, server may send a correction

The honest matrix:
RequirementComplexity addedWhole DB sync, always onlineTrivialOffline queuingLowDelta sync on reconnectMedium — need a WALConcurrent conflict resolutionHigh — need a strategy
The good news is that for most apps, last-write-wins plus a WAL gets you 90% of the way there with maybe 20% of the complexity of a full CRDT engine. You only need CRDTs if you have genuinely collaborative real-time editing of the same fields simultaneously — like Google Docs. For most app data (todos, settings, records), LWW with a sequence log is totally fine and what most production systems actually use under the hood.
So the real question is: do you expect genuinely simultaneous edits to the same row, or just concurrent edits to different rows?lww is fineApr 14Then your architecture is actually pretty clean and buildable. Here's what the full thing looks like:

Server (DO):

SQLite database (the canonical source)
A mutations log table with auto-incrementing sequence numbers
On mutation: write to SQLite, append to log, broadcast to connected clients
On connect: client sends last known sequence number, DO replays log from there
If sequence is 0 or missing: send full snapshot

sqlCREATE TABLE mutations (
seq INTEGER PRIMARY KEY AUTOINCREMENT,
table TEXT,
row_id TEXT,
op TEXT, -- 'set' | 'delete'
data JSON,
ts INTEGER
);
Client (wa-sqlite or OPFS):

Local SQLite mirror
Persisted last_seq so reconnects are cheap
Mutation queue in IndexedDB for offline support
On reconnect: drain queue → send to DO → receive delta from last_seq

Transport:

WebSocket for live mutations
Single HTTP endpoint for initial snapshot if needed

The flow:
Online write:
Client mutates locally → sends to DO → DO writes + broadcasts
Other clients receive broadcast → apply locally

Offline write:
Client mutates locally → queues mutation

Reconnect:
Client sends queued mutations → DO applies LWW
Client sends last_seq → DO streams delta back
Client applies delta (LWW, so server wins on conflict)

What you actually need to build:

DO class with SQLite + mutation log + WebSocket broadcast (~200 lines)
Client sync class with wa-sqlite + queue + reconnect logic (~300 lines)
A simple mutation format: { table, rowId, op, data, clientTs }

That's genuinely it. The WAL doubles as your audit log, LWW means no conflict resolution code, and the DO's single-writer guarantee means you never have split-brain. The whole thing is probably 500-600 lines of TypeScript before any app-specific code.
The Agents SDK handles WebSocket hibernation and reconnection for you, so you can skip a lot of the boilerplate on the server side. You're really just writing the mutation log and the delta replay logic.does tldraw one not do this stuff?Apr 14Good question — let me check exactly what tldraw-sync actually implements under the hood.Searched the webSearched the webInteresting findings — tldraw's sync is more sophisticated than the open source Cloudflare template suggests, but it's also more tightly coupled to their use case than it appears.
What tldraw-sync actually does:
Their production app uses sequence numbers, soft reboots that preserve snapshots and replay history, hard reboots that clear state and reconnect, and optimistic rollback that automatically reverts failed mutations. DeepWiki So they do have delta sync and offline recovery.
But here's the catch:
Their internal architecture actually uses Zero for user data sync on one layer, and their own TLSync protocol for canvas drawing data on another — two separate sync systems running in parallel. DeepWiki The open source Cloudflare template is just the drawing layer, not the full thing.
The public TLSocketRoom is snapshot-based — it stores the full document state and fires an onDataChange callback when things change. There's no built-in WAL or sequence log exposed publicly. GitHub
So the honest answer:
The open source tldraw-sync is not what you want — it's canvas-document-oriented, snapshot-based, and tightly coupled to tldraw's data model. Their internal production system does what you want but it's not extracted into a reusable library.
You'd essentially be building the thing that doesn't publicly exist yet — a general purpose, schema-agnostic, WAL-based sync engine native to Durable Objects. And based on this research, nobody has open sourced that.would i want to use yjs or no?Apr 14For your use case — SQLite-backed, LWW, whole-DB sync — probably not. Here's why:
What Yjs is good at:

Collaborative text editing (like Google Docs)
Fine-grained concurrent edits to the same data simultaneously
Rich CRDT data types (text, arrays, maps) that merge automatically
Presence/awareness (cursors, selections)

Why it doesn't fit your model:

Yjs operates on its own CRDT data structures — Y.Text, Y.Array, Y.Map — not SQLite tables. You'd be mapping between two data models constantly
Its whole value prop is conflict-free merging of concurrent edits, which you explicitly don't need since you chose LWW
The Yjs document is its own thing — it's not a SQLite replica, it is the store. You'd essentially be running two databases
Yjs history/update logs are CRDT operation logs, not SQL mutation logs — very different things

Where it would make sense:
If you had one specific field that needed true collaborative editing — like a shared notes textarea inside an otherwise SQL-backed app — you could use Yjs just for that field and SQLite for everything else. That's actually a reasonable hybrid.
For your architecture:
You already have the right primitive — a DO with SQLite, a mutation log, and LWW. That's cleaner and simpler than Yjs for tabular data. Yjs would add complexity without solving any problem you actually have.
Short answer: skip it.is there good text editing but not crdt or is crdt needed for that?Apr 14CRDT is not strictly needed for text editing — it depends on your concurrency model.
Why CRDT exists for text:
The problem with naive LWW on text is that the unit of conflict is the whole string. If two users both edit a paragraph simultaneously, LWW just picks one and throws the other away entirely. That's bad UX for collaborative editing.
Alternatives to CRDT:
Operational Transform (OT)

What Google Docs actually uses
Server transforms concurrent operations so they compose correctly
Requires a central server to order and transform ops — which you have (the DO)
Complex to implement correctly but well-understood
Libraries: ShareDB, ot.js

Server-serialized editing

Simplest approach — the DO is single-writer, so just lock the field while someone's editing
Last person to save wins, others get a conflict warning
Like Google Docs "someone else is editing" but without the live merging
Totally fine for most app text fields (descriptions, notes, etc.)

Pessimistic locking

Client claims a lock on a text field from the DO
Others see it as read-only while locked
Lock releases on blur or timeout
Simple, predictable, no merging needed

The real question:
What kind of text editing do you need? There's a big difference between:

A notes field on a record — server-serialized LWW is totally fine
A shared document everyone edits simultaneously — you need OT or CRDT
A form field — LWW is fine, conflicts are rare

For most app use cases it's the first one, and LWW on the whole text value is completely acceptable. CRDT/OT only really matters when multiple people are genuinely typing in the same field at the same time.if i wanted sqlite backed shared editing then how might i want to go about that?Apr 14This is actually a pretty interesting design problem. The key insight is that you can layer different sync strategies per field type:
The hybrid approach:
For regular fields (strings, numbers, booleans) — your existing LWW SQLite sync works fine. For rich text fields that need collaborative editing — you store the Yjs or OT document separately and sync it differently, then write the final value back to SQLite when it settles.
Concrete architecture:
SQLite (DO)
├── records table ← LWW synced normally
│ ├── id
│ ├── title ← plain text, LWW fine
│ ├── status ← LWW fine  
│ └── body_doc_id ← foreign key to a collab doc
└── collab_docs table ← stores Yjs binary snapshots
├── id
└── snapshot ← BLOB, the Y.Doc state vector
The Yjs updates flow separately over WebSocket, the DO merges them into its Y.Doc in memory, and periodically flushes the snapshot blob back to SQLite. When a client connects, they get the SQLite snapshot for the record fields plus the Y.Doc snapshot for the rich text.
Simpler option — ProseMirror + server OT:
If you don't want Yjs at all, ShareDB is the classic choice:

Stores OT operations in a log (fits naturally into your mutation log)
Server (your DO) transforms and rebroadcasts ops
Client applies ops to ProseMirror or Quill
Final text value written back to SQLite periodically

ShareDB was built for exactly this — a central server serializing OT operations — and a DO is a perfect host for it since it's single-writer by design.
Simplest option — TipTap/ProseMirror with Yjs, stored as blob:
User edits in TipTap
→ Yjs update generated
→ sent to DO over WebSocket
→ DO applies to in-memory Y.Doc
→ broadcasts to other clients
→ every N seconds: DO serializes Y.Doc → stores blob in SQLite
→ on connect: client gets blob, reconstructs Y.Doc locally
This is basically what Notion does. The rich text is a CRDT document, SQLite just stores snapshots of it. You get collaborative editing without giving up SQLite as your source of truth.
My recommendation:
If you want the least complexity, go with TipTap + Yjs just for rich text fields, stored as blobs in your DO's SQLite. Everything else stays LWW. The boundary between "CRDT field" and "LWW field" is just a column type in your schema — your sync engine treats blob columns as opaque and routes their updates through a Y.Doc instead of LWW.
That way you're not rebuilding OT, not abandoning your SQLite architecture, and you only pay the Yjs complexity cost for fields that actually need it.is crdt needed or overkill since technically the DO is authoritativeApr 14Really good point — since the DO is the single authoritative writer, you actually don't need CRDT at all for collaborative text editing either.
Why CRDT exists in the first place:
CRDT and OT solve the problem of peer-to-peer merging where there's no single authority. If two clients can both be "right" simultaneously with no server to arbitrate, you need math to merge them. That's the Google Docs problem — they had to invent OT because they couldn't just say "server wins."
But you have a DO:
The DO processes one operation at a time, in order. So the "hard part" of collaborative text editing is already solved — you have a linearizable log. The only question is how to represent text operations in that log.
What you actually need:
Just a way to express "insert X at position Y" and "delete N chars at position Z" as operations, and a way to apply them to the server's canonical text and broadcast the result.
The naive version:
Client types "hello" at position 5
→ sends { op: 'insert', pos: 5, text: 'hello' }
→ DO applies to its canonical text
→ DO broadcasts the updated full text to all clients
→ Clients replace their local copy
That's it. No CRDT, no OT. Works fine as long as you're okay with:

Occasional cursor jumping (when someone else's op shifts your position)
Full text replacement on each broadcast (fine for moderate sized documents)

Where it breaks down:
The only remaining problem is cursor positions. If user A is at position 50 and user B inserts 10 chars at position 20, user A's cursor is now wrong — it should be at position 60. This is the only thing you need positional awareness for, and it's much simpler than full OT:
javascriptfunction adjustCursor(cursorPos, op) {
if (op.type === 'insert' && op.pos <= cursorPos) {
return cursorPos + op.text.length
}
if (op.type === 'delete' && op.pos < cursorPos) {
return cursorPos - Math.min(op.length, cursorPos - op.pos)
}
return cursorPos
}
That's basically 90% of what OT does, just for cursor positions rather than arbitrary document transforms.
So the full simple stack:

ProseMirror or TipTap on the client (handles local editing state)
Send ops as { insert/delete, pos, content } to DO over WebSocket
DO applies to canonical text string, broadcasts to all clients
Clients apply the op locally, adjust their cursor position
DO flushes canonical text to SQLite periodically

When you'd actually want Yjs:

Truly offline-first editing where two people edit the same document for hours with no connectivity, then merge
You don't control the server (peer-to-peer scenario)
You need fine-grained undo/redo that survives merges

For a DO-backed app where clients are generally online, Yjs is genuinely overkill. The DO's linearizability is a superpower you should lean into rather than work around with CRDTs.ok so look up what id actually want to make and what libraries i should use as inspiration for this final, DO is authoritative with offline first, collaborative editing with text backed by sqlite on client and DOApr 14Searched the webSearched the webPowerSync is the single best reference for what you want to build. Here's the full picture:

PowerSync is the closest existing thing to your idea
Their explicit philosophy: no CRDTs needed since there's no peer-to-peer involved — just server-authoritative LWW with optional custom conflict resolution. Standard SQLite on the client, standard database on the server, PowerSync just keeps them in sync. Powersync
The catch: they use Postgres WAL or MongoDB change streams as the replication source Powersync — not DOs. Your idea is the same architecture but with a DO as the authoritative server instead of Postgres, which is actually simpler.

The exact stack you want:
Client:

SQLite compiled to WASM, run in a Web Worker so the main thread stays unblocked. OPFS for persistence — provides direct file access enabling WAL mode, so writes don't block reads. DEV Community
Mutation queue persisted to OPFS/IndexedDB so offline writes survive page reloads
Last known sequence number persisted so reconnects are cheap

Server (DO):

SQLite-backed DO as canonical source
Mutation log table with auto-increment sequence numbers
WebSocket transport — broadcast mutations to connected clients, stream delta on reconnect

Text editing:

TipTap or ProseMirror on the client
Ops sent as structured mutations { table, rowId, field, op, pos, content }
DO applies sequentially (linearizable by nature), broadcasts result
Simple cursor position adjustment on clients — no CRDT needed

Libraries to study as inspiration:
LibraryWhat to stealPowerSyncOverall architecture, mutation queue design, checkpoint/sequence system, client SDK shapewa-sqliteClient SQLite WASM + OPFS VFS implementationtldraw-syncDO + WebSocket room pattern, snapshot on connectLiveStoreEvent log as source of truth, Cloudflare adapterReplicacheOffline mutation queue, optimistic apply + server reconciliation pattern

What you'd be building that doesn't exist:
PowerSync requires Postgres + their hosted service. LiveStore has the one-user-one-DB limit. TinyBase has no write authority. Zero needs Postgres.
None of them are: DO-native, whole-DB sync, LWW, offline-first, with a clean write path, no external database required. That's the gap. Your version would be lighter than all of them and natively fit the Cloudflare ecosystem.so i do want to use an event sourcing approach?Apr 14Not necessarily — it depends on what you mean by event sourcing. There's a spectrum:
True event sourcing:

The log is the source of truth
Current state is derived by replaying all events
You never store "the current value of X", only "X was set to Y at time T"
Powerful but heavy — you need compaction, snapshots, replay logic

What you actually want (mutation log):

SQLite is the source of truth
The log is just a sync mechanism — a record of what changed so clients can catch up
Current state is just the table rows, not a replay
Much simpler

The difference is subtle but important:
Event sourcing:
state = replay(all_events_since_beginning)

Mutation log for sync:
state = sqlite_rows (the log just helps clients catch up)
PowerSync's approach is the second one — they maintain an ops log (ps_oplog) on the client as a sync mechanism, not as the source of truth. The actual data lives in regular SQLite tables. PowerSync
LiveStore does true event sourcing — the log is canonical and state is derived. That's why it's more complex and has the one-user-one-DB limitation.

For your use case: mutation log, not event sourcing.
Your DO's SQLite tables are the truth. The mutation log is just a WAL-style changelog that lets clients say "give me everything since sequence 42." You can GC old log entries once all clients have caught up. Clean, simple, no replay complexity.
