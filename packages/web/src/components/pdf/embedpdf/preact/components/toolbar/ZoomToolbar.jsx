/**
 * ZoomToolbar - Zoom controls for PDF viewer
 */
import { useZoom, ZoomMode } from '@embedpdf/plugin-zoom/preact';
import { ToolbarButton, ToolbarDivider } from '../ui/index.js';
import { useCallback, useState, useRef, useEffect } from 'preact/hooks';

const ZOOM_PRESETS = [
  { label: '50%', value: 0.5 },
  { label: '75%', value: 0.75 },
  { label: '100%', value: 1.0 },
  { label: '125%', value: 1.25 },
  { label: '150%', value: 1.5 },
  { label: '200%', value: 2.0 },
];

const ZOOM_MODES = [
  { label: 'Fit to Page', value: ZoomMode.FitPage },
  { label: 'Fit to Width', value: ZoomMode.FitWidth },
];

export default function ZoomToolbar({ documentId }) {
  const { state, provides } = useZoom(documentId);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  if (!provides) return null;

  const handleZoomIn = useCallback(() => {
    provides.zoomIn();
    setIsDropdownOpen(false);
  }, [provides]);

  const handleZoomOut = useCallback(() => {
    provides.zoomOut();
    setIsDropdownOpen(false);
  }, [provides]);

  const handlePresetSelect = useCallback(
    value => {
      provides.requestZoom(value);
      setIsDropdownOpen(false);
    },
    [provides],
  );

  const handleModeSelect = useCallback(
    newMode => {
      provides.requestZoom(newMode);
      setIsDropdownOpen(false);
    },
    [provides],
  );

  useEffect(() => {
    const handleClickOutside = e => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  const zoomPercentage = Math.round((state.currentZoomLevel || 1) * 100);
  const currentModeLabel = ZOOM_MODES.find(m => m.value === state.zoomLevel)?.label;

  return (
    <div class='flex items-center gap-1'>
      <ToolbarButton onClick={handleZoomOut} aria-label='Zoom out'>
        <svg class='h-4 w-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M20 12H4' />
        </svg>
      </ToolbarButton>

      <div class='relative' ref={dropdownRef}>
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          class='flex min-w-[80px] items-center justify-center gap-1 rounded px-2 py-1 text-sm text-gray-700 hover:bg-gray-100'
        >
          <span>{currentModeLabel || `${zoomPercentage}%`}</span>
          <svg class='h-3 w-3' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 9l-7 7-7-7' />
          </svg>
        </button>

        {isDropdownOpen && (
          <div class='absolute top-full left-0 z-50 mt-1 w-36 rounded-md border border-gray-200 bg-white py-1 shadow-lg'>
            {ZOOM_MODES.map(zoomMode => (
              <button
                key={zoomMode.value}
                onClick={() => handleModeSelect(zoomMode.value)}
                class={`w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 ${
                  state.zoomLevel === zoomMode.value ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                }`}
              >
                {zoomMode.label}
              </button>
            ))}
            <ToolbarDivider orientation='horizontal' />
            {ZOOM_PRESETS.map(preset => (
              <button
                key={preset.value}
                onClick={() => handlePresetSelect(preset.value)}
                class={`w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 ${
                  Math.abs(state.currentZoomLevel - preset.value) < 0.01 ?
                    'bg-blue-50 text-blue-600'
                  : 'text-gray-700'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <ToolbarButton onClick={handleZoomIn} aria-label='Zoom in'>
        <svg class='h-4 w-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 4v16m8-8H4' />
        </svg>
      </ToolbarButton>
    </div>
  );
}
