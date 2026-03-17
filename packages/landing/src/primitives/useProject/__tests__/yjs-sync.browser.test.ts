/**
 * Yjs browser integration tests
 *
 * These tests run in a real Chromium browser via Vitest Browser Mode.
 * They verify behavior that cannot be tested under jsdom:
 *   - IndexedDB persistence via Dexie + y-dexie
 *   - Y.Doc -> Zustand projectStore sync pipeline
 *   - Multi-client sync convergence
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as Y from 'yjs';
import Dexie from 'dexie';
import yDexie from 'y-dexie';
import { DexieYProvider } from 'y-dexie';
import { createSyncManager } from '../sync';
import { useProjectStore } from '@/stores/projectStore';

// --- helpers ---

const TEST_DB_NAME = 'corates-browser-test';

/** Disposable Dexie database scoped to a single test */
class TestDB extends Dexie {
  projects!: Dexie.Table;

  constructor() {
    super(TEST_DB_NAME, { addons: [yDexie] });
    this.version(1).stores({
      projects: 'id, ydoc: Y.Doc',
    });
  }
}

/** Populate a Y.Doc with studies, meta, and members */
function populateDoc(ydoc: Y.Doc, { studyCount = 2, projectName = 'Test Project' } = {}) {
  const meta = ydoc.getMap('meta');
  meta.set('name', projectName);
  meta.set('createdAt', Date.now());

  const members = ydoc.getMap('members');
  const owner = new Y.Map();
  owner.set('role', 'owner');
  owner.set('name', 'Test User');
  owner.set('email', 'test@example.com');
  owner.set('joinedAt', Date.now());
  members.set('user-1', owner);

  const reviews = ydoc.getMap('reviews');
  for (let i = 0; i < studyCount; i++) {
    const study = new Y.Map();
    study.set('name', `Study ${i}`);
    study.set('description', `Description ${i}`);
    study.set('createdAt', Date.now() - (studyCount - i) * 1000);
    study.set('updatedAt', Date.now());
    study.set('checklists', new Y.Map());
    reviews.set(`study-${i}`, study);
  }
}

// --- tests ---

describe('Y.Doc <-> IndexedDB persistence (Dexie + y-dexie)', () => {
  let db: TestDB;

  beforeEach(async () => {
    db = new TestDB();
    await db.open();
  });

  afterEach(async () => {
    if (db?.isOpen()) db.close();
    await Dexie.delete(TEST_DB_NAME);
  });

  it('round-trips a Y.Doc through IndexedDB', async () => {
    const projectId = crypto.randomUUID();

    // Write phase: create a Y.Doc, populate it, persist via y-dexie
    const writeDoc = new Y.Doc();
    populateDoc(writeDoc, { studyCount: 3, projectName: 'Persistence Test' });

    await db.projects.put({ id: projectId });
    const row = await db.projects.get(projectId);
    const provider = DexieYProvider.load(row.ydoc);
    await provider.whenLoaded;

    const state = Y.encodeStateAsUpdate(writeDoc);
    Y.applyUpdate(row.ydoc, state);

    // Small delay for Dexie to flush
    await new Promise(r => setTimeout(r, 100));

    // Read phase: load back from the same database
    const readRow = await db.projects.get(projectId);
    const readProvider = DexieYProvider.load(readRow.ydoc);
    await readProvider.whenLoaded;

    const readDoc = new Y.Doc();
    const persistedState = Y.encodeStateAsUpdate(readRow.ydoc);
    Y.applyUpdate(readDoc, persistedState);

    expect(readDoc.getMap('reviews').size).toBe(3);
    expect(readDoc.getMap('meta').get('name')).toBe('Persistence Test');
    expect(readDoc.getMap('members').size).toBe(1);

    const study0 = readDoc.getMap('reviews').get('study-0') as Y.Map<unknown>;
    expect(study0.get('name')).toBe('Study 0');
    expect(study0.get('checklists')).toBeDefined();

    writeDoc.destroy();
    readDoc.destroy();
  });

  it('persists incremental updates', async () => {
    const projectId = crypto.randomUUID();

    const doc = new Y.Doc();
    populateDoc(doc, { studyCount: 1 });

    await db.projects.put({ id: projectId });
    const row = await db.projects.get(projectId);
    const provider = DexieYProvider.load(row.ydoc);
    await provider.whenLoaded;

    Y.applyUpdate(row.ydoc, Y.encodeStateAsUpdate(doc));
    await new Promise(r => setTimeout(r, 50));

    // Add another study (incremental update)
    const reviews = doc.getMap('reviews');
    const newStudy = new Y.Map();
    newStudy.set('name', 'Incremental Study');
    newStudy.set('createdAt', Date.now());
    newStudy.set('checklists', new Y.Map());
    reviews.set('study-inc', newStudy);

    Y.applyUpdate(row.ydoc, Y.encodeStateAsUpdate(doc));
    await new Promise(r => setTimeout(r, 100));

    // Reload and verify
    const readRow = await db.projects.get(projectId);
    const readProvider = DexieYProvider.load(readRow.ydoc);
    await readProvider.whenLoaded;

    const readDoc = new Y.Doc();
    Y.applyUpdate(readDoc, Y.encodeStateAsUpdate(readRow.ydoc));

    expect(readDoc.getMap('reviews').size).toBe(2);
    expect((readDoc.getMap('reviews').get('study-inc') as Y.Map<unknown>).get('name')).toBe(
      'Incremental Study',
    );

    doc.destroy();
    readDoc.destroy();
  });
});

describe('Y.Doc -> Zustand projectStore sync pipeline', () => {
  const projectId = 'sync-test-' + Date.now();

  afterEach(() => {
    useProjectStore.getState().clearProject(projectId);
  });

  it('syncFromYDoc populates store with studies, meta, and members', () => {
    const ydoc = new Y.Doc();
    populateDoc(ydoc, { studyCount: 3, projectName: 'Sync Pipeline Test' });

    const syncManager = createSyncManager(projectId, () => ydoc);
    syncManager.syncFromYDoc();

    const state = useProjectStore.getState();
    const data = state.projects[projectId];
    expect(data).toBeDefined();
    expect(data.studies).toHaveLength(3);
    expect(data.meta.name).toBe('Sync Pipeline Test');
    expect(data.members).toHaveLength(1);
    expect((data.members[0] as { userId: string }).userId).toBe('user-1');

    const study = data.studies.find(s => s.id === 'study-0');
    expect(study).toBeDefined();
    expect(study!.name).toBe('Study 0');
    expect(study!.checklists).toEqual([]);

    ydoc.destroy();
  });

  it('re-sync picks up studies added after initial sync', () => {
    const ydoc = new Y.Doc();
    populateDoc(ydoc, { studyCount: 1 });

    const syncManager = createSyncManager(projectId, () => ydoc);
    syncManager.syncFromYDoc();

    expect(useProjectStore.getState().projects[projectId].studies).toHaveLength(1);

    // Add a study directly to the Y.Doc
    const reviews = ydoc.getMap('reviews');
    const newStudy = new Y.Map();
    newStudy.set('name', 'Added Later');
    newStudy.set('createdAt', Date.now());
    newStudy.set('checklists', new Y.Map());
    reviews.set('study-later', newStudy);

    syncManager.syncFromYDoc();

    const studies = useProjectStore.getState().projects[projectId].studies;
    expect(studies).toHaveLength(2);
    expect(studies.find(s => s.id === 'study-later')!.name).toBe('Added Later');

    ydoc.destroy();
  });

  it('syncs nested checklist data', () => {
    const ydoc = new Y.Doc();
    const reviews = ydoc.getMap('reviews');
    const meta = ydoc.getMap('meta');
    meta.set('name', 'Checklist Test');
    ydoc.getMap('members');

    const study = new Y.Map();
    study.set('name', 'Study With Checklist');
    study.set('createdAt', Date.now());

    const checklists = new Y.Map();
    const checklist = new Y.Map();
    checklist.set('type', 'AMSTAR2');
    checklist.set('assignedTo', 'user-1');
    checklist.set('status', 'in_progress');
    checklist.set('createdAt', Date.now());
    checklists.set('cl-1', checklist);

    study.set('checklists', checklists);
    reviews.set('study-cl', study);

    const syncManager = createSyncManager(projectId, () => ydoc);
    syncManager.syncFromYDoc();

    const state = useProjectStore.getState();
    const syncedStudy = state.projects[projectId].studies.find(s => s.id === 'study-cl');
    expect(syncedStudy!.checklists).toHaveLength(1);
    expect(syncedStudy!.checklists![0].type).toBe('AMSTAR2');
    expect(syncedStudy!.checklists![0].status).toBe('in_progress');

    ydoc.destroy();
  });
});

describe('Multi-client Y.Doc sync (in-memory, no server)', () => {
  it('two Y.Docs converge via update exchange', () => {
    const docA = new Y.Doc();
    const docB = new Y.Doc();

    // Bidirectional sync (simulates what y-websocket does)
    docA.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin !== 'remote') Y.applyUpdate(docB, update, 'remote');
    });
    docB.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin !== 'remote') Y.applyUpdate(docA, update, 'remote');
    });

    // Client A adds a study
    const reviewsA = docA.getMap('reviews');
    const studyA = new Y.Map();
    studyA.set('name', 'From Client A');
    studyA.set('createdAt', Date.now());
    studyA.set('checklists', new Y.Map());
    reviewsA.set('study-a', studyA);

    // Client B should see it immediately
    expect(docB.getMap('reviews').size).toBe(1);
    expect((docB.getMap('reviews').get('study-a') as Y.Map<unknown>).get('name')).toBe(
      'From Client A',
    );

    // Client B adds a study
    const reviewsB = docB.getMap('reviews');
    const studyB = new Y.Map();
    studyB.set('name', 'From Client B');
    studyB.set('createdAt', Date.now());
    studyB.set('checklists', new Y.Map());
    reviewsB.set('study-b', studyB);

    // Both should have both studies
    expect(docA.getMap('reviews').size).toBe(2);
    expect(docB.getMap('reviews').size).toBe(2);
    expect((docA.getMap('reviews').get('study-b') as Y.Map<unknown>).get('name')).toBe(
      'From Client B',
    );

    docA.destroy();
    docB.destroy();
  });

  it('concurrent edits to the same field resolve consistently', () => {
    const docA = new Y.Doc();
    const docB = new Y.Doc();

    // Initial state
    const reviews = docA.getMap('reviews');
    const study = new Y.Map();
    study.set('name', 'Original');
    study.set('createdAt', Date.now());
    study.set('checklists', new Y.Map());
    reviews.set('study-1', study);

    // Sync initial state to B
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));

    // Wire bidirectional sync
    docA.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin !== 'remote') Y.applyUpdate(docB, update, 'remote');
    });
    docB.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin !== 'remote') Y.applyUpdate(docA, update, 'remote');
    });

    // Both clients edit the same field
    (docA.getMap('reviews').get('study-1') as Y.Map<unknown>).set('name', 'Edited by A');
    (docB.getMap('reviews').get('study-1') as Y.Map<unknown>).set('name', 'Edited by B');

    // Yjs guarantees convergence
    const nameA = (docA.getMap('reviews').get('study-1') as Y.Map<unknown>).get('name');
    const nameB = (docB.getMap('reviews').get('study-1') as Y.Map<unknown>).get('name');
    expect(nameA).toBe(nameB);

    docA.destroy();
    docB.destroy();
  });

  it('delete and add operations from different clients merge correctly', () => {
    const docA = new Y.Doc();
    const docB = new Y.Doc();

    // Seed with 3 studies
    populateDoc(docA, { studyCount: 3 });
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));

    // Bidirectional sync
    docA.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin !== 'remote') Y.applyUpdate(docB, update, 'remote');
    });
    docB.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin !== 'remote') Y.applyUpdate(docA, update, 'remote');
    });

    // Client A deletes study-0
    docA.getMap('reviews').delete('study-0');

    // Client B adds study-3
    const newStudy = new Y.Map();
    newStudy.set('name', 'Study 3');
    newStudy.set('createdAt', Date.now());
    newStudy.set('checklists', new Y.Map());
    docB.getMap('reviews').set('study-3', newStudy);

    // Both converge: study-0 deleted, study-1 + study-2 remain, study-3 added
    expect(docA.getMap('reviews').size).toBe(3);
    expect(docB.getMap('reviews').size).toBe(3);
    expect(docA.getMap('reviews').has('study-0')).toBe(false);
    expect(docA.getMap('reviews').has('study-3')).toBe(true);

    docA.destroy();
    docB.destroy();
  });
});
