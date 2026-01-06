# Third-Party Libraries Audit

**Date:** 2026-01-06  
**Scope:** Identify useful 3rd party libraries that could benefit the CoRATES codebase

---

## Executive Summary

This audit analyzes the current CoRATES codebase to identify areas where third-party libraries could improve code quality, reduce maintenance burden, or add valuable functionality. The recommendations are prioritized by impact and effort.

---

## Current Stack Overview

### Frontend (packages/web)

- **UI Framework:** SolidJS + Ark UI
- **Routing:** @solidjs/router
- **State/Data:** TanStack Query, Yjs, IndexedDB (idb)
- **Styling:** TailwindCSS
- **Charts:** D3.js
- **PDF:** embedpdf ecosystem
- **Icons:** solid-icons

### Backend (packages/workers)

- **Runtime:** Cloudflare Workers
- **Framework:** Hono
- **Database:** Drizzle ORM + D1
- **Auth:** Better-Auth
- **Payments:** Stripe
- **Real-time:** Yjs + Durable Objects
- **Email:** Postmark
- **Validation:** Zod

---

## High Priority Recommendations

### 1. Error Monitoring: Sentry or Toucan

**Problem:** The codebase has a TODO comment in [ErrorBoundary.jsx](packages/web/src/components/ErrorBoundary.jsx#L115) noting the need for error monitoring. Unknown errors are caught but only logged to console.

**Recommendation:** **@sentry/browser** or **toucan-js** (Cloudflare-native)

**Benefits:**

- Automatic error tracking with stack traces
- Session replay for debugging user issues
- Performance monitoring
- Release tracking

**Implementation:**

```js
// Frontend: @sentry/browser (lightweight, works with SolidJS)
// Backend: toucan-js (designed for Cloudflare Workers)
```

**Effort:** Low-Medium  
**Impact:** High

---

### 2. Schema Validation: Zod Frontend

**Problem:** While Zod is used extensively in the workers package for validation, the frontend relies on manual validation or lacks structured validation entirely. Form validation is inconsistent.

**Recommendation:** Use existing **zod** dependency on frontend

**Benefits:**

- Type-safe form validation
- Consistent error messages
- Reuse schemas between frontend/backend

**Implementation:**

- Export shared schemas from `@corates/shared`
- Use `@tanstack/solid-form` or `@modular-forms/solid` with Zod adapter

**Effort:** Medium  
**Impact:** High

---

### 3. Date/Time Handling: date-fns or Temporal

**Problem:** The codebase uses raw `Date.now()`, `new Date()` throughout. No consistent date formatting or timezone handling. Examples found in:

- [referenceLookup.js](packages/web/src/lib/referenceLookup.js)
- [studies.js](packages/web/src/primitives/useProject/studies.js)
- [queryClient.js](packages/web/src/lib/queryClient.js)

**Recommendation:** **date-fns** (tree-shakeable) or **@formkit/tempo** (smaller)

**Benefits:**

- Consistent date formatting across the app
- Relative time display ("2 hours ago")
- Timezone-safe operations
- Internationalization support

**Implementation:**

```js
// date-fns is tree-shakeable, only import what you need
import { formatDistanceToNow, format, parseISO } from 'date-fns';
```

**Effort:** Low  
**Impact:** Medium

---

### 4. Reference Parsing: Better BibTeX/RIS Libraries

**Problem:** Custom RIS and BibTeX parsers in [referenceParser.js](packages/web/src/lib/referenceParser.js) (400+ lines). These are complex format-specific parsers that likely have edge cases.

**Recommendation:** **bibtex-parse** or **citation-js**

**Benefits:**

- Battle-tested parsing for academic formats
- Support for more citation styles (CSL)
- Better handling of edge cases
- Citation formatting capabilities

**Consideration:** Evaluate bundle size vs. custom solution. Your current implementation may be sufficient if working well.

**Effort:** Medium  
**Impact:** Medium

---

### 5. Debounce/Throttle Utilities: @solid-primitives/scheduled

**Problem:** Manual debounce implementations scattered throughout the codebase:

- [queryClient.js](packages/web/src/lib/queryClient.js) - manual setTimeout debounce
- [useOnlineStatus.js](packages/web/src/primitives/useOnlineStatus.js) - manual timers

**Recommendation:** **@solid-primitives/scheduled**

**Benefits:**

- SolidJS-native reactivity integration
- Proper cleanup handling
- `debounce`, `throttle`, `scheduleIdle`, `leading` variants
- Already maintained by SolidJS community

**Implementation:**

```js
import { debounce, throttle } from '@solid-primitives/scheduled';
const debouncedSave = debounce(save, 1000);
```

**Effort:** Low  
**Impact:** Medium

---

## Medium Priority Recommendations

### 6. HTTP Client: ky or ofetch

**Problem:** Raw `fetch()` calls throughout [api/](packages/web/src/api/) with repeated boilerplate for:

- Error handling
- JSON parsing
- Headers management
- Retry logic

**Recommendation:** **ky** (browser) or **ofetch** (universal)

**Benefits:**

- Automatic JSON parsing
- Retry with backoff
- Request/response hooks
- Simpler error handling
- Timeout support built-in

**Implementation:**

```js
import ky from 'ky';
const api = ky.create({ prefixUrl: API_BASE, credentials: 'include' });
const data = await api.get('billing/subscription').json();
```

**Effort:** Medium  
**Impact:** Medium

---

### 7. Image Processing: Sharp (Backend)

**Problem:** [imageUtils.js](packages/web/src/lib/imageUtils.js) does client-side image compression using Canvas API. This works but:

- Inconsistent results across browsers
- No WebP/AVIF support
- CPU-intensive on client

**Recommendation:** Move to server-side with **@cf-wasm/photon** or process uploads via **Cloudflare Images**

**Benefits:**

- Consistent compression quality
- Modern format support (WebP, AVIF)
- Reduced client CPU usage
- Better compression ratios

**Consideration:** This requires architectural change. Current solution is functional.

**Effort:** High  
**Impact:** Low-Medium

---

### 8. UUID Generation: nanoid

**Problem:** Using `crypto.randomUUID()` throughout. While this works, nanoid offers advantages.

**Recommendation:** **nanoid**

**Benefits:**

- 21 chars vs 36 chars (smaller storage/URLs)
- URL-safe by default
- Customizable alphabet
- Slightly faster

**Implementation:**

```js
import { nanoid } from 'nanoid';
const studyId = nanoid(); // "V1StGXR8_Z5jdHi6B-myT"
```

**Effort:** Low  
**Impact:** Low

---

### 9. Statistical Functions: simple-statistics

**Problem:** [inter-rater-reliability.js](packages/web/src/lib/inter-rater-reliability.js) implements Cohen's Kappa manually. Academic tools often need additional statistical measures.

**Recommendation:** **simple-statistics**

**Benefits:**

- Cohen's Kappa, Fleiss' Kappa
- Standard deviation, variance, percentiles
- Regression analysis
- Well-tested implementations
- Small bundle size (tree-shakeable)

**Implementation:**

```js
import { cohensKappa, standardDeviation } from 'simple-statistics';
```

**Effort:** Low  
**Impact:** Medium (for future statistical features)

---

### 10. Form State Management: @modular-forms/solid

**Problem:** Complex form state handling in components like AddStudiesForm. Manual persistence logic in [formStatePersistence.js](packages/web/src/lib/formStatePersistence.js).

**Recommendation:** **@modular-forms/solid** with Zod adapter

**Benefits:**

- Built for SolidJS reactivity
- Zod schema integration
- Field-level validation
- Dirty/touched tracking
- Built-in array fields (for study lists)

**Effort:** Medium-High  
**Impact:** Medium

---

## Low Priority / Nice-to-Have

### 11. DOMPurify for User Content

**Problem:** Basic HTML escaping in [escapeHtml.js](packages/workers/src/lib/escapeHtml.js). If user-generated HTML content is ever displayed (markdown, etc.), XSS risks increase.

**Recommendation:** **isomorphic-dompurify** or **sanitize-html**

**Benefits:**

- Comprehensive XSS protection
- Configurable allowed tags/attributes
- Works server and client side

**When needed:** If implementing markdown rendering, rich text, or displaying user HTML.

**Effort:** Low  
**Impact:** Low (currently not rendering user HTML)

---

### 12. Distributed Rate Limiting: @upstash/ratelimit

**Problem:** Current rate limiting in [rateLimit.js](packages/workers/src/middleware/rateLimit.js) is per-worker-instance memory-based. Comment notes this limitation.

**Recommendation:** **@upstash/ratelimit** or implement with Durable Objects

**Benefits:**

- True distributed rate limiting
- Works across all worker instances
- Multiple algorithms (sliding window, token bucket)

**When needed:** When scaling to high traffic or strict rate limiting requirements.

**Effort:** Medium  
**Impact:** Low (current solution works for moderate traffic)

---

### 13. Charting Alternative: @observablehq/plot or Chart.js

**Problem:** D3 is powerful but low-level. Current charts in [AMSTARDistribution.jsx](packages/web/src/components/charts/AMSTARDistribution.jsx) require significant code.

**Recommendation:** Keep D3 for complex visualizations, consider **@observablehq/plot** for simpler charts

**Benefits:**

- Higher-level API
- Still D3-based (familiar)
- Good for academic visualizations
- Less boilerplate

**Consideration:** D3 gives full control. Only switch if chart requirements are simple.

**Effort:** Medium  
**Impact:** Low

---

### 14. Feature Flags: @vercel/flags or LaunchDarkly

**Problem:** No feature flag system for gradual rollouts, A/B testing, or disabling features.

**Recommendation:** **@vercel/flags** (if using Vercel) or **@happykit/flags** or custom with KV

**Benefits:**

- Gradual feature rollouts
- User segment targeting
- Kill switches for features
- A/B testing capability

**When needed:** When approaching production with real users.

**Effort:** Medium  
**Impact:** Low (pre-production)

---

## Libraries to Avoid

### moment.js

- Too large (300kb+), use date-fns instead

### lodash (full)

- Use native methods or lodash-es with specific imports

### axios

- fetch is standard, ky/ofetch are smaller and modern

### jQuery

- Not needed with SolidJS

---

## Summary Matrix

| Library                     | Priority | Effort   | Impact | Category       |
| --------------------------- | -------- | -------- | ------ | -------------- |
| Sentry/Toucan               | High     | Low-Med  | High   | Monitoring     |
| Zod (frontend)              | High     | Medium   | High   | Validation     |
| date-fns                    | High     | Low      | Medium | Utilities      |
| @solid-primitives/scheduled | High     | Low      | Medium | Utilities      |
| ky/ofetch                   | Medium   | Medium   | Medium | HTTP           |
| simple-statistics           | Medium   | Low      | Medium | Statistics     |
| @modular-forms/solid        | Medium   | Med-High | Medium | Forms          |
| nanoid                      | Low      | Low      | Low    | Utilities      |
| DOMPurify                   | Low      | Low      | Low    | Security       |
| @upstash/ratelimit          | Low      | Medium   | Low    | Infrastructure |

---

## Recommended Next Steps

1. **Immediate:** Add error monitoring (Sentry/Toucan) - catches production issues early
2. **Short-term:** Integrate date-fns and @solid-primitives/scheduled - quick wins
3. **Medium-term:** Evaluate form library needs based on complexity growth
4. **Ongoing:** Review this audit quarterly as requirements evolve
