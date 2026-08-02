/**
 * The project read layer: reactive hooks over the sync-engine collections,
 * plus the D1-authoritative facts (project meta, members) via React Query.
 *
 * One authority per fact: collaborative content (studies, checklists, answers,
 * pdfs, annotations, outcomes, reconciliations) reads from workspace
 * collections — live, local, offline-capable. Identity and membership read
 * from D1 through React Query and are never mirrored into the workspace.
 *
 * Writers here bridge the two write paths: online projects mutate through the
 * engine (`client.mutate.*`), local practice applies the same shared mutators
 * directly to its local-only collections (`applyLocalMutation`).
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLiveQuery, eq } from '@tanstack/react-db';
import { useQuery } from '@tanstack/react-query';
import {
  answerRowId,
  deriveFinalized,
  reconciliationRowId,
  scoreChecklistRows,
  type ChecklistAnswerInput,
  type ChecklistType,
  type ReconciliationRow,
} from '@corates/shared/sync';
import {
  getDomainQuestions as getRob2DomainQuestions,
  scoreRob2Domain,
  type DomainAnswers as Rob2DomainAnswers,
} from '@corates/shared/checklists/rob2';
import {
  getDomainQuestions as getRobinsIDomainQuestions,
  scoreRobinsDomain,
  type DomainAnswers as RobinsIDomainAnswers,
} from '@corates/shared/checklists/robins-i';
import { CHECKLIST_STATUS, getOutcomeKey } from '@corates/shared/checklists';
import { useProjectStore, selectConnectionPhase } from '@/stores/projectStore';
import type {
  ChecklistEntry,
  MemberEntry,
  OutcomeEntry,
  PdfEntry,
  StudyInfo,
} from '@/stores/projectStore';
import { queryKeys } from '@/lib/queryKeys';
import { getMyProjects } from '@/server/functions/users.functions';
import { getProjectMembers } from '@/server/functions/org-projects.functions';
import { QUERY_STABLE } from '@/lib/queryPresets';
import { getCachedProjectOrgId, rememberProjectOrgId } from '@/primitives/db.js';
import { showToast } from '@/lib/toast';
import { connectionPool, type ProjectCollections } from './ConnectionPool';
import { emptyCollections } from './localCollections';
import { applyLocalMutation } from './localWrites';

/**
 * The project id for the workspace subtree — provided by ProjectGate (online)
 * and LocalChecklistView (local practice), replacing the reactor context as
 * the way instrument components learn which project they render.
 */
export const WorkspaceProjectContext = createContext<string | null>(null);

/** The ambient project id; throws outside a workspace subtree. */
export function useWorkspaceProjectId(): string {
  const projectId = useContext(WorkspaceProjectContext);
  if (!projectId) {
    throw new Error('useWorkspaceProjectId must be used inside a WorkspaceProjectContext provider');
  }
  return projectId;
}

/**
 * The collections for a project, reactively: re-resolves when the session's
 * phase changes (the pool initializes entries in an effect, after first
 * render). Null when no session exists — e.g. sidebar rows for projects the
 * user hasn't opened.
 */
export function useProjectCollections(projectId: string): ProjectCollections | null {
  // Subscribed purely as a tripwire: the phase flips when the entry appears.
  useProjectStore(s => selectConnectionPhase(s, projectId).phase);
  return connectionPool.getCollections(projectId);
}

function useCollections(projectId: string): ProjectCollections {
  return useProjectCollections(projectId) ?? emptyCollections;
}

// ---------------------------------------------------------------------------
// Answers

/** One answer row's value, reactively. Null when unanswered or missing. */
export function useAnswerValue<T = unknown>(
  projectId: string,
  checklistId: string,
  flatKey: string,
): T | null {
  const collections = useCollections(projectId);
  const rowId = answerRowId(checklistId, flatKey);
  const { data } = useLiveQuery(
    q => q.from({ answer: collections.answers }).where(({ answer }) => eq(answer.id, rowId)),
    [collections, rowId],
  );
  return (data?.[0]?.value as T | undefined) ?? null;
}

/** A checklist's full flat answer map, reactively. */
export function useChecklistAnswerMap(
  projectId: string,
  checklistId: string,
): Record<string, unknown> {
  const collections = useCollections(projectId);
  const { data } = useLiveQuery(
    q =>
      q
        .from({ answer: collections.answers })
        .where(({ answer }) => eq(answer.checklistId, checklistId)),
    [collections, checklistId],
  );
  return useMemo(() => {
    const map: Record<string, unknown> = {};
    for (const row of data ?? []) map[row.key] = row.value;
    return map;
  }, [data]);
}

/** Imperative answer read for write-time composition (e.g. critical toggles). */
export function getAnswerValue(projectId: string, checklistId: string, flatKey: string): unknown {
  const collections = connectionPool.getCollections(projectId);
  return collections?.answers.get(answerRowId(checklistId, flatKey))?.value ?? null;
}

// ---------------------------------------------------------------------------
// Writers

export interface AnswerWriters {
  /** Section-level answer update, validated by the instrument's key schema. */
  updateAnswer: (input: ChecklistAnswerInput) => void;
  /** Free-text field write (notes/comments); replaces the Y.Text edit path. */
  setText: (flatKey: string, text: string) => void;
}

/**
 * The two write entry points the instrument UIs need. Online projects go
 * through the engine's mutation outbox; local practice applies the same
 * shared mutators directly to its local-only collections.
 */
export function useAnswerWriters(
  projectId: string,
  _studyId: string,
  checklistId: string,
): AnswerWriters {
  const updateAnswer = useCallback(
    (input: ChecklistAnswerInput) => {
      const client = connectionPool.getClient(projectId);
      if (client) {
        void client.mutate.checklist.updateAnswer({ checklistId, input, now: Date.now() });
        return;
      }
      // Local-practice writes apply synchronously; a rejection throws here
      // (onClick handlers have no catch) — route it to the same toast the
      // online path's onMutationRejected uses.
      try {
        applyLocalMutation(projectId, 'checklist.updateAnswer', {
          checklistId,
          input,
          now: Date.now(),
        });
      } catch (err) {
        console.error('[local] mutation rejected:', err);
        showToast.error('Change Rejected', 'Your change could not be applied.');
      }
    },
    [projectId, checklistId],
  );

  const setText = useCallback(
    (flatKey: string, text: string) => {
      const client = connectionPool.getClient(projectId);
      if (client) {
        void client.mutate.checklist.setText({ checklistId, key: flatKey, text });
        return;
      }
      try {
        applyLocalMutation(projectId, 'checklist.setText', { checklistId, key: flatKey, text });
      } catch (err) {
        console.error('[local] mutation rejected:', err);
        showToast.error('Change Rejected', 'Your change could not be applied.');
      }
    },
    [projectId, checklistId],
  );

  return useMemo(() => ({ updateAnswer, setText }), [updateAnswer, setText]);
}

// ---------------------------------------------------------------------------
// Scores

/** The header score for a checklist; null while incomplete. */
export function useChecklistScore(
  projectId: string,
  checklistId: string,
  checklistType: string | null,
): string | null {
  const flat = useChecklistAnswerMap(projectId, checklistId);
  return useMemo(() => {
    if (!checklistType) return null;
    const score = scoreChecklistRows(checklistType as ChecklistType, flat);
    return score === 'Incomplete' || score === 'Error' ? null : score;
  }, [checklistType, flat]);
}

export function useRob2DomainScore(
  projectId: string,
  checklistId: string,
  domainKey: string,
): { judgement: string | null; isComplete: boolean } {
  const flat = useChecklistAnswerMap(projectId, checklistId);
  return useMemo(() => {
    const questions = getRob2DomainQuestions(domainKey);
    const answers: Rob2DomainAnswers = {};
    for (const qKey of Object.keys(questions)) {
      answers[qKey] = { answer: (flat[qKey] as string | null | undefined) ?? null };
    }
    const result = scoreRob2Domain(domainKey, answers);
    return { judgement: result.judgement, isComplete: result.isComplete };
  }, [flat, domainKey]);
}

export function useRobinsIDomainScore(
  projectId: string,
  checklistId: string,
  domainKey: string,
): { judgement: string | null; isComplete: boolean } {
  const flat = useChecklistAnswerMap(projectId, checklistId);
  return useMemo(() => {
    const questions = getRobinsIDomainQuestions(domainKey);
    const answers: RobinsIDomainAnswers = {};
    for (const qKey of Object.keys(questions)) {
      answers[qKey] = { answer: (flat[qKey] as string | null | undefined) ?? null };
    }
    const result = scoreRobinsDomain(domainKey, answers);
    return { judgement: result.judgement, isComplete: result.isComplete };
  }, [flat, domainKey]);
}

// ---------------------------------------------------------------------------
// Studies

function toPdfEntry(row: {
  id: string;
  key: string;
  fileName: string;
  size: number;
  uploadedBy: string;
  uploadedAt: number;
  tag: string;
  title?: string;
  firstAuthor?: string;
  publicationYear?: string;
  journal?: string;
  doi?: string;
}): PdfEntry {
  return {
    id: row.id,
    fileName: row.fileName,
    key: row.key,
    size: row.size,
    uploadedBy: row.uploadedBy,
    uploadedAt: row.uploadedAt,
    tag: row.tag,
    title: row.title ?? null,
    firstAuthor: row.firstAuthor ?? null,
    publicationYear: row.publicationYear ?? null,
    journal: row.journal ?? null,
    doi: row.doi ?? null,
  };
}

/**
 * All studies with nested checklists and pdfs — the `StudyInfo` shape the
 * project tabs consume, assembled from live rows. Finalized checklists carry
 * their score + chart-facing consolidated answers, derived from answer rows.
 */
export function useAllStudies(projectId: string): StudyInfo[] {
  const collections = useCollections(projectId);
  const { data: studies } = useLiveQuery(
    q => q.from({ study: collections.studies }),
    [collections],
  );
  const { data: checklists } = useLiveQuery(
    q => q.from({ checklist: collections.checklists }),
    [collections],
  );
  const { data: pdfs } = useLiveQuery(q => q.from({ pdf: collections.pdfs }), [collections]);
  const { data: answers } = useLiveQuery(
    q => q.from({ answer: collections.answers }),
    [collections],
  );

  return useMemo(() => {
    const answersByChecklist = new Map<string, Record<string, unknown>>();
    for (const row of answers ?? []) {
      let map = answersByChecklist.get(row.checklistId);
      if (!map) {
        map = {};
        answersByChecklist.set(row.checklistId, map);
      }
      map[row.key] = row.value;
    }

    const checklistsByStudy = new Map<string, ChecklistEntry[]>();
    for (const row of checklists ?? []) {
      let entry: ChecklistEntry = {
        id: row.id,
        type: row.type,
        title: row.title ?? null,
        assignedTo: row.assignedTo,
        outcomeId: row.outcomeId,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        score: null,
        answers: null,
        consolidatedAnswers: null,
      };
      if (row.status === CHECKLIST_STATUS.FINALIZED) {
        const flat = answersByChecklist.get(row.id) ?? {};
        const derived = deriveFinalized(row.type, flat);
        entry = { ...entry, score: derived.score, consolidatedAnswers: derived.consolidatedAnswers };
      }
      const list = checklistsByStudy.get(row.studyId) ?? [];
      list.push(entry);
      checklistsByStudy.set(row.studyId, list);
    }
    for (const list of checklistsByStudy.values()) {
      list.sort((a, b) => a.createdAt - b.createdAt);
    }

    const pdfsByStudy = new Map<string, PdfEntry[]>();
    for (const row of pdfs ?? []) {
      const list = pdfsByStudy.get(row.studyId) ?? [];
      list.push(toPdfEntry(row));
      pdfsByStudy.set(row.studyId, list);
    }

    const result: StudyInfo[] = (studies ?? []).map(study => ({
      id: study.id,
      name: study.name ?? '',
      description: study.description ?? '',
      originalTitle: study.originalTitle ?? null,
      firstAuthor: study.firstAuthor ?? null,
      publicationYear: study.publicationYear ?? null,
      authors: study.authors ?? null,
      journal: study.journal ?? null,
      doi: study.doi ?? null,
      abstract: study.abstract ?? null,
      importSource: study.importSource ?? null,
      pdfUrl: study.pdfUrl ?? null,
      pdfSource: study.pdfSource ?? null,
      pdfAccessible: Boolean(study.pdfAccessible),
      pmid: study.pmid ?? null,
      url: study.url ?? null,
      volume: study.volume ?? null,
      issue: study.issue ?? null,
      pages: study.pages ?? null,
      type: study.type ?? null,
      reviewer1: study.reviewer1 ?? null,
      reviewer2: study.reviewer2 ?? null,
      createdAt: study.createdAt,
      updatedAt: study.updatedAt,
      checklists: checklistsByStudy.get(study.id) ?? [],
      pdfs: pdfsByStudy.get(study.id) ?? [],
    }));
    result.sort((a, b) => a.createdAt - b.createdAt);
    return result;
  }, [studies, checklists, pdfs, answers]);
}

export function useStudy(projectId: string, studyId: string): StudyInfo | undefined {
  const studies = useAllStudies(projectId);
  return useMemo(() => studies.find(s => s.id === studyId), [studies, studyId]);
}

export function useSortedStudyIds(projectId: string): string[] {
  const studies = useAllStudies(projectId);
  return useMemo(() => studies.map(s => s.id), [studies]);
}

// ---------------------------------------------------------------------------
// Reconciliation progress (workspace-authoritative)

/**
 * The entry shape the completed/reconcile UIs consume — the reconciliations
 * row with the legacy ops layer's defaults applied.
 */
export interface ReconciliationProgressEntry {
  studyId: string;
  outcomeKey: string;
  outcomeId: string | null;
  type: string;
  checklist1Id: string;
  checklist2Id: string;
  reconciledChecklistId: string | null;
  currentPage: number;
  viewMode: string;
  updatedAt: number;
}

function toProgressEntry(row: ReconciliationRow): ReconciliationProgressEntry {
  return {
    studyId: row.studyId,
    outcomeKey: row.outcomeKey,
    outcomeId: row.outcomeId,
    type: row.type,
    checklist1Id: row.checklist1Id,
    checklist2Id: row.checklist2Id,
    reconciledChecklistId: row.reconciledChecklistId ?? null,
    currentPage: row.currentPage ?? 0,
    viewMode: row.viewMode ?? 'questions',
    updatedAt: row.updatedAt,
  };
}

/** One outcome group's reconciliation progress, reactively. Null when none saved. */
export function useReconciliationProgress(
  projectId: string,
  studyId: string,
  outcomeId: string | null,
  type: string,
): ReconciliationProgressEntry | null {
  const collections = useCollections(projectId);
  const rowId = reconciliationRowId(studyId, getOutcomeKey(outcomeId, type));
  const { data } = useLiveQuery(
    q =>
      q
        .from({ reconciliation: collections.reconciliations })
        .where(({ reconciliation }) => eq(reconciliation.id, rowId)),
    [collections, rowId],
  );
  return useMemo(() => {
    const row = data?.[0];
    return row ? toProgressEntry(row) : null;
  }, [data]);
}

/** All reconciliation progress rows for a project, reactively. */
export function useAllReconciliationProgress(projectId: string): ReconciliationProgressEntry[] {
  const collections = useCollections(projectId);
  const { data } = useLiveQuery(
    q => q.from({ reconciliation: collections.reconciliations }),
    [collections],
  );
  return useMemo(() => (data ?? []).map(toProgressEntry), [data]);
}

// ---------------------------------------------------------------------------
// Outcomes (workspace-authoritative)

export function useProjectOutcomes(projectId: string): OutcomeEntry[] {
  const collections = useCollections(projectId);
  const { data } = useLiveQuery(q => q.from({ outcome: collections.outcomes }), [collections]);
  return useMemo(() => {
    const outcomes = (data ?? []).map(row => ({
      id: row.id,
      name: row.name,
      createdAt: row.createdAt,
      createdBy: row.createdBy,
    }));
    outcomes.sort((a, b) => a.createdAt - b.createdAt);
    return outcomes;
  }, [data]);
}

// ---------------------------------------------------------------------------
// D1-authoritative facts (React Query — never mirrored into the workspace)

export interface ProjectMetaInfo {
  name: string | null;
  description: string | null;
  orgId: string | null;
}

const EMPTY_META: ProjectMetaInfo = { name: null, description: null, orgId: null };

/** Project identity from D1 (via the projects list query). */
export function useProjectMeta(projectId: string): ProjectMetaInfo {
  const { data } = useQuery({
    queryKey: queryKeys.projects.all,
    queryFn: () => getMyProjects(),
    ...QUERY_STABLE,
  });
  return useMemo(() => {
    const project = (data as Array<{ id: string; name?: string; description?: string | null; orgId?: string }> | undefined)?.find(
      p => p.id === projectId,
    );
    if (!project) return EMPTY_META;
    return {
      name: project.name ?? null,
      description: project.description ?? null,
      orgId: project.orgId ?? null,
    };
  }, [data, projectId]);
}

/**
 * orgId for a project: the D1 projects query is the authority, with the
 * Dexie-stamped value (written on every successful resolution — orgId is
 * immutable per project) covering the cold-hard-refresh window where the
 * workspace hydrates from cache before the network query returns.
 */
export function useProjectOrgId(projectId: string | null | undefined): string | null {
  const { orgId } = useProjectMeta(projectId || '');
  const [fallbackOrgId, setFallbackOrgId] = useState<string | null>(null);
  const isLocal = !projectId || projectId.startsWith('local-');

  useEffect(() => {
    if (!isLocal && projectId && orgId) void rememberProjectOrgId(projectId, orgId);
  }, [projectId, orgId, isLocal]);

  useEffect(() => {
    setFallbackOrgId(null);
    if (isLocal || !projectId) return;
    let cancelled = false;
    void getCachedProjectOrgId(projectId).then(value => {
      if (!cancelled && value) setFallbackOrgId(value);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, isLocal]);

  if (!projectId) return null;
  return orgId ?? fallbackOrgId;
}

/** One error toast per project per failure episode, however many components
 * mount the members hook; cleared when a fetch succeeds again. */
const membersErrorToasted = new Set<string>();

/** Project members from D1 (`projectMembers ⨝ user`), in MemberEntry shape. */
export function useProjectMembers(projectId: string): MemberEntry[] {
  const orgId = useProjectOrgId(projectId);
  const { data, isError } = useQuery({
    queryKey: queryKeys.projects.members(projectId),
    queryFn: () => getProjectMembers({ data: { orgId: orgId!, projectId } }),
    enabled: Boolean(orgId && projectId && !projectId.startsWith('local-')),
    ...QUERY_STABLE,
  });

  // A failed members fetch silently degrades the page (names render
  // "Unknown", owner-only controls hide) — say so instead.
  useEffect(() => {
    if (isError && !membersErrorToasted.has(projectId)) {
      membersErrorToasted.add(projectId);
      showToast.error(
        'Members Failed to Load',
        'Member names and roles may be missing or outdated. Retrying in the background.',
      );
    } else if (!isError) {
      membersErrorToasted.delete(projectId);
    }
  }, [isError, projectId]);

  return useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data.map(member => ({
      userId: member.userId,
      role: member.role ?? 'member',
      joinedAt:
        member.joinedAt instanceof Date
          ? member.joinedAt.getTime()
          : Number(member.joinedAt ?? 0),
      name: member.name ?? '',
      email: member.email ?? '',
      givenName: member.givenName ?? '',
      familyName: member.familyName ?? '',
      image: member.image ?? null,
    }));
  }, [data]);
}
