/**
 * pdfTextSelection - Native text selection implementation for PDF.js
 * Creates invisible text elements positioned over PDF content for native browser selection
 * Works reliably at any zoom level by using PDF coordinates and viewport transforms
 */

/**
 * Creates a native text selection layer for a PDF page
 * @param {HTMLElement} container - Container element (positioned over canvas)
 * @param {Object} page - PDF.js page object
 * @param {Object} viewport - PDF.js viewport object
 * @returns {Object} Selection layer with cleanup function
 */
export function createTextSelectionLayer(container, page, initialViewport) {
  let viewport = initialViewport;
  let textItems = null;
  let textLayerDiv = null;

  // Create text layer container
  textLayerDiv = document.createElement('div');
  textLayerDiv.style.position = 'absolute';
  textLayerDiv.style.top = '0';
  textLayerDiv.style.left = '0';
  textLayerDiv.style.width = `${viewport.width}px`;
  textLayerDiv.style.height = `${viewport.height}px`;
  textLayerDiv.style.overflow = 'hidden';
  textLayerDiv.style.pointerEvents = 'auto';
  textLayerDiv.style.userSelect = 'text';
  textLayerDiv.style.cursor = 'text';
  textLayerDiv.style.zIndex = '3';
  textLayerDiv.className = 'pdf-text-layer-native';
  container.appendChild(textLayerDiv);

  // Render text items as invisible, selectable spans
  async function renderTextItems() {
    if (!textLayerDiv) return;

    try {
      const textContent = await page.getTextContent();
      textItems = textContent.items;

      // Clear existing content
      textLayerDiv.innerHTML = '';

      // Create spans for each text item
      for (const item of textItems) {
        if (!item.str || !item.transform) continue;

        const span = document.createElement('span');
        span.textContent = item.str;

        // Get viewport coordinates for this text item
        const pdfX = item.transform[4];
        const pdfY = item.transform[5];
        const itemWidth = item.width || 0;
        const itemHeight = item.height || 0;

        // Convert PDF coordinates to viewport coordinates
        // PDF origin is bottom-left, viewport origin is top-left
        const topLeft = viewport.convertToViewportPoint(pdfX, pdfY + itemHeight);
        const fontSize = itemHeight * viewport.scale;

        // Position the span exactly over the PDF text
        span.style.position = 'absolute';
        span.style.left = `${topLeft[0]}px`;
        span.style.top = `${topLeft[1]}px`;
        span.style.fontSize = `${fontSize}px`;
        span.style.lineHeight = '1';
        span.style.color = 'transparent';
        span.style.whiteSpace = 'pre';
        span.style.userSelect = 'text';
        span.style.pointerEvents = 'auto';
        span.style.fontFamily = item.fontName || 'sans-serif';
        span.style.transformOrigin = '0% 0%';

        // Apply text transform if needed (rotation, etc.)
        // PDF transform matrix: [a, b, c, d, e, f]
        // a, b, c, d form the rotation/scaling matrix
        const a = item.transform[0];
        const b = item.transform[1];
        const _c = item.transform[2];
        const _d = item.transform[3];

        // Calculate rotation angle from transform matrix
        const angle = Math.atan2(b, a) * (180 / Math.PI);
        if (Math.abs(angle) > 0.1) {
          span.style.transform = `rotate(${angle}deg)`;
        }

        // Set dimensions to match text item
        span.style.width = `${itemWidth * viewport.scale}px`;
        span.style.height = `${itemHeight * viewport.scale}px`;
        span.style.display = 'inline-block';

        textLayerDiv.appendChild(span);
      }
    } catch (err) {
      console.error('Error rendering text items:', err);
    }
  }

  // Initial render
  renderTextItems();

  // Update viewport when scale changes
  function updateViewport(newViewport) {
    viewport = newViewport;

    if (textLayerDiv) {
      textLayerDiv.style.width = `${newViewport.width}px`;
      textLayerDiv.style.height = `${newViewport.height}px`;

      // Re-render all text items with new viewport
      renderTextItems();
    }
  }

  // Cleanup function
  function cleanup() {
    if (textLayerDiv) {
      textLayerDiv.remove();
      textLayerDiv = null;
    }
    textItems = null;
  }

  return {
    cleanup,
    updateViewport,
    getSelectedText: () => {
      // Get native browser selection
      const selection = window.getSelection();
      return selection.toString();
    },
  };
}
