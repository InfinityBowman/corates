/**
 * useProject hook - Manages Y.js connection and operations for a single project
 */

import { createEffect, onCleanup, createMemo } from 'solid-js';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { createChecklist as createAMSTAR2Answers } from '../AMSTAR2/checklist.js';
import { getWsBaseUrl } from '@config/api.js';
import projectStore from './projectStore.js';
import useOnlineStatus from './useOnlineStatus.js';

/**
 * Hook to connect to a project's Y.Doc and manage studies/checklists
 * Note: Y.js map key remains 'reviews' for backward compatibility with existing data
 * @param {string} projectId - The project ID to connect to
 * @returns {Object} Project state and operations
 */
export function useProject(projectId) {
  // Check if this is a local-only project
  const isLocalProject = () => projectId && projectId.startsWith('local-');

  let ws = null;
  let ydoc = null;
  let indexeddbProvider = null;
  let reconnectTimeout = null;
  let reconnectAttempts = 0;
  let shouldReconnect = false; // Track if we should reconnect when online
  const MAX_RECONNECT_ATTEMPTS = 10;
  const BASE_RECONNECT_DELAY = 1000; // Start with 1 second

  const isOnline = useOnlineStatus();

  // Reactive getters from store
  const connectionState = createMemo(() => projectStore.getConnectionState(projectId));
  const connected = () => connectionState().connected;
  const connecting = () => connectionState().connecting;
  const synced = () => connectionState().synced;
  const error = () => connectionState().error;

  const projectData = createMemo(() => projectStore.getProject(projectId));
  const studies = () => projectData()?.studies || [];
  const meta = () => projectData()?.meta || {};
  const members = () => projectData()?.members || [];

  // Get reconnect delay with exponential backoff (max 30 seconds)
  function getReconnectDelay() {
    const delay = Math.min(BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts), 30000);
    return delay;
  }

  // Sync Y.Doc state to store
  function syncFromYDoc() {
    if (!ydoc) return;

    // Note: Y.js map key remains 'reviews' for backward compatibility
    const studiesMap = ydoc.getMap('reviews');
    const studiesList = [];

    // Debug: log all root-level maps
    const allMaps = Array.from(ydoc.share.keys());
    console.log(`[Project ${projectId}] syncFromYDoc: Y.Doc has maps:`, allMaps);
    console.log(`[Project ${projectId}] syncFromYDoc: 'reviews' map size: ${studiesMap.size}`);

    for (const [studyId, studyYMap] of studiesMap.entries()) {
      const studyData = studyYMap.toJSON ? studyYMap.toJSON() : studyYMap;
      const study = {
        id: studyId,
        name: studyData.name || '',
        description: studyData.description || '',
        // Reference metadata fields
        firstAuthor: studyData.firstAuthor || null,
        publicationYear: studyData.publicationYear || null,
        authors: studyData.authors || null,
        journal: studyData.journal || null,
        doi: studyData.doi || null,
        abstract: studyData.abstract || null,
        importSource: studyData.importSource || null,
        // Reviewer assignments
        reviewer1: studyData.reviewer1 || null,
        reviewer2: studyData.reviewer2 || null,
        createdAt: studyData.createdAt,
        updatedAt: studyData.updatedAt,
        checklists: [],
        pdfs: [],
      };

      // Get checklists from nested Y.Map
      const checklistsMap = studyYMap.get ? studyYMap.get('checklists') : null;
      if (checklistsMap && typeof checklistsMap.entries === 'function') {
        for (const [checklistId, checklistYMap] of checklistsMap.entries()) {
          const checklistData = checklistYMap.toJSON ? checklistYMap.toJSON() : checklistYMap;
          study.checklists.push({
            id: checklistId,
            type: checklistData.type || 'AMSTAR2',
            assignedTo: checklistData.assignedTo || null,
            status: checklistData.status || 'pending',
            createdAt: checklistData.createdAt,
            updatedAt: checklistData.updatedAt,
          });
        }
      }

      // Get PDFs from nested Y.Map
      const pdfsMap = studyYMap.get ? studyYMap.get('pdfs') : null;
      if (pdfsMap && typeof pdfsMap.entries === 'function') {
        for (const [fileName, pdfYMap] of pdfsMap.entries()) {
          const pdfData = pdfYMap.toJSON ? pdfYMap.toJSON() : pdfYMap;
          study.pdfs.push({
            fileName,
            key: pdfData.key,
            size: pdfData.size,
            uploadedBy: pdfData.uploadedBy,
            uploadedAt: pdfData.uploadedAt,
          });
        }
      }

      // Get reconciliation progress if any
      const reconciliationMap = studyYMap.get ? studyYMap.get('reconciliation') : null;
      if (reconciliationMap) {
        const reconciliationData =
          reconciliationMap.toJSON ? reconciliationMap.toJSON() : reconciliationMap;
        if (reconciliationData.checklist1Id && reconciliationData.checklist2Id) {
          study.reconciliation = {
            checklist1Id: reconciliationData.checklist1Id,
            checklist2Id: reconciliationData.checklist2Id,
            currentPage: reconciliationData.currentPage || 0,
            viewMode: reconciliationData.viewMode || 'questions',
            updatedAt: reconciliationData.updatedAt,
          };
        }
      }

      studiesList.push(study);
    }

    // Sort by createdAt
    studiesList.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    // Sync meta
    const metaMap = ydoc.getMap('meta');
    const metaData = metaMap.toJSON ? metaMap.toJSON() : {};

    // Sync members
    const membersMap = ydoc.getMap('members');
    const membersList = [];
    for (const [userId, memberYMap] of membersMap.entries()) {
      const memberData = memberYMap.toJSON ? memberYMap.toJSON() : memberYMap;
      membersList.push({
        userId,
        role: memberData.role,
        joinedAt: memberData.joinedAt,
        name: memberData.name,
        email: memberData.email,
        displayName: memberData.displayName,
        image: memberData.image,
      });
    }

    // Update store with all data
    projectStore.setProjectData(projectId, {
      studies: studiesList,
      meta: metaData,
      members: membersList,
    });
  }

  // Clear reconnect timeout helper
  function clearReconnectTimeout() {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
  }

  // Setup WebSocket connection (can be called multiple times for reconnection)
  function setupWebSocket() {
    if (!ydoc || isLocalProject()) return;

    // Build WebSocket URL
    const wsUrl = `${getWsBaseUrl()}/api/project/${projectId}`;

    ws = new WebSocket(wsUrl);
    projectStore.setConnectionState(projectId, { connecting: true });

    ws.onopen = () => {
      console.log(`[Project ${projectId}] WebSocket connected`);
      projectStore.setConnectionState(projectId, { connecting: false, connected: true });
      reconnectAttempts = 0; // Reset on successful connection

      // Send any local state that might exist from IndexedDB
      // This ensures local changes are synced to server after connection
      if (ydoc) {
        const localState = Y.encodeStateAsUpdate(ydoc);
        if (localState.length > 0) {
          console.log(
            `[Project ${projectId}] Sending local state to server on connect, size: ${localState.length} bytes`,
          );
          ws.send(JSON.stringify({ type: 'update', update: Array.from(localState) }));
        }
      }
    };

    ws.onmessage = event => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'sync' || data.type === 'update') {
          console.log(
            `[Project ${projectId}] Received ${data.type}, update size: ${data.update?.length} bytes`,
          );
          const update = new Uint8Array(data.update);
          // Apply with 'remote' origin - syncFromYDoc will be called by the update handler
          Y.applyUpdate(ydoc, update, 'remote');

          // Log ALL root-level maps after applying update
          const allMapKeys = Array.from(ydoc.share.keys());
          const mapSizes = {};
          allMapKeys.forEach(key => {
            const map = ydoc.getMap(key);
            mapSizes[key] = map.size;
          });
          console.log(`[Project ${projectId}] After ${data.type}, Y.Doc maps:`, mapSizes);
        } else if (data.type === 'error') {
          projectStore.setConnectionState(projectId, { error: data.message });
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };
    ws.onclose = event => {
      projectStore.setConnectionState(projectId, { connected: false, connecting: false });

      // If we got a 403 (not a member), clear IndexedDB and don't reconnect
      if (event.code === 1008 || event.reason?.includes('member')) {
        console.log(`[Project ${projectId}] Access denied - not a member. Clearing local data.`);
        if (indexeddbProvider) {
          indexeddbProvider.clearData();
        }
        projectStore.setConnectionState(projectId, {
          error: 'You are not a member of this project',
        });
        shouldReconnect = false;
        return;
      }

      // Don't reconnect if it was a clean close (code 1000) or if we've exceeded max attempts
      const isCleanClose = event.code === 1000;
      if (isCleanClose || reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          projectStore.setConnectionState(projectId, {
            error: 'Maximum reconnection attempts reached. Please refresh the page.',
          });
        }
        shouldReconnect = false;
        return;
      }

      // Mark that we should reconnect
      shouldReconnect = true;

      // If we're offline, wait for online event instead of attempting now
      if (!isOnline()) {
        console.log('WebSocket closed while offline. Will reconnect when online.');
        projectStore.setConnectionState(projectId, {
          error: 'Offline - will reconnect when online',
        });
        return;
      }

      // Attempt to reconnect with exponential backoff
      reconnectAttempts++;
      const delay = getReconnectDelay();
      console.log(
        `WebSocket closed. Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`,
      );

      reconnectTimeout = setTimeout(() => {
        // Clean up old WebSocket before reconnecting
        if (ws) {
          ws.onclose = null;
          ws.onerror = null;
          ws.onmessage = null;
          ws = null;
        }

        // Reconnect by calling setupWebSocket again
        setupWebSocket();
      }, delay);
    };

    ws.onerror = err => {
      console.error('WebSocket error:', err);
      projectStore.setConnectionState(projectId, {
        error: 'Connection error',
        connected: false,
        connecting: false,
      });
    };
  }

  // Connect to the project's WebSocket (or just IndexedDB for local projects)
  function connect() {
    if (ydoc || !projectId) return;

    // Clear any pending reconnection attempts
    clearReconnectTimeout();

    // Set this as the active project
    projectStore.setActiveProject(projectId);
    projectStore.setConnectionState(projectId, { connecting: true, error: null });

    ydoc = new Y.Doc();

    // Set up IndexedDB persistence for offline support
    indexeddbProvider = new IndexeddbPersistence(`corates-project-${projectId}`, ydoc);

    indexeddbProvider.whenSynced.then(() => {
      projectStore.setConnectionState(projectId, { synced: true });
      // Sync UI from locally persisted data immediately
      syncFromYDoc();

      // For local projects, we're "connected" once IndexedDB is synced
      if (isLocalProject()) {
        projectStore.setConnectionState(projectId, { connecting: false, connected: true });
      }
    });

    // For local projects, don't connect to WebSocket
    if (isLocalProject()) {
      // Listen for local Y.Doc changes (no WebSocket sync)
      ydoc.on('update', () => {
        syncFromYDoc();
      });
      return;
    }

    // Initial WebSocket setup
    setupWebSocket();

    // Listen for local Y.Doc changes
    ydoc.on('update', (update, origin) => {
      // Only send if the update originated locally (not from WebSocket)
      if (origin !== 'remote' && ws && ws.readyState === WebSocket.OPEN) {
        console.log(
          `[Project ${projectId}] Sending local update via WebSocket, size: ${update.length} bytes`,
        );
        ws.send(JSON.stringify({ type: 'update', update: Array.from(update) }));
      }
      syncFromYDoc();
    });
  }

  // Disconnect from WebSocket
  function disconnect() {
    clearReconnectTimeout();
    shouldReconnect = false;

    if (ws) {
      // Set handlers to null to prevent reconnection on close
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      ws.close(1000); // Clean close code
      ws = null;
    }
    if (indexeddbProvider) {
      indexeddbProvider.destroy();
      indexeddbProvider = null;
    }
    if (ydoc) {
      ydoc.destroy();
      ydoc = null;
    }

    reconnectAttempts = 0;
    projectStore.setConnectionState(projectId, { connected: false, synced: false });
  }

  // Create a new study
  // metadata can include: firstAuthor, publicationYear, authors, journal, doi, abstract, importSource
  function createStudy(name, description = '', metadata = {}) {
    if (!ydoc) return null;
    // Allow writes if Y.js doc is synced from IndexedDB (local-first)
    // Changes will sync to server when WebSocket reconnects
    if (!synced()) return null;

    const studyId = crypto.randomUUID();
    const now = Date.now();

    console.log(`[Project ${projectId}] Creating study: ${name}`);

    // Note: Y.js map key remains 'reviews' for backward compatibility
    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = new Y.Map();

    studyYMap.set('name', name);
    studyYMap.set('description', description);
    studyYMap.set('createdAt', now);
    studyYMap.set('updatedAt', now);
    studyYMap.set('checklists', new Y.Map());

    // Set optional reference metadata fields
    if (metadata.firstAuthor) studyYMap.set('firstAuthor', metadata.firstAuthor);
    if (metadata.publicationYear) studyYMap.set('publicationYear', metadata.publicationYear);
    if (metadata.authors) studyYMap.set('authors', metadata.authors);
    if (metadata.journal) studyYMap.set('journal', metadata.journal);
    if (metadata.doi) studyYMap.set('doi', metadata.doi);
    if (metadata.abstract) studyYMap.set('abstract', metadata.abstract);
    if (metadata.importSource) studyYMap.set('importSource', metadata.importSource);

    studiesMap.set(studyId, studyYMap);

    return studyId;
  }

  // Update a study
  function updateStudy(studyId, updates) {
    if (!ydoc) return;
    if (!synced()) return;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId);

    if (!studyYMap) return;

    if (updates.name !== undefined) studyYMap.set('name', updates.name);
    if (updates.description !== undefined) studyYMap.set('description', updates.description);
    // Reference metadata fields
    if (updates.firstAuthor !== undefined) studyYMap.set('firstAuthor', updates.firstAuthor);
    if (updates.publicationYear !== undefined)
      studyYMap.set('publicationYear', updates.publicationYear);
    if (updates.authors !== undefined) studyYMap.set('authors', updates.authors);
    if (updates.journal !== undefined) studyYMap.set('journal', updates.journal);
    if (updates.doi !== undefined) studyYMap.set('doi', updates.doi);
    if (updates.abstract !== undefined) studyYMap.set('abstract', updates.abstract);
    // Reviewer assignment fields
    if (updates.reviewer1 !== undefined) studyYMap.set('reviewer1', updates.reviewer1);
    if (updates.reviewer2 !== undefined) studyYMap.set('reviewer2', updates.reviewer2);
    studyYMap.set('updatedAt', Date.now());
  }

  // Update project settings (stored in meta map)
  function updateProjectSettings(settings) {
    if (!ydoc) return;
    if (!synced()) return;

    const metaMap = ydoc.getMap('meta');
    for (const [key, value] of Object.entries(settings)) {
      metaMap.set(key, value);
    }
    metaMap.set('updatedAt', Date.now());
  }

  // Delete a study
  function deleteStudy(studyId) {
    if (!ydoc) return;
    if (!synced()) return;

    const studiesMap = ydoc.getMap('reviews');
    studiesMap.delete(studyId);
  }

  // Add PDF metadata to a study (called after successful upload to R2)
  function addPdfToStudy(studyId, pdfInfo) {
    if (!ydoc) return;
    if (!synced()) return;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId);
    if (!studyYMap) return;

    let pdfsMap = studyYMap.get('pdfs');
    if (!pdfsMap) {
      pdfsMap = new Y.Map();
      studyYMap.set('pdfs', pdfsMap);
    }

    const pdfYMap = new Y.Map();
    pdfYMap.set('key', pdfInfo.key);
    pdfYMap.set('fileName', pdfInfo.fileName);
    pdfYMap.set('size', pdfInfo.size);
    pdfYMap.set('uploadedBy', pdfInfo.uploadedBy);
    pdfYMap.set('uploadedAt', pdfInfo.uploadedAt || Date.now());
    pdfsMap.set(pdfInfo.fileName, pdfYMap);

    studyYMap.set('updatedAt', Date.now());
  }

  // Remove PDF metadata from a study (called after successful delete from R2)
  function removePdfFromStudy(studyId, fileName) {
    if (!ydoc) return;
    if (!synced()) return;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId);
    if (!studyYMap) return;

    const pdfsMap = studyYMap.get('pdfs');
    if (pdfsMap) {
      pdfsMap.delete(fileName);
    }

    studyYMap.set('updatedAt', Date.now());
  }

  // Create a checklist in a study
  function createChecklist(studyId, type = 'AMSTAR2', assignedTo = null) {
    if (!ydoc) return null;
    if (!synced()) return null;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId);

    if (!studyYMap) return null;

    let checklistsMap = studyYMap.get('checklists');
    if (!checklistsMap) {
      checklistsMap = new Y.Map();
      studyYMap.set('checklists', checklistsMap);
    }

    const checklistId = crypto.randomUUID();
    const now = Date.now();

    // Get the default answers structure for this checklist type
    let answersData = {};
    if (type === 'AMSTAR2') {
      const amstar2 = createAMSTAR2Answers({
        id: checklistId,
        name: `${type} Checklist`,
        createdAt: now,
      });
      // Extract only the question answers (q1, q2, etc.)
      Object.entries(amstar2).forEach(([key, value]) => {
        if (/^q\d+[a-z]*$/i.test(key)) {
          answersData[key] = value;
        }
      });
    }

    const checklistYMap = new Y.Map();
    checklistYMap.set('type', type);
    checklistYMap.set('assignedTo', assignedTo);
    checklistYMap.set('status', 'pending');
    checklistYMap.set('createdAt', now);
    checklistYMap.set('updatedAt', now);

    // Store answers as a Y.Map with each question as a nested Y.Map
    const answersYMap = new Y.Map();
    Object.entries(answersData).forEach(([questionKey, questionData]) => {
      const questionYMap = new Y.Map();
      questionYMap.set('answers', questionData.answers);
      questionYMap.set('critical', questionData.critical);
      answersYMap.set(questionKey, questionYMap);
    });
    checklistYMap.set('answers', answersYMap);

    checklistsMap.set(checklistId, checklistYMap);

    // Update study's updatedAt
    studyYMap.set('updatedAt', now);

    return checklistId;
  }

  // Update a checklist
  function updateChecklist(studyId, checklistId, updates) {
    if (!ydoc) return;
    if (!synced()) return;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId);
    if (!studyYMap) return;

    const checklistsMap = studyYMap.get('checklists');
    if (!checklistsMap) return;

    const checklistYMap = checklistsMap.get(checklistId);
    if (!checklistYMap) return;

    if (updates.title !== undefined) checklistYMap.set('title', updates.title);
    if (updates.assignedTo !== undefined) checklistYMap.set('assignedTo', updates.assignedTo);
    if (updates.status !== undefined) checklistYMap.set('status', updates.status);
    checklistYMap.set('updatedAt', Date.now());
  }

  // Delete a checklist
  function deleteChecklist(studyId, checklistId) {
    if (!ydoc) return;
    if (!synced()) return;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId);
    if (!studyYMap) return;

    const checklistsMap = studyYMap.get('checklists');
    if (!checklistsMap) return;

    checklistsMap.delete(checklistId);
    studyYMap.set('updatedAt', Date.now());
  }

  // Get a specific checklist's Y.Map for answer updates
  function getChecklistAnswersMap(studyId, checklistId) {
    if (!ydoc) return null;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId);
    if (!studyYMap) return null;

    const checklistsMap = studyYMap.get('checklists');
    if (!checklistsMap) return null;

    const checklistYMap = checklistsMap.get(checklistId);
    if (!checklistYMap) return null;

    return checklistYMap.get('answers');
  }

  // Get full checklist data including answers in plain object format
  function getChecklistData(studyId, checklistId) {
    if (!ydoc) return null;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId);
    if (!studyYMap) return null;

    const checklistsMap = studyYMap.get('checklists');
    if (!checklistsMap) return null;

    const checklistYMap = checklistsMap.get(checklistId);
    if (!checklistYMap) return null;

    const data = checklistYMap.toJSON ? checklistYMap.toJSON() : {};

    // Convert answers Y.Map to plain object with question keys at top level
    const answers = {};
    const answersMap = checklistYMap.get('answers');
    if (answersMap && typeof answersMap.entries === 'function') {
      for (const [questionKey, questionYMap] of answersMap.entries()) {
        const questionData = questionYMap.toJSON ? questionYMap.toJSON() : questionYMap;
        answers[questionKey] = questionData;
      }
    }

    return {
      ...data,
      answers,
    };
  }

  // Update a single answer in a checklist
  function updateChecklistAnswer(studyId, checklistId, questionKey, answerData) {
    if (!ydoc) return;
    if (!synced()) return;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId);
    if (!studyYMap) return;

    const checklistsMap = studyYMap.get('checklists');
    if (!checklistsMap) return;

    const checklistYMap = checklistsMap.get(checklistId);
    if (!checklistYMap) return;

    let answersMap = checklistYMap.get('answers');
    if (!answersMap) {
      answersMap = new Y.Map();
      checklistYMap.set('answers', answersMap);
    }

    // Update the specific question's answer
    const questionYMap = new Y.Map();
    questionYMap.set('answers', answerData.answers);
    questionYMap.set('critical', answerData.critical);
    answersMap.set(questionKey, questionYMap);

    checklistYMap.set('updatedAt', Date.now());
  }

  // Save reconciliation progress for a study
  function saveReconciliationProgress(studyId, progressData) {
    if (!ydoc) return;
    if (!synced()) return;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId);
    if (!studyYMap) return;

    // Store reconciliation progress as a Y.Map
    let reconciliationMap = studyYMap.get('reconciliation');
    if (!reconciliationMap) {
      reconciliationMap = new Y.Map();
      studyYMap.set('reconciliation', reconciliationMap);
    }

    // Save the progress data
    reconciliationMap.set('checklist1Id', progressData.checklist1Id);
    reconciliationMap.set('checklist2Id', progressData.checklist2Id);
    reconciliationMap.set('currentPage', progressData.currentPage);
    reconciliationMap.set('viewMode', progressData.viewMode || 'questions');
    reconciliationMap.set('finalAnswers', JSON.stringify(progressData.finalAnswers || {}));
    reconciliationMap.set('updatedAt', Date.now());

    studyYMap.set('updatedAt', Date.now());
  }

  // Get reconciliation progress for a study
  function getReconciliationProgress(studyId) {
    if (!ydoc) return null;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId);
    if (!studyYMap) return null;

    const reconciliationMap = studyYMap.get('reconciliation');
    if (!reconciliationMap) return null;

    const data = reconciliationMap.toJSON ? reconciliationMap.toJSON() : {};
    if (!data.checklist1Id || !data.checklist2Id) return null;

    return {
      checklist1Id: data.checklist1Id,
      checklist2Id: data.checklist2Id,
      currentPage: data.currentPage || 0,
      viewMode: data.viewMode || 'questions',
      finalAnswers: data.finalAnswers ? JSON.parse(data.finalAnswers) : {},
      updatedAt: data.updatedAt,
    };
  }

  // Clear reconciliation progress for a study
  function clearReconciliationProgress(studyId) {
    if (!ydoc) return;
    if (!synced()) return;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId);
    if (!studyYMap) return;

    studyYMap.delete('reconciliation');
    studyYMap.set('updatedAt', Date.now());
  }

  // Auto-connect when projectId changes
  createEffect(() => {
    if (projectId) {
      connect();
    }
  });

  // Reconnect when coming back online
  createEffect(() => {
    if (isOnline() && shouldReconnect && !connected() && !connecting()) {
      console.log('Network is back online. Attempting to reconnect...');
      shouldReconnect = false;
      reconnectAttempts = 0; // Reset attempts when coming back online
      clearReconnectTimeout();

      // Clean up old WebSocket if exists
      if (ws) {
        ws.onclose = null;
        ws.onerror = null;
        ws.onmessage = null;
        ws.close();
        ws = null;
      }

      // Reconnect (ydoc already exists, just need to setup WebSocket)
      if (ydoc && !isLocalProject()) {
        setupWebSocket();
      }
    }
  });

  // Cleanup on unmount
  onCleanup(() => {
    disconnect();
  });

  return {
    // State
    connected,
    connecting,
    synced,
    error,
    studies,
    meta,
    members,
    isLocalProject,

    // Operations
    createStudy,
    updateStudy,
    updateProjectSettings,
    deleteStudy,
    addPdfToStudy,
    removePdfFromStudy,
    createChecklist,
    updateChecklist,
    deleteChecklist,
    getChecklistAnswersMap,
    getChecklistData,
    updateChecklistAnswer,
    saveReconciliationProgress,
    getReconciliationProgress,
    clearReconciliationProgress,

    // Connection management
    connect,
    disconnect,
  };
}

export default useProject;
