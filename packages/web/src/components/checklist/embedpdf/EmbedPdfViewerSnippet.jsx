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

  let containerRef;
  let viewerInstance = null;
  let currentBlobUrl = null;
  let currentReadOnly = null;
  let currentCategories = null;

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

  // Helper function to destroy viewer instance and clean up
  function destroyViewer() {
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

        // Customize responsive breakpoints after initialization
        // Adjust mobile view threshold (default is 640px for sm breakpoint)
        viewerInstance.registry.then(registry => {
          try {
            const ui = registry.getPlugin('ui')?.provides();
            if (ui) {
              const schema = ui.getSchema();
              const mainToolbar = schema.toolbars?.['main-toolbar'];

              if (mainToolbar?.responsive?.breakpoints) {
                const originalBreakpoints = mainToolbar.responsive.breakpoints;
                // Adjust breakpoints to switch to mobile view at a larger width
                // Preserve all show/hide arrays, only change the width thresholds
                ui.mergeSchema({
                  toolbars: {
                    'main-toolbar': {
                      ...mainToolbar,
                      responsive: {
                        ...mainToolbar.responsive,
                        breakpoints: {
                          ...originalBreakpoints,
                          // Adjust xs breakpoint: keep original, mobile view will start later
                          xs:
                            originalBreakpoints.xs ?
                              {
                                ...originalBreakpoints.xs,
                              }
                            : originalBreakpoints.xs,
                          // Adjust sm breakpoint: mobile view now starts at 400px instead of 640px
                          // This means desktop mode stays active on smaller screens (until < 400px)
                          sm:
                            originalBreakpoints.sm ?
                              {
                                minWidth: 400, // Changed from 640 to 400 (desktop mode stays on smaller screens)
                                maxWidth: 768, // Keep maxWidth at 768
                                // Preserve the original show/hide arrays to keep buttons visible
                                hide: originalBreakpoints.sm.hide || [],
                                show: originalBreakpoints.sm.show || [],
                              }
                            : originalBreakpoints.sm,
                          // Adjust md breakpoint: desktop view now starts at 640px instead of 768px
                          // This means desktop mode comes earlier (at smaller screen sizes)
                          md:
                            originalBreakpoints.md ?
                              {
                                minWidth: 640, // Changed from 768 to 640 (desktop mode comes earlier)
                                // Preserve the original show/hide arrays
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
            }
          } catch (err) {
            console.warn('Failed to customize breakpoints:', err);
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

  // Clean up on unmount
  onCleanup(() => {
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
