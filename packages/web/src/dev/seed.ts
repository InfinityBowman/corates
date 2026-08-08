/**
 * Dev seeding over the sync engine: generated studies and full project
 * templates applied through the same shared mutators the app writes with.
 *
 * Replaces the old ProjectDoc dev RPCs (handleDevAddStudy /
 * handleDevApplyTemplate): instead of a server handler building Y.Maps, the
 * browser opens a short-lived engine session (persist: false, independent of
 * the pool's UI session) and issues ordinary mutations — the outbox keeps
 * them ordered, the server applies them authoritatively, and any open UI
 * session watches the seed arrive live through pokes.
 *
 * The write set is built as a pure plan (`planAddStudy` / `planTemplate`,
 * name + args pairs) and then executed against a client — so tests can run
 * every template through `createTestEngine` and prove the fixture data
 * satisfies the mutator schemas without a socket.
 *
 * Members are D1 facts and are not seeded; template user ids (e.g.
 * `user_reviewer1`) render as unknown members unless remapped to real
 * project members via `userMapping`. Template PDF rows attach with their
 * fake R2 keys, matching the old plane's behavior (viewing them fails —
 * they exist for list UIs). When `devApplyTemplate` is given an `orgId`,
 * it additionally uploads real PDFs from the local dev pool and attaches
 * them with real R2 keys, so template projects get viewable PDFs.
 *
 * Dev-only: lazy-import this module so fixtures stay out of the main bundle.
 */

import { createWorkspace } from '@cf-sync/client';
import { loadDevPdfPool, takeDevPdf } from '@/lib/devPdfPool';
import { fetchReferenceByIdentifier } from '@/lib/referenceLookup';
import {
  resolveNestedTextValue,
  syncApp,
  textAnswerKeys,
  type ChecklistAnswerInput,
  type ChecklistType,
} from '@corates/shared/sync';
import { CHECKLIST_STATUS, getOutcomeKey } from '@corates/shared/checklists';
import { getWsBaseUrl } from '@/config/api';
import {
  generateAMSTAR2Answers,
  generateROB2Answers,
  generateROBINSIAnswers,
  getTemplate,
  type MockProjectData,
  type MockStudy,
} from './mock-templates';

/** One planned write: a mutator name and its args, validated at apply time. */
export interface SeedMutation {
  name: string;
  args: Record<string, unknown>;
}

/** Id/clock context so planners stay deterministic under test. */
export interface SeedContext {
  now: number;
  id: (prefix: string) => string;
}

export function defaultSeedContext(): SeedContext {
  return {
    now: Date.now(),
    id: prefix => `gen_${prefix}_${crypto.randomUUID().slice(0, 8)}`,
  };
}

// ---------------------------------------------------------------------------
// Session plumbing

function createSeedWorkspace(projectId: string) {
  return createWorkspace({
    url: getWsBaseUrl(),
    pathPrefix: '/api/sync',
    workspaceId: projectId,
    app: syncApp,
    persist: false,
    // The default clientId is per-tab-per-workspace (sessionStorage), which
    // would make concurrent seed sessions — and the pool's UI session for an
    // open project — supersede each other (4409). Each seed session is its
    // own short-lived client.
    clientId: `seed_${crypto.randomUUID()}`,
  });
}

type SeedWorkspace = ReturnType<typeof createSeedWorkspace>;
type SeedClient = SeedWorkspace['client'];

/** Open a short-lived seeding session and wait until it is live. */
async function withSeedSession<T>(
  projectId: string,
  fn: (workspace: SeedWorkspace) => Promise<T>,
): Promise<T> {
  const workspace = createSeedWorkspace(projectId);
  try {
    await waitForSynced(workspace.client);
    return await fn(workspace);
  } finally {
    await workspace.destroy();
  }
}

function waitForSynced(client: SeedClient, timeoutMs = 15_000): Promise<void> {
  if (client.status === 'synced') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error('dev seed: timed out connecting to the workspace'));
    }, timeoutMs);
    const unsubscribe = client.subscribeStatus(status => {
      if (status === 'synced') {
        clearTimeout(timer);
        unsubscribe();
        resolve();
      }
    });
  });
}

/**
 * Fire a plan through the outbox (order-preserving) and await every ack.
 * allSettled, not all: a single rejection must not abandon the still-inflight
 * remainder — the session's destroy() in withSeedSession would strand the
 * unsent tail of the outbox (persist is off, so it would simply be lost).
 * Failures aggregate into one error after everything settles.
 */
async function runPlan(client: SeedClient, plan: SeedMutation[]): Promise<void> {
  const mutate = client.mutate as unknown as Record<
    string,
    Record<string, (args: Record<string, unknown>) => Promise<unknown>>
  >;
  const results = await Promise.allSettled(
    plan.map(({ name, args }) => {
      const [namespace, op] = name.split('.');
      return mutate[namespace][op](args);
    }),
  );
  const failures = results
    .map((result, index) => ({ result, name: plan[index].name }))
    .filter(entry => entry.result.status === 'rejected');
  if (failures.length > 0) {
    const first = failures[0].result as PromiseRejectedResult;
    throw new Error(
      `dev seed: ${failures.length}/${plan.length} mutations rejected ` +
        `(first: ${failures[0].name}: ${String(first.reason)})`,
    );
  }
}

// ---------------------------------------------------------------------------
// Answer planning

/**
 * Plan one generated answers object onto a checklist: section updates via
 * `checklist.updateAnswer` (the mutator expands them to rows), prose via
 * `checklist.setText`.
 */
function planChecklistAnswers(
  checklistId: string,
  type: ChecklistType,
  answers: Record<string, unknown>,
  now: number,
): SeedMutation[] {
  const plan: SeedMutation[] = [];
  for (const [key, data] of Object.entries(answers)) {
    plan.push({
      name: 'checklist.updateAnswer',
      args: { checklistId, input: { type, key, data } as ChecklistAnswerInput, now },
    });
  }
  for (const flatKey of textAnswerKeys(type)) {
    // checklist.create prefills sectionA.outcome with the outcome name and
    // changeOutcome re-syncs it only while it still matches — overwriting it
    // with template prose would disable exactly the path dev should exercise.
    if (flatKey === 'sectionA.outcome') continue;
    const text = resolveNestedTextValue(answers, flatKey);
    if (text) {
      plan.push({ name: 'checklist.setText', args: { checklistId, key: flatKey, text } });
    }
  }
  return plan;
}

function generateChecklistAnswers(
  type: ChecklistType,
  fillMode: 'random' | 'all-yes' | 'mixed',
  seed: number,
): Record<string, unknown> {
  if (type === 'AMSTAR2') {
    return generateAMSTAR2Answers({ fill: fillMode, seed }) as Record<string, unknown>;
  }
  if (type === 'ROB2') {
    return { ...generateROB2Answers({ fill: fillMode, seed }) } as Record<string, unknown>;
  }
  const fill =
    fillMode === 'all-yes' ? 'complete'
    : fillMode === 'mixed' ? 'partial'
    : 'random';
  return generateROBINSIAnswers({ fill, seed }) as unknown as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Generated study (the old handleDevAddStudy)

export interface DevAddStudyOptions {
  type: ChecklistType;
  fillMode?: 'random' | 'all-yes' | 'mixed';
  reviewer1: string;
  reviewer2: string;
  /** Also create a finalized consensus checklist + reconciliation row. */
  reconcile?: boolean;
  /** Existing outcome id, or '__auto__'/undefined to create one (ROB2/ROBINS-I). */
  outcomeId?: string | null;
  /** 1-based number used in the generated study name. */
  studyNum?: number;
}

export interface DevAddStudyResult {
  studyId: string;
  checklistIds: string[];
  outcomeId: string | null;
}

/** Pure plan for one generated study with two completed reviewer checklists
 * and (optionally) a finalized consensus checklist. */
export function planAddStudy(
  options: DevAddStudyOptions,
  ctx: SeedContext = defaultSeedContext(),
): { plan: SeedMutation[]; result: DevAddStudyResult } {
  const {
    type,
    fillMode = 'random',
    reviewer1,
    reviewer2,
    reconcile = true,
    outcomeId: requestedOutcomeId,
    studyNum,
  } = options;
  if (!reviewer1 || !reviewer2 || reviewer1 === reviewer2) {
    throw new Error('devAddStudy: two distinct reviewers are required');
  }

  const { now } = ctx;
  const seed1 = now;
  const seed2 = seed1 + 9999;
  const studyId = ctx.id('study');
  const checklist1Id = ctx.id('cl1');
  const checklist2Id = ctx.id('cl2');
  const reconciledChecklistId = reconcile ? ctx.id('rec') : null;
  const num = studyNum ?? Math.floor(now / 1000) % 10000;

  const requiresOutcome = type === 'ROB2' || type === 'ROBINS_I';
  let outcomeId: string | null = null;
  const plan: SeedMutation[] = [];

  if (requiresOutcome) {
    if (requestedOutcomeId && requestedOutcomeId !== '__auto__') {
      outcomeId = requestedOutcomeId;
    } else {
      outcomeId = ctx.id('outcome');
      plan.push({
        name: 'outcome.create',
        args: { id: outcomeId, name: `Generated Outcome ${num}`, createdBy: reviewer1, now },
      });
    }
  }

  plan.push(
    {
      name: 'study.create',
      args: {
        id: studyId,
        name: `Generated Study ${num}`,
        description: `Auto-generated ${type} study`,
        metadata: {
          originalTitle: `Generated Study ${num}`,
          firstAuthor: `Author${num}`,
          publicationYear: String(2020 + (num % 5)),
          authors: `Author${num} A, Author${num} B`,
          journal: 'Generated Journal',
        },
        now,
      },
    },
    { name: 'study.update', args: { id: studyId, updates: { reviewer1, reviewer2 }, now } },
  );

  const checklists: Array<{ id: string; assignedTo: string | null; status: string; seed: number }> =
    [
      {
        id: checklist1Id,
        assignedTo: reviewer1,
        status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
        seed: seed1,
      },
      {
        id: checklist2Id,
        assignedTo: reviewer2,
        status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
        seed: seed2,
      },
    ];
  if (reconcile && reconciledChecklistId) {
    checklists.push({
      id: reconciledChecklistId,
      assignedTo: null,
      status: CHECKLIST_STATUS.FINALIZED,
      seed: seed1 + 5555,
    });
  }

  for (const checklist of checklists) {
    plan.push({
      name: 'checklist.create',
      args: { id: checklist.id, studyId, type, assignedTo: checklist.assignedTo, outcomeId, now },
    });
    plan.push(
      ...planChecklistAnswers(
        checklist.id,
        type,
        generateChecklistAnswers(type, fillMode, checklist.seed),
        now,
      ),
    );
    plan.push({
      name: 'checklist.update',
      args: { checklistId: checklist.id, updates: { status: checklist.status }, now },
    });
  }

  if (reconcile && reconciledChecklistId) {
    plan.push({
      name: 'reconciliation.saveProgress',
      args: {
        studyId,
        outcomeId,
        type,
        data: { checklist1Id, checklist2Id, reconciledChecklistId },
        now,
      },
    });
  }

  return {
    plan,
    result: {
      studyId,
      checklistIds: [
        checklist1Id,
        checklist2Id,
        ...(reconciledChecklistId ? [reconciledChecklistId] : []),
      ],
      outcomeId,
    },
  };
}

export async function devAddStudy(
  projectId: string,
  options: DevAddStudyOptions,
): Promise<DevAddStudyResult> {
  const { plan, result } = planAddStudy(options);
  await withSeedSession(projectId, async ({ client }) => runPlan(client, plan));
  return result;
}

// ---------------------------------------------------------------------------
// Templates (the old handleDevApplyTemplate)

export interface PlanTemplateOptions {
  /** Template user id → real project member id. Unmapped ids pass through. */
  userMapping?: Record<string, string>;
  /** Used as createdBy for template outcomes. */
  actorId: string;
}

/** Pure plan applying one mock project template's outcomes and studies. */
export function planTemplate(
  data: MockProjectData,
  { userMapping = {}, actorId }: PlanTemplateOptions,
  ctx: SeedContext = defaultSeedContext(),
): SeedMutation[] {
  const mapUser = (id: string | null): string | null =>
    id === null ? null : (userMapping[id] ?? id);

  const plan: SeedMutation[] = [];
  for (const [outcomeId, outcome] of Object.entries(data.meta.outcomes ?? {})) {
    plan.push({
      name: 'outcome.create',
      args: { id: outcomeId, name: outcome.name, createdBy: actorId, now: ctx.now },
    });
  }
  for (const study of data.studies) {
    planTemplateStudy(study, mapUser, ctx, plan);
  }
  return plan;
}

function planTemplateStudy(
  study: MockStudy,
  mapUser: (id: string | null) => string | null,
  ctx: SeedContext,
  plan: SeedMutation[],
): void {
  const { now } = ctx;
  plan.push({
    name: 'study.create',
    args: {
      id: study.id,
      name: study.name,
      description: study.description,
      metadata: {
        originalTitle: study.originalTitle,
        firstAuthor: study.firstAuthor,
        publicationYear: String(study.publicationYear),
        authors: study.authors,
        journal: study.journal,
        doi: study.doi,
        abstract: study.abstract,
        ...(study.pdfUrl ? { pdfUrl: study.pdfUrl } : {}),
        ...(study.pdfSource ? { pdfSource: study.pdfSource } : {}),
        pdfAccessible: study.pdfAccessible,
      },
      now,
    },
  });
  const reviewer1 = mapUser(study.reviewer1);
  const reviewer2 = mapUser(study.reviewer2);
  if (reviewer1 || reviewer2) {
    plan.push({
      name: 'study.update',
      args: {
        id: study.id,
        updates: {
          ...(reviewer1 ? { reviewer1 } : {}),
          ...(reviewer2 ? { reviewer2 } : {}),
        },
        now,
      },
    });
  }

  for (const checklist of study.checklists) {
    const type = checklist.type as ChecklistType;
    plan.push({
      name: 'checklist.create',
      args: {
        id: checklist.id,
        studyId: study.id,
        type,
        assignedTo: mapUser(checklist.assignedTo),
        outcomeId: checklist.outcomeId ?? null,
        now,
      },
    });
    plan.push(
      ...planChecklistAnswers(
        checklist.id,
        type,
        checklist.answers as unknown as Record<string, unknown>,
        now,
      ),
    );
    const updates: { status?: string; title?: string } = {};
    if (checklist.status !== CHECKLIST_STATUS.PENDING) updates.status = checklist.status;
    if (checklist.title) updates.title = checklist.title;
    if (Object.keys(updates).length > 0) {
      plan.push({ name: 'checklist.update', args: { checklistId: checklist.id, updates, now } });
    }
  }

  for (const pdf of study.pdfs) {
    plan.push({
      name: 'pdf.attach',
      args: {
        studyId: study.id,
        pdf: {
          id: ctx.id('pdf'),
          key: pdf.key,
          fileName: pdf.fileName,
          size: pdf.size,
          uploadedBy: mapUser(pdf.uploadedBy) ?? pdf.uploadedBy,
          uploadedAt: pdf.uploadedAt,
        },
        now,
      },
    });
  }

  // Synthesize the reconciliation-progress row when the template ships a
  // consensus checklist beside two reviewer checklists of the same group.
  const groups = new Map<
    string,
    { reviewers: string[]; consensus: string | null; type: ChecklistType; outcomeId: string | null }
  >();
  for (const checklist of study.checklists) {
    const key = getOutcomeKey(checklist.outcomeId ?? null, checklist.type);
    let group = groups.get(key);
    if (!group) {
      group = {
        reviewers: [],
        consensus: null,
        type: checklist.type as ChecklistType,
        outcomeId: checklist.outcomeId ?? null,
      };
      groups.set(key, group);
    }
    if (checklist.assignedTo === null) group.consensus = checklist.id;
    else group.reviewers.push(checklist.id);
  }
  for (const group of groups.values()) {
    if (group.consensus && group.reviewers.length >= 2) {
      plan.push({
        name: 'reconciliation.saveProgress',
        args: {
          studyId: study.id,
          outcomeId: group.outcomeId,
          type: group.type,
          data: {
            checklist1Id: group.reviewers[0],
            checklist2Id: group.reviewers[1],
            reconciledChecklistId: group.consensus,
          },
          now,
        },
      });
    }
  }
}

export interface ApplyTemplateOptions extends PlanTemplateOptions {
  mode?: 'replace' | 'merge';
  /** When set, upload one real PDF per study from the local dev pool and
   * attach it with its real R2 key. Skipped when the pool is not downloaded. */
  orgId?: string;
  /** Fetch real reference metadata (CrossRef/Unpaywall) for studies with DOIs
   * and merge it over the fixture metadata. Off by default so e2e seeding
   * never depends on external APIs. */
  enrichReferences?: boolean;
  /** Interim status text (reference fetches, PDF uploads) for the dev UI. */
  onProgress?: (message: string) => void;
}

export async function devApplyTemplate(
  projectId: string,
  templateName: string,
  {
    mode = 'replace',
    orgId,
    enrichReferences = false,
    onProgress,
    ...planOptions
  }: ApplyTemplateOptions,
): Promise<{ studies: number; pdfs: number; references: number }> {
  const data = getTemplate(templateName);
  if (!data) throw new Error(`devApplyTemplate: unknown template "${templateName}"`);

  return withSeedSession(projectId, async ({ client, collections }) => {
    if (mode === 'replace') {
      // Studies first (their deletion cascades checklist rows that would
      // otherwise hold OutcomeInUse), then outcomes. Through runPlan so every
      // deletion settles before we proceed (or the aggregate error surfaces).
      await runPlan(
        client,
        collections.studies.toArray.map(study => ({
          name: 'study.delete',
          args: { id: study.id },
        })),
      );
      await runPlan(
        client,
        collections.outcomes.toArray.map(outcome => ({
          name: 'outcome.delete',
          args: { id: outcome.id },
        })),
      );
    }

    const ctx = defaultSeedContext();
    const plan = planTemplate(data, planOptions, ctx);
    await runPlan(client, plan);

    const references =
      enrichReferences ? await enrichStudyReferences(client, data, ctx, onProgress) : 0;
    const pdfs =
      orgId ?
        await attachPoolPdfs(client, orgId, projectId, data, planOptions.actorId, ctx, onProgress)
      : 0;
    return { studies: data.studies.length, pdfs, references };
  });
}

/**
 * Fetch real reference metadata for every template study with a DOI and merge
 * it over the fixture metadata via `study.update`, plus a readable study name
 * ("Smith et al. 2021"). Sequential on purpose — CrossRef rate-limits bursts.
 * A failed lookup skips that study rather than failing the seed.
 */
async function enrichStudyReferences(
  client: SeedClient,
  data: MockProjectData,
  ctx: SeedContext,
  onProgress?: (message: string) => void,
): Promise<number> {
  const withDois = data.studies.filter(study => study.doi);
  const plan: SeedMutation[] = [];
  for (const study of withDois) {
    try {
      const ref = await fetchReferenceByIdentifier(study.doi);
      const updates: Record<string, unknown> = {};
      const merge = (key: string, value: unknown) => {
        if (value !== null && value !== undefined && value !== '') updates[key] = value;
      };
      merge('originalTitle', ref.title);
      merge('firstAuthor', ref.firstAuthor);
      merge('publicationYear', ref.publicationYear ? String(ref.publicationYear) : null);
      merge('authors', ref.authors);
      merge('journal', ref.journal);
      merge('doi', ref.doi);
      merge('abstract', ref.abstract);
      merge('pdfUrl', ref.pdfUrl);
      merge('pdfSource', ref.pdfSource);
      merge('pdfAccessible', ref.pdfAccessible);
      if (ref.firstAuthor && ref.publicationYear) {
        updates.name = `${ref.firstAuthor} et al. ${ref.publicationYear}`;
      } else if (ref.title) {
        updates.name = ref.title.length > 60 ? `${ref.title.slice(0, 57)}...` : ref.title;
      }
      plan.push({ name: 'study.update', args: { id: study.id, updates, now: ctx.now } });
      onProgress?.(`Fetching references (${plan.length}/${withDois.length})...`);
    } catch (err) {
      console.warn(`dev seed: reference lookup failed for ${study.doi}`, err);
    }
  }
  await runPlan(client, plan);
  return plan.length;
}

/**
 * Upload one dev-pool PDF per study (round-robin over the pool) and attach it
 * through the seed session. Publisher PDFs block automated downloads, so the
 * pool (`pnpm --filter web dev:pdfs`) is the only way template projects get
 * real, viewable PDFs. An empty pool or a failed upload skips that study
 * rather than failing the whole seed.
 */
async function attachPoolPdfs(
  client: SeedClient,
  orgId: string,
  projectId: string,
  data: MockProjectData,
  actorId: string,
  ctx: SeedContext,
  onProgress?: (message: string) => void,
): Promise<number> {
  const pool = await loadDevPdfPool();
  if (pool.length === 0) return 0;

  // Lazy: @/api/pdf-api transitively imports server-function modules that
  // reference `cloudflare:workers`, which the unit-test module graph (via
  // seed.test.ts) cannot resolve.
  const { uploadPdf } = await import('@/api/pdf-api');

  const plan: SeedMutation[] = [];
  for (const [index, study] of data.studies.entries()) {
    const poolPdf = await takeDevPdf(pool, index);
    if (!poolPdf) continue;
    try {
      onProgress?.(`Uploading PDFs (${plan.length + 1}/${data.studies.length})...`);
      const uploaded = await uploadPdf(orgId, projectId, study.id, poolPdf.data, poolPdf.fileName);
      plan.push({
        name: 'pdf.attach',
        args: {
          studyId: study.id,
          pdf: {
            id: ctx.id('pdf'),
            key: uploaded.key,
            fileName: uploaded.fileName,
            size: uploaded.size,
            uploadedBy: actorId,
            uploadedAt: ctx.now,
          },
          tag: 'primary',
          now: ctx.now,
        },
      });
    } catch (err) {
      console.warn(`dev seed: pool PDF upload failed for study ${study.id}`, err);
    }
  }
  await runPlan(client, plan);
  return plan.length;
}

export type { MockProjectData };
