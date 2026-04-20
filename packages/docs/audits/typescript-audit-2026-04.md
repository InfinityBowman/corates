# TypeScript Audit -- CoRATES

Date: 2026-04-18 (revised after self-review, updated 2026-04-20)
Scope: `packages/web`, `packages/workers`, `packages/shared`, `packages/db`
Excludes: `node_modules`, `dist`, `.tanstack`, `reference/`, `packages/stripe-purchases` (separate Hono workspace), `packages/stripe-dev`, `packages/ai`

## TL;DR

Strict mode is on across all four packages -- solid baseline. The big wins are not language-feature obscurities; they're the patterns a 2026-vintage TS codebase should reach for and largely doesn't:

1. **API route response types aren't exported** -- every TanStack Start file route returns `Response.json({...})` and every consumer in `hooks/`/`api/` re-types the payload by hand (115 `as Record<string, unknown>` casts in `packages/web/src`).
2. **Engine adapter contract isn't honored** by its consumers -- well-designed 4-param generic, but `EngineContext<any, any, ...>` at the call sites.
3. **`satisfies` is used 4 times in the entire repo** -- strong signal of underuse.
4. **No type tests** -- for a codebase with custom generics like the reconcile engine, this means contract regressions ship silently.

Order-of-attack is at the bottom.

---

## Verified counts

| Signal                                          |   Count | Where                                         |
| ----------------------------------------------- | ------: | --------------------------------------------- |
| `as Record<string, unknown>`                    |     115 | `packages/web/src` (29 files)                 |
| `as any`                                        |    ~144 | all packages (54 files); down from 298        |
| `@ts-ignore` / `@ts-expect-error`               |       3 | 2 in d3 charts, 1 in workers `types.d.ts`     |
| `satisfies`                                     |       4 | `UserSession.ts`, `stripeEventLedger.ts`, +2  |
| Type tests (`expectTypeOf`, tsd, `assertType`)  |       0 | none                                          |
| `createServerFn` (TanStack Start typed RPC)     |       0 | not used                                      |

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

**Option A -- Just export the response type from the route file (lowest cost).**

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

**Option B -- Zod-parse at the boundary (real safety).**

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

**Option C -- Migrate hot endpoints to `createServerFn`.**
TanStack Start's blessed RPC. Full end-to-end inference, no hand-rolled types, no `Response.json` parse. Currently used in zero endpoints in this repo. Right answer for _new_ endpoints; per-endpoint migration cost for existing routes.

### C2. Engine adapters don't honor their own contract

`packages/web/src/components/project/reconcile-tab/engine/types.ts:153-264` defines a clean 4-param generic `ReconciliationAdapter<TChecklist, TFinalAnswers, TComparison, TNavItem>`.

But `adapter.tsx:304` and `:488` instantiate as:

```ts
function renderPage(context: EngineContext<any, any, ComparisonResult | null, Rob2NavItem>) { ... }
function Rob2NavbarAdapter(navbarContext: NavbarContext<any, ComparisonResult | null, Rob2NavItem>) { ... }
```

Two of four type parameters are `any`. And `ReconciliationEngineProps` (lines 270-296) uses `checklist1: unknown`, `checklist2: unknown` -- the public boundary erases generics entirely.

**Honest assessment of the fix cost:** This is _not_ a "just pipe TChecklist through" change. The reason `any` slipped in is that `renderPage` does `c1?.preliminary?.[currentItem.key]` -- index access on a generic with a runtime-discovered key. Two paths:

1. **Minimal**: just type `ReconciliationEngineProps` so callers pass typed checklists; leave the adapter internals as `any` for now. Catches the _external_ contract violation without touching the adapter body.
2. **Full**: redesign nav items to carry typed accessors. Larger change; would close this properly but might be a 1-2 day refactor.

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
export function createChecklistOfType(type: string, options: Record<string, unknown>): any { ... }
export function scoreChecklistOfType(type: string, state: any): string { ... }
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

Note: callers passing a `string`-typed kind still need to narrow at runtime to get a specific type -- the registry doesn't _eliminate_ the dispatch, it just makes it type-safe.

### H3. Google Picker -- install `@types/google.picker`

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

### H5. `error as Error` / `const error = err as Error` in catch blocks

Pervasive: ~100 occurrences across API route files. Nearly every catch block in `routes/api/` uses `const error = err as Error;`. With `useUnknownInCatchVariables` (TS 4.4+ default in strict), use `instanceof Error` narrowing. A 5-line helper `errorMessage(e: unknown): string` would centralize this and allow a codemod-style cleanup pass.

---

## Missing patterns (what an expert would expect to see)

### G1. No type tests

Zero `expectTypeOf`/`tsd`/`assertType` calls anywhere. For a codebase that ships a custom generic like `ReconciliationAdapter<TChecklist, TFinalAnswers, TComparison, TNavItem>`, type tests catch contract regressions at PR time.

Vitest already supports type tests via `expectTypeOf`. Suggested setup:

```ts
// engine/__type-tests__/adapter.test-d.ts
import { expectTypeOf } from 'vitest';
import type { ReconciliationAdapter } from '../engine/types';
import { rob2Adapter } from '../rob2-reconcile/adapter';
import type { ROB2Checklist } from '@corates/shared';

// Catches the C2 regression: adapter must use ROB2Checklist, not any
expectTypeOf(rob2Adapter).toMatchTypeOf<ReconciliationAdapter<ROB2Checklist, any, any, any>>();
```

### G4. `satisfies` operator is used 4 times in the whole repo

`satisfies` lets you constrain a value to a type without widening the inferred literal type. In a 2026 TS codebase this should be doing real work in registry objects, route configs, plan definitions, theme objects, etc.

Concrete example -- the checklist registry at `packages/web/src/checklist-registry/index.ts:29`:

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

Keys stay narrow, values get checked. This pattern applies in many places -- plan definitions in `packages/shared/src/plans`, query keys in `packages/web/src/lib/queryKeys`, etc.

### G5. `verbatimModuleSyntax: false` in `packages/web/tsconfig.json`

Setting it to `true` enforces `import type` for type-only imports, which:

- Lets the bundler eliminate type imports cleanly (avoids accidentally pulling in runtime modules just for types).
- Avoids subtle Vite HMR / TanStack Start route-tree generation issues caused by type-only modules being treated as runtime modules.

Modern TanStack/Vite projects ship with this on. Flipping it would surface a one-time cleanup pass (lint can autofix most of it) and prevent a class of subtle build issues going forward.

---

## Medium (pattern hygiene)

### M2. `FinalAnswers = Record<string, unknown>` is too loose

`packages/web/src/components/project/reconcile-tab/rob2-reconcile/navbar-utils.ts:90`. The structure is known: `{ preliminary?: Partial<ROB2PreliminaryState>; [domain]: DomainState }`. Replacing the alias propagates real types into `hasNavItemAnswer`, `isNavItemAgreement`, `getCurrentItemComparison`.

### M3. Correlated optional fields instead of discriminated structure

`adapter.tsx:39, 339, 354` -- `PRELIMINARY_TEXT_FIELDS.includes(currentItem.key)` is a runtime check selecting which preliminary fields need Y.Text sync. Promote the field union into the type system: `type TextFieldKey = 'experimental' | 'comparator' | 'sources' | ...` and key the field map by it. The runtime `.includes()` becomes a compile-time guarantee.

### M4. `ChecklistHandler` not generic over its answers

`packages/web/src/primitives/useProject/checklists/handlers/base.ts:16-36` returns `Record<string, unknown>`. Each subclass already knows its answer shape -- make the abstract class `ChecklistHandler<TAnswers>` and the concrete subclasses pin `TAnswers`.

### M5. `apiFetch` `<T>` defaults to `unknown` but never validates

`packages/web/src/lib/apiFetch.ts:93, 98, 102` -- `return (await response.json()) as T;`. The wrapper shape is well-thought-through (good `Omit` use on per-verb overloads at lines 107-128). Rather than baking validation into the fetcher, just compose Zod parsing at the call site for boundary-critical endpoints -- it stays explicit and the fetcher stays simple.

---

## Yjs ceiling (clarification)

`packages/workers/src/durable-objects/ProjectDoc.ts` uses `Y.Map<unknown>()` and `?: unknown` fields heavily. **Yjs's API genuinely cannot give you better runtime typing** -- Y.Map values are dynamically typed at the protocol level. Don't try to "fix" this directly.

The right pattern is a typed _facade_ over the Y.Doc that exposes typed read/write methods. Move all `as Record<string, unknown>` and `as ProjectMeta` casts into the facade methods. Consumers get typed access; the facade isolates the Yjs trust boundary to one file.

---

## Suggested order of attack

| #   | Change                                                                       |                  Effort | Why now                                                                                                        |
| --- | ---------------------------------------------------------------------------- | ----------------------: | -------------------------------------------------------------------------------------------------------------- |
| 1   | ~~Auth `as unknown as` -> Zod parse (H2); oauth-relay WeakMap (H6)~~ DONE   |                      -- | Both fixed: Zod parse in session-helper, WeakMap in oauth-relay.                                               |
| 2   | ~~C1 first pass: 5 hot endpoints (subscription, invoices, usage, users/me/projects, users/search)~~ DONE | -- | Response types exported from route files; consumers import instead of hand-rolling. Also fixed latent bugs in InvoicesList (wrong field names hidden by `any`). |
| 3   | C1 continued: admin endpoints, billing helpers (checkout, portal, members)   |                half day | adminStore.ts and useAdminQueries.ts still have 26+ `as Record<string, unknown>` casts.                       |
| 4   | Checklist registry -- discriminated map + `satisfies` (H1 + G4)             |                  2-3 hr | Removes the most concentrated `any` cluster.                                                                   |
| 5   | Add Vitest type tests for `ReconciliationAdapter` (G1)                       |                  1-2 hr | Cheaper than the C2 full refactor; catches future regressions.                                                 |
| 6   | `@types/google.picker` install + single-guard cleanup (H3)                   |                  30 min | Quick win.                                                                                                     |
| 7   | `verbatimModuleSyntax: true` in web tsconfig (G5)                            | 1-2 hr (mostly autofix) | One-time cleanup; pays off in build cleanliness.                                                               |
| 8   | `server.ts` env typing (H4); Yjs facade extraction                           |                   1 day | Lower priority -- current state isn't actively dangerous.                                                      |
| 9   | `errorMessage(e: unknown)` helper + codemod ~100 catch blocks (H5)           |                  2-3 hr | Mechanical but pervasive; eliminates the most common unsafe cast pattern in API routes.                        |

Item 3 continues the C1 pattern to admin/billing endpoints. Items 4-5 are the type-safety substance. Items 6-9 are polish.
