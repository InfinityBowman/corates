/**
 * localChecklistsStore - Shared store for local checklists (Dexie)
 * Exports reactive accessors and methods for managing local-only checklists.
 */

import { createSignal } from 'solid-js';
import { createChecklistOfType, DEFAULT_CHECKLIST_TYPE } from '@/checklist-registry';
import { db } from '@primitives/db.js';

// Reactive state
const [checklists, setChecklists] = createSignal([]);
const [loading, setLoading] = createSignal(true);
const [error, setError] = createSignal(null);

async function loadChecklists() {
  const checklistsList = await db.localChecklists.orderBy('updatedAt').reverse().toArray();
  setChecklists(checklistsList);
  return checklistsList;
}

async function init() {
  try {
    setLoading(true);
    await loadChecklists();
  } catch (err) {
    console.error('Error initializing local checklists:', err);
    setError(err?.message || String(err));
  } finally {
    setLoading(false);
  }
}

async function createChecklist(name = 'Untitled Checklist', type = DEFAULT_CHECKLIST_TYPE) {
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

  await db.localChecklists.add(checklist);
  setChecklists(prev => [checklist, ...prev]);
  return checklist;
}

async function getChecklist(checklistId) {
  return (await db.localChecklists.get(checklistId)) || null;
}

async function updateChecklist(checklistId, updates) {
  const existing = await getChecklist(checklistId);
  if (!existing) return null;

  const updatedChecklist = { ...existing, ...updates, updatedAt: Date.now() };
  await db.localChecklists.put(updatedChecklist);
  setChecklists(prev => prev.map(c => (c.id === checklistId ? updatedChecklist : c)));
  return updatedChecklist;
}

async function deleteChecklist(checklistId) {
  await db.transaction('rw', [db.localChecklists, db.localChecklistPdfs], async () => {
    await db.localChecklists.delete(checklistId);
    await db.localChecklistPdfs.delete(checklistId);
  });
  setChecklists(prev => prev.filter(c => c.id !== checklistId));
  return true;
}

async function savePdf(checklistId, pdfData, fileName = 'document.pdf') {
  const pdfRecord = { checklistId, data: pdfData, fileName, updatedAt: Date.now() };
  await db.localChecklistPdfs.put(pdfRecord);
  return pdfRecord;
}

async function getPdf(checklistId) {
  return (await db.localChecklistPdfs.get(checklistId)) || null;
}

async function deletePdf(checklistId) {
  await db.localChecklistPdfs.delete(checklistId);
  return true;
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
