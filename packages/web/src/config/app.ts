/**
 * Application identity shown in the UI.
 */

export const APP_NAME = 'CoRATES';
export const APP_FULL_NAME = 'Collaborative Research Appraisal Tool for Evidence Synthesis';
export const APP_VERSION = '1.0.0';
export const APP_PUBLISHER = 'Syntch LLC';

// Every route inherits the root's `index,follow`. robots.txt stops crawling but is
// not noindex, so a blocked URL linked from anywhere can still be listed bare.
// Signed-in and token-bearing routes spread this into their `head` to opt out.
export const NOINDEX_META = { name: 'robots', content: 'noindex, nofollow' } as const;
