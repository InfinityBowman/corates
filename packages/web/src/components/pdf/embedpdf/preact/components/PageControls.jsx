/**
 * PageControls - Floating page navigation controls
 */
import { useViewportCapability } from '@embedpdf/plugin-viewport/preact';
import { useScroll } from '@embedpdf/plugin-scroll/preact';
import { useState, useCallback, useRef, useEffect } from 'preact/hooks';

export default function PageControls({ documentId }) {
  const { provides: viewport } = useViewportCapability();
  const {
    provides: scroll,
    state: { currentPage, totalPages },
  } = useScroll(documentId);

  const [isVisible, setIsVisible] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const hideTimeoutRef = useRef(null);
  const [inputValue, setInputValue] = useState(String(currentPage));

  useEffect(() => {
    setInputValue(String(currentPage));
  }, [currentPage]);

  const startHideTimer = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    hideTimeoutRef.current = setTimeout(() => {
      if (!isHovering) {
        setIsVisible(false);
      }
    }, 4000);
  }, [isHovering]);

  useEffect(() => {
    if (!viewport) return;

    return viewport.onScrollActivity(activity => {
      if (activity.documentId === documentId) {
        setIsVisible(true);
        startHideTimer();
      }
    });
  }, [viewport, documentId, startHideTimer]);

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  const handleMouseEnter = () => {
    setIsHovering(true);
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    startHideTimer();
  };

  const handlePageChange = e => {
    e.preventDefault();
    const page = parseInt(inputValue, 10);

    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      scroll?.scrollToPage?.({
        pageNumber: page,
      });
    }
  };

  const handlePreviousPage = e => {
    e.preventDefault();
    e.currentTarget.blur();
    if (currentPage > 1) {
      scroll?.scrollToPreviousPage();
    }
  };

  const handleNextPage = e => {
    e.preventDefault();
    e.currentTarget.blur();
    if (currentPage < totalPages) {
      scroll?.scrollToNextPage();
    }
  };

  if (totalPages === 0) return null;

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      class={`absolute bottom-4 left-1/2 z-50 -translate-x-1/2 transition-opacity duration-200 ${
        isVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <div class='flex items-center gap-2 rounded-lg border border-gray-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm'>
        {/* Previous Button */}
        <button
          onClick={handlePreviousPage}
          disabled={currentPage === 1}
          class='rounded p-1 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40'
          aria-label='Previous page'
        >
          <svg class='h-4 w-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M15 19l-7-7 7-7'
            />
          </svg>
        </button>

        {/* Page Input */}
        <form onSubmit={handlePageChange} class='flex items-center gap-1 text-sm'>
          <input
            type='text'
            value={inputValue}
            onInput={e => {
              const value = e.target.value.replace(/[^0-9]/g, '');
              setInputValue(value);
            }}
            class='w-10 rounded border border-gray-300 px-1 py-0.5 text-center text-sm focus:border-blue-500 focus:outline-none'
          />
          <span class='text-gray-400'>/</span>
          <span class='text-gray-600'>{totalPages}</span>
        </form>

        {/* Next Button */}
        <button
          onClick={handleNextPage}
          disabled={currentPage === totalPages}
          class='rounded p-1 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40'
          aria-label='Next page'
        >
          <svg class='h-4 w-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' />
          </svg>
        </button>
      </div>
    </div>
  );
}
