import { atom, transact } from '@tldraw/state';
import type { Atom } from '@tldraw/state';
import { useValue } from '@tldraw/state-react';
import type { StudyInfo, MemberEntry, ProjectMeta } from './projectStore';

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

class ProjectAtoms {
  private studyAtoms = new Map<string, Atom<StudyInfo | undefined>>();
  readonly studyOrder = atom<string[]>('studyOrder', [], { isEqual: arraysEqual });
  readonly meta = atom<ProjectMeta>('projectMeta', { outcomes: [] });
  readonly members = atom<MemberEntry[]>('members', []);

  getOrCreateStudyAtom(studyId: string): Atom<StudyInfo | undefined> {
    let a = this.studyAtoms.get(studyId);
    if (!a) {
      a = atom<StudyInfo | undefined>(`study:${studyId}`, undefined);
      this.studyAtoms.set(studyId, a);
    }
    return a;
  }

  setStudy(studyId: string, study: StudyInfo): void {
    this.getOrCreateStudyAtom(studyId).set(study);
  }

  deleteStudy(studyId: string): void {
    const a = this.studyAtoms.get(studyId);
    if (a) {
      a.set(undefined);
      this.studyAtoms.delete(studyId);
    }
  }

  setStudies(studies: StudyInfo[]): void {
    const incomingIds = new Set<string>();

    transact(() => {
      for (const study of studies) {
        incomingIds.add(study.id);
        this.setStudy(study.id, study);
      }

      for (const [id] of this.studyAtoms) {
        if (!incomingIds.has(id)) {
          this.deleteStudy(id);
        }
      }

      this.studyOrder.set(studies.map(s => s.id));
    });
  }

  cleanup(): void {
    this.studyAtoms.clear();
  }
}

const registry = new Map<string, ProjectAtoms>();

export function getProjectAtoms(projectId: string): ProjectAtoms {
  let atoms = registry.get(projectId);
  if (!atoms) {
    atoms = new ProjectAtoms();
    registry.set(projectId, atoms);
  }
  return atoms;
}

export function cleanupProjectAtoms(projectId: string): void {
  const atoms = registry.get(projectId);
  if (atoms) {
    atoms.cleanup();
    registry.delete(projectId);
  }
}

// -- React hooks --

export function useStudy(projectId: string, studyId: string): StudyInfo | undefined {
  const atoms = getProjectAtoms(projectId);
  const studyAtom = atoms.getOrCreateStudyAtom(studyId);
  return useValue(studyAtom);
}

export function useStudyIds(projectId: string): string[] {
  const atoms = getProjectAtoms(projectId);
  return useValue(atoms.studyOrder);
}

export function useProjectMeta(projectId: string): ProjectMeta {
  const atoms = getProjectAtoms(projectId);
  return useValue(atoms.meta);
}

export function useProjectMembers(projectId: string): MemberEntry[] {
  const atoms = getProjectAtoms(projectId);
  return useValue(atoms.members);
}

export function useAllStudies(projectId: string): StudyInfo[] {
  const atoms = getProjectAtoms(projectId);
  return useValue(
    'allStudies:' + projectId,
    () => {
      return atoms.studyOrder.get().flatMap(id => {
        const study = atoms.getOrCreateStudyAtom(id).get();
        return study ? [study] : [];
      });
    },
    [atoms],
  );
}
