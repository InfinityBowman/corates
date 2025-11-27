/**
 * useLocalChecklists hook - Manages local-only checklists stored in IndexedDB
 * These checklists exist only on the device and don't require authentication
 */

import { createSignal, createEffect, onCleanup } from 'solid-js';
import { createChecklist as createAMSTAR2Template } from '@/AMSTAR2/checklist.js';

const DB_NAME = 'corates-local-checklists';
const DB_VERSION = 1;
const STORE_NAME = 'checklists';

// Shared database instance and initialization promise
let dbInstance = null;
let dbInitPromise = null;

/**
 * Open the IndexedDB database (singleton pattern)
 */
function openDatabase() {
  // Return existing promise if already initializing
  if (dbInitPromise) {
    return dbInitPromise;
  }

  // Return existing instance if already open
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  dbInitPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      dbInitPromise = null;
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = event => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
  });

  return dbInitPromise;
}

/**
 * Hook to manage local checklists
 */
export function useLocalChecklists() {
  const [checklists, setChecklists] = createSignal([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal(null);

  // Get database instance (ensures it's initialized)
  async function getDb() {
    return openDatabase();
  }

  // Initialize database and load checklists
  async function init() {
    try {
      setLoading(true);
      await getDb();
      await loadChecklists();
    } catch (err) {
      console.error('Error initializing local checklists:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Load all checklists from IndexedDB
  async function loadChecklists() {
    const db = await getDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const checklistsList = request.result || [];
        // Sort by updatedAt descending (most recently updated first)
        checklistsList.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
        setChecklists(checklistsList);
        resolve(checklistsList);
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Create a new local checklist
  async function createChecklist(name = 'Untitled Checklist', type = 'AMSTAR2') {
    const db = await getDb();

    const now = Date.now();
    const id = `local-${crypto.randomUUID()}`;

    // Create the AMSTAR2 template with all questions
    const template = createAMSTAR2Template({
      id,
      name,
      createdAt: now,
      reviewerName: '',
      reviewDate: '',
    });

    const checklist = {
      ...template,
      id,
      name,
      type,
      createdAt: now,
      updatedAt: now,
      isLocal: true,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(checklist);

      request.onsuccess = () => {
        setChecklists(prev => [checklist, ...prev]);
        resolve(checklist);
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Get a single checklist by ID
  async function getChecklist(checklistId) {
    const db = await getDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(checklistId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  // Update a local checklist
  async function updateChecklist(checklistId, updates) {
    const db = await getDb();

    const existing = await getChecklist(checklistId);
    if (!existing) return null;

    const updatedChecklist = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(updatedChecklist);

      request.onsuccess = () => {
        setChecklists(prev => prev.map(c => (c.id === checklistId ? updatedChecklist : c)));
        resolve(updatedChecklist);
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Delete a local checklist
  async function deleteChecklist(checklistId) {
    const db = await getDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(checklistId);

      request.onsuccess = () => {
        setChecklists(prev => prev.filter(c => c.id !== checklistId));
        resolve(true);
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Initialize on mount
  createEffect(() => {
    init();
  });

  return {
    checklists,
    loading,
    error,
    createChecklist,
    getChecklist,
    updateChecklist,
    deleteChecklist,
    refetch: loadChecklists,
  };
}

export default useLocalChecklists;
