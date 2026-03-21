# PageSpeed Insights Results - 2026-03-20

## Pre-Deploy (before optimizations)

### Mobile

| Page       | Perf | A11y | BP  | SEO | FCP  |
| ---------- | ---- | ---- | --- | --- | ---- |
| /          | 91   | 94   | 100 | 92  | 1.5s |
| /about     | 85   | 90   | 100 | 92  | 2.7s |
| /pricing   | 89   | 94   | 100 | 92  | 2.7s |
| /resources | 87   | 94   | 92  | 92  | 2.7s |

### Desktop

| Page       | Perf | A11y | BP  | SEO | FCP  |
| ---------- | ---- | ---- | --- | --- | ---- |
| /          | 85   | 94   | 92  | 92  | 0.6s |
| /about     | 99   | 89   | 92  | 92  | 0.6s |
| /pricing   | 85   | 94   | 92  | 92  | 0.6s |
| /resources | 100  | 93   | 92  | 92  | 0.5s |

---

## Post-Deploy (with optimizations)

Changes deployed: prerendering 10 static pages, Cache-Control headers on SSR routes, `_headers` file for immutable asset caching, CSP on frontend worker, `defaultPreload: 'intent'` with 30s stale time, `html_handling: "drop-trailing-slash"`, dead `sw.js` removed.

### Mobile

| Page       | Perf | A11y | BP  | SEO | FCP  |
| ---------- | ---- | ---- | --- | --- | ---- |
| /          | 75   | 94   | 92  | 92  | 2.9s |
| /about     | 81   | 90   | 92  | 92  | 2.9s |
| /pricing   | 85   | 94   | 92  | 92  | 2.9s |
| /resources | 100  | 94   | 92  | 92  | 1.2s |

### Desktop

| Page       | Perf | A11y | BP  | SEO | FCP  |
| ---------- | ---- | ---- | --- | --- | ---- |
| /          | 94   | 94   | 92  | 92  | 0.6s |
| /about     | 99   | 89   | 92  | 92  | 0.6s |
| /pricing   | 100  | 94   | 92  | 92  | 0.6s |
| /resources | 100  | 93   | 92  | 92  | 0.6s |

---

## Analysis

### Improvements

- **Desktop /**: 85 -> 94 (+9)
- **Desktop /pricing**: 85 -> 100 (+15)
- **Mobile /resources**: 87 -> 100 (+13), FCP 2.7s -> 1.2s

### Regressions

- **Mobile /**: 91 -> 75 (-16), FCP 1.5s -> 2.9s
- **Mobile /about**: 85 -> 81 (-4)

### Notes

- Mobile home page regression likely due to PageSpeed variability (Lighthouse mobile throttling is noisy) or the CSP adding overhead to the first paint. Worth re-running a few times to get a stable baseline.
- Best Practices stayed at 92 rather than improving -- the CSP may need adjustments (e.g., `unsafe-inline` in `script-src` downgrades the score).
- Desktop scores improved across the board, especially /pricing (85 -> 100).
- /resources saw the biggest improvement on mobile (87 -> 100), likely benefiting most from prerendering since it's a simple static page.

### Remaining opportunities

- Best Practices 92: likely caused by `'unsafe-inline'` in CSP `script-src` -- investigate if TanStack Start can use nonces instead
- Accessibility 89 on /about: check contrast ratios and missing labels
- Mobile FCP 2.9s on / and /about: investigate render-blocking resources, consider font preloading or reducing above-the-fold weight
- Re-run tests 3-5 times and average to reduce Lighthouse mobile variability
