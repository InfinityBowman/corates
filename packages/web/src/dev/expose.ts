/**
 * Dev/e2e console seam: puts the seeding API on `window` so Playwright specs
 * (and a curious console user) can seed through the real client path — the
 * same short-lived engine sessions and shared mutators the dev panel uses.
 * Loaded lazily from the root route behind `VITE_DEV_PANEL`; never part of
 * production bundles.
 */

import { devAddStudy, devApplyTemplate } from './seed';
import { rewriteLocalRowsToLegacyDoc } from './legacy';

declare global {
  interface Window {
    __devSeed?: {
      addStudy: typeof devAddStudy;
      applyTemplate: typeof devApplyTemplate;
    };
    __devLegacy?: {
      rewriteLocalRowsToLegacyDoc: typeof rewriteLocalRowsToLegacyDoc;
    };
  }
}

window.__devSeed = { addStudy: devAddStudy, applyTemplate: devApplyTemplate };
window.__devLegacy = { rewriteLocalRowsToLegacyDoc };

export {};
