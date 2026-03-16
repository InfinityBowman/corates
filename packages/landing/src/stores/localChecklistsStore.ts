/**
 * localChecklistsStore - Zustand store for local checklists (Dexie)
 * Manages local-only checklists for offline practice mode.
 */

import { create } from 'zustand';
import { createChecklistOfType, DEFAULT_CHECKLIST_TYPE } from '@/checklist-registry';
import { db } from '@/primitives/db.js';

interface LocalChecklist {
  id: string;
  name: string;
  checklistType: string;
  data?: unknown;
  createdAt: number;
  updatedAt: number;
  isLocal: boolean;
}

interface LocalChecklistPdf {
  checklistId: string;
  data: ArrayBuffer;
  fileName: string;
  updatedAt: number;
}

interface LocalChecklistsState {
  checklists: LocalChecklist[];
  loading: boolean;
  error: string | null;
}

/* eslint-disable no-unused-vars */
interface LocalChecklistsActions {
  init: () => Promise<void>;
  refetch: () => Promise<LocalChecklist[]>;
  createChecklist: (name?: string, type?: string) => Promise<LocalChecklist>;
  getChecklist: (checklistId: string) => Promise<LocalChecklist | null>;
  updateChecklist: (
    checklistId: string,
    updates: Partial<LocalChecklist>,
  ) => Promise<LocalChecklist | null>;
  deleteChecklist: (checklistId: string) => Promise<boolean>;
  savePdf: (
    checklistId: string,
    pdfData: ArrayBuffer,
    fileName?: string,
  ) => Promise<LocalChecklistPdf>;
  getPdf: (checklistId: string) => Promise<LocalChecklistPdf | null>;
  deletePdf: (checklistId: string) => Promise<boolean>;
}
/* eslint-enable no-unused-vars */

export const useLocalChecklistsStore = create<LocalChecklistsState & LocalChecklistsActions>()(
  (set, get) => ({
    checklists: [],
    loading: true,
    error: null,

    refetch: async () => {
      const checklistsList = (await db.localChecklists
        .orderBy('updatedAt')
        .reverse()
        .toArray()) as unknown as LocalChecklist[];
      set({ checklists: checklistsList });
      return checklistsList;
    },

    init: async () => {
      try {
        set({ loading: true });
        await get().refetch();
      } catch (err) {
        console.error('Error initializing local checklists:', err);
        set({ error: (err as Error)?.message || String(err) });
      } finally {
        set({ loading: false });
      }
    },

    createChecklist: async (name = 'Untitled Checklist', type = DEFAULT_CHECKLIST_TYPE) => {
      const now = Date.now();
      const id = `local-${crypto.randomUUID()}`;

      const template = createChecklistOfType(type, {
        id,
        name,
        createdAt: now,
        reviewerName: '',
      });

      const checklist: LocalChecklist = {
        ...template,
        id,
        name,
        checklistType: type,
        createdAt: now,
        updatedAt: now,
        isLocal: true,
      };

      // Dexie table type from untyped db.js doesn't match our interface
      await (db.localChecklists as any).add(checklist);
      set(state => ({ checklists: [checklist, ...state.checklists] }));
      return checklist;
    },

    getChecklist: async checklistId => {
      return ((await db.localChecklists.get(checklistId)) as unknown as LocalChecklist) || null;
    },

    updateChecklist: async (checklistId, updates) => {
      const existing = await get().getChecklist(checklistId);
      if (!existing) return null;

      const updatedChecklist = { ...existing, ...updates, updatedAt: Date.now() };
      await (db.localChecklists as any).put(updatedChecklist);
      set(state => ({
        checklists: state.checklists.map(c => (c.id === checklistId ? updatedChecklist : c)),
      }));
      return updatedChecklist;
    },

    deleteChecklist: async checklistId => {
      await db.transaction('rw', [db.localChecklists, db.localChecklistPdfs], async () => {
        await db.localChecklists.delete(checklistId);
        await db.localChecklistPdfs.delete(checklistId);
      });
      set(state => ({
        checklists: state.checklists.filter(c => c.id !== checklistId),
      }));
      return true;
    },

    savePdf: async (checklistId, pdfData, fileName = 'document.pdf') => {
      const pdfRecord: LocalChecklistPdf = {
        checklistId,
        data: pdfData,
        fileName,
        updatedAt: Date.now(),
      };
      await db.localChecklistPdfs.put(pdfRecord);
      return pdfRecord;
    },

    getPdf: async checklistId => {
      return ((await db.localChecklistPdfs.get(checklistId)) as LocalChecklistPdf) || null;
    },

    deletePdf: async checklistId => {
      await db.localChecklistPdfs.delete(checklistId);
      return true;
    },
  }),
);

// Auto-initialize when module loads (matches SolidJS behavior)
if (typeof window !== 'undefined') {
  useLocalChecklistsStore.getState().init();
}
