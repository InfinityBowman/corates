/**
 * Application identity shown in the UI.
 */

export const APP_NAME = 'CoRATES';
export const APP_FULL_NAME = 'Collaborative Research Appraisal Tool for Evidence Synthesis';
export const APP_VERSION = '1.0.0';
export const APP_PUBLISHER = 'Syntch LLC';
// Zenodo concept DOI, which always resolves to the latest archived release.
// TODO(agent): set once the first GitHub release is archived on Zenodo (#861).
export const APP_DOI: string | null = null;

// Every route inherits the root's `index,follow`. robots.txt stops crawling but is
// not noindex, so a blocked URL linked from anywhere can still be listed bare.
// The _app and _auth layouts spread this into their `head` to opt out. It must sit
// on the ssr:false layout itself: the server never runs head() on its children.
export const NOINDEX_META = { name: 'robots', content: 'noindex, nofollow' } as const;
