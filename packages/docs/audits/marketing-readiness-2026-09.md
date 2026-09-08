# Marketing Readiness Audit (September 2026)

## Purpose

Answer one question: what does CoRATES still need before it is marketed to
researchers? This covers the product, the trust and legal package, operations,
onboarding, competitive positioning, and channels. It was produced on
2026-09-07 from a read of the codebase at `2018ba54`, the open issue list, the
existing audits in this directory, and web research into competitors,
instrument licensing, and how universities evaluate and buy research software.

Companion documents: `user-feedback-outreach-2026-09.md` (talk to the users we
have first) and `seo-libguide-outreach.md` (the acquisition playbook). Both
should wait until Part 1 below is closed.

## Summary

CoRATES is a real product. Three instruments with the official algorithms,
dual independent appraisal, a working side-by-side reconciliation engine,
realtime presence, PDF annotation, robvis-style figures, Stripe billing, an
admin console, and a no-account appraisal tool. The e2e suite exercises every
instrument workflow. Most competitors do not have per-outcome RoB 2 at all.

It is not ready to market, for six reasons that are cheaper to fix than to
explain to a librarian:

1. RoB 2 and ROBINS-I are CC BY-NC-ND and the app reproduces them verbatim in
   a paid product with no permission on file.
2. Every appraisal lives in a Durable Object with no backup.
3. Two-factor auth is bypassed by email OTP and OAuth sign-in, and the
   security page advertises it.
4. Deleting an account leaves all project content and PDFs in place while the
   UI says it is permanent.
5. The privacy policy omits two data flows, one of them logs with user ids to a
   personal domain.
6. The landing page promises three things the product does not do.

After those, the gaps researchers will hit in their first week are the locked
RoB 2 judgements, agreement statistics that only work for AMSTAR 2, no path
from a local appraisal into a project, and exports that do not reach RevMan,
robvis, or Excel. Instrument breadth (Newcastle-Ottawa, QUADAS-2, JBI, a
generic template) decides how many review types can use the tool at all.

## Where the product stands today

| Area          | State                                                                                                                                                                                              |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Instruments   | AMSTAR 2 (2017), RoB 2 (2.0), ROBINS-I (V2 draft). Official algorithms implemented. Per-outcome for RoB 2 and ROBINS-I. No other instruments, no custom template.                                  |
| Workflow      | Create project, add studies (PDF, RIS/ENW/BibTeX, DOI/PMID lookup, Google Drive), assign two reviewers with auto-fill, independent checklists, reconcile to a third checklist, reopen.             |
| Collaboration | Custom sync engine with offline outbox, presence avatars, per-question presence, remote cursors, email invitations, org and project roles (member, owner).                                         |
| PDF           | EmbedPDF viewer, highlights and eight annotation types, annotations cloned into the reconciled checklist. Annotations are not linked to questions.                                                 |
| Outputs       | Project and per-study CSV and PDF, traffic-light and weighted bar plots (SVG, PNG, Cochrane palette), results tables, APA and AMA citation of the tool.                                            |
| Agreement     | Percent agreement and Cohen's kappa, AMSTAR 2 only (`packages/web/src/lib/inter-rater-reliability.ts:70`).                                                                                         |
| Local tool    | `/checklist` runs without an account, persists to IndexedDB, exports CSV and PDF, no figures, no promotion into a project.                                                                         |
| Account       | Google, ORCID, password, email OTP. TOTP 2FA. Session list. Account deletion. No data export.                                                                                                      |
| Billing       | Free 1 project and 3 collaborators, Team 300 USD/yr for 3 projects, Lab 900 USD/yr for 10, Enterprise by contact. Only `project.create`, `projects.max`, and `collaborators.org.max` are enforced. |
| Public pages  | Landing, about, pricing with FAQ, privacy, terms, security, contact, three strong resource pages. No user docs, blog, changelog, or status page.                                                   |
| Users         | About 40 in production, one external paying customer, four projects ever created.                                                                                                                  |

## Part 1: Blockers before any outreach

These are ordered by how badly they would go if a librarian or a Cochrane
methods person found them first.

### 1.1 Instrument licensing

- RoB 2, ROBINS-I, ROBINS-E, and ROB-ME are licensed CC BY-NC-ND 4.0.
  riskofbias.info states it no longer supports third-party implementations.
  The only contact it gives, risk-of-bias@bristol.ac.uk, is described as not
  monitored regularly, so a permission answer will need Bristol or Cochrane
  Methods directly.
  https://www.riskofbias.info/welcome/rob-2-0-tool/current-version-of-rob-2
- `packages/shared/src/checklists/rob2/schema.ts` and
  `robins-i/schema.ts` carry the signalling questions verbatim, and the
  scoring modules implement the official algorithms. A 300 USD/yr Team plan
  is commercial use under a plain reading of the license.
- AMSTAR 2 is CC BY 4.0 (BMJ 2017), so it is clear. ROBIS and PROBAST are
  also CC BY. JBI is "research purposes only" and asks integrators to contact
  them. CASP is CC BY-NC-SA. MMAT is non-commercial only.
- `packages/web/src/lib/tool-content.ts:7-11` documents a policy of not
  reproducing instrument content, and the resource pages say "CoRATES does
  not reproduce the official content". That is true of the marketing pages
  and false of the product.
- No attribution or "used with permission" notice exists anywhere in the app.

Action: write to the Bristol group now, because the reply will take weeks.
Ask for written permission covering a paid collaborative implementation, offer
to link to riskofbias.info from every checklist, and offer the free tier as
the noncommercial path. In parallel, get one hour of IP counsel on the
questionnaire-as-method position as a fallback. Add attribution and version
text to each checklist header regardless of the answer. Do not add JBI, CASP,
or MMAT until their permissions are in hand.

### 1.2 Backups

- WorkspaceDO holds every study, checklist, answer, annotation, and
  reconciliation. There is no recurring backup (#633).
  `packages/docs/guides/database.md` says so explicitly. R2 media is covered
  by bucket versioning configured in the Cloudflare dashboard. D1 has 30-day
  Time Travel only.
- Terms 9.4 makes the customer responsible for backups of their own data,
  which no researcher will read as reasonable for a hosted tool.

Action: scheduled export of each WorkspaceDO to R2 (the `/api/sync-admin`
export already exists as the primitive) and one rehearsed restore documented
in `database.md`. Then say
"daily backups, 30-day retention" on the security page.

### 1.3 Two-factor bypass (#562)

- Email OTP and Google or ORCID sign-in issue a full session even when
  `twoFactorEnabled` is true. Passwordless users cannot enroll at all.
- `packages/web/src/routes/security.tsx` advertises 2FA.

Action: fix before outreach. Until then, remove the 2FA claim from the
security page.

### 1.4 Account deletion does not delete project content

- `packages/web/src/server/functions/users.server.ts:59` batch-deletes D1 rows
  but never calls `teardownWorkspace` or removes R2 objects. Compare
  `packages/workers/src/commands/projects/deleteProject.ts`, which does.
- `DeleteAccountSection.tsx` tells the user "Every project you created is
  deleted. This is permanent."

Action: reuse `teardownWorkspace` per owned project and delete the project's
media files. This is a GDPR erasure obligation as well as an honesty problem.

### 1.5 Privacy policy versus reality

- Not disclosed: Plausible analytics loaded from `plausible.jacobmaynard.dev`
  (`routes/__root.tsx:113`), and structured logs carrying `userId` shipped to
  a self-hosted Loki at `loki.jacobmaynard.dev` with 90-day retention
  (`packages/docs/guides/observability.md`). A university data protection
  officer will ask about a personal domain as a log sink.
- No DPA offered, no maintained subprocessor list, no breach-notification
  commitment, no retention schedule beyond "while you have an account".
- Four different contact addresses across `.github/SECURITY.md` (support@),
  `security.tsx` (contact@), privacy (privacy@), and terms (legal@).
- Data location is stated as "U.S. servers". Cloudflare D1 and R2 support an
  EU jurisdiction only at creation time, so the honest sentence is "primary
  storage in US Cloudflare regions, edge compute is global".

Action: add Plausible and the log pipeline to the policy, move the log sink
and analytics to a corates.org subdomain or disclose the operator, publish a
subprocessor page (Cloudflare, Stripe, Postmark, Sentry, Google, ORCID,
Plausible), commit to 72-hour breach notification, add a retention table, and
put a click-through DPA with EU SCCs Module 2 and the UK Addendum behind a
link. Templates for all of these are cheap; the absence is what costs a sale.

### 1.6 Marketing claims the product does not back

From `packages/web/src/components/FeatureShowcase.tsx` and elsewhere:

| Claim                                                                                                                                     | Reality                                                                                                | Fix                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| "Automatic inter-rater reliability calculation"                                                                                           | AMSTAR 2 only; RoB 2 and ROBINS-I projects show N/A under a tile labelled "Domain judgements compared" | Extend kappa to domain judgements for the other two instruments |
| "Continue working even without internet access (coming soon)" (line 542)                                                                  | Offline persistence and outbox exist; `.github/SECURITY.md` says it works                              | Pick one; probably drop "coming soon"                           |
| "Role-based access control and audit logging (coming soon)" (line 597)                                                                    | Two-tier roles exist; no user-facing audit log                                                         | Reword to what exists, or expose the mutation log               |
| Reviewers can override suggested judgements with documentation (`lib/tool-content.ts`)                                                    | `DomainSection.tsx:144` and `:163` hard-code `isAutoMode={true}` (#652)                                | Ship overrides with required rationale, or delete the sentence  |
| "Priority support", "PDF markup and consensus workflows", "Exports and figures" as plan features (`packages/shared/src/plans/catalog.ts`) | None are gated; all plans get them                                                                     | Fine to leave, but do not imply Free lacks them                 |

## Part 2: Gaps researchers hit in the first week

Ranked by how often a real review team will hit them.

1. **RoB 2 and ROBINS-I judgements cannot be overridden (#652).** The official
   Excel tool allows documented overrides and Cochrane MECIR C54 requires
   justified judgements. A reviewer who disagrees with the algorithm on an
   edge case has no exit. Ship override with mandatory rationale, shown as
   "algorithm suggested X, reviewer chose Y because" in exports.
2. **Per-outcome model unverified end to end (#651).** The schema is per
   outcome, but no test proves one study with two outcomes survives assign,
   reconcile, charts, CSV, and PDF without collapsing. Cochrane requires
   assessment per result contributing to the Summary of Findings table.
   Write the multi-outcome regression test and close the audit. Also model
   RoB 2 domain 1 as shared at study level, which is how RevMan Web does it.
3. **Agreement statistics only for AMSTAR 2.** Extend to domain-level and
   overall-level agreement for RoB 2 and ROBINS-I, add a per-item table, and
   export it. PRISMA 2020 item 11 asks who assessed and how.
4. **Local appraisal is a dead end (#656).** A user on 2026-09-05 made four
   local AMSTAR 2 appraisals with PDFs and then created an empty project. The
   free no-account tool is the top-of-funnel and it does not lead anywhere.
   Build "move into project" or at least "start a project from these".
5. **Exports do not reach where results go (#634).** Missing: RevMan Web RoB 2
   CSV template (the one integration that wins Cochrane teams, and Covidence
   cannot do it), robvis-compatible CSV (Study, D1..Dn, Overall, Weight),
   Excel, raw-answer JSON, a Word-ready per-outcome table, and a generated
   PRISMA item 11 methods sentence. Results tables are on-screen only.
6. **Supporting text is not anchored to questions.** Annotations carry no
   question or domain key. MECIR C54 and Campbell C53 want quoted support for
   each judgement, and Nested Knowledge, Rayyan, and PICO Portal already link
   highlights to questions. Add "cite this highlight for this question" and
   export the quotes as "support for judgement".
7. **Imports assume nothing came before.** No Covidence or Rayyan CSV import,
   no PubMed `.nbib`, no manual study entry form. Quality assessment sits
   downstream of screening, and teams will not re-enter studies.
8. **Nobody is told when something happens.** Notifications cover invitations
   and removals only. No "your co-reviewer finished", "ready to reconcile",
   or "you were assigned" (#628 has the hook now). Email preferences are a
   disabled "Coming soon" stub.
9. **Archiving does not exist (#670)** while pricing counts projects and the
   downgrade error says "archive or delete".
10. **Full project export at every tier.** Libraries treat lock-in as a
    purchase blocker. A zip of CSV, JSON, PDFs, and annotations, plus an
    account-wide export, is what the privacy policy already promises under
    "Portability".

## Part 3: Instrument coverage

Demand ranking from PROSPERO protocol analysis, citation shares, and mandates.
Newcastle-Ottawa remains the most-planned non-randomised tool (39 percent of
protocols versus 33 percent for ROBINS-I). Together NOS and QUADAS-2 cover
most observational and diagnostic accuracy reviews, which today cannot use
CoRATES at all.

| Instrument                  | Demand                            | License                                               | Effort                                | Recommendation                                           |
| --------------------------- | --------------------------------- | ----------------------------------------------------- | ------------------------------------- | -------------------------------------------------------- |
| RoB 2 (parallel)            | Highest, mandatory in Cochrane    | CC BY-NC-ND, permission needed                        | Done                                  | Clear the license                                        |
| ROBINS-I                    | High                              | CC BY-NC-ND, V2 still draft (revised Nov 2025)        | Done                                  | Record the version used per appraisal; keep V1 available |
| Newcastle-Ottawa            | High                              | Free from OHRI, no stated license                     | Low, study level, star scoring        | Add first                                                |
| QUADAS-2                    | High for DTA reviews              | Bristol, no published license, WHO copies CC BY-NC-SA | Medium, per-domain with applicability | Add second, ask Bristol in the same letter               |
| Generic custom template     | High, every competitor has it     | None                                                  | Medium                                | Add; also unlocks reporting checklists                   |
| JBI checklists              | High in nursing and allied health | Research use only, contact JBI                        | Low each, 13 designs                  | Ask JBI; Rayyan and Nested Knowledge got permission      |
| AMSTAR 2                    | Medium, overviews                 | CC BY 4.0                                             | Done                                  | Pair with ROBIS                                          |
| CASP                        | Medium, qualitative synthesis     | CC BY-NC-SA                                           | Low                                   | After permission                                         |
| ROBINS-E                    | Medium, exposure reviews          | CC BY-NC-ND                                           | Medium, shares ROBINS-I structure     | Include in Bristol letter                                |
| ROBIS, PROBAST(+AI)         | Lower                             | CC BY                                                 | Medium                                | Cheap wins, no permission needed                         |
| RoB 2 cluster and crossover | Lower                             | Same as RoB 2                                         | Medium                                | After base license                                       |
| MMAT, QUIPS, SYRCLE, COSMIN | Niche                             | Non-commercial or unstated                            | Low each                              | Later                                                    |

A study-design field on each study, so the project can assign different
instruments per design, is the structural change that makes breadth useful.

## Part 4: Trust and procurement package

What procurement asks for, in order: HECVAT, VPAT, DPA. Even a 300 USD tool
gets the triad once a library is involved.

- **HECVAT 4.1.5.** One 321-question workbook, free with an EDUCAUSE account;
  startups report 3 to 10 days. Host the completed PDF on the security page.
  Universities accept HECVAT plus a pen-test summary instead of SOC 2 from a
  vendor this size. https://www.educause.edu/higher-education-community-vendor-assessment-toolkit
- **VPAT or ACR against WCAG 2.1 AA.** ADA Title II deadline for large public
  entities passed in April 2026, so buyers are strict. A self-authored ACR
  with "partially supports" and remediation notes is acceptable; no ACR is
  not. Issue #22 is still "add accessibility lint rules". Do an axe pass,
  add a skip-to-content link, replace the 45 files using `title=` with
  tooltips, and label the 56 raw labels noted in the July UI audit.
- **Security page rewrite.** Hosting, encryption in transit and at rest,
  backups with retention, staff MFA, logging, 72-hour breach notification,
  vulnerability disclosure with safe harbor, and RFC 9116
  `/.well-known/security.txt` (absent today). Add a business continuity
  sentence for a one-person company: data export at any time and a
  commitment to notify and hand over exports if the service shuts down.
- **Data governance page.** Uploaded PDFs: user warrants rights, no
  redistribution beyond the team, no training or reuse, deleted on project
  delete. Retention: no silent deletion of dormant projects, 12-month
  inactivity warning, deletion within 30 days of request. Ownership when a
  student leaves: owner transfer and admin reassignment. A copy-pasteable
  data management plan paragraph for ethics applications.
- **Procurement page.** Written quote, PO acceptance, net-30 invoice, W-9 on
  request, multi-year, site-license tier by contact. Enable Stripe Tax and
  collect tax IDs at checkout (#251): EU and UK universities with a VAT number
  reverse-charge, and US SaaS is taxable in NY, TX, PA, and WA.
- **Citation.** Add `CITATION.cff`, connect the GitHub release to Zenodo for a
  DOI, and add a "How to cite" page with APA, Vancouver, and BibTeX plus the
  version DOI. The `CiteCorates` component already exists; give it a DOI.
- **GDPR representatives.** Article 27 EU and UK representatives are required
  for a non-EU processor with EU or UK users and cost a few hundred euros a
  year. Defer until the first EU or UK institutional customer, but know it is
  coming. EU-US Data Privacy Framework self-certification is about 1,000 USD
  a year and replaces SCCs for US transfers.

## Part 5: Operations

- **No alerting anywhere.** Nothing in `infra/` or Grafana references
  alerts, pager, or uptime. Add an external uptime check on `/health`, Sentry
  alert rules, and Loki alerts on error rate. Publish a status page.
- **Client crashes never reach Loki (#662),** so the product-health dashboard
  can read zero while a project tab white-screens.
- **e2e flakes halted production** through early September: eleven of the
  last forty pushes to main failed, mostly locator ambiguity. #697 and #701
  anchored the suite on data-testid selectors; the last four runs are green.
  Post-merge e2e still gates the production deploy, which is intended.
- **Rate limiting** for the auth endpoints is Better Auth's limiter with D1
  storage (#717); the corates.org zone has no edge rate-limit ruleset, only the
  managed WAF. Consider Turnstile on signup and contact.
- **Un-skip `pdfValidation.test.ts:130`** (files without a PDF signature) or
  fix what it was hiding.
- **Version-change toast (#299) and afk socket disconnect (#298)** are cheap
  and affect every long session.

## Part 6: Onboarding and documentation

Lack of knowledge was the top adoption barrier in the largest tool-use survey
(51 percent, Scott 2021), and 72 percent of users are self-taught. Covidence
Academy plus monthly webinars is the bar.

- **User documentation site.** `packages/docs` is engineering-only. Needed: a
  getting-started guide, one page per instrument on how CoRATES implements
  it, how reconciliation works, how to export, how outcomes work for RoB 2,
  and a FAQ. Replace the two Google Drive share links used as "Detailed
  Guidance Document" in `ROB2Checklist/resources.ts` and
  `ROBINSIChecklist/resources.ts` with hosted pages.
- **One walkthrough video** (60 to 90 seconds, already listed as a
  prerequisite in `seo-libguide-outreach.md`) plus three to five task
  videos.
- **Sample project.** Memory notes say a sample project is not an intended
  feature of the shell redesign; a read-only demo project or the mock chart
  outputs in #696 serve the same purpose for a first visit.
- **Changelog page** with dates. It also answers the bus-factor question a
  solo vendor always gets.
- **Support commitment.** The contact page says 24 hours; put that on the
  pricing page and honour it.
- **Roadmap page.** Public and short. Cochrane methods people and librarians
  reward transparency and it lets you say "QUADAS-2 in Q1" instead of no.

## Part 7: Competitive positioning

| Tool                  | Appraisal support                                                                           | Pricing                                                 | Where CoRATES wins                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Covidence             | RoB 1 default; no RoB 2 template; one custom template per review; consensus export CSV only | 339 USD/yr per review; institutional 2,500 to 6,500 USD | Cochrane itself says Covidence is not RoB 2 compatible. This is the headline.                    |
| Rayyan                | RoB 2 only so far, others "planned"; RoB gated to Business tier                             | 2,500 USD/yr minimum for RoB                            | Price, no per-seat, ROBINS-I and AMSTAR 2 today                                                  |
| RevMan Web            | RoB 2 native but assessment done in Excel; no ROBINS-I                                      | Free for Cochrane authors                               | Dual-reviewer workflow and reconciliation; the RevMan CSV export makes CoRATES the front end     |
| Nested Knowledge      | Broad instruments, AI suggestions, PDF-anchored quotes                                      | 295 USD per user per month                              | Price by an order of magnitude                                                                   |
| EPPI-Reviewer         | Generic coding tools, reconciliation                                                        | 10 GBP per user per month plus per review               | Instrument-aware algorithms, per-outcome structure                                               |
| JBI SUMARI            | JBI checklists, dated UI                                                                    | 130 USD/yr                                              | UX, realtime, figures                                                                            |
| DistillerSR, Laser AI | Enterprise, audit trails, AI                                                                | 19.95 USD/mo student to 3,000 USD/project               | Price, simplicity                                                                                |
| robvis                | Figures only                                                                                | Free                                                    | Figures are produced from the appraisal itself; match its CSV format so reviewers can round-trip |
| SRDR+                 | Free multi-tool RoB                                                                         | Shut down 28 Nov 2025                                   | Orphaned AHRQ Evidence-based Practice Center users are a live segment                            |

Positioning that the research supports: "the appraisal step, done properly,
at a price a lab can put on a card". Lead with RoB 2 per outcome where
Covidence has nothing, dual review with reconciliation where RevMan has an
Excel sheet, and flat team pricing where Rayyan wants 2,500 USD. Do not lead
with AI; the 2025 joint Cochrane, Campbell, JBI, and CEE position statement
requires disclosure of any AI that suggests judgements, and comparative
studies put generative RoB error rates at 10 to 56 percent. If AI is added
later, ship the disclosure sentence with it.

The PolyForm Noncommercial license reads as "not open source" to the Evidence
Synthesis Hackathon and Cochrane open-methods community and disqualifies a
JOSS paper. Either say plainly on the site that universities and public
research organisations may use it regardless of funding, or consider an
OSI license for the instrument schemas and scoring so that part becomes
citable and auditable.

## Part 8: Channels and sequence

- **First: the outreach already drafted** in
  `user-feedback-outreach-2026-09.md`. Seven external users with activity, one
  paying customer, and the dominant pattern is one session and no return.
  That leak is worth finding before adding traffic.
- **Directories.** SR Toolbox accepts free submissions and its own analysis
  shows quality assessment is where software is thinnest. ACRL Evidence
  Synthesis Methods Interest Group maintains the librarian-facing tool guide.
- **Libguides** via systematic review librarians, per `seo-libguide-outreach.md`.
  Libraries list what they license first, then free tools, and justify
  purchases with "used by Cochrane and JBI". A free classroom tier and a
  two-month campus trial modelled on Covidence's are the wedge.
- **Lists.** EVIDENCE-BASED-HEALTH (JISCMail), MEDLIB-L, the ACRL ESMIG list.
- **Events.** ESMARConf (free, online, mid-year, tool demos of record),
  Cochrane Colloquium Krakow 8 to 10 December 2026 (abstracts closed; attend),
  EBHC International Conference 21 to 24 October 2026.
- **Paper.** Research Synthesis Methods has a "Software Focus" article type.
  An inter-rater reliability and time-to-consensus study with one partner
  review team is the validation researchers respect.
- **Institutional SSO.** Email-domain verification gets most of the way.
  InCommon costs 700 USD plus 2,500 USD a year; defer until a site license
  asks.

## Recommended sequence

Tracked in GitHub issue #739. Every item carries the `marketing-readiness`
label. Issue numbers below are the source of truth for status.

### Phase 0: close the blockers (before any email goes out)

- #712 Permission for RoB 2 and ROBINS-I; in-app attribution and version
- #633 Back up WorkspaceDO
- #562 2FA bypass via email OTP and OAuth
- #713 Account deletion leaves workspace content and PDFs behind
- #714 Privacy policy, subprocessors, DPA, retention, security page
- #715 Move Plausible and Loki off the personal domain
- #716 Landing and security page claims match the product
- #718 Alerting, uptime monitor, status page
- #727 security.txt and disclosure policy
- Send the emails in `user-feedback-outreach-2026-09.md`

### Phase 1: first-week gaps (before libguide outreach)

- #652 RoB 2 and ROBINS-I overrides with rationale
- #651 Per-outcome model verified end to end
- #720 Agreement statistics for RoB 2 and ROBINS-I
- #656 Move a local appraisal into a project
- #721 RevMan, robvis, Excel, JSON, manuscript table exports
- #634 Polish existing outputs
- #722 Full project archive and account export
- #723 Highlights linked to questions, exported as support for judgement
- #724 User docs and walkthrough video
- #725 Changelog and roadmap
- #726 CITATION.cff, Zenodo DOI, How to cite
- #628 Assignment notifications
- #728 Completion, ready-to-reconcile, and finalized notifications
- #670 Project archiving
- #737 Un-skip the PDF signature validation test
- #662 Client crashes to Loki

### Phase 2: breadth (first quarter of marketing)

- #729 Newcastle-Ottawa Scale
- #730 QUADAS-2
- #731 Custom templates and study-design field
- #732 Permission for JBI, CASP, MMAT
- #733 Import from Covidence, Rayyan, PubMed nbib, manual entry
- #734 HECVAT and ACR
- #22 Accessibility
- #735 Institutions page, site license, classroom tier
- #251 Stripe Tax
- #736 Data governance page and owner transfer
- SR Toolbox and ACRL ESMIG listings; start `seo-libguide-outreach.md`

### Phase 3: within six months

- #650 Org management, viewer role, offboarding
- ROBIS and PROBAST (CC BY, no permission needed)
- Research Synthesis Methods software paper with an agreement study
- EU and UK Article 27 representatives when the first EU or UK
  institution signs
- Email-domain institutional verification; SSO on demand
- ESMARConf 2027 talk; Cochrane Colloquium Krakow, December 2026

## Sources

- riskofbias.info license and third-party implementation statement:
  https://www.riskofbias.info/welcome/rob-2-0-tool/current-version-of-rob-2
- ROBINS-I V2 draft status: https://www.riskofbias.info/welcome/robins-i-v2
- AMSTAR 2 (CC BY 4.0): https://pmc.ncbi.nlm.nih.gov/articles/PMC5833365/
- JBI tools terms: https://jbi.global/critical-appraisal-tools
- CASP license: https://casp-uk.net/referencing/
- Cochrane MECIR standards: https://www.cochrane.org/authors/handbooks-and-manuals/mecir-manual/key-points-and-introduction/versions-and-changes-mecir
- Cochrane on Covidence and RoB 2: https://www.cochrane.org/learn/courses-and-resources/cochrane-methodology/risk-bias/about-risk-bias-2-rob-2
- Covidence RoB tool FAQ: https://support.covidence.org/help/faq-which-risk-of-bias-tool-does-covidence-use
- Covidence pricing: https://www.covidence.org/pricing/
- Rayyan pricing and RoB: https://www.rayyan.ai/pricing
- RevMan Web RoB 2: https://documentation.cochrane.org/revman-kb/risk-of-bias-2-in-revman-web-110237795.html
- Nested Knowledge pricing: https://about.nested-knowledge.com/pricing/
- EPPI-Reviewer fees: https://eppi.ioe.ac.uk/cms/er4/About/Aboutourfees/tabid/2937/Default.aspx
- robvis: https://mcguinlu.github.io/robvis/
- SRDR+ closure: https://effectivehealthcare.ahrq.gov/news/ceasing-operations
- Tool-use survey (Scott 2021): https://pubmed.ncbi.nlm.nih.gov/34242757/
- PROSPERO tool-choice analysis: https://pmc.ncbi.nlm.nih.gov/articles/PMC6857304/
- SR Toolbox: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9713957/
- PRISMA 2020: https://systematicreviewsjournal.biomedcentral.com/articles/10.1186/s13643-021-01626-4
- Joint position statement on AI in evidence synthesis: https://pmc.ncbi.nlm.nih.gov/articles/PMC12603384/
- HECVAT: https://www.educause.edu/higher-education-community-vendor-assessment-toolkit
- VPAT template: https://www.itic.org/policy/accessibility/vpat
- security.txt: https://securitytxt.org/
- Cloudflare data location: https://developers.cloudflare.com/d1/configuration/data-location/
- EU-US DPF program: https://www.dataprivacyframework.gov/Program-Overview
- CITATION.cff: https://citation-file-format.github.io/
- JOSS license requirement: https://joss.readthedocs.io/en/latest/submitting.html
- InCommon fees: https://incommon.org/join-incommon/fees/
- ACRL ESMIG tools guide: https://acrl.libguides.com/ESMIG/Evidence_Synthesis_Resources/tools
- Cochrane Colloquium 2026: https://colloquium-2026.cochrane.org/
- ESMARConf: https://esmarconf.org/
