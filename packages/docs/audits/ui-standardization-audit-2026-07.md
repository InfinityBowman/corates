# UI Standardization Audit - July 2026

Survey of hand-rolled UI patterns in `packages/web/src` versus their shadcn/ui equivalents, with a prioritized plan for future conversion sessions. Scope excludes `components/pdf/embedpdf/**` (vendored, has its own design system).

## Completed

- **Buttons** - All hand-rolled `<button>` elements converted to the shadcn `Button` component across settings, billing, reconciliation, auth, dashboard, layout, checklist, landing pages, pricing, and navbar. Deliberately kept custom: sidebar/tree navigation rows, tab switchers, answer-option and domain pills, selection pills/cards, presence avatars, clickable card surfaces, collapsible section headers, dev panels, ui-primitive internals (`inline-edit`, `password-input`), and the embedpdf viewer.
- **Badges** - Status/label pills converted to the shadcn `Badge` across project study rows, reconcile tags, role pills, billing status, add-studies import pills, admin chips, and the navbar offline indicator. Raw color tints mapped to `success`/`warning`/`info`/`destructive` variants; dynamic color maps (`getStatusStyle`, ProjectCard role colors) preserved via `className` override. Kept custom: domain judgement pills, `ScoreTag` registry-driven colors, interactive chips, answer-value pills, full-width banners.
- **Selects** - Zero raw `<select>` elements; ui `Select` used in 17 files.
- **Toasts** - Fully standardized on sonner via the `showToast` wrapper in `lib/toast.ts` (48 adopters, `<Toaster />` mounted once in `__root.tsx`).
- **Progress** - No hand-rolled progress bars exist; ui `Progress` used where needed.
- **Spinners** - All hand-rolled `animate-spin` divs and raw `LoaderIcon`/`Loader2Icon` loaders converted to ui `Spinner` (32 files). Added a `current` variant (`border-t-current border-r-current`) so in-button spinners inherit the button's text color across all Button variants, replacing what `LoaderIcon` got from `currentColor`. Deliberately kept: conditional spin-on-fetch `RefreshCwIcon`s (`ProjectDocStorageSection`, admin `database.tsx`) and `DevToastTester` (dev panel).
- **Inputs + Labels (planned chunks)** - Settings (`ProfileInfoSection`, `AcademicInfoSection`, `SecuritySettings`, `TwoFactorSetup`, `MergeAccountsDialog`, `DeleteAccountSection`, `PersonaSection`), auth/org/project modals (`complete-profile`, `CreateOrgPage`, `CreateProjectModal`, `CreateLocalChecklist`, `EditPdfMetadataModal`), and marketing (`contact.tsx`) converted to ui `Input`/`Label`. Policy decisions: real form labels adopt Label default styling (text-sm font-medium, normal case) with `htmlFor`/`useId` wiring; caption-style labels over non-form content (InlineEdit, static text, section headings) became styled `span`s. Added ui `Textarea` (derived from the Input recipe). `SecuritySettings` and `TwoFactorSetup` password fields adopted `ui/password-input` (dropping two hand-rolled eye toggles) and gained proper `autoComplete` attrs. Kept custom: `CreateOrgPage` slug prefix-group inner input (composite control), hidden file/sr-only inputs.
- **Inputs long tail** - `OutcomeManager`, `AddMemberModal` search, `ReviewerAssignment` percent field converted. Outside the deliberately-custom answer UIs and dev panels, zero raw text inputs remain.
- **Dialogs/modals** - `ChartSettingsModal` converted to ui `Dialog` (was the last hand-rolled modal): gains focus trap, escape handling, scroll lock; dropped the manual backdrop mousedown tracking. Its raw checkbox became ui `Checkbox` and the palette radios became ui `RadioGroup` (new primitive `ui/radio-group.tsx`, styled to match Checkbox); its inputs/labels converted too.
- **Skeletons** - `JudgementPanel` pending-dot converted to ui `Skeleton`. Remaining `animate-pulse` uses (`FeatureShowcase`, `QuestionPresenceIndicator`) are decorative pulse animations, not loading states - kept.
- **Avatars** - `ProfileInfoSection` converted to `Avatar`/`AvatarImage`/`AvatarFallback` (gradient initials preserved via className). Remaining marketing-page circles are decorative - kept.
- **Alerts/callouts (reframed)** - Investigation showed most of the ~138 raw-color matches were not callouts: they are selection states in the custom answer UIs, judgement color coding (Low/Some concerns/High), reviewer panel tints, and marketing decoration - all reclassified as deliberate (dark mode is not planned, so no token-mapping debt). The genuine status tints were converted to semantic tokens: `ChecklistForm` no-outcomes warning box, `DoiLookupSection` missing-PDF row/button/labels + its raw textarea to ui `Textarea`, `ReferenceImportSection` PDF pill, `ReconcileStudyRow` READY/WAITING status rows, destructive delete-hovers (`LocalChecklistItem`, `TodoStudyRow`), `AddMemberModal` row hover, icon accent chips (`CreateProjectModal` to primary tokens, `PricingTable` downgrade dialog to warning tokens), admin `UserDialogs` ban-reason textarea/label. Eight `bg-blue-50` page backgrounds across checklist/reconcile workspaces became `bg-secondary`. Kept: reconcile agreement banners and reviewer tints (custom UI color coding), `ImpersonationBanner` (deliberately loud), `SubscriptionCard` on-gradient tint, `NoteEditor` (parameterized custom control), marketing pages, dev panels.

## Remaining categories

| Category             | Hand-rolled                         | ui adopters | Verdict          |
| -------------------- | ----------------------------------- | ----------- | ---------------- |
| Text inputs/textarea | answer UIs + dev panels only        | 30+ files   | Done             |
| Labels               | 56 instances / ~26 files            | 20+ files   | Partial          |
| Checkbox/radio       | ~13, all in custom answer UIs       | 2 files     | Deliberate       |
| Cards                | AdminBox x22 + ~18 inline `bg-card` | 5 files     | Not standardized |
| Alerts/callouts      | domain color coding only            | 25+ files   | Done             |
| Tooltips (`title=`)  | ~45 files                           | 18 files    | Partial          |
| Tabs                 | 2 switchers                         | 4 files     | Mostly done      |

## Recommendations

### Medium (needs judgment)

1. **Checkboxes/radios in answer UIs** - All remaining raw checkboxes/radios live inside the checklist/reconcile answer UIs deliberately kept custom (`amstar2-reconcile/AnswerPanel`, `rob2-reconcile/pages/PreliminaryPage`, ROBINS-I sections B/C/D, RoB answer/direction panels, `AMSTAR2Checklist`). Converting them is a deliberate design decision, not a mechanical sweep - they sit inside the custom answer-pill system. ui `Checkbox` and `RadioGroup` primitives are now both available if that decision is ever made.

2. **Hand-rolled tab switchers** - Two remain: `routes/_auth/signin.tsx:184-330` (full role=tablist implementation) and the `PricingTable` Monthly/Annual toggle. Both have sliding-indicator animations that ui `Tabs` does not provide out of the box; converting means losing the slide or restyling `TabsList`. Cosmetic call - fine to leave.

3. **Remaining labels** - 56 raw `<label>` elements in ~26 files, mostly checklist/reconcile answer UIs (part of item 1) plus a few sr-only and wrapper labels. Convert opportunistically when touching those files.

### Larger / defer or scope deliberately

4. **Cards** - The app effectively has its own card system: `components/admin/ui/AdminBox.tsx` (`border-border bg-card rounded-xl border p-6 shadow-xs`, ~22 admin files) plus ~18 files with inline `rounded-xl border bg-card` containers. ui `Card` has only 5 adopters. Recommendation: do NOT migrate wholesale - it is churn without visual gain since the recipes already use semantic tokens. Either bless AdminBox/inline `bg-card` as the house pattern, or align ui `Card` styling with it and adopt opportunistically in new code. This is a policy decision, not a conversion task.

5. **`title=` to Tooltip** - ~45 files use `title=` attributes. Convert selectively where discoverability matters (icon-only buttons); a blanket sweep is noise. Related parked issue: `ChecklistYjsWrapper` "Mark Complete" lost its disabled-state tooltip because Button applies `disabled:pointer-events-none` (native `title` does not show either) - needs a `Tooltip` wrapper around a span if it matters.

## Suggested session order

1. Selective `title=` to Tooltip conversion for icon-only buttons (item 5)
2. Separately: decide the card-system policy (item 4) before touching any cards
3. Visual review pass of all conversions (requires dev server)

## Other parked items (from the button/badge passes)

- Reconcile navbar "Reset" pills (ROB2/ROBINS-I/AMSTAR-2 navbars) are destructive actions styled as pills to match sibling domain pills; could take `variant='destructive'` if they should stand apart.
- Tinted destructive Button treatment (`bg-destructive/10 text-destructive`) is used ad hoc; candidate sites if an upstream tinted variant is ever adopted: `AccountProviderCard` Unlink, `GoogleDriveSettings` Disconnect, `SessionManagement` "Sign out everywhere", `PdfUploadSection` Retry.
- `SubscriptionCard` `past_due`/`unpaid` badge mapped to `warning` (amber); switch to `destructive` if those states should read as alarming.
- Dev panels (`components/dev/**`) still use raw buttons - lowest priority.
- Visual review pass of all converted buttons/badges still pending (requires dev server).
