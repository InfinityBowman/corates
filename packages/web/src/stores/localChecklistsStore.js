/**
 * localChecklistsStore - Shared store for local checklists (IndexedDB)
 * Exports reactive accessors and methods for managing local-only checklists.
 */

import { createSignal } from 'solid-js';
import { createChecklistOfType, DEFAULT_CHECKLIST_TYPE } from '@/checklist-registry';

const DB_NAME = 'corates-local-checklists';
const DB_VERSION = 2; // Bumped for PDF store
const STORE_NAME = 'checklists';
const PDF_STORE_NAME = 'pdfs';

let dbInstance = null;
let dbInitPromise = null;

function openDatabase() {
  if (dbInitPromise) return dbInitPromise;
  if (dbInstance) return Promise.resolve(dbInstance);

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
      if (!db.objectStoreNames.contains(PDF_STORE_NAME)) {
        const pdfStore = db.createObjectStore(PDF_STORE_NAME, { keyPath: 'checklistId' });
        pdfStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
  });

  return dbInitPromise;
}

// Reactive state
const [checklists, setChecklists] = createSignal([]);
const [loading, setLoading] = createSignal(true);
const [error, setError] = createSignal(null);

async function getDb() {
  return openDatabase();
}

async function loadChecklists() {
  const db = await getDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const checklistsList = request.result || [];
      checklistsList.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
      setChecklists(checklistsList);
      resolve(checklistsList);
    };
    request.onerror = () => reject(request.error);
  });
}

async function init() {
  try {
    setLoading(true);
    await getDb();
    await loadChecklists();
  } catch (err) {
    console.error('Error initializing local checklists:', err);
    setError(err?.message || String(err));
  } finally {
    setLoading(false);
  }
}

async function createChecklist(name = 'Untitled Checklist', type = DEFAULT_CHECKLIST_TYPE) {
  const db = await getDb();
  const now = Date.now();
  const id = `local-${crypto.randomUUID()}`;

  const template = createChecklistOfType(type, {
    id,
    name,
    createdAt: now,
    reviewerName: '',
  });

  const checklist = {
    ...template,
    id,
    name,
    checklistType: type,
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

async function updateChecklist(checklistId, updates) {
  const db = await getDb();
  const existing = await getChecklist(checklistId);
  if (!existing) return null;

  const updatedChecklist = { ...existing, ...updates, updatedAt: Date.now() };

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

async function deleteChecklist(checklistId) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME, PDF_STORE_NAME], 'readwrite');
    const checklistStore = transaction.objectStore(STORE_NAME);
    const pdfStore = transaction.objectStore(PDF_STORE_NAME);

    checklistStore.delete(checklistId);
    pdfStore.delete(checklistId);

    transaction.oncomplete = () => {
      setChecklists(prev => prev.filter(c => c.id !== checklistId));
      resolve(true);
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

async function savePdf(checklistId, pdfData, fileName = 'document.pdf') {
  const db = await getDb();
  const pdfRecord = { checklistId, data: pdfData, fileName, updatedAt: Date.now() };
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PDF_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(PDF_STORE_NAME);
    const request = store.put(pdfRecord);
    request.onsuccess = () => resolve(pdfRecord);
    request.onerror = () => reject(request.error);
  });
}

async function getPdf(checklistId) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PDF_STORE_NAME, 'readonly');
    const store = transaction.objectStore(PDF_STORE_NAME);
    const request = store.get(checklistId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function deletePdf(checklistId) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PDF_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(PDF_STORE_NAME);
    const request = store.delete(checklistId);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

// Initialize immediately
init();

const store = {
  checklists,
  loading,
  error,
  createChecklist,
  getChecklist,
  updateChecklist,
  deleteChecklist,
  savePdf,
  getPdf,
  deletePdf,
  refetch: loadChecklists,
};

export default store;
export { store as localChecklistsStore };
