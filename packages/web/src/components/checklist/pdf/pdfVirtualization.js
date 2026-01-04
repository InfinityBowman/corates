/**
 * pdfVirtualization - Page virtualization for large PDFs
 * Only renders DOM nodes for pages in/near the viewport to keep DOM/layout stable
 */

import { createSignal, createEffect, onCleanup, untrack } from 'solid-js';

const VIRTUAL_WINDOW_MARGIN = 3; // Render 3 pages above/below viewport
const PAGE_GAP_PX = 32; // gap-8
const PAGE_CHROME_PX = 28; // label + small vertical padding/shadow allowance

/**
 * Creates PDF page virtualization module
 * @param {Object} document - PDF document module
 * @param {Object} scrollHandler - Scroll handler module
 * @returns {Object} Virtualization operations
 */
export function createPdfVirtualization(document, scrollHandler) {
  const [visiblePageRange, setVisiblePageRange] = createSignal({ start: 1, end: 1 });
  const [basePageHeights, setBasePageHeights] = createSignal([]); // 1-indexed (index 1..n)
  const [defaultBaseHeight, setDefaultBaseHeight] = createSignal(800);
  const [prefixOffsets, setPrefixOffsets] = createSignal([]); // 1-indexed: top offset of each page
  const [totalHeight, setTotalHeight] = createSignal(0);

  let scrollContainerRef = null;
  let resizeObserver = null;
  let scrollListener = null;
  let pendingHeightBuild = null;

  function getBaseHeight(pageNum) {
    const base = basePageHeights();
    return base[pageNum] || defaultBaseHeight();
  }

  function getPageHeight(pageNum) {
    const s = scrollHandler.scale();
    return getBaseHeight(pageNum) * s + PAGE_CHROME_PX;
  }

  function rebuildPrefixOffsets({ preserveScroll = true } = {}) {
    const totalPages = document.totalPages();
    if (!scrollContainerRef || totalPages <= 0) {
      setPrefixOffsets([]);
      setTotalHeight(0);
      return;
    }

    // Preserve the center-of-container anchor so updating offsets doesn't jump the view.
    // Important: we must not accidentally track prefixOffsets() inside any createEffect that calls
    // rebuildPrefixOffsets(), otherwise setPrefixOffsets() will retrigger that effect and loop.
    let anchor = null;
    if (preserveScroll) {
      anchor = untrack(() => {
        const y = scrollContainerRef.scrollTop + scrollContainerRef.clientHeight / 2;
        const pageNum = getPageAtScrollOffset(y);
        const pageTop = getPageOffset(pageNum);
        const pageHeight = getPageHeight(pageNum);
        const ratio = pageHeight > 0 ? Math.min(1, Math.max(0, (y - pageTop) / pageHeight)) : 0.5;
        return { y, pageNum, ratio };
      });
    }

    const offsets = Array(totalPages + 2).fill(0);
    let running = 0;
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      offsets[pageNum] = running;
      running += getPageHeight(pageNum);
      if (pageNum < totalPages) running += PAGE_GAP_PX;
    }
    offsets[totalPages + 1] = running;

    setPrefixOffsets(offsets);
    setTotalHeight(running);

    if (preserveScroll && anchor) {
      const newTop = getPageOffset(anchor.pageNum);
      const newHeight = getPageHeight(anchor.pageNum);
      const newCenterY = newTop + anchor.ratio * newHeight;
      scrollContainerRef.scrollTop = Math.max(0, newCenterY - scrollContainerRef.clientHeight / 2);
    }
  }

  // Binary search helpers (prefixOffsets must be built)
  function getPageOffset(pageNum) {
    const offsets = prefixOffsets();
    return offsets[pageNum] || 0;
  }

  function getPageAtScrollOffset(y) {
    const totalPages = document.totalPages();
    if (totalPages <= 0) return 1;

    const offsets = prefixOffsets();
    if (!offsets || offsets.length === 0) {
      // Fallback until offsets are built
      const estimated = defaultBaseHeight() * scrollHandler.scale() + PAGE_CHROME_PX + PAGE_GAP_PX;
      return Math.min(totalPages, Math.max(1, Math.floor(y / Math.max(1, estimated)) + 1));
    }

    let lo = 1;
    let hi = totalPages;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const top = offsets[mid];
      const bottom = top + getPageHeight(mid);
      if (y < top) {
        hi = mid - 1;
      } else if (y > bottom) {
        lo = mid + 1;
      } else {
        return mid;
      }
    }
    return Math.min(totalPages, Math.max(1, lo));
  }

  // Calculate which pages should be rendered based on scroll position
  function calculateVisibleRange() {
    if (!scrollContainerRef) return { start: 1, end: 1 };

    const container = scrollContainerRef;
    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;
    const viewportTop = scrollTop;
    const viewportBottom = scrollTop + containerHeight;

    const totalPages = document.totalPages();
    if (totalPages === 0) return { start: 1, end: 1 };

    const firstVisible = getPageAtScrollOffset(viewportTop);
    const lastVisible = getPageAtScrollOffset(viewportBottom);
    const start = Math.max(1, firstVisible - VIRTUAL_WINDOW_MARGIN);
    const end = Math.min(totalPages, lastVisible + VIRTUAL_WINDOW_MARGIN);
    return { start, end };
  }

  // Update visible range on scroll
  function handleScroll() {
    const newRange = calculateVisibleRange();
    const current = visiblePageRange();
    if (newRange.start !== current.start || newRange.end !== current.end) {
      setVisiblePageRange(newRange);
    }
  }

  // Set scroll container and setup listeners
  function setScrollContainer(ref) {
    if (scrollContainerRef) {
      if (scrollListener) {
        scrollContainerRef.removeEventListener('scroll', scrollListener);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    }

    scrollContainerRef = ref;

    if (ref) {
      scrollListener = () => {
        requestAnimationFrame(handleScroll);
      };
      ref.addEventListener('scroll', scrollListener, { passive: true });

      resizeObserver = new ResizeObserver(() => {
        rebuildPrefixOffsets({ preserveScroll: true });
        handleScroll();
      });
      resizeObserver.observe(ref);

      // Initial calculation
      handleScroll();
    }
  }

  // Register a page element (kept for API compatibility; deterministic model doesn't need DOM measurement)
  function registerPage(pageNum, element) {
    void pageNum;
    void element;
  }

  // Update visible range when PDF changes
  createEffect(() => {
    const totalPages = document.totalPages();
    const doc = document.pdfDoc();
    const docId = document.docId();
    if (totalPages > 0) {
      // Reset cached page sizes when PDF changes
      setBasePageHeights([]);
      setPrefixOffsets([]);
      setTotalHeight(0);

      if (!doc) return;

      // Cancel any previous build loop
      if (pendingHeightBuild) {
        pendingHeightBuild.cancelled = true;
      }
      const token = { cancelled: false, docId };
      pendingHeightBuild = token;

      // Compute all base heights once, then apply with scroll preservation.
      (async () => {
        try {
          const next = Array(totalPages + 2).fill(0);

          // Seed default from page 1 immediately (helps initial offsets).
          const page1 = await doc.getPage(1);
          const viewport1 = page1.getViewport({ scale: 1.0 });
          const base1 = Math.max(200, viewport1.height);
          if (token.cancelled) return;
          setDefaultBaseHeight(base1);

          // Build all page base heights.
          next[1] = base1;
          for (let pageNum = 2; pageNum <= totalPages; pageNum++) {
            const page = await doc.getPage(pageNum);
            const viewport = page.getViewport({ scale: 1.0 });
            next[pageNum] = Math.max(50, viewport.height);
            if (token.cancelled) return;
          }

          // Apply in one shot to avoid repeated offset churn.
          setBasePageHeights(next);
          rebuildPrefixOffsets({ preserveScroll: true });
          handleScroll();
        } catch {
          // Fall back to default height estimate if precompute fails.
          rebuildPrefixOffsets({ preserveScroll: true });
          handleScroll();
        }
      })();
    }
  });

  // Rebuild offsets when scale changes
  createEffect(() => {
    const currentScale = scrollHandler.scale();
    void currentScale;
    if (!scrollContainerRef) return;
    if (document.totalPages() <= 0) return;
    rebuildPrefixOffsets({ preserveScroll: true });
    handleScroll();
  });

  // Cleanup
  function cleanup() {
    if (scrollListener && scrollContainerRef) {
      scrollContainerRef.removeEventListener('scroll', scrollListener);
    }
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    if (pendingHeightBuild) {
      pendingHeightBuild.cancelled = true;
    }
  }

  onCleanup(cleanup);

  return {
    visiblePageRange,
    totalHeight,
    setScrollContainer,
    registerPage,
    getPageOffset,
    getPageHeight,
    getPageAtScrollOffset,
    cleanup,
  };
}
