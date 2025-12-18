/**
 * PdfListItem - Single PDF row with actions
 *
 * Displays PDF info with:
 * - File name
 * - Tag badge
 * - View/download button
 * - Tag change dropdown (if editable)
 * - Delete button (if editable)
 */

import { Show, createSignal } from 'solid-js';
import { FiTrash2, FiEye, FiDownload, FiEdit2 } from 'solid-icons/fi';
import { CgFileDocument } from 'solid-icons/cg';
import { Menu, Dialog } from '@corates/ui';
import PdfTagBadge from './PdfTagBadge.jsx';

export default function PdfListItem(props) {
  // props.pdf: { id, fileName, key, size, uploadedAt, tag, title?, firstAuthor?, publicationYear?, ... }
  // props.onView: (pdf) => void
  // props.onDownload: (pdf) => void
  // props.onDelete: (pdf) => void
  // props.onTagChange: (pdfId, newTag) => void
  // props.onEditMetadata: (pdf) => void - new: open edit metadata modal
  // props.readOnly: boolean
  // props.hasPrimary: boolean - whether another PDF already has primary tag
  // props.hasProtocol: boolean - whether another PDF already has protocol tag

  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);

  const formatFileSize = bytes => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = timestamp => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleDateString();
  };

  const tagMenuItems = () => {
    const items = [];

    // Only show tag options that make sense
    if (props.pdf.tag !== 'primary') {
      items.push({
        value: 'set-primary',
        label:
          props.hasPrimary && props.pdf.tag !== 'primary' ?
            'Set as Primary (replaces current)'
          : 'Set as Primary',
      });
    }

    if (props.pdf.tag !== 'protocol') {
      items.push({
        value: 'set-protocol',
        label:
          props.hasProtocol && props.pdf.tag !== 'protocol' ?
            'Set as Protocol (replaces current)'
          : 'Set as Protocol',
      });
    }

    if (props.pdf.tag !== 'secondary') {
      items.push({
        value: 'set-secondary',
        label: 'Set as Secondary',
      });
    }

    return items;
  };

  const handleTagMenuSelect = details => {
    if (details.value === 'set-primary') {
      props.onTagChange?.(props.pdf.id, 'primary');
    } else if (details.value === 'set-protocol') {
      props.onTagChange?.(props.pdf.id, 'protocol');
    } else if (details.value === 'set-secondary') {
      props.onTagChange?.(props.pdf.id, 'secondary');
    }
  };

  const handleDelete = () => {
    setShowDeleteConfirm(false);
    props.onDelete?.(props.pdf);
  };

  return (
    <>
      <div class='flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors'>
        {/* File icon */}
        <div class='shrink-0'>
          <CgFileDocument class='w-8 h-8 text-gray-400' />
        </div>

        {/* File info */}
        <div class='flex-1 min-w-0'>
          <div class='flex items-center gap-2'>
            <span class='text-sm font-medium text-gray-900 truncate'>{props.pdf.fileName}</span>
            <PdfTagBadge tag={props.pdf.tag} />
          </div>
          <div class='text-xs text-gray-500 mt-0.5'>
            {formatFileSize(props.pdf.size)}
            <Show when={props.pdf.uploadedAt}> &middot; {formatDate(props.pdf.uploadedAt)}</Show>
          </div>
        </div>

        {/* Actions */}
        <div class='flex items-center gap-1'>
          {/* View button */}
          <button
            type='button'
            onClick={() => props.onView?.(props.pdf)}
            class='p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors'
            title='View PDF'
          >
            <FiEye class='w-4 h-4' />
          </button>

          {/* Download button */}
          <button
            type='button'
            onClick={() => props.onDownload?.(props.pdf)}
            class='p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors'
            title='Download PDF'
          >
            <FiDownload class='w-4 h-4' />
          </button>

          {/* Edit metadata button (if not read-only) */}
          <Show when={!props.readOnly}>
            <button
              type='button'
              onClick={() => props.onEditMetadata?.(props.pdf)}
              class='p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors'
              title='Edit Metadata'
            >
              <FiEdit2 class='w-4 h-4' />
            </button>
          </Show>

          {/* Tag change menu (if not read-only) */}
          <Show when={!props.readOnly && tagMenuItems().length > 0}>
            <Menu
              trigger={<span class='text-xs'>Tag</span>}
              items={tagMenuItems()}
              onSelect={handleTagMenuSelect}
              placement='bottom-end'
              hideIndicator
            />
          </Show>

          {/* Delete button (if not read-only) */}
          <Show when={!props.readOnly}>
            <button
              type='button'
              onClick={() => setShowDeleteConfirm(true)}
              class='p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors'
              title='Delete PDF'
            >
              <FiTrash2 class='w-4 h-4' />
            </button>
          </Show>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteConfirm()} onOpenChange={setShowDeleteConfirm} title='Delete PDF'>
        <div class='p-4'>
          <p class='text-gray-600 mb-4'>
            Are you sure you want to delete <strong>{props.pdf.fileName}</strong>? This action
            cannot be undone.
          </p>
          <div class='flex justify-end gap-3'>
            <button
              type='button'
              onClick={() => setShowDeleteConfirm(false)}
              class='px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50'
            >
              Cancel
            </button>
            <button
              type='button'
              onClick={handleDelete}
              class='px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700'
            >
              Delete
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
