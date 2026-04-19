# TypeScript Audit — CoRATES

Date: 2026-04-18 (revised after self-review)
Scope: `packages/web`, `packages/workers`, `packages/shared`, `packages/db`
Excludes: `node_modules`, `dist`, `.tanstack`, `reference/`, `packages/stripe-purchases` (separate Hono workspace), `packages/stripe-dev`, `packages/ai`

## TL;DR

Strict mode is on across all four packages — solid baseline. The big wins are not language-feature obscurities; they're the patterns a 2026-vintage TS codebase should reach for and largely doesn't:

1. **Branded IDs are absent.** Every `userId`/`orgId`/`projectId` is a raw `string`. In a multi-entity domain this is the highest-leverage missing pattern.
2. **TanStack Router validators are essentially unused** — only 2 routes have `validateSearch`, and even those use `as string` casts inside the validator (defeating the point).
3. **API route response types aren't exported** — every TanStack Start file route returns `Response.json({...})` and every consumer in `hooks/`/`api/` re-types the payload by hand (115 `as Record<string, unknown>` casts in `packages/web/src`).
4. **Engine adapter contract isn't honored** by its consumers — well-designed 4-param generic, but `EngineContext<any, any, …>` at the call sites.
5. **`satisfies` is used 3 times in the entire repo** — strong signal of underuse.
6. **Zero `assertNever` / exhaustiveness guards** anywhere.
7. **No type tests** — for a codebase with custom generics like the reconcile engine, this means contract regressions ship silently.

Order-of-attack is at the bottom. The single highest safety/cost change is `assertNever`. The single highest leverage change is **branded IDs**.

---

## Verified counts

| Signal                                               |   Count | Where                                               |
| ---------------------------------------------------- | ------: | --------------------------------------------------- |
| `as Record<string, unknown>`                         |     115 | `packages/web/src` (29 files)                       |
| `as any`                                             |     144 | all packages (55 files)                             |
| `: any` / `<any>` / `as any` (broad)                 |     427 | `packages/web/src` (98 files)                       |
| `@ts-ignore` / `@ts-expect-error`                    |       3 | 2 in d3 charts, 1 in workers `types.d.ts`           |
| `satisfies`                                          |       3 | only in `workers/durable-objects` and `oauth-relay` |
| `assertNever` / `: never =>` exhaustiveness fallback |       0 | nowhere                                             |
| `validateSearch` / TanStack Router `validator:`      |       2 | both use `as string` inside the validator           |
| Brand types (`__brand`, `Brand<…>`)                  |       0 | none                                                |
| Type tests (`expectTypeOf`, tsd, `assertType`)       |       0 | none                                                |
| `createServerFn` (TanStack Start typed RPC)          |       0 | not used                                            |
| `hc<…>` Hono RPC                                     |       0 | N/A — no Hono in web/workers                        |
| `$inferSelect` / `$inferInsert` / `Infer*Model`      | 2 files | `db/orgAccessGrants.ts`, `db/stripeEventLedger.ts`  |

---

## Critical (boundary failures)

### C1. Route handlers throw away their response shape

Every API file route exports a plain handler that returns `Response.json({...})`. The literal object shape is never captured as a type, so consumers can't import it.

Example, `packages/web/src/routes/api/billing/subscription.ts:18-85`:

```ts
export const handleGet = async ({ request }) => {
  // ...
  return Response.json({
    tier: orgBilling.effectivePlanId,
    status: ...,
    tierInfo: { name, description },
    stripeSubscriptionId: ... | null,
    currentPeriodEnd: ... | null,
    cancelAtPeriodEnd: boolean,
    // ...
  }, { status: 200 });
};
```

`packages/web/src/hooks/useSubscription.ts:17-44` re-declares the shape by hand:

```ts
export interface Subscription {
  tier: string;
  status: string; /* ...8 fields */
}
async function fetchSubscription(): Promise<Subscription> {
  return (await res.json()) as Subscription; // unchecked cast
}
```

Repeated across `useAdminQueries.ts` (10+ endpoints), `api/billing.ts`, `useMyProjectsList.ts`, ~25 more files.

**There are three honest options here. Pick one per endpoint, not all three:**

**Option A — Just export the response type from the route file (lowest cost).**

```ts
// route file
export type SubscriptionResponse = {
  tier: string; status: string; /* ... */
};
export const handleGet = async (...): Promise<Response> => {
  const payload: SubscriptionResponse = { /* ... */ };
  return Response.json(payload, { status: 200 });
};

// consumer
import type { SubscriptionResponse } from '@/routes/api/billing/subscription';
const data = (await res.json()) as SubscriptionResponse;
```

Same trust level as today (still a runtime cast in the consumer), but adding/removing fields on the server breaks the consumer at compile time. Zero machinery, zero runtime cost.

**Option B — Zod-parse at the boundary (real safety).**

```ts
// shared schema
export const SubscriptionSchema = z.object({ tier: z.string() /* ... */ });
export type Subscription = z.infer<typeof SubscriptionSchema>;

// route
return Response.json(SubscriptionSchema.parse(payload));

// consumer
return SubscriptionSchema.parse(await res.json());
```

Costs a bundle-size hit and a parse pass per request, but you get genuine runtime guarantees in both directions. Right call for high-stakes endpoints (billing, auth, admin); overkill for static reads.

**Option C — Migrate hot endpoints to `createServerFn`.**
TanStack Start's blessed RPC. Full end-to-end inference, no hand-rolled types, no `Response.json` parse. Currently used in zero endpoints in this repo. Right answer for _new_ endpoints; per-endpoint migration cost for existing routes.

Earlier I recommended a phantom-typed `TypedResponse<T>` wrapper. Withdrawn — it's just `as` with extra steps.

### C2. Drizzle inference is barely used

Only `packages/db/src/orgAccessGrants.ts:6` and `stripeEventLedger.ts` use `InferSelectModel`. `packages/db/src/schema.ts` (50+ tables) exports raw Drizzle definitions but never `typeof user.$inferSelect`.

Worse, `orgAccessGrants.ts:8-16` hand-writes `CreateGrantData`:

```ts
interface CreateGrantData {
  id: string;
  orgId: string;
  type: string;
  startsAt: Date;
  expiresAt: Date;
  stripeCheckoutSessionId?: string | null;
  metadata?: Record<string, unknown> | null;
}
```

This duplicates the schema. Use `typeof orgAccessGrants.$inferInsert`.

**Fix**: in each schema module, append:

```ts
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
```

Re-export from `packages/db/src/index.ts`. Delete shadow interfaces in callers.

### C3. Engine adapters don't honor their own contract

`packages/web/src/components/project/reconcile-tab/engine/types.ts:153-264` defines a clean 4-param generic `ReconciliationAdapter<TChecklist, TFinalAnswers, TComparison, TNavItem>`.

But `adapter.tsx:304` and `:488` instantiate as:

```ts
function renderPage(context: EngineContext<any, any, ComparisonResult | null, Rob2NavItem>) { ... }
function Rob2NavbarAdapter(navbarContext: NavbarContext<any, ComparisonResult | null, Rob2NavItem>) { ... }
```

Two of four type parameters are `any`. And `ReconciliationEngineProps` (lines 270-296) uses `checklist1: unknown`, `checklist2: unknown` — the public boundary erases generics entirely.

**Honest assessment of the fix cost:** This is _not_ a "just pipe TChecklist through" change. The reason `any` slipped in is that `renderPage` does `c1?.preliminary?.[currentItem.key]` — index access on a generic with a runtime-discovered key. To make that typed, `Rob2NavItem` variants would need to carry their own typed accessor functions:

```ts
type Rob2NavItem =
  | {
      type: 'preliminary';
      key: keyof ROB2Checklist['preliminary'];
      getValue: (c: ROB2Checklist) => string | undefined;
    }
  | { type: 'domainQuestion'; domainKey: keyof ROB2Checklist['domains']; ... }
  | ...;
```

That's a real refactor with judgment calls (where do the accessors live? do they replace the existing `meta` field or supplement it?). Two paths:

1. **Minimal**: just type `ReconciliationEngineProps` so callers pass typed checklists; leave the adapter internals as `any` for now. Catches the _external_ contract violation without touching the adapter body.
2. **Full**: redesign nav items to carry typed accessors. Larger change; would close C3 properly but might be a 1–2 day refactor.

A type test (see G1 below) would have caught this regression at PR time without requiring the full refactor.

---

## High-impact (type-safety leaks)

### H1. Checklist registry is fully untyped

`packages/web/src/checklist-registry/index.ts:23-69`:

```ts
interface ChecklistConfig {
  createChecklist: (..._args: any[]) => any;
  scoreChecklist: (_state: any) => string;
  getAnswers: (_state: any) => any;
}
export function createChecklistOfType(type: string, options: Record<string, unknown>): any { … }
export function scoreChecklistOfType(type: string, state: any): string { … }
```

`AMSTAR2Checklist | ROB2Checklist | ROBINSIChecklist` already exist as concrete types. Convert to a discriminated map:

```ts
type ChecklistMap = {
  AMSTAR2: AMSTAR2Checklist;
  ROB2: ROB2Checklist;
  ROBINS_I: ROBINSIChecklist;
};
type ChecklistKind = keyof ChecklistMap;
interface ChecklistConfig<K extends ChecklistKind> {
  create: (opts: ...) => ChecklistMap[K];
  score: (state: ChecklistMap[K]) => string;
  getAnswers: (state: ChecklistMap[K]) => ...;
}
const REGISTRY = {
  AMSTAR2: { create: createAMSTAR2, score: scoreAMSTAR2, getAnswers: getAMSTAR2Answers },
  ROB2: { ... },
  ROBINS_I: { ... },
} satisfies { [K in ChecklistKind]: ChecklistConfig<K> };
```

Note: callers passing a `string`-typed kind still need to narrow at runtime to get a specific type — the registry doesn't _eliminate_ the dispatch, it just makes it type-safe.

### H2. `as unknown as AuthUser` double-cast

`packages/workers/src/auth/session-helper.ts:25-26`:

```ts
return {
  user: result.user as unknown as AuthUser,
  session: result.session as unknown as AuthSession,
};
```

`as unknown as X` is the strongest "trust me" cast in the language. Better-auth's user shape can drift between versions. Replace with a Zod parse at the session boundary.

### H3. Google Picker — install `@types/google.picker`

`packages/web/src/lib/googlePicker.ts:79, 117, 122, 127-152` has 7 `google!` non-null assertions plus `(data: any)`, `let builder: any`, `const docs: any[]`, `(doc: any)`, with hand-rolled stubs at the top.

`@types/google.picker` exists on npm (currently v0.0.52). Installing it removes the need for the hand-rolled stubs. Then narrow `window.google?.picker` once after `loadGooglePicker()` and the `!`s and `any`s collapse.

### H4. `server.ts` casts upward to `never`

`packages/web/src/server.ts:35, 44, 51, 62`:

```ts
async fetch(request: Request, env: unknown, ctx: ExecutionContext): Promise<Response> {
  // ...
  const stub = getProjectDocStub(env as never, projectId);
  const ns = (env as DOEnv).USER_SESSION;
  return startFetch(request, { context: { cloudflareCtx: ctx } } as never);
}
```

Casting _to_ `never` is a smell that the binding type is too narrow at the source. The handler is typed `env: unknown` precisely so it has to be cast every time. Since `packages/workers/tsconfig.json` already includes `worker-configuration.d.ts`, prefer the typed `env` import from `cloudflare:workers` (already used on line 8) over the parameter, and define a proper `Env` type for the handler signature.

### H5. `error as Error` in catch blocks

At least 3 sites: `routes/api/billing/subscription.ts:77`, `routes/api/admin/projects/$projectId.ts:132,165`, `routes/api/google-drive/import.ts:219`. With `useUnknownInCatchVariables` (TS 4.4+ default in strict), use `instanceof Error` narrowing. A 5-line helper `errorMessage(e: unknown): string` would centralize this.

### H6. OAuth relay context augmentation via `as any`

`packages/workers/src/auth/oauth-relay.ts:188, 357`:

```ts
(ctx.context as any)._relayOrigin = currentOrigin;
const relayOrigin = (ctx.context as any)._relayOrigin;
```

Use TypeScript module augmentation against better-auth's context type. A 6-line `declare module` block removes both `any` casts permanently.

---

## Missing patterns (what an expert would expect to see)

This section was added during self-review. These are absent from the codebase entirely.

### G1. No type tests

Zero `expectTypeOf`/`tsd`/`assertType` calls anywhere. For a codebase that ships a custom generic like `ReconciliationAdapter<TChecklist, TFinalAnswers, TComparison, TNavItem>`, type tests catch contract regressions like C3 at PR time.

Vitest already supports type tests via `expectTypeOf`. Suggested setup:

```ts
// engine/__type-tests__/adapter.test-d.ts
import { expectTypeOf } from 'vitest';
import type { ReconciliationAdapter } from '../engine/types';
import { rob2Adapter } from '../rob2-reconcile/adapter';
import type { ROB2Checklist } from '@corates/shared';

// Catches the C3 regression: adapter must use ROB2Checklist, not any
expectTypeOf(rob2Adapter).toMatchTypeOf<ReconciliationAdapter<ROB2Checklist, any, any, any>>();
```

A few well-placed type tests are worth more than blanket annotation rules.

### G2. Branded IDs

Every entity ID is a raw `string`. In a domain with `userId`, `orgId`, `projectId`, `studyId`, `mediaFileId`, `grantId`, `subscriptionId`, `invitationId` — no brand, no compile-time prevention of "passed projectId where userId was expected." This is a recurring real-bug class in multi-entity systems.

Lightest version with Zod (you already use Zod):

```ts
// packages/shared/src/ids.ts
export const UserId = z.string().brand<'UserId'>();
export type UserId = z.infer<typeof UserId>;
export const OrgId = z.string().brand<'OrgId'>();
export type OrgId = z.infer<typeof OrgId>;
export const ProjectId = z.string().brand<'ProjectId'>();
export type ProjectId = z.infer<typeof ProjectId>;
// ... etc
```

Then types like `getProjectById(id: ProjectId)` reject a raw `string` _and_ reject an `OrgId`. Drizzle integration via `.$type<ProjectId>()` on the column. Cost: a few hours to introduce, plus a knock-on pass to update signatures. Highest leverage missing pattern in this repo.

### G3. TanStack Router validators are essentially unused

Only `_auth/check-email.tsx:15` and `_auth/reset-password.tsx:20` define `validateSearch`. And both look like:

```ts
validateSearch: (search: Record<string, unknown>) => ({
  email: (search.email as string) || '',
}),
```

The `as string` cast inside a validator defeats the entire point — there's no actual validation. Every `$projectId`, `$orgId`, `$userId` route accepts whatever string comes in.

Replace with Zod (you already have it):

```ts
validateSearch: z.object({ email: z.string().email() }).parse,
```

For path params, use TanStack Router's `params: { parse }` config with `z.string().uuid()` (or branded IDs from G2). This gives typed _and_ runtime-valid params at the route level — currently 0% of routes do this.

### G4. `satisfies` operator is used 3 times in the whole repo

`satisfies` lets you constrain a value to a type without widening the inferred literal type. In a 2026 TS codebase this should be doing real work in registry objects, route configs, plan definitions, theme objects, etc.

Concrete example here — the checklist registry at `packages/web/src/checklist-registry/index.ts:29`:

```ts
const CHECKLIST_REGISTRY: Record<string, ChecklistConfig> = { ... };
```

With `: Record<string, ChecklistConfig>` you've widened the keys to `string` and lost the ability to infer "the keys are exactly AMSTAR2 | ROB2 | ROBINS_I." Switch to `satisfies` (in combination with H1's typed map):

```ts
const CHECKLIST_REGISTRY = {
  AMSTAR2: { ... },
  ROB2: { ... },
  ROBINS_I: { ... },
} satisfies { [K in ChecklistKind]: ChecklistConfig<K> };
```

Keys stay narrow, values get checked. This pattern applies in many places — plan definitions in `packages/shared/src/plans`, query keys in `packages/web/src/lib/queryKeys`, etc.

### G5. `verbatimModuleSyntax: false` in `packages/web/tsconfig.json`

Setting it to `true` enforces `import type` for type-only imports, which:

- Lets the bundler eliminate type imports cleanly (avoids accidentally pulling in runtime modules just for types).
- Avoids subtle Vite HMR / TanStack Start route-tree generation issues caused by type-only modules being treated as runtime modules.

Modern TanStack/Vite projects ship with this on. Flipping it would surface a one-time cleanup pass (lint can autofix most of it) and prevent a class of subtle build issues going forward.

---

## Medium (pattern hygiene)

### M1. No exhaustiveness guards anywhere

Zero matches for `assertNever` or equivalent fallback. The reconcile adapters all have `if (currentItem.type === ...)` chains ending in:

```ts
return <div className='py-12 text-center'>Unknown item type</div>;  // adapter.tsx:480
```

Add to `packages/shared`:

```ts
export const assertNever = (x: never): never => {
  throw new Error(`Unhandled variant: ${JSON.stringify(x)}`);
};
```

Apply to the rob2/robins adapter switches. Converts "added a new nav item type" from a runtime UI bug into a compile error. **Single highest safety/cost ratio change in this audit.**

### M2. `FinalAnswers = Record<string, unknown>` is too loose

`packages/web/src/components/project/reconcile-tab/rob2-reconcile/navbar-utils.ts:90`. The structure is known: `{ preliminary?: Partial<ROB2PreliminaryState>; [domain]: DomainState }`. Replacing the alias propagates real types into `hasNavItemAnswer`, `isNavItemAgreement`, `getCurrentItemComparison`.

### M3. Correlated optional fields instead of discriminated structure

`adapter.tsx:39, 339, 354` — `PRELIMINARY_TEXT_FIELDS.includes(currentItem.key)` is a runtime check selecting which preliminary fields need Y.Text sync. Promote the field union into the type system: `type TextFieldKey = 'experimental' | 'comparator' | 'sources' | …` and key the field map by it. The runtime `.includes()` becomes a compile-time guarantee.

### M4. `ChecklistHandler` not generic over its answers

`packages/web/src/primitives/useProject/checklists/handlers/base.ts:16-36` returns `Record<string, unknown>`. Each subclass already knows its answer shape — make the abstract class `ChecklistHandler<TAnswers>` and the concrete subclasses pin `TAnswers`.

### M5. `apiFetch` `<T>` defaults to `unknown` but never validates

`packages/web/src/lib/apiFetch.ts:93, 98, 102` — `return (await response.json()) as T;`. The wrapper shape is well-thought-through (good `Omit` use on per-verb overloads at lines 107-128). Rather than baking validation into the fetcher, just compose Zod parsing at the call site for boundary-critical endpoints — it stays explicit and the fetcher stays simple.

---

## Yjs ceiling (clarification)

`packages/workers/src/durable-objects/ProjectDoc.ts` uses `Y.Map<unknown>()` and `?: unknown` fields heavily. **Yjs's API genuinely cannot give you better runtime typing** — Y.Map values are dynamically typed at the protocol level. Don't try to "fix" this directly.

The right pattern is a typed _façade_ over the Y.Doc that exposes typed read/write methods:

```ts
class TypedProjectDoc {
  constructor(private doc: Y.Doc) {}
  getMeta(): ProjectMeta {
    return this.yMapToPlain(this.doc.getMap('meta'));
  }
  setTitle(title: string) {
    this.doc.getMap('meta').set('title', title);
  }
}
```

Move all `as Record<string, unknown>` and `as ProjectMeta` casts into the façade methods. Consumers get typed access; the façade isolates the Yjs trust boundary to one file. This is the right shape — not removing the casts, but containing them.

---

## What to keep doing (already good)

- **Strict mode + `noUnusedLocals` + `noUnusedParameters` + `noFallthroughCasesInSwitch`** across all packages.
- **`Rob2NavItem` discriminated union** (`navbar-utils.ts:29-47`) — textbook. Drives clean narrowing in `hasNavItemAnswer`/`isNavItemAgreement`.
- **`ReconciliationAdapter` interface design** (`engine/types.ts:153-264`) — well-constrained 4-param generic with sensible defaults and a `TNavItem extends ReconciliationNavItem` constraint. The implementation just doesn't honor it (see C3).
- **`apiFetch` per-verb overloads** with `Omit<…, 'method' | 'body'>` — correct way to model HTTP method overloads.
- **`withRetry<T>`** in `packages/workers/src/lib/retry.ts:32-95` — properly carries `T` through `RetryResult<T>` without leaking.
- **Limited `@ts-expect-error` use** — only 3 instances total, all justified.

---

## Suggested order of attack (revised)

| #   | Change                                                                                                        |                   Effort | Why now                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------- | -----------------------: | -------------------------------------------------------------------------------------------------------------- |
| 1   | `assertNever` helper + apply to reconcile adapters                                                            |                   30 min | Free safety. Closes M1.                                                                                        |
| 2   | `$inferSelect`/`$inferInsert` re-exports from db schema, delete shadow interfaces                             |                   1–2 hr | Closes C2. Removes a duplication source.                                                                       |
| 3   | **Branded IDs** (G2): introduce `UserId`/`OrgId`/`ProjectId` etc., adopt incrementally at function signatures | 3–5 hr initial + ongoing | Highest leverage missing pattern. Pays off forever.                                                            |
| 4   | Auth `as unknown as` → Zod parse (H2); oauth-relay module augmentation (H6)                                   |                   1–2 hr | Closes the two highest-trust auth bypasses.                                                                    |
| 5   | Pick 3–5 hot endpoints, apply C1 Option A (`export type` from route)                                          |                 half day | Kills a chunk of `as Record<string, unknown>` with minimal ceremony. Use Option B (Zod) only for billing/auth. |
| 6   | Checklist registry → discriminated map + `satisfies` (H1 + G4)                                                |                   2–3 hr | Removes the most concentrated `any` cluster.                                                                   |
| 7   | Add Vitest type tests for `ReconciliationAdapter` (G1)                                                        |                   1–2 hr | Cheaper than the C3 full refactor; catches future regressions.                                                 |
| 8   | `@types/google.picker` install + single-guard cleanup (H3)                                                    |                   30 min | Quick win.                                                                                                     |
| 9   | TanStack Router validators with Zod for top routes (G3)                                                       |                 half day | Validates path/search params at route boundary.                                                                |
| 10  | `verbatimModuleSyntax: true` in web tsconfig (G5)                                                             |  1–2 hr (mostly autofix) | One-time cleanup; pays off in build cleanliness.                                                               |
| 11  | `server.ts` env typing (H4); Yjs façade extraction                                                            |                    1 day | Lower priority — current state isn't actively dangerous.                                                       |

Items 1–3 are the highest leverage. Items 4–7 are the type-safety substance. Items 8–11 are polish.

---

## What was deliberately removed during self-review

For transparency:

- **Earlier phantom-typed `json<T>()` wrapper recommendation in C1.** Withdrawn — it's `as` with extra steps. Replaced with three honest options.
- **Earlier "pipe TChecklist through ReconciliationEngineProps" in C3.** Reframed — it's not that simple, the index access pattern is the actual blocker, and the realistic minimal fix is just typing the public boundary.
- **Earlier "mapped checklist type `ChecklistWithQuestions<TKeys>`" recommendation.** Removed — wrong. AMSTAR2/ROB2/ROBINS-I have structurally different shapes (flat questions vs domains+signaling vs sections), not just different keys. A unifying mapped type would lose information.
- **Earlier "explicit return type on `compareChecklists`" recommendation.** Removed — style preference, not correctness. Many top-tier TS codebases (tRPC, TanStack, Effect) deliberately rely on inference for internal functions to avoid annotation rot.
- **Earlier "Hono RPC client" recommendation.** Already withdrawn in v1 — there's no Hono in `packages/web`/`packages/workers`. The `packages/stripe-purchases` Hono workspace is separate.

## Methodology notes

- All findings were verified by reading cited files at cited line numbers.
- "212 `as Record<string, unknown>`" from initial exploration was an overcount; verified count is **115** in `packages/web/src` (29 files).
- The audit was reviewed for expert plausibility after the first draft and revised — the `## What was deliberately removed` section above lists what changed and why.
