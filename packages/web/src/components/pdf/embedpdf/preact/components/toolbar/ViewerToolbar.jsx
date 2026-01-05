/**
 * ViewerToolbar - Main toolbar for PDF viewer
 */
import { ToolbarButton } from '../ui/index.js';
import ZoomToolbar from './ZoomToolbar.jsx';

export default function ViewerToolbar({
  documentId,
  onToggleThumbnails,
  onToggleSearch,
  showThumbnails,
  showSearch,
}) {
  return (
    <div class='flex h-12 items-center justify-between border-b border-gray-200 bg-white px-3'>
      {/* Left section - Sidebar toggles */}
      <div class='flex items-center gap-1'>
        <ToolbarButton
          onClick={onToggleThumbnails}
          isActive={showThumbnails}
          aria-label='Toggle thumbnails'
          title='Page thumbnails'
        >
          <svg class='h-4 w-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z'
            />
          </svg>
        </ToolbarButton>
      </div>

      {/* Center section - Zoom controls */}
      <div class='flex items-center gap-2'>
        <ZoomToolbar documentId={documentId} />
      </div>

      {/* Right section - Search and tools */}
      <div class='flex items-center gap-1'>
        <ToolbarButton
          onClick={onToggleSearch}
          isActive={showSearch}
          aria-label='Toggle search'
          title='Search in document'
        >
          <svg class='h-4 w-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
            />
          </svg>
        </ToolbarButton>
      </div>
    </div>
  );
}
