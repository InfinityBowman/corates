/**
 * The app shell scrolls inside <main>, not the window.
 */

// A stable id for the container: without it TanStack keys the element by its
// nth-child path, which shifts when the impersonation banner or the collapsed
// sidebar rail mount.
export const MAIN_SCROLL_ID = 'app-main';

// TanStack carries an inner element's scroll offset from the previous route into
// the next one unless the element is listed here, which left admin detail pages
// opening at the list's scroll position.
export const SCROLL_TO_TOP_SELECTORS = [`[data-scroll-restoration-id="${MAIN_SCROLL_ID}"]`];
