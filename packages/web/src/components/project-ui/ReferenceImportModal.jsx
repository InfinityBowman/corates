/**
 * ReferenceImportModal - Modal for importing references from Zotero/EndNote/BibTeX files
 * Parses RIS, BibTeX, and EndNote formats and allows selecting which references to import
 */

import { createSignal, createMemo, For, Show } from 'solid-js';
import { Dialog } from '@components/zag/Dialog.jsx';
import { FileUpload } from '@components/zag/FileUpload.jsx';
import { Checkbox } from '@components/zag/Checkbox.jsx';
import { showToast } from '@components/zag/Toast.jsx';
import { parseReferenceFile, getRefDisplayName, SUPPORTED_FORMATS } from '@/lib/referenceParser.js';
import { BiRegularImport } from 'solid-icons/bi';
import { AiOutlineFileText } from 'solid-icons/ai';

/**
 * @param {Object} props
 * @param {boolean} props.open - Whether the modal is open
 * @param {Function} props.onClose - Called when modal should close
 * @param {Function} props.onImport - Called with selected references: (references: Array) => void
 */
export default function ReferenceImportModal(props) {
  const [parsedRefs, setParsedRefs] = createSignal([]);
  const [selectedIds, setSelectedIds] = createSignal(new Set());
  const [parsing, setParsing] = createSignal(false);
  const [fileName, setFileName] = createSignal('');

  // Reset state when modal closes
  const handleClose = () => {
    setParsedRefs([]);
    setSelectedIds(new Set());
    setFileName('');
    props.onClose();
  };

  // Handle file selection
  const handleFileSelect = async files => {
    if (!files || files.length === 0) return;

    const file = files[0];
    setFileName(file.name);
    setParsing(true);

    try {
      const refs = await parseReferenceFile(file);

      if (refs.length === 0) {
        showToast.warning('No References Found', 'The file does not contain any valid references.');
        setParsedRefs([]);
        setSelectedIds(new Set());
        return;
      }

      // Add unique IDs to each reference for selection tracking
      const refsWithIds = refs.map((ref, index) => ({
        ...ref,
        _id: `ref-${index}`,
      }));

      setParsedRefs(refsWithIds);
      // Select all by default
      setSelectedIds(new Set(refsWithIds.map(r => r._id)));

      showToast.success(
        'References Parsed',
        `Found ${refs.length} reference${refs.length === 1 ? '' : 's'}.`,
      );
    } catch (error) {
      console.error('Error parsing reference file:', error);
      showToast.error(
        'Parse Error',
        'Failed to parse the reference file. Please check the format.',
      );
      setParsedRefs([]);
      setSelectedIds(new Set());
    } finally {
      setParsing(false);
    }
  };

  // Toggle single reference selection
  const toggleSelection = id => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select/deselect all
  const toggleSelectAll = () => {
    if (selectedIds().size === parsedRefs().length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(parsedRefs().map(r => r._id)));
    }
  };

  // Get selected references
  const selectedRefs = createMemo(() => {
    const ids = selectedIds();
    return parsedRefs().filter(r => ids.has(r._id));
  });

  // Handle import
  const handleImport = () => {
    const refs = selectedRefs();
    if (refs.length === 0) {
      showToast.warning('No Selection', 'Please select at least one reference to import.');
      return;
    }

    // Remove internal _id before passing to parent
    const cleanRefs = refs.map(({ _id, ...ref }) => ref);
    props.onImport(cleanRefs);
    handleClose();
  };

  const allSelected = createMemo(
    () => parsedRefs().length > 0 && selectedIds().size === parsedRefs().length,
  );

  const someSelected = createMemo(
    () => selectedIds().size > 0 && selectedIds().size < parsedRefs().length,
  );

  return (
    <Dialog
      open={props.open}
      onOpenChange={open => !open && handleClose()}
      title='Import References'
      description='Import studies from Zotero, EndNote, or other reference managers'
    >
      <div class='space-y-4'>
        {/* File upload area */}
        <Show when={parsedRefs().length === 0}>
          <div class='space-y-3'>
            <FileUpload
              accept='.ris,.enw,.bib,.bibtex'
              multiple={false}
              onFilesChange={handleFileSelect}
              showFileList={false}
              helpText='RIS, EndNote, or BibTeX format'
              compact
            />

            {/* Supported formats info */}
            <div class='text-xs text-gray-500'>
              <p class='font-medium mb-1'>Supported formats:</p>
              <ul class='list-disc list-inside space-y-0.5'>
                <For each={SUPPORTED_FORMATS}>
                  {format => (
                    <li>
                      <span class='font-medium'>{format.extension}</span> - {format.description}
                    </li>
                  )}
                </For>
              </ul>
            </div>

            {/* Parsing indicator */}
            <Show when={parsing()}>
              <div class='flex items-center justify-center gap-2 py-4 text-gray-500'>
                <div class='w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin' />
                <span>Parsing references...</span>
              </div>
            </Show>
          </div>
        </Show>

        {/* Parsed references list */}
        <Show when={parsedRefs().length > 0}>
          <div class='space-y-3'>
            {/* File info and change button */}
            <div class='flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2'>
              <div class='flex items-center gap-2 text-sm text-gray-600'>
                <AiOutlineFileText class='w-4 h-4' />
                <span class='truncate max-w-48'>{fileName()}</span>
                <span class='text-gray-400'>({parsedRefs().length} references)</span>
              </div>
              <button
                type='button'
                onClick={() => {
                  setParsedRefs([]);
                  setSelectedIds(new Set());
                  setFileName('');
                }}
                class='text-xs text-blue-600 hover:text-blue-700 font-medium'
              >
                Change file
              </button>
            </div>

            {/* Select all checkbox */}
            <div class='flex items-center gap-2 pb-2 border-b border-gray-200'>
              <Checkbox
                checked={allSelected()}
                indeterminate={someSelected()}
                onChange={toggleSelectAll}
                label={`Select all (${selectedIds().size}/${parsedRefs().length})`}
              />
            </div>

            {/* References list */}
            <div class='max-h-64 overflow-y-auto space-y-1 pr-1'>
              <For each={parsedRefs()}>
                {ref => (
                  <div
                    class={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                      selectedIds().has(ref._id) ?
                        'bg-blue-50 hover:bg-blue-100'
                      : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                    onClick={() => toggleSelection(ref._id)}
                  >
                    <Checkbox
                      checked={selectedIds().has(ref._id)}
                      onChange={() => toggleSelection(ref._id)}
                      class='mt-0.5'
                    />
                    <div class='flex-1 min-w-0'>
                      <p class='text-sm font-medium text-gray-900 line-clamp-2'>{ref.title}</p>
                      <p class='text-xs text-gray-500 mt-0.5'>
                        {getRefDisplayName(ref)}
                        <Show when={ref.journal}>
                          <span class='mx-1'>-</span>
                          <span class='italic'>{ref.journal}</span>
                        </Show>
                      </p>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>

        {/* Action buttons */}
        <div class='flex justify-end gap-2 pt-2'>
          <button
            type='button'
            onClick={handleClose}
            class='px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors'
          >
            Cancel
          </button>
          <Show when={parsedRefs().length > 0}>
            <button
              type='button'
              onClick={handleImport}
              disabled={selectedIds().size === 0}
              class='px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2'
            >
              <BiRegularImport class='w-4 h-4' />
              Import {selectedIds().size} {selectedIds().size === 1 ? 'study' : 'studies'}
            </button>
          </Show>
        </div>
      </div>
    </Dialog>
  );
}
