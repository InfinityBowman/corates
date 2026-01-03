/**
 * pdfScrollHandler - Scroll handling, page tracking, and IntersectionObserver
 * Handles scroll events, current page tracking, and lazy loading via IntersectionObserver
 */

import { createSignal, createEffect } from 'solid-js';

const RENDER_MARGIN = 2; // Render 2 pages ahead/behind viewport

/**
 * Creates PDF scroll handling module
 * @param {Object} document - PDF document module
 * @returns {Object} Scroll handling operations
 */
export function createPdfScrollHandler(document) {
  const [currentPage, setCurrentPage] = createSignal(1);
  const [scale, setScale] = createSignal(1.0);

  let scrollContainerRef = null;
  let pageRefs = new Map();
  let gestureStartScale = 1.0;
  let scrollRafId = null;
  let intersectionObserver = null;
  const visiblePages = new Set();
  let rendererCallbacks = null;

  // Zoom-to-point tracking
  let zoomOriginPoint = null; // { x, y } in container coordinates
  let zoomOriginScale = null; // Scale before zoom
  let lastMousePosition = null; // { x, y } for button-triggered zoom
  let isWheelZooming = false; // Track if we're in an active wheel zoom gesture
  let scrollAdjustRafId = null; // RAF ID for scroll adjustment to prevent multiple queued adjustments
  let zoomAdjustToken = 0; // Token to coalesce rapid zoom adjustments (latest wins)

  // Handle scroll to update current page indicator
  function handleScroll() {
    if (!scrollContainerRef || pageRefs.size === 0) return;

    // Throttle using requestAnimationFrame
    if (scrollRafId !== null) return;

    scrollRafId = requestAnimationFrame(() => {
      scrollRafId = null;

      const containerRect = scrollContainerRef.getBoundingClientRect();
      const containerMiddle = containerRect.top + containerRect.height / 2;

      let closestPage = 1;
      let closestDistance = Infinity;

      pageRefs.forEach((pageEl, pageNum) => {
        if (pageEl) {
          const pageRect = pageEl.getBoundingClientRect();
          const pageMiddle = pageRect.top + pageRect.height / 2;
          const distance = Math.abs(pageMiddle - containerMiddle);

          if (distance < closestDistance) {
            closestDistance = distance;
            closestPage = pageNum;
          }
        }
      });

      if (closestPage !== currentPage()) {
        setCurrentPage(closestPage);
      }
    });
  }

  function handleGestureStart(e) {
    e.preventDefault();
    gestureStartScale = scale();
  }

  function handleGestureChange(e) {
    e.preventDefault();
    // e.scale is relative to gesture start (1.0 = no change)
    const newScale = Math.min(Math.max(gestureStartScale * e.scale, 0.5), 3.0);
    setScale(newScale);
  }

  function handleGestureEnd(e) {
    e.preventDefault();
  }

  // Track mouse position for button-triggered zoom
  function handleMouseMove(e) {
    if (!scrollContainerRef) return;
    const rect = scrollContainerRef.getBoundingClientRect();
    lastMousePosition = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  // Handle pinch-to-zoom via wheel event with ctrlKey (trackpad gesture - Chrome/Firefox)
  function handleWheel(e) {
    // Only handle pinch-to-zoom (ctrlKey is set for trackpad pinch gestures)
    if (!e.ctrlKey) return;

    e.preventDefault();

    if (!scrollContainerRef) return;

    // Get cursor position relative to scroll container
    const rect = scrollContainerRef.getBoundingClientRect();
    const cursorPoint = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    // Mark that we're in a wheel zoom gesture
    isWheelZooming = true;

    // Use deltaY directly for smooth, proportional zooming
    // Smaller divisor = more sensitive, larger = less sensitive
    const zoomDelta = -e.deltaY * 0.01;
    const oldScale = scale();
    const newScale = Math.min(Math.max(oldScale + zoomDelta, 0.5), 3.0);

    if (newScale === oldScale) return;

    // Store zoom origin before changing scale (same as button zoom)
    zoomOriginPoint = cursorPoint;
    zoomOriginScale = oldScale;
    zoomAdjustToken += 1; // Increment token to invalidate any pending adjustments

    // Update scale - the createEffect will handle scroll adjustment
    setScale(newScale);

    // Clear wheel zoom flag after a short delay (when gesture ends)
    clearTimeout(handleWheel.zoomEndTimeout);
    handleWheel.zoomEndTimeout = setTimeout(() => {
      isWheelZooming = false;
    }, 150);
  }

  // Set scroll container ref and setup scroll listener
  function setScrollContainerRef(ref) {
    if (scrollContainerRef) {
      scrollContainerRef.removeEventListener('scroll', handleScroll);
      scrollContainerRef.removeEventListener('wheel', handleWheel);
      scrollContainerRef.removeEventListener('mousemove', handleMouseMove);
      scrollContainerRef.removeEventListener('gesturestart', handleGestureStart);
      scrollContainerRef.removeEventListener('gesturechange', handleGestureChange);
      scrollContainerRef.removeEventListener('gestureend', handleGestureEnd);
    }

    scrollContainerRef = ref;
    if (ref) {
      ref.addEventListener('scroll', handleScroll, { passive: true });
      ref.addEventListener('wheel', handleWheel, { passive: false });
      ref.addEventListener('mousemove', handleMouseMove, { passive: true });
      // Safari-specific gesture events for pinch-to-zoom
      ref.addEventListener('gesturestart', handleGestureStart);
      ref.addEventListener('gesturechange', handleGestureChange);
      ref.addEventListener('gestureend', handleGestureEnd);

      // Setup IntersectionObserver after container is set
      setupIntersectionObserver();
    }
  }

  // Register a page container ref
  function setPageRef(pageNum, ref) {
    if (ref) {
      pageRefs.set(pageNum, ref);
      // Set data attribute for IntersectionObserver
      ref.dataset.pageNum = pageNum;
      // Observe the page element if observer is set up
      if (intersectionObserver) {
        intersectionObserver.observe(ref);
      }
    } else {
      pageRefs.delete(pageNum);
      // Unobserve if observer exists
      if (intersectionObserver && ref) {
        intersectionObserver.unobserve(ref);
      }
    }
  }

  // Setup IntersectionObserver for lazy loading
  function setupIntersectionObserver() {
    if (intersectionObserver || !scrollContainerRef) return;

    intersectionObserver = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          const pageNum = parseInt(entry.target.dataset.pageNum, 10);
          if (isNaN(pageNum)) return;

          if (entry.isIntersecting) {
            visiblePages.add(pageNum);
            // Schedule render if renderer callbacks are available
            if (rendererCallbacks && rendererCallbacks.schedulePageRender) {
              rendererCallbacks.schedulePageRender(pageNum);
            }
          } else {
            visiblePages.delete(pageNum);
            // Cancel render if renderer callbacks are available
            if (rendererCallbacks && rendererCallbacks.cancelPageRender) {
              rendererCallbacks.cancelPageRender(pageNum);
            }
          }
        });
      },
      {
        root: scrollContainerRef,
        rootMargin: `${RENDER_MARGIN * 100}% 0px`, // Render margin pages
        threshold: 0.01,
      },
    );

    // Observe all existing page refs
    pageRefs.forEach((pageEl, pageNum) => {
      if (pageEl) {
        pageEl.dataset.pageNum = pageNum;
        intersectionObserver.observe(pageEl);
      }
    });
  }

  function getVisiblePages() {
    return visiblePages;
  }

  function isPageVisible(pageNum) {
    return visiblePages.has(pageNum);
  }

  // Navigation - scroll to page
  function goToPage(pageNum) {
    const pageEl = pageRefs.get(pageNum);
    if (pageEl && scrollContainerRef) {
      pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setCurrentPage(pageNum);
    }
  }

  function goToPrevPage() {
    if (currentPage() > 1) {
      goToPage(currentPage() - 1);
    }
  }

  function goToNextPage() {
    if (currentPage() < document.totalPages()) {
      goToPage(currentPage() + 1);
    }
  }

  // Zoom to a specific point, preserving that point's position on screen
  function zoomToPoint(scaleDelta, point = null) {
    if (!scrollContainerRef) return;

    const oldScale = scale();
    let zoomPoint = point;

    // If no point provided, use viewport center or last mouse position
    if (!zoomPoint) {
      if (lastMousePosition) {
        zoomPoint = lastMousePosition;
      } else {
        const rect = scrollContainerRef.getBoundingClientRect();
        zoomPoint = {
          x: rect.width / 2,
          y: rect.height / 2,
        };
      }
    }

    // Store zoom origin before changing scale
    zoomOriginPoint = zoomPoint;
    zoomOriginScale = oldScale;
    zoomAdjustToken += 1; // Increment token to invalidate any pending adjustments

    // Calculate new scale
    const newScale = Math.min(Math.max(oldScale + scaleDelta, 0.5), 3.0);
    setScale(newScale);
  }

  // Adjust scroll position after scale change to maintain zoom origin
  // Works for both button-triggered zoom and pinch zoom
  createEffect(() => {
    const currentScale = scale();

    // Only adjust scroll if we have a stored zoom origin
    if (zoomOriginPoint === null || zoomOriginScale === null || !scrollContainerRef) {
      return;
    }

    // Skip if scale hasn't actually changed
    if (currentScale === zoomOriginScale) {
      return;
    }

    // Capture the current token to check if we're still the latest adjustment
    const currentToken = zoomAdjustToken;
    const pointX = zoomOriginPoint.x;
    const pointY = zoomOriginPoint.y;

    // Find which page contains the zoom point
    let targetPage = null;
    let targetPageNum = null;
    let pointOffsetFromPageTop = 0;
    let pointOffsetFromPageLeft = 0;

    // Calculate the point's position in the scroll container's coordinate space
    const pointInContainer = {
      x: scrollContainerRef.scrollLeft + pointX,
      y: scrollContainerRef.scrollTop + pointY,
    };

    // Find the page that contains this point
    pageRefs.forEach((pageEl, pageNum) => {
      if (!pageEl || targetPage) return;

      const pageTop = pageEl.offsetTop;
      const pageBottom = pageTop + pageEl.offsetHeight;
      const pageLeft = pageEl.offsetLeft;
      const pageRight = pageLeft + pageEl.offsetWidth;

      // Check if point is within this page's bounds (both vertical and horizontal)
      if (
        pointInContainer.y >= pageTop &&
        pointInContainer.y <= pageBottom &&
        pointInContainer.x >= pageLeft &&
        pointInContainer.x <= pageRight
      ) {
        targetPage = pageEl;
        targetPageNum = pageNum;
        pointOffsetFromPageTop = pointInContainer.y - pageTop;
        pointOffsetFromPageLeft = pointInContainer.x - pageLeft;
      }
    });

    // Prioritize rendering the target page if we found it
    if (targetPageNum !== null && rendererCallbacks && rendererCallbacks.schedulePageRender) {
      rendererCallbacks.schedulePageRender(targetPageNum);
    }

    // Cancel any pending scroll adjustment
    if (scrollAdjustRafId !== null) {
      cancelAnimationFrame(scrollAdjustRafId);
      scrollAdjustRafId = null;
    }

    if (!targetPage || targetPageNum === null) {
      // Fallback: use viewport center calculation
      const oldScrollHeight = scrollContainerRef.scrollHeight;
      const oldScrollWidth = scrollContainerRef.scrollWidth;
      const scrollRatio =
        oldScrollHeight > 0 ? scrollContainerRef.scrollTop / oldScrollHeight : 0;
      const scrollLeftRatio =
        oldScrollWidth > 0 ? scrollContainerRef.scrollLeft / oldScrollWidth : 0;

      // Poll for layout update with bounded timeout
      let pollStartTime = Date.now();
      const maxPollTime = 400; // Max 400ms to wait for layout

      function pollForLayoutUpdate() {
        // Check if we're still the latest adjustment
        if (currentToken !== zoomAdjustToken) {
          return; // Stale adjustment, abort
        }

        if (!scrollContainerRef) return;

        const newScrollHeight = scrollContainerRef.scrollHeight;
        const newScrollWidth = scrollContainerRef.scrollWidth;
        if (newScrollHeight > 0 && newScrollHeight !== oldScrollHeight) {
          // Layout has updated
          scrollContainerRef.scrollTop = scrollRatio * newScrollHeight;

          // Adjust horizontal scroll if container has horizontal overflow
          if (newScrollWidth > 0 && newScrollWidth !== oldScrollWidth && scrollContainerRef.scrollWidth > scrollContainerRef.clientWidth) {
            scrollContainerRef.scrollLeft = scrollLeftRatio * newScrollWidth;
          }

          zoomOriginPoint = null;
          zoomOriginScale = null;
        } else if (Date.now() - pollStartTime < maxPollTime) {
          // Keep polling
          scrollAdjustRafId = requestAnimationFrame(pollForLayoutUpdate);
        } else {
          // Timeout - apply adjustment anyway
          if (newScrollHeight > 0) {
            scrollContainerRef.scrollTop = scrollRatio * newScrollHeight;
          }
          if (newScrollWidth > 0 && scrollContainerRef.scrollWidth > scrollContainerRef.clientWidth) {
            scrollContainerRef.scrollLeft = scrollLeftRatio * newScrollWidth;
          }
          zoomOriginPoint = null;
          zoomOriginScale = null;
        }
      }

      scrollAdjustRafId = requestAnimationFrame(pollForLayoutUpdate);
      return;
    }

    // Calculate the ratio of the point's position within the page (both vertical and horizontal)
    const oldPageHeight = targetPage.offsetHeight;
    const oldPageWidth = targetPage.offsetWidth;
    const pointRatio = oldPageHeight > 0 ? pointOffsetFromPageTop / oldPageHeight : 0;
    const pointRatioX = oldPageWidth > 0 ? pointOffsetFromPageLeft / oldPageWidth : 0;

    // Poll for page dimensions update with bounded timeout
    let pollStartTime = Date.now();
    const maxPollTime = 400; // Max 400ms to wait for layout

    function pollForPageHeightUpdate() {
      // Check if we're still the latest adjustment
      if (currentToken !== zoomAdjustToken) {
        return; // Stale adjustment, abort
      }

      if (!scrollContainerRef || !targetPage) return;

      const newPageHeight = targetPage.offsetHeight;
      const newPageWidth = targetPage.offsetWidth;

      if (newPageHeight !== oldPageHeight && newPageHeight > 0) {
        // Page dimensions have updated - apply scroll adjustment
        const newPointOffsetFromPageTop = pointRatio * newPageHeight;
        const newPageTop = targetPage.offsetTop;
        const newPointInContainerY = newPageTop + newPointOffsetFromPageTop;

        // Adjust vertical scroll to keep the point at the same screen position
        const newScrollTop = newPointInContainerY - pointY;
        scrollContainerRef.scrollTop = Math.max(0, newScrollTop);

        // Adjust horizontal scroll if container has horizontal overflow
        if (scrollContainerRef.scrollWidth > scrollContainerRef.clientWidth) {
          const newPointOffsetFromPageLeft = pointRatioX * newPageWidth;
          const newPageLeft = targetPage.offsetLeft;
          const newPointInContainerX = newPageLeft + newPointOffsetFromPageLeft;
          const newScrollLeft = newPointInContainerX - pointX;
          scrollContainerRef.scrollLeft = Math.max(0, newScrollLeft);
        }

        // Clear zoom origin tracking
        zoomOriginPoint = null;
        zoomOriginScale = null;
      } else if (Date.now() - pollStartTime < maxPollTime) {
        // Keep polling
        scrollAdjustRafId = requestAnimationFrame(pollForPageHeightUpdate);
      } else {
        // Timeout - apply adjustment with current dimensions anyway
        if (newPageHeight > 0) {
          const newPointOffsetFromPageTop = pointRatio * newPageHeight;
          const newPageTop = targetPage.offsetTop;
          const newPointInContainerY = newPageTop + newPointOffsetFromPageTop;
          const newScrollTop = newPointInContainerY - pointY;
          scrollContainerRef.scrollTop = Math.max(0, newScrollTop);

          // Adjust horizontal scroll if container has horizontal overflow
          if (scrollContainerRef.scrollWidth > scrollContainerRef.clientWidth && newPageWidth > 0) {
            const newPointOffsetFromPageLeft = pointRatioX * newPageWidth;
            const newPageLeft = targetPage.offsetLeft;
            const newPointInContainerX = newPageLeft + newPointOffsetFromPageLeft;
            const newScrollLeft = newPointInContainerX - pointX;
            scrollContainerRef.scrollLeft = Math.max(0, newScrollLeft);
          }
        }
        zoomOriginPoint = null;
        zoomOriginScale = null;
      }
    }

    scrollAdjustRafId = requestAnimationFrame(pollForPageHeightUpdate);
  });

  function cleanup() {
    if (scrollRafId !== null) {
      cancelAnimationFrame(scrollRafId);
      scrollRafId = null;
    }

    if (scrollAdjustRafId !== null) {
      cancelAnimationFrame(scrollAdjustRafId);
      scrollAdjustRafId = null;
    }

    if (handleWheel.zoomEndTimeout) {
      clearTimeout(handleWheel.zoomEndTimeout);
      handleWheel.zoomEndTimeout = null;
    }

    if (intersectionObserver) {
      intersectionObserver.disconnect();
      intersectionObserver = null;
    }

    if (scrollContainerRef) {
      scrollContainerRef.removeEventListener('scroll', handleScroll);
      scrollContainerRef.removeEventListener('wheel', handleWheel);
      scrollContainerRef.removeEventListener('mousemove', handleMouseMove);
      scrollContainerRef.removeEventListener('gesturestart', handleGestureStart);
      scrollContainerRef.removeEventListener('gesturechange', handleGestureChange);
      scrollContainerRef.removeEventListener('gestureend', handleGestureEnd);
    }

    pageRefs.clear();
    visiblePages.clear();
  }

  return {
    // State
    currentPage,
    scale,
    setScale,
    setCurrentPage,

    // Ref setters
    setScrollContainerRef,
    setPageRef,
    setupIntersectionObserver,

    // Visibility tracking
    getVisiblePages,
    isPageVisible,
    setRendererCallbacks: callbacks => {
      rendererCallbacks = callbacks;
    },

    // Navigation
    goToPage,
    goToPrevPage,
    goToNextPage,

    // Zoom controls
    zoomIn: () => zoomToPoint(0.25),
    zoomOut: () => zoomToPoint(-0.25),
    resetZoom: () => setScale(1.0),
    fitToWidth: () => {
      if (!scrollContainerRef || !document.pdfDoc()) return;

      document
        .pdfDoc()
        .getPage(1)
        .then(page => {
          const viewport = page.getViewport({ scale: 1.0 });
          const containerWidth = scrollContainerRef.clientWidth - 64; // Account for padding
          const newScale = containerWidth / viewport.width;
          setScale(Math.min(Math.max(newScale, 0.5), 3.0));
        });
    },

    // Cleanup
    cleanup,
  };
}
