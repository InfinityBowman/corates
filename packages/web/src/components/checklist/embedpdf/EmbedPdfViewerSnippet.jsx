/**
 * EmbedPdfViewerSnippet - Component for viewing PDF files using EmbedPDF snippet viewer
 * Uses the vanilla EmbedPDF snippet with full UI (toolbar, sidebar, etc.)
 *
 * Configuration:
 * - Light theme with blue accent colors matching app design
 * - Only highlights and free-text comments enabled (no ink/shapes/redaction)
 * - Read-only mode disables all annotation tools
 */

import { createMemo, createEffect, onCleanup } from 'solid-js';
import EmbedPDF from '@embedpdf/snippet';

export default function EmbedPdfViewerSnippet(props) {
  // props.pdfData - ArrayBuffer of PDF data (required for snippet viewer)
  // props.pdfFileName - Name of the PDF file (optional, for display)
  // props.readOnly - If true, disables all annotation tools (view-only mode)
  // props.pdfs - Array of PDFs for multi-PDF selection
  // props.selectedPdfId - Currently selected PDF ID
  // props.onPdfSelect - Handler for PDF selection change

  let containerRef;
  let viewerInstance = null;
  let currentBlobUrl = null;
  let currentReadOnly = null;
  let currentCategories = null;
  let popoverElement = null;
  let popoverButtonElement = null;
  let clickOutsideHandler = null;
  let escapeKeyHandler = null;

  // Create blob URL from pdfData
  const blobUrl = createMemo(() => {
    const pdfData = props.pdfData;
    if (!pdfData) return null;

    const blob = new Blob([pdfData], { type: 'application/pdf' });
    return URL.createObjectURL(blob);
  });

  // Build disabled categories based on read-only state
  // When readOnly is true, disable all annotation features
  // When readOnly is false, only keep highlight and free-text comments
  const disabledCategories = createMemo(() => {
    if (props.readOnly) {
      // Disable all annotation features in read-only mode
      return [
        'annotation',
        'annotation-highlight',
        'annotation-text',
        'annotation-ink',
        'annotation-shape',
        'mode-shapes', // Disable shapes mode button
        'annotation-stamp',
        'annotation-underline',
        'annotation-strikeout',
        'annotation-squiggly',
        'panel-comment',
        'redaction',
        'export',
        'print',
      ];
    }
    // In edit mode, only keep highlight and free-text comments
    return [
      'annotation-ink',
      'annotation-shape',
      'mode-shapes', // Disable shapes mode button
      'annotation-stamp',
      'annotation-underline',
      'annotation-strikeout',
      'annotation-squiggly',
      'redaction',
      'export',
      'print',
    ];
  });

  // Theme configuration: light mode with blue accent colors matching app design
  const themeConfig = createMemo(() => ({
    preference: 'light',
    light: {
      accent: {
        primary: '#2563eb', // blue-600
        primaryHover: '#1d4ed8', // blue-700
        primaryActive: '#1e40af', // blue-800
        primaryLight: '#dbeafe', // blue-100
        primaryForeground: '#ffffff',
      },
      background: {
        app: '#f0f9ff', // blue-50
        surface: '#ffffff',
        surfaceAlt: '#f8fafc',
        elevated: '#ffffff',
        overlay: 'rgba(0, 0, 0, 0.5)',
        input: '#ffffff',
      },
      foreground: {
        primary: '#1e293b', // slate-800
        secondary: '#64748b', // slate-500
        muted: '#94a3b8', // slate-400
        disabled: '#cbd5e1', // slate-300
        onAccent: '#ffffff',
      },
      interactive: {
        hover: '#f1f5f9', // slate-100
        active: '#e2e8f0', // slate-200
        selected: '#dbeafe', // blue-100
        focus: '#2563eb', // blue-600
      },
      border: {
        default: '#e2e8f0', // slate-200
        subtle: '#f1f5f9', // slate-100
        strong: '#cbd5e1', // slate-300
      },
    },
  }));

  // Helper function to close the PDF switcher popover
  function closePdfSwitcherPopover() {
    if (popoverElement) {
      popoverElement.style.display = 'none';
      popoverElement.classList.remove('open');
    }
    if (clickOutsideHandler) {
      document.removeEventListener('click', clickOutsideHandler);
      clickOutsideHandler = null;
    }
    if (escapeKeyHandler) {
      document.removeEventListener('keydown', escapeKeyHandler);
      escapeKeyHandler = null;
    }
  }

  // Helper function to open the PDF switcher popover
  function openPdfSwitcherPopover(buttonElement) {
    if (!popoverElement || !containerRef) return;
    popoverButtonElement = buttonElement;

    const containerRect = containerRef.getBoundingClientRect();

    if (buttonElement) {
      const buttonRect = buttonElement.getBoundingClientRect();
      // Position popover below the button, aligned to the right
      popoverElement.style.top = `${buttonRect.bottom - containerRect.top + 4}px`;
      popoverElement.style.right = `${containerRect.right - buttonRect.right}px`;
    } else {
      // Fallback position: top-right of container
      popoverElement.style.top = '40px';
      popoverElement.style.right = '10px';
    }

    popoverElement.style.display = 'block';
    popoverElement.classList.add('open');

    // Handle click outside to close
    clickOutsideHandler = event => {
      if (
        popoverElement &&
        !popoverElement.contains(event.target) &&
        (!buttonElement || !buttonElement.contains(event.target))
      ) {
        closePdfSwitcherPopover();
      }
    };
    setTimeout(() => {
      document.addEventListener('click', clickOutsideHandler);
    }, 0);

    // Handle ESC key to close
    escapeKeyHandler = event => {
      if (event.key === 'Escape') {
        closePdfSwitcherPopover();
      }
    };
    document.addEventListener('keydown', escapeKeyHandler);
  }

  // Helper function to update the PDF switcher popover content
  function updatePdfSwitcherPopoverContent() {
    if (!popoverElement) return;

    const pdfs = props.pdfs || [];
    if (pdfs.length === 0) {
      popoverElement.innerHTML = '';
      return;
    }

    // Sort PDFs: primary first, then protocol, then secondary
    const sortedPdfs = [...pdfs].sort((a, b) => {
      const tagOrder = { primary: 0, protocol: 1, secondary: 2 };
      const tagA = tagOrder[a.tag] ?? 2;
      const tagB = tagOrder[b.tag] ?? 2;
      return tagA - tagB;
    });

    popoverElement.innerHTML = '';

    sortedPdfs.forEach(pdf => {
      const isSelected = pdf.id === props.selectedPdfId;
      const tagLabel =
        pdf.tag === 'primary' ? 'Primary'
        : pdf.tag === 'protocol' ? 'Protocol'
        : null;
      const displayName = tagLabel ? `${pdf.fileName} (${tagLabel})` : pdf.fileName;

      const button = document.createElement('button');
      button.className = `embedpdf-pdf-switcher-item ${isSelected ? 'selected' : ''}`;
      button.setAttribute('data-pdf-id', pdf.id);
      button.textContent = displayName;
      button.style.cssText = `
        width: 100%;
        text-align: left;
        padding: 8px 12px;
        border: none;
        background: ${isSelected ? '#dbeafe' : 'transparent'};
        color: ${isSelected ? '#1e40af' : '#1e293b'};
        cursor: pointer;
        border-radius: 4px;
        font-size: 14px;
        transition: background-color 0.15s;
      `;

      button.addEventListener('mouseenter', () => {
        button.style.backgroundColor = isSelected ? '#dbeafe' : '#f1f5f9';
      });

      button.addEventListener('mouseleave', () => {
        button.style.backgroundColor = isSelected ? '#dbeafe' : 'transparent';
      });

      button.addEventListener('click', () => {
        if (props.onPdfSelect) {
          props.onPdfSelect(pdf.id);
          closePdfSwitcherPopover();
        }
      });

      popoverElement.appendChild(button);
    });
  }

  // Helper function to create and setup the PDF switcher popover
  function setupPdfSwitcherPopover(container) {
    // Remove existing popover if it exists
    const existingPopover = container.querySelector('.embedpdf-pdf-switcher-popover');
    if (existingPopover) {
      existingPopover.remove();
    }

    // Create popover element
    popoverElement = document.createElement('div');
    popoverElement.className = 'embedpdf-pdf-switcher-popover';
    popoverElement.style.cssText = `
      position: absolute;
      display: none;
      z-index: 1000;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      min-width: 200px;
      max-width: 300px;
      max-height: 400px;
      overflow-y: auto;
      padding: 4px;
    `;

    updatePdfSwitcherPopoverContent();
    container.appendChild(popoverElement);
  }

  // Helper function to destroy viewer instance and clean up
  function destroyViewer() {
    closePdfSwitcherPopover();

    if (popoverElement && popoverElement.parentNode) {
      popoverElement.parentNode.removeChild(popoverElement);
      popoverElement = null;
    }

    if (viewerInstance) {
      try {
        if (typeof viewerInstance.destroy === 'function') {
          viewerInstance.destroy();
        } else if (typeof viewerInstance.unmount === 'function') {
          viewerInstance.unmount();
        } else if (typeof viewerInstance.dispose === 'function') {
          viewerInstance.dispose();
        }
      } catch (err) {
        console.warn('Error destroying EmbedPDF viewer:', err);
      }
      viewerInstance = null;
    }

    if (containerRef) {
      try {
        containerRef.innerHTML = '';
      } catch (err) {
        console.warn('Error clearing container:', err);
      }
    }

    if (currentBlobUrl) {
      try {
        URL.revokeObjectURL(currentBlobUrl);
      } catch (err) {
        console.warn('Error revoking blob URL:', err);
      }
      currentBlobUrl = null;
    }
  }

  // Initialize or re-initialize the snippet viewer when dependencies change
  createEffect(() => {
    const url = blobUrl();
    const container = containerRef;
    const categories = disabledCategories();
    const readOnly = props.readOnly;

    if (!url || !container) {
      // Clean up existing viewer if URL is removed
      destroyViewer();
      return;
    }

    // Check if we need to recreate the viewer
    // Recreate if: URL changed, readOnly changed, or categories changed
    const needsRecreate =
      !viewerInstance ||
      currentBlobUrl !== url ||
      currentReadOnly !== readOnly ||
      JSON.stringify(currentCategories) !== JSON.stringify(categories);

    if (needsRecreate) {
      // Destroy existing viewer before creating new one
      destroyViewer();

      // Initialize new viewer
      try {
        viewerInstance = EmbedPDF.init({
          type: 'container',
          target: container,
          src: url,
          theme: themeConfig(),
          disabledCategories: categories,
        });
        currentBlobUrl = url;
        currentReadOnly = readOnly;
        currentCategories = categories;

        // Customize responsive breakpoints and setup PDF switcher after initialization
        // Adjust mobile view threshold (default is 640px for sm breakpoint)
        viewerInstance.registry.then(registry => {
          try {
            const commands = registry.getPlugin('commands')?.provides();
            const ui = registry.getPlugin('ui')?.provides();
            if (!ui) return;

            const schema = ui.getSchema();
            const mainToolbar = schema.toolbars?.['main-toolbar'];

            // Customize responsive breakpoints
            if (mainToolbar?.responsive?.breakpoints) {
              const originalBreakpoints = mainToolbar.responsive.breakpoints;
              ui.mergeSchema({
                toolbars: {
                  'main-toolbar': {
                    ...mainToolbar,
                    responsive: {
                      ...mainToolbar.responsive,
                      breakpoints: {
                        ...originalBreakpoints,
                        xs:
                          originalBreakpoints.xs ?
                            {
                              ...originalBreakpoints.xs,
                            }
                          : originalBreakpoints.xs,
                        sm:
                          originalBreakpoints.sm ?
                            {
                              minWidth: 400,
                              maxWidth: 768,
                              hide: originalBreakpoints.sm.hide || [],
                              show: originalBreakpoints.sm.show || [],
                            }
                          : originalBreakpoints.sm,
                        md:
                          originalBreakpoints.md ?
                            {
                              minWidth: 640,
                              hide: originalBreakpoints.md.hide || [],
                              show: originalBreakpoints.md.show || [],
                            }
                          : originalBreakpoints.md,
                      },
                    },
                  },
                },
              });
            }

            // Setup PDF switcher if we have multiple PDFs
            const pdfs = props.pdfs || [];
            if (pdfs.length > 1 && commands && ui) {
              // Register PDF switcher icon (document/file icon)
              viewerInstance.registerIcon('pdf-switcher', {
                viewBox: '0 0 24 24',
                paths: [
                  {
                    d: 'M14 3v4a1 1 0 0 0 1 1h4',
                    stroke: 'currentColor',
                    fill: 'none',
                    'stroke-linecap': 'round',
                    'stroke-linejoin': 'round',
                  },
                  {
                    d: 'M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z',
                    stroke: 'currentColor',
                    fill: 'none',
                    'stroke-linecap': 'round',
                    'stroke-linejoin': 'round',
                  },
                ],
              });

              // Setup popover
              setupPdfSwitcherPopover(container);

              // Register PDF switcher command
              commands.registerCommand({
                id: 'custom.pdf-switcher',
                label: 'Switch PDF',
                icon: 'pdf-switcher',
                action: () => {
                  if (!popoverElement || !container) return;

                  // Find the button element - try multiple selectors as EmbedPDF may use different attributes
                  let buttonElement = container.querySelector(
                    `[data-command-id="custom.pdf-switcher"]`,
                  );
                  if (!buttonElement) {
                    buttonElement = container.querySelector('#pdf-switcher-button');
                  }
                  if (!buttonElement) {
                    const allButtons = container.querySelectorAll('button');
                    buttonElement = Array.from(allButtons).find(
                      btn =>
                        btn.getAttribute('aria-label')?.includes('Switch PDF') ||
                        btn.getAttribute('title')?.includes('Switch PDF'),
                    );
                  }

                  if (popoverElement.classList.contains('open')) {
                    closePdfSwitcherPopover();
                  } else {
                    updatePdfSwitcherPopoverContent();
                    openPdfSwitcherPopover(buttonElement || null);
                  }
                },
              });

              // Add PDF switcher button to toolbar
              const toolbarSchema = JSON.parse(JSON.stringify(mainToolbar));
              const items = toolbarSchema.items || [];
              const rightGroup = items.find(item => item.id === 'right-group');

              if (rightGroup && Array.isArray(rightGroup.items)) {
                // Check if button already exists
                const existingIndex = rightGroup.items.findIndex(
                  item => item.id === 'pdf-switcher-button',
                );

                const pdfSwitcherButton = {
                  type: 'command-button',
                  id: 'pdf-switcher-button',
                  commandId: 'custom.pdf-switcher',
                  variant: 'icon',
                };

                if (existingIndex >= 0) {
                  rightGroup.items[existingIndex] = pdfSwitcherButton;
                } else {
                  // Insert before the last item (usually a spacer or rightmost button)
                  rightGroup.items.splice(rightGroup.items.length - 1, 0, pdfSwitcherButton);
                }

                ui.mergeSchema({
                  toolbars: {
                    'main-toolbar': {
                      ...toolbarSchema,
                      items,
                    },
                  },
                });
              }
            }
          } catch (err) {
            console.warn('Failed to customize viewer:', err);
          }
        });
      } catch (err) {
        console.error('Failed to initialize EmbedPDF viewer:', err);
        viewerInstance = null;
        currentBlobUrl = null;
        currentReadOnly = null;
        currentCategories = null;
      }
    } else if (viewerInstance) {
      // Only theme can be updated without recreating
      // Update theme if it changed (though themeConfig is stable, this is defensive)
      try {
        if (viewerInstance.setTheme) {
          viewerInstance.setTheme(themeConfig());
        }
      } catch (err) {
        console.warn('Failed to update EmbedPDF theme:', err);
      }
    }
  });

  // Update popover content when PDFs or selectedPdfId changes
  createEffect(() => {
    const pdfs = props.pdfs;
    const selectedPdfId = props.selectedPdfId;

    // Update popover content if it exists
    if (popoverElement && popoverElement.parentNode) {
      updatePdfSwitcherPopoverContent();
    }
  });

  // Clean up on unmount
  onCleanup(() => {
    // Close and remove popover
    closePdfSwitcherPopover();
    if (popoverElement && popoverElement.parentNode) {
      popoverElement.parentNode.removeChild(popoverElement);
      popoverElement = null;
    }

    // Destroy viewer instance
    if (viewerInstance) {
      try {
        if (typeof viewerInstance.destroy === 'function') {
          viewerInstance.destroy();
        } else if (typeof viewerInstance.unmount === 'function') {
          viewerInstance.unmount();
        } else if (typeof viewerInstance.dispose === 'function') {
          viewerInstance.dispose();
        }
      } catch (err) {
        console.warn('Error destroying EmbedPDF viewer on cleanup:', err);
      }
      viewerInstance = null;
    }

    // Clear container contents
    if (containerRef) {
      try {
        containerRef.innerHTML = '';
      } catch (err) {
        console.warn('Error clearing container:', err);
      }
    }

    // Revoke blob URL (only the current one to avoid double-revoking)
    if (currentBlobUrl) {
      try {
        URL.revokeObjectURL(currentBlobUrl);
      } catch (err) {
        console.warn('Error revoking blob URL:', err);
      }
      currentBlobUrl = null;
    }

    // Also revoke the current blobUrl if different (shouldn't happen, but safety check)
    const url = blobUrl();
    if (url && url !== currentBlobUrl) {
      try {
        URL.revokeObjectURL(url);
      } catch (err) {
        console.warn('Error revoking blob URL:', err);
      }
    }
  });

  const hasPdfData = createMemo(() => !!props.pdfData);

  return (
    <div class='h-full w-full bg-gray-100'>
      {hasPdfData() ?
        <div ref={containerRef} class='h-full w-full' />
      : <div class='flex h-full items-center justify-center'>
          <div class='text-center text-gray-500'>
            <p>No PDF selected</p>
          </div>
        </div>
      }
    </div>
  );
}
