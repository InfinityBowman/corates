# Plan: Jev (System One classifier) integration

**Status:** Draft
**Created:** 2026-09-20
**Last Updated:** 2026-09-20

---

## Overview

Jev is TypeSafe AI's "System One" model: it does not generate text, it answers typed
questions about a state and returns calibrated probabilities. Three question types:

- `noul` - a statement, returns probability it is true (0-1)
- `choice` - pick one of up to 255 named options, returns the choice, the full probability
  distribution, and a confidence
- `score` - rate against an ordered rubric of 2-10 levels, returns a continuous position
  plus per-level probabilities and confidence

Questions are evaluated in parallel against one shared state, so batching many questions
about one paper costs tokens but almost no extra latency.

This matters for CoRATES because nearly every judgement the app models is already a small
typed label set, not prose: `RESPONSE_TYPES.STANDARD` is `Y | PY | PN | N | NI`,
`ROB2_JUDGEMENT_SCALE` is `Low | Some concerns | High`, `AMSTAR2_ITEM_SCALE` is
`Yes | Partial Yes | No`. Those are `choice` and `score` questions verbatim.

It is also available as a Workers AI model (`typesafe/jev`), so it can be called from the
existing worker through a binding with no API key, no egress, and no new vendor contract.

## Prerequisites

- Workers AI binding added to `packages/web/wrangler.jsonc` (see Phase 1)
- Extracted PDF text available server-side (see "Getting text to the model")
- Existing reconciled consensus checklists in production, for the Phase 0 evaluation

## Goals

1. Add a single typed server-side wrapper for Jev that the rest of the app calls.
2. Replace the hand-tuned junk-title regexes in study import with a classifier, without
   making import depend on a network call.
3. Suggest the right instrument per study from its abstract.
4. Decide, on evidence, whether Jev is good enough to suggest appraisal answers - and
   only then build that feature.

## Non-Goals

- Generating summaries, reconciliation narratives, or evidence tables. Jev cannot generate
  text. That work stays with the `packages/ai` LangExtract/Gemini track.
- Auto-filling any appraisal answer. Every suggestion requires a reviewer action.
- Replacing `packages/ai`. Extraction finds the passage; Jev judges it. They compose.

## Getting text to the model

Today PDF text extraction is client-side: `extractPdfTitle` / `extractPdfDoi` in
`@/lib/pdfUtils` run in the browser during `usePdfOperations`. The server holds the PDF
bytes in `PDF_BUCKET` but has no extractor.

Jev's context window is 32,000 tokens. A typical paper fits; a long one with appendices
does not.

Recommendation: extract text once at upload time and store it as a sibling R2 object under
a `text/` prefix in `PDF_BUCKET`. Every later classification then reads a cheap text object
instead of re-parsing a PDF. For papers over the context window, select sections rather
than truncating - which is exactly the job `packages/ai` extraction is prototyping.

This is the largest piece of prerequisite work in the plan and it is worth costing
separately before committing to Phase 3.

## Implementation

### Phase 0: Offline evaluation (gate for Phase 3)

Before building any appraisal feature, measure whether Jev agrees with our reviewers.

We already ship the machinery: `weightedKappa`, `MIN_PAIRS_FOR_KAPPA` (20), and the
per-instrument adapters in `packages/shared/src/checklists/reliability/`. Those adapters
take two checklists and produce rating pairs. Feeding them (human consensus, Jev) instead
of (reviewer 1, reviewer 2) requires no new statistics.

**Tasks:**

- [ ] Script that pulls reconciled consensus checklists plus their PDFs from a project
- [ ] Run Jev per domain, build a synthetic `Checklist` from the answers
- [ ] Report weighted kappa of Jev vs consensus per instrument and per domain, alongside
      the existing human-human kappa for the same project as the baseline
- [ ] Gate: if Jev vs human kappa is materially below human vs human, Phase 3 does not ship

### Phase 1: Binding, wrapper, and title triage

Wrangler does not inherit top-level bindings into named environments, so the AI binding
goes in three places in `packages/web/wrangler.jsonc` - top level, `env.production`, and
`env.staging` - the same way `d1_databases` and `r2_buckets` are repeated today:

```jsonc
"ai": { "binding": "AI" }
```

Then regenerate `worker-configuration.d.ts` with `wrangler types`.

The wrapper lives at `packages/web/src/server/lib/jev.ts`: it calls
`env.AI.run('typesafe/jev', ...)` via `import { env } from 'cloudflare:workers'`, parses
the response with Zod against the documented output schema, and throws
`DomainErrorException` on failure per the server function error contract. Keep it
injectable so unit tests can supply a fake rather than calling the real model.

**Title triage.** `packages/web/src/hooks/useAddStudies/matching.ts` currently decides
whether an extracted title is a real paper title using `BOILERPLATE` and `TYPESETTER`
regexes, a digit-ratio heuristic, a de-spacing pass, and length floors calibrated against
the production corpus - where roughly 27% of extracted titles are junk.

That is a `noul` question. Better still, it is many `noul` questions against one state:
send the batch of candidate titles as the state and one question per title keyed by PDF
id, which is one round trip for a whole upload rather than one per file.

Import must not block on this. Keep `isWeakTitle` as the synchronous default so the flow
works offline and when the model is down; run Jev as an enrichment that flags suspect
titles before the user commits the import.

**Tasks:**

- [ ] Add the binding in all three config blocks, regenerate types
- [ ] `server/lib/jev.ts` wrapper plus Zod response schema and unit tests with a fake
- [ ] Server function taking candidate titles, returning per-title probability
- [ ] Wire into `usePdfOperations` as non-blocking enrichment with regex fallback
- [ ] Verify against the production corpus that it beats the current regexes

### Phase 2: Instrument routing

Which instrument applies is determined by study design: RoB 2 for randomised trials,
ROBINS-I for non-randomised studies of interventions, AMSTAR 2 for systematic reviews.
`STUDY_DESIGNS` in `rob2/schema.ts` already enumerates the RoB 2 sub-designs.

One `choice` question over the abstract, surfaced as a suggestion in project setup and in
add-studies. The reviewer confirms; nothing is gated on the answer. Setup steps must never
be gated or hidden, so this is a default, not a branch.

**Tasks:**

- [ ] `choice` question mapping design labels to criteria
- [ ] Suggestion in the add-studies flow, user-confirmable
- [ ] Record accepted vs overridden so accuracy can be measured in production

### Phase 3: Appraisal answer suggestions (only if Phase 0 passes)

Each RoB 2 signalling question is a `ROB2Question` with `text` and a `responseType` of
`STANDARD` or `WITH_NA`. That maps directly onto a `choice` question with criteria drawn
from `RESPONSE_LABELS`. Batch one call per domain - five to seven questions - with the
domain-relevant text as state.

**Storage.** Suggestions must not go in the sync doc's `answers` table. They are
server-authored, never edited by reviewers, need no CRDT merge, and the workspace doc
already has a measured 300-study ceiling that extra rows would erode. A new D1 table keyed
by (studyId, checklistType, outcomeId, questionKey), written by the worker and read-only
to the client, is the right home.

**Methodological hazard, and the reason this is gated.** If both reviewers see the same
suggestion, their answers stop being independent, and inter-rater agreement stops being
evidence of anything. Reported kappa would rise while real reliability falls. This is not
a hypothetical for a tool whose selling point is reliability reporting.

Mitigations, all of which should ship together with the feature:

- Opt-in per project, off by default. There is no feature flag system today, so this is a
  project setting.
- Record on each answer whether a suggestion was shown and whether it was accepted.
- Report kappa split by that flag, so a project can see its own contamination.

**Tasks:**

- [ ] D1 table and migration via DrizzleKit
- [ ] Per-domain question builder from the instrument schemas
- [ ] Suggestion UI showing the label and its confidence, never pre-selected
- [ ] Project setting, default off
- [ ] Suggestion-shown/accepted provenance on answers, and kappa split by it

## Technical details

Request and response shape, as served by Workers AI:

```ts
const response = await env.AI.run('typesafe/jev', {
  state: paperText,
  questions: {
    d1_1: {
      type: 'choice',
      instructions: 'Was the allocation sequence random?',
      criteria: {
        Y: 'Explicitly states a random component in the sequence generation',
        PY: 'Implies randomisation without describing the method',
        PN: 'Suggests a non-random element without stating one',
        N: 'Describes a non-random sequence, e.g. alternation or date of birth',
        NI: 'No information about sequence generation',
      },
    },
  },
});
```

Answers come back keyed the same way. A `choice` answer carries `choice`, `probabilities`
(a distribution over the criteria keys) and `confidence`. A `score` answer carries `score`,
`legend`, `probabilities` and `confidence`. A `noul` answer carries only `noul`, a number
from 0 to 1 which is itself the belief. Every response includes
`usage.input_tokens` / `usage.output_tokens`, and output tokens are always zero.

Confidence is the routing primitive: below a threshold, show nothing rather than a weak
suggestion.

**Cost.** Direct API pricing is $0.042 per million input tokens with output free. A 10k
token paper appraised across roughly 30 signalling questions batched into six calls is
about 60k input tokens, near $0.0025 per study, so a 300-study project lands under a
dollar. Workers AI is billed in neurons and its rate for this model needs checking in the
dashboard before these numbers are quoted anywhere.

**Alternative transport.** The direct API is `POST https://tokenra.io/v1/decisions` with a
`TYPESAFE_API_KEY` bearer token. The Workers AI binding is preferable: no secret to
rotate, no egress, and paper text never leaves Cloudflare - which is a materially easier
conversation with an institution than shipping full texts to a third-party API, and is the
current weak point of the Gemini-based prototype in `packages/ai`.

## Success criteria

- [ ] Binding added in all three environment blocks, types regenerated, typecheck clean
- [ ] Wrapper unit-tested against a fake; no test calls the real model
- [ ] Title triage measurably beats the current regexes on the production corpus, and
      import still works with the model unavailable
- [ ] Phase 0 kappa numbers exist and are recorded here before Phase 3 starts
- [ ] No suggestion is ever written into a reviewer's answers without a reviewer action

## Open questions

- Does Workers AI pricing for `typesafe/jev` make per-study appraisal viable at plan
  prices, or does it need to be a paid add-on?
- Is Jev's 32k context enough with section selection, or does Phase 3 depend on the
  extraction work in `packages/ai` landing first?
- Should title triage replace the regexes or run alongside them as a second opinion? The
  regexes are free and instant; the answer probably depends on the Phase 1 measurement.
- Does storing extracted PDF text in R2 raise any retention or licensing question that the
  PDFs themselves do not?

## Related documents

- `packages/ai/markdown/AI_OPPORTUNITIES.md` - the LangExtract/Gemini extraction track
- `packages/ai/markdown/AI_ASSISTED_APPRAISAL.md`
- [Jev on Cloudflare Workers AI](https://developers.cloudflare.com/ai/models/typesafe/jev/)
- [TypeSafe System One concepts](https://docs.typesafe.ai/concepts/system-one)
