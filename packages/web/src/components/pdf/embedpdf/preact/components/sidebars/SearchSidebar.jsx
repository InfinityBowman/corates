/**
 * SearchSidebar - Document search sidebar using useSearch hook
 */
import { useSearch } from '@embedpdf/plugin-search/preact';
import { useScrollCapability } from '@embedpdf/plugin-scroll/preact';
import { useState, useRef, useEffect, useCallback } from 'preact/hooks';
import { MatchFlag } from '@embedpdf/models';

const HitLine = ({ hit, onClick, active }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (active && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [active]);

  return (
    <button
      ref={ref}
      onClick={onClick}
      class={`w-full rounded border p-2 text-left text-sm transition-colors ${
        active ?
          'border-blue-500 bg-blue-50 text-blue-900'
        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
      }`}
    >
      <span>
        {hit.context?.truncatedLeft && '... '}
        {hit.context?.before}
        <span class='font-bold text-blue-600'>{hit.context?.match}</span>
        {hit.context?.after}
        {hit.context?.truncatedRight && ' ...'}
      </span>
    </button>
  );
};

export default function SearchSidebar({ documentId, onClose }) {
  const { state, provides } = useSearch(documentId);
  const { provides: scrollProvides } = useScrollCapability();
  const inputRef = useRef(null);
  const [inputValue, setInputValue] = useState('');

  // Sync inputValue with persisted state.query when state loads
  useEffect(() => {
    setInputValue(state.query || '');
  }, [state.query, documentId]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [provides]);

  useEffect(() => {
    if (state.activeResultIndex !== undefined && state.activeResultIndex >= 0 && !state.loading) {
      scrollToItem(state.activeResultIndex);
    }
  }, [state.activeResultIndex, state.loading, state.query, state.flags]);

  const handleInputChange = useCallback(
    e => {
      const value = e.target.value;
      setInputValue(value);

      if (value === '') {
        provides?.stopSearch();
      } else {
        provides?.searchAllPages(value);
      }
    },
    [provides],
  );

  const handleFlagChange = useCallback(
    (flag, checked) => {
      if (checked) {
        provides?.setFlags([...state.flags, flag]);
      } else {
        provides?.setFlags(state.flags.filter(f => f !== flag));
      }
    },
    [provides, state.flags],
  );

  const clearInput = useCallback(() => {
    setInputValue('');
    provides?.stopSearch();
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [provides]);

  const scrollToItem = useCallback(
    index => {
      const item = state.results[index];
      if (!item) return;

      const minCoordinates = item.rects.reduce(
        (min, rect) => ({
          x: Math.min(min.x, rect.origin.x),
          y: Math.min(min.y, rect.origin.y),
        }),
        { x: Infinity, y: Infinity },
      );

      scrollProvides?.forDocument(documentId).scrollToPage({
        pageNumber: item.pageIndex + 1,
        pageCoordinates: minCoordinates,
        center: true,
      });
    },
    [state.results, scrollProvides, documentId],
  );

  const groupByPage = useCallback(results => {
    return results.reduce((map, r, i) => {
      (map[r.pageIndex] ??= []).push({ hit: r, index: i });
      return map;
    }, {});
  }, []);

  if (!provides) return null;

  const grouped = groupByPage(state.results || []);

  return (
    <div class='flex h-full w-64 flex-col border-r border-gray-200 bg-white'>
      {/* Header */}
      <div class='flex h-10 items-center justify-between border-b border-gray-200 px-3'>
        <span class='text-sm font-medium text-gray-700'>Search</span>
        <button
          onClick={onClose}
          class='rounded p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
          aria-label='Close search'
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

      {/* Search input */}
      <div class='border-b border-gray-200 p-3'>
        <div class='relative'>
          <div class='pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3'>
            <svg
              class='h-4 w-4 text-gray-400'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
              />
            </svg>
          </div>
          <input
            ref={inputRef}
            type='text'
            value={inputValue}
            onInput={handleInputChange}
            placeholder='Search in document...'
            class='w-full rounded border border-gray-300 py-1.5 pr-8 pl-9 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none'
          />
          {inputValue && (
            <button
              type='button'
              onClick={clearInput}
              class='absolute inset-y-0 right-0 flex items-center pr-2'
            >
              <svg
                class='h-4 w-4 text-gray-400 hover:text-gray-600'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M6 18L18 6M6 6l12 12'
                />
              </svg>
            </button>
          )}
        </div>

        {/* Options */}
        <div class='mt-2 flex gap-3'>
          <label class='flex cursor-pointer items-center gap-1 text-xs text-gray-600'>
            <input
              type='checkbox'
              checked={state.flags?.includes(MatchFlag.MatchCase)}
              onChange={e => handleFlagChange(MatchFlag.MatchCase, e.target.checked)}
              class='h-3 w-3 rounded border-gray-300'
            />
            Match case
          </label>
          <label class='flex cursor-pointer items-center gap-1 text-xs text-gray-600'>
            <input
              type='checkbox'
              checked={state.flags?.includes(MatchFlag.MatchWholeWord)}
              onChange={e => handleFlagChange(MatchFlag.MatchWholeWord, e.target.checked)}
              class='h-3 w-3 rounded border-gray-300'
            />
            Whole word
          </label>
        </div>

        {/* Results count and navigation */}
        {state.active && !state.loading && state.total > 0 && (
          <div class='mt-2 flex items-center justify-between'>
            <span class='text-xs text-gray-600'>{state.total} results found</span>
            {state.total > 1 && (
              <div class='flex gap-1'>
                <button
                  type='button'
                  onClick={() => provides.previousResult()}
                  class='rounded p-1 text-gray-600 hover:bg-gray-100'
                  aria-label='Previous result'
                >
                  <svg class='h-4 w-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M5 15l7-7 7 7'
                    />
                  </svg>
                </button>
                <button
                  type='button'
                  onClick={() => provides.nextResult()}
                  class='rounded p-1 text-gray-600 hover:bg-gray-100'
                  aria-label='Next result'
                >
                  <svg class='h-4 w-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M19 9l-7 7-7-7'
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      <div class='flex-1 overflow-y-auto p-3'>
        {state.loading ?
          <div class='flex items-center justify-center py-4'>
            <div class='h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600' />
            <span class='ml-2 text-sm text-gray-500'>Searching...</span>
          </div>
        : <div class='space-y-3'>
            {Object.entries(grouped).map(([page, hits]) => (
              <div key={page}>
                <div class='mb-1 text-xs font-semibold text-gray-500'>Page {Number(page) + 1}</div>
                <div class='space-y-1'>
                  {hits.map(({ hit, index }) => (
                    <HitLine
                      key={index}
                      hit={hit}
                      active={index === state.activeResultIndex}
                      onClick={() => provides.goToResult(index)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        }
      </div>
    </div>
  );
}
