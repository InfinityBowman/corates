/**
 * ThumbnailsSidebar - Page thumbnails sidebar using ThumbnailsPane
 */
import { ThumbnailsPane, ThumbImg } from '@embedpdf/plugin-thumbnail/preact';
import { useScroll } from '@embedpdf/plugin-scroll/preact';

export default function ThumbnailsSidebar({ documentId, onClose }) {
  const { state, provides } = useScroll(documentId);

  return (
    <div class='flex h-full w-48 flex-col border-r border-gray-200 bg-gray-50'>
      {/* Header */}
      <div class='flex h-10 items-center justify-between border-b border-gray-200 px-3'>
        <span class='text-sm font-medium text-gray-700'>Pages</span>
        <button
          onClick={onClose}
          class='rounded p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
          aria-label='Close thumbnails'
        >
          <svg class='h-4 w-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M6 18L18 6M6 6l12 12'
            />
          </svg>
        </button>
      </div>

      {/* Thumbnail list */}
      <div class='flex-1 overflow-hidden'>
        <ThumbnailsPane documentId={documentId} style={{ width: '100%', height: '100%' }}>
          {m => (
            <div
              key={m.pageIndex}
              style={{
                position: 'absolute',
                width: '100%',
                height: m.wrapperHeight,
                top: m.top,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: 'pointer',
                padding: '8px',
              }}
              onClick={() => {
                provides?.scrollToPage?.({
                  pageNumber: m.pageIndex + 1,
                });
              }}
            >
              <div
                style={{
                  width: m.width,
                  height: m.height,
                  border: `2px solid ${state.currentPage === m.pageIndex + 1 ? '#3b82f6' : '#d1d5db'}`,
                  borderRadius: '4px',
                  overflow: 'hidden',
                  boxShadow:
                    state.currentPage === m.pageIndex + 1 ?
                      '0 0 0 2px rgba(59, 130, 246, 0.2)'
                    : 'none',
                }}
              >
                <ThumbImg
                  documentId={documentId}
                  meta={m}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                  }}
                />
              </div>
              <div
                style={{
                  height: m.labelHeight,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: '4px',
                }}
              >
                <span class='text-xs text-gray-600'>{m.pageIndex + 1}</span>
              </div>
            </div>
          )}
        </ThumbnailsPane>
      </div>
    </div>
  );
}
