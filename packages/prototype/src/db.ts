import Dexie, { type Table } from 'dexie';
import yDexie from 'y-dexie';
import type { Doc as YDoc } from 'yjs';

interface ProjectRow {
  id: string;
  updatedAt: number;
  ydoc: YDoc;
}

class PrototypeDB extends Dexie {
  projects!: Table<ProjectRow, string>;

  constructor() {
    super('prototype', { addons: [yDexie] });
    this.version(1).stores({
      projects: 'id, updatedAt, ydoc: Y.Doc',
    });
  }
}

export const db = new PrototypeDB();
