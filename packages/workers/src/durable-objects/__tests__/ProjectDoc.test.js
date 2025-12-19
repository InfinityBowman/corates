/**
 * Tests for ProjectDoc Durable Object
 * Focus: Y.js sync behavior for new users joining projects
 *
 * This test suite verifies that:
 * 1. Studies created before a user joins are synced to them
 * 2. The Y.js sync protocol correctly sends full state to new clients
 * 3. State persistence and restoration works correctly
 */

import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';

// Message types matching ProjectDoc.js
const messageSync = 0;

/**
 * Helper to create a Y.Doc with studies (simulates server state)
 */
function createDocWithStudies(studyCount = 3) {
  const doc = new Y.Doc();
  const studiesMap = doc.getMap('reviews');
  const metaMap = doc.getMap('meta');

  // Add project metadata
  metaMap.set('name', 'Test Project');
  metaMap.set('createdAt', Date.now());

  // Add some studies
  for (let i = 0; i < studyCount; i++) {
    const studyId = `study-${i}`;
    const studyYMap = new Y.Map();
    studyYMap.set('name', `Study ${i}`);
    studyYMap.set('description', `Description for study ${i}`);
    studyYMap.set('createdAt', Date.now() - (studyCount - i) * 1000);
    studyYMap.set('updatedAt', Date.now());
    studyYMap.set('checklists', new Y.Map());
    studiesMap.set(studyId, studyYMap);
  }

  return doc;
}

/**
 * Helper to create an empty Y.Doc (simulates new client state)
 */
function createEmptyDoc() {
  return new Y.Doc();
}

/**
 * Simulates the Y.js sync protocol exchange between server and client
 */
function simulateSyncProtocol(serverDoc, clientDoc) {
  // Step 1: Client sends sync step 1 (state vector) to server
  const clientEncoder = encoding.createEncoder();
  encoding.writeVarUint(clientEncoder, messageSync);
  syncProtocol.writeSyncStep1(clientEncoder, clientDoc);
  const clientSyncStep1 = encoding.toUint8Array(clientEncoder);

  // Server receives and processes sync step 1
  const serverDecoder = decoding.createDecoder(clientSyncStep1);
  const messageType = decoding.readVarUint(serverDecoder);

  expect(messageType).toBe(messageSync);

  // Server prepares response (sync step 2)
  const serverEncoder = encoding.createEncoder();
  encoding.writeVarUint(serverEncoder, messageSync);
  syncProtocol.readSyncMessage(serverDecoder, serverEncoder, serverDoc, null);

  // Server should have a response to send
  const responseLength = encoding.length(serverEncoder);

  if (responseLength > 1) {
    const serverResponse = encoding.toUint8Array(serverEncoder);

    // Client receives and processes server response
    const clientResponseDecoder = decoding.createDecoder(serverResponse);
    const responseType = decoding.readVarUint(clientResponseDecoder);

    expect(responseType).toBe(messageSync);

    const clientResponseEncoder = encoding.createEncoder();
    encoding.writeVarUint(clientResponseEncoder, messageSync);
    syncProtocol.readSyncMessage(clientResponseDecoder, clientResponseEncoder, clientDoc, null);
  }

  return { responseLength };
}

describe('ProjectDoc Y.js Sync Protocol', () => {
  describe('Initial sync for new users', () => {
    it('should sync all studies to a new client with empty state', () => {
      // Server has 3 studies
      const serverDoc = createDocWithStudies(3);

      // New client has empty state (simulates new user)
      const clientDoc = createEmptyDoc();

      // Verify server has studies, client doesn't
      expect(serverDoc.getMap('reviews').size).toBe(3);
      expect(clientDoc.getMap('reviews').size).toBe(0);

      // Simulate sync protocol
      simulateSyncProtocol(serverDoc, clientDoc);

      // Client should now have all studies
      const clientStudies = clientDoc.getMap('reviews');
      expect(clientStudies.size).toBe(3);

      // Verify study data is correct
      const study0 = clientStudies.get('study-0');
      expect(study0).toBeDefined();
      expect(study0.get('name')).toBe('Study 0');
    });

    it('should sync project metadata to new client', () => {
      const serverDoc = createDocWithStudies(1);
      const clientDoc = createEmptyDoc();

      simulateSyncProtocol(serverDoc, clientDoc);

      const clientMeta = clientDoc.getMap('meta');
      expect(clientMeta.get('name')).toBe('Test Project');
    });

    it('should handle server with many studies', () => {
      const serverDoc = createDocWithStudies(50);
      const clientDoc = createEmptyDoc();

      expect(serverDoc.getMap('reviews').size).toBe(50);
      expect(clientDoc.getMap('reviews').size).toBe(0);

      simulateSyncProtocol(serverDoc, clientDoc);

      expect(clientDoc.getMap('reviews').size).toBe(50);
    });

    it('should sync nested checklist data', () => {
      const serverDoc = createDocWithStudies(1);
      const studiesMap = serverDoc.getMap('reviews');
      const study = studiesMap.get('study-0');

      // Add a checklist to the study
      const checklistsMap = study.get('checklists');
      const checklistYMap = new Y.Map();
      checklistYMap.set('type', 'AMSTAR2');
      checklistYMap.set('assignedTo', 'user-123');
      checklistYMap.set('status', 'in_progress');
      checklistsMap.set('checklist-1', checklistYMap);

      const clientDoc = createEmptyDoc();
      simulateSyncProtocol(serverDoc, clientDoc);

      // Verify nested data synced
      const clientStudy = clientDoc.getMap('reviews').get('study-0');
      const clientChecklists = clientStudy.get('checklists');
      expect(clientChecklists.size).toBe(1);

      const clientChecklist = clientChecklists.get('checklist-1');
      expect(clientChecklist.get('type')).toBe('AMSTAR2');
      expect(clientChecklist.get('assignedTo')).toBe('user-123');
    });
  });

  describe('State persistence and restoration', () => {
    it('should correctly encode and restore full document state', () => {
      const originalDoc = createDocWithStudies(5);

      // Encode full state (as done in DO persistence)
      const fullState = Y.encodeStateAsUpdate(originalDoc);

      // Create new doc and restore state (as done when DO restarts)
      const restoredDoc = new Y.Doc();
      Y.applyUpdate(restoredDoc, fullState);

      // Verify all data restored
      expect(restoredDoc.getMap('reviews').size).toBe(5);
      expect(restoredDoc.getMap('meta').get('name')).toBe('Test Project');

      // Verify a new client can sync from restored doc
      const clientDoc = createEmptyDoc();
      simulateSyncProtocol(restoredDoc, clientDoc);
      expect(clientDoc.getMap('reviews').size).toBe(5);
    });

    it('should handle Array.from conversion for storage', () => {
      const originalDoc = createDocWithStudies(3);

      // Simulate DO storage: convert to Array, then back to Uint8Array
      const fullState = Y.encodeStateAsUpdate(originalDoc);
      const storedAsArray = [...fullState];
      const restoredUint8Array = new Uint8Array(storedAsArray);

      // Restore into new doc
      const restoredDoc = new Y.Doc();
      Y.applyUpdate(restoredDoc, restoredUint8Array);

      expect(restoredDoc.getMap('reviews').size).toBe(3);
    });
  });

  describe('Incremental updates after initial sync', () => {
    it('should sync new studies added after initial sync', () => {
      const serverDoc = createDocWithStudies(2);
      const clientDoc = createEmptyDoc();

      // Initial sync
      simulateSyncProtocol(serverDoc, clientDoc);
      expect(clientDoc.getMap('reviews').size).toBe(2);

      // Server adds a new study
      const studiesMap = serverDoc.getMap('reviews');
      const newStudyYMap = new Y.Map();
      newStudyYMap.set('name', 'New Study');
      newStudyYMap.set('createdAt', Date.now());
      studiesMap.set('study-new', newStudyYMap);

      expect(serverDoc.getMap('reviews').size).toBe(3);

      // Sync again
      simulateSyncProtocol(serverDoc, clientDoc);

      // Client should have the new study
      expect(clientDoc.getMap('reviews').size).toBe(3);
      expect(clientDoc.getMap('reviews').get('study-new')).toBeDefined();
    });

    it('should sync updates to existing studies', () => {
      const serverDoc = createDocWithStudies(1);
      const clientDoc = createEmptyDoc();

      // Initial sync
      simulateSyncProtocol(serverDoc, clientDoc);

      // Server updates the study
      const serverStudy = serverDoc.getMap('reviews').get('study-0');
      serverStudy.set('name', 'Updated Study Name');

      // Sync again
      simulateSyncProtocol(serverDoc, clientDoc);

      // Client should have the updated name
      const clientStudy = clientDoc.getMap('reviews').get('study-0');
      expect(clientStudy.get('name')).toBe('Updated Study Name');
    });
  });

  describe('Edge cases', () => {
    it('should handle sync when both docs are empty', () => {
      const serverDoc = createEmptyDoc();
      const clientDoc = createEmptyDoc();

      // Should not throw
      simulateSyncProtocol(serverDoc, clientDoc);

      expect(serverDoc.getMap('reviews').size).toBe(0);
      expect(clientDoc.getMap('reviews').size).toBe(0);
    });

    it('should handle client with stale data', () => {
      // Server has studies
      const serverDoc = createDocWithStudies(3);

      // Client has old state (maybe from IndexedDB)
      const clientDoc = new Y.Doc();
      const clientStudiesMap = clientDoc.getMap('reviews');
      const oldStudyYMap = new Y.Map();
      oldStudyYMap.set('name', 'Old Study');
      oldStudyYMap.set('createdAt', Date.now() - 100_000);
      clientStudiesMap.set('old-study', oldStudyYMap);

      expect(clientDoc.getMap('reviews').size).toBe(1);

      // Sync should merge states
      simulateSyncProtocol(serverDoc, clientDoc);

      // Client should have both old and new studies (Y.js merges)
      // The exact behavior depends on Y.js merge semantics
      // At minimum, server studies should be present
      expect(clientDoc.getMap('reviews').has('study-0')).toBe(true);
    });

    it('should correctly report when server has data to send', () => {
      const serverDoc = createDocWithStudies(3);
      const clientDoc = createEmptyDoc();

      const { responseLength } = simulateSyncProtocol(serverDoc, clientDoc);

      // Server should have had data to send (response > 1 byte)
      expect(responseLength).toBeGreaterThan(1);
    });
  });
});

describe('ProjectDoc State Vector Behavior', () => {
  it('should send full state when client has empty state vector', () => {
    const serverDoc = createDocWithStudies(5);
    const clientDoc = createEmptyDoc();

    // Get client's state vector (should be minimal/empty)
    const clientStateVector = Y.encodeStateVector(clientDoc);

    // Get update that server would send based on client's state vector
    const update = Y.encodeStateAsUpdate(serverDoc, clientStateVector);

    // Apply update to client
    Y.applyUpdate(clientDoc, update);

    // Client should now have all server data
    expect(clientDoc.getMap('reviews').size).toBe(5);
  });

  it('should send only diff when client has partial state', () => {
    const serverDoc = createDocWithStudies(2);

    // Client already has study-0 (simulating partial sync)
    const clientDoc = createEmptyDoc();
    const clientStudiesMap = clientDoc.getMap('reviews');
    const study0 = new Y.Map();
    study0.set('name', 'Study 0');
    study0.set('createdAt', Date.now());
    clientStudiesMap.set('study-0', study0);

    // Full sync should still work and add missing study
    simulateSyncProtocol(serverDoc, clientDoc);

    expect(clientDoc.getMap('reviews').size).toBeGreaterThanOrEqual(2);
  });
});

describe('Production Scenario: New User Joins Project', () => {
  /**
   * This test simulates the exact production scenario:
   * 1. User A creates project and adds studies
   * 2. User A adds User B as collaborator
   * 3. User B opens project (first time, empty IndexedDB)
   * 4. User B should see all studies
   */
  it('should sync all existing studies to newly added collaborator', () => {
    // === SERVER SIDE (Durable Object) ===
    // User A has been working on this project
    const serverDoc = new Y.Doc();

    // Add project metadata
    const metaMap = serverDoc.getMap('meta');
    metaMap.set('name', 'Research Project');
    metaMap.set('createdAt', Date.now() - 86_400_000); // Created yesterday

    // Add User A as owner
    const membersMap = serverDoc.getMap('members');
    const userAMember = new Y.Map();
    userAMember.set('role', 'owner');
    userAMember.set('joinedAt', Date.now() - 86_400_000);
    membersMap.set('user-a', userAMember);

    // User A adds 3 studies over time
    const studiesMap = serverDoc.getMap('reviews');

    const study1 = new Y.Map();
    study1.set('name', 'Study 1 - Added Yesterday');
    study1.set('createdAt', Date.now() - 86_400_000);
    study1.set('checklists', new Y.Map());
    studiesMap.set('study-1', study1);

    const study2 = new Y.Map();
    study2.set('name', 'Study 2 - Added This Morning');
    study2.set('createdAt', Date.now() - 3_600_000);
    study2.set('checklists', new Y.Map());
    studiesMap.set('study-2', study2);

    const study3 = new Y.Map();
    study3.set('name', 'Study 3 - Added Recently');
    study3.set('createdAt', Date.now() - 60_000);
    study3.set('checklists', new Y.Map());
    studiesMap.set('study-3', study3);

    // Simulate DO persistence (as happens on every update)
    // (state is persisted but we'll use the final state below)
    Y.encodeStateAsUpdate(serverDoc);

    // User A adds User B as collaborator
    const userBMember = new Y.Map();
    userBMember.set('role', 'collaborator');
    userBMember.set('joinedAt', Date.now());
    membersMap.set('user-b', userBMember);

    // Persist again after adding member
    const persistedStateAfterMember = [...Y.encodeStateAsUpdate(serverDoc)];

    // === SIMULATE DO RESTART (eviction) ===
    // Create new server doc from persisted state
    const restoredServerDoc = new Y.Doc();
    Y.applyUpdate(restoredServerDoc, new Uint8Array(persistedStateAfterMember));

    // Verify server has all data after restart
    expect(restoredServerDoc.getMap('reviews').size).toBe(3);
    expect(restoredServerDoc.getMap('members').size).toBe(2);

    // === CLIENT SIDE (User B's browser) ===
    // User B opens project for the first time
    // Their IndexedDB is empty, so they start with empty Y.Doc
    const userBClientDoc = new Y.Doc();

    // User B's client syncs with server
    simulateSyncProtocol(restoredServerDoc, userBClientDoc);

    // === VERIFICATION ===
    // User B should see all 3 studies
    const userBStudies = userBClientDoc.getMap('reviews');
    expect(userBStudies.size).toBe(3);
    expect(userBStudies.get('study-1').get('name')).toBe('Study 1 - Added Yesterday');
    expect(userBStudies.get('study-2').get('name')).toBe('Study 2 - Added This Morning');
    expect(userBStudies.get('study-3').get('name')).toBe('Study 3 - Added Recently');

    // User B should see both members
    const userBMembers = userBClientDoc.getMap('members');
    expect(userBMembers.size).toBe(2);
    expect(userBMembers.has('user-a')).toBe(true);
    expect(userBMembers.has('user-b')).toBe(true);
  });

  it('should sync studies when User B has stale IndexedDB data from different project', () => {
    // Server has project data
    const serverDoc = createDocWithStudies(3);

    // User B's client has stale data from a DIFFERENT project in IndexedDB
    // This shouldn't happen in practice, but let's verify Y.js handles it
    const clientDoc = new Y.Doc();
    const staleStudies = clientDoc.getMap('reviews');
    const staleStudy = new Y.Map();
    staleStudy.set('name', 'Stale Study From Different Context');
    staleStudy.set('createdAt', Date.now() - 999_999_999);
    // Note: Using different clientID means this is treated as separate data
    staleStudies.set('stale-study-id', staleStudy);

    // Sync should merge/add server studies
    simulateSyncProtocol(serverDoc, clientDoc);

    // Client should have server's studies
    expect(clientDoc.getMap('reviews').has('study-0')).toBe(true);
    expect(clientDoc.getMap('reviews').has('study-1')).toBe(true);
    expect(clientDoc.getMap('reviews').has('study-2')).toBe(true);
  });

  it('should handle rapid member addition and immediate connection', () => {
    // Server has studies
    const serverDoc = createDocWithStudies(5);
    const membersMap = serverDoc.getMap('members');

    // Add owner
    const owner = new Y.Map();
    owner.set('role', 'owner');
    membersMap.set('owner-id', owner);

    // Add new member (this happens via /sync-member endpoint)
    const newMember = new Y.Map();
    newMember.set('role', 'collaborator');
    newMember.set('joinedAt', Date.now());
    membersMap.set('new-member-id', newMember);

    // New member connects IMMEDIATELY after being added
    const clientDoc = createEmptyDoc();
    simulateSyncProtocol(serverDoc, clientDoc);

    // Should have all studies
    expect(clientDoc.getMap('reviews').size).toBe(5);
    // Should see themselves as member
    expect(clientDoc.getMap('members').has('new-member-id')).toBe(true);
  });
});

describe('Debugging: State Vector Analysis', () => {
  it('should show state vector sizes for debugging', () => {
    const serverDoc = createDocWithStudies(3);
    const clientDoc = createEmptyDoc();

    // Log state vectors for debugging
    const serverSV = Y.encodeStateVector(serverDoc);
    const clientSV = Y.encodeStateVector(clientDoc);

    console.log('Server state vector length:', serverSV.length);
    console.log('Client state vector length:', clientSV.length);

    // Server should have non-trivial state vector
    expect(serverSV.length).toBeGreaterThan(0);

    // Client with empty doc should have minimal state vector
    // (just the client ID header)
    expect(clientSV.length).toBeLessThan(serverSV.length);

    // After sync, client state vector should match server
    simulateSyncProtocol(serverDoc, clientDoc);
    const clientSVAfterSync = Y.encodeStateVector(clientDoc);

    console.log('Client state vector length after sync:', clientSVAfterSync.length);

    // State vectors should be similar (may not be exactly equal due to client IDs)
    expect(clientSVAfterSync.length).toBeGreaterThan(clientSV.length);
  });

  it('should correctly identify missing updates from state vector diff', () => {
    const serverDoc = createDocWithStudies(5);
    const clientDoc = createEmptyDoc();

    // Get what server would send to client
    const clientSV = Y.encodeStateVector(clientDoc);
    const updateForClient = Y.encodeStateAsUpdate(serverDoc, clientSV);

    console.log('Update size for empty client:', updateForClient.length, 'bytes');

    // Apply update
    Y.applyUpdate(clientDoc, updateForClient);

    // Client should now have all data
    expect(clientDoc.getMap('reviews').size).toBe(5);

    // Now get what server would send if client already synced
    const clientSVAfterSync = Y.encodeStateVector(clientDoc);
    const updateForSyncedClient = Y.encodeStateAsUpdate(serverDoc, clientSVAfterSync);

    console.log('Update size for synced client:', updateForSyncedClient.length, 'bytes');

    // Update for synced client should be minimal (just header)
    expect(updateForSyncedClient.length).toBeLessThan(updateForClient.length);
  });
});
