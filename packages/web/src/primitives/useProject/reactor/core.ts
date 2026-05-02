import { atom, transact, computed } from '@tldraw/state';
import type { Atom, Computed } from '@tldraw/state';
import * as Y from 'yjs';

export class YMapReactor {
  private atoms = new Map<string, Atom<unknown>>();
  private observer: (event: Y.YMapEvent<unknown>) => void;

  constructor(
    private prefix: string,
    readonly ymap: Y.Map<unknown>,
  ) {
    this.observer = (event: Y.YMapEvent<unknown>) => {
      transact(() => {
        for (const [key] of event.keys) {
          const a = this.atoms.get(key);
          if (a) a.set(this.read(key));
        }
      });
    };
    ymap.observe(this.observer);
  }

  field<T>(key: string): Atom<T> {
    let a = this.atoms.get(key);
    if (!a) {
      a = atom(`${this.prefix}:${key}`, this.read(key));
      this.atoms.set(key, a);
    }
    return a as Atom<T>;
  }

  private read(key: string): unknown {
    const val = this.ymap.get(key);
    if (val instanceof Y.Text) return val.toString();
    return val ?? null;
  }

  dispose(): void {
    this.ymap.unobserve(this.observer);
    this.atoms.clear();
  }
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export class CollectionReactor<T extends { dispose(): void }> {
  readonly ids: Atom<string[]>;
  private items = new Map<string, T>();
  private observer: (event: Y.YMapEvent<unknown>) => void;

  constructor(
    prefix: string,
    private ymap: Y.Map<unknown>,
    factory: (id: string, ymap: Y.Map<unknown>) => T,
  ) {
    for (const [id, val] of ymap.entries()) {
      this.items.set(id, factory(id, val as Y.Map<unknown>));
    }
    this.ids = atom(`${prefix}:ids`, [...ymap.keys()], { isEqual: arraysEqual });

    this.observer = (event: Y.YMapEvent<unknown>) => {
      for (const [key, change] of event.keys) {
        if (change.action === 'delete') {
          this.items.get(key)?.dispose();
          this.items.delete(key);
        }
        if (change.action === 'add' || change.action === 'update') {
          this.items.get(key)?.dispose();
          const val = ymap.get(key) as Y.Map<unknown>;
          this.items.set(key, factory(key, val));
        }
      }
      this.ids.set([...ymap.keys()]);
    };
    ymap.observe(this.observer);
  }

  get(id: string): T | undefined {
    return this.items.get(id);
  }

  dispose(): void {
    this.ymap.unobserve(this.observer);
    for (const item of this.items.values()) item.dispose();
    this.items.clear();
  }
}

export class ChecklistReactor {
  readonly fields: YMapReactor;
  readonly answers: YMapReactor;

  constructor(
    readonly id: string,
    ymap: Y.Map<unknown>,
  ) {
    this.fields = new YMapReactor(`cl:${id}`, ymap);
    let answersYMap = ymap.get('answers') as Y.Map<unknown> | undefined;
    if (!answersYMap) {
      answersYMap = new Y.Map();
      ymap.set('answers', answersYMap);
    }
    this.answers = new YMapReactor(`cl:${id}:a`, answersYMap);
  }

  dispose(): void {
    this.fields.dispose();
    this.answers.dispose();
  }
}

export class StudyReactor {
  readonly fields: YMapReactor;
  readonly checklists: CollectionReactor<ChecklistReactor>;

  constructor(
    readonly id: string,
    studyYMap: Y.Map<unknown>,
  ) {
    this.fields = new YMapReactor(`study:${id}`, studyYMap);

    let checklistsYMap = studyYMap.get('checklists') as Y.Map<unknown> | undefined;
    if (!checklistsYMap) {
      checklistsYMap = new Y.Map();
      studyYMap.set('checklists', checklistsYMap);
    }
    this.checklists = new CollectionReactor(
      `study:${id}:cl`,
      checklistsYMap,
      (clId, ymap) => new ChecklistReactor(clId, ymap),
    );
  }

  dispose(): void {
    this.fields.dispose();
    this.checklists.dispose();
  }
}

export class ProjectReactor {
  readonly studies: CollectionReactor<StudyReactor>;
  readonly sortedStudyIds: Computed<string[]>;

  constructor(readonly ydoc: Y.Doc) {
    const reviewsMap = ydoc.getMap('reviews');
    this.studies = new CollectionReactor(
      'reviews',
      reviewsMap,
      (id, ymap) => new StudyReactor(id, ymap),
    );

    this.sortedStudyIds = computed(
      'sortedStudyIds',
      () => {
        const ids = this.studies.ids.get();
        return [...ids].sort((a, b) => {
          const aS = this.studies.get(a);
          const bS = this.studies.get(b);
          const aC = aS ? (aS.fields.field<number>('createdAt').get() ?? 0) : 0;
          const bC = bS ? (bS.fields.field<number>('createdAt').get() ?? 0) : 0;
          return aC - bC;
        });
      },
      { isEqual: arraysEqual },
    );
  }

  dispose(): void {
    this.studies.dispose();
  }
}
