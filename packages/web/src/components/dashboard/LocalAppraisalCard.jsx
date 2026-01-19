/**
 * LocalAppraisalCard - Compact card for local appraisals
 *
 * Features:
 * - Horizontal layout
 * - Checklist type badge
 * - Relative timestamp
 * - Inline rename with Editable
 * - Delete action
 */

import { Show, createMemo } from 'solid-js';
import { FiFileText, FiChevronRight, FiTrash2 } from 'solid-icons/fi';
import { SimpleEditable } from '@/components/ui/editable';
import { getChecklistMetadata } from '@/checklist-registry';

/**
 * Format a relative time string
 * @param {Date|string|number} date
 * @returns {string}
 */
function formatRelativeTime(date) {
  if (!date) return '';
  const now = new Date();
  const then = new Date(date);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return then.toLocaleDateString();
}

/**
 * Local appraisal card component
 * @param {Object} props
 * @param {Object} props.checklist - Checklist data
 * @param {() => void} props.onOpen - Called when card is opened
 * @param {() => void} [props.onDelete] - Called when delete is requested
 * @param {(name: string) => void} [props.onRename] - Called when renamed
 * @param {Object} [props.style] - Animation style object
 */
export function LocalAppraisalCard(props) {
  const typeLabel = createMemo(() => {
    const metadata = getChecklistMetadata(props.checklist?.type || props.checklist?.checklistType);
    return metadata?.name || props.checklist?.type || 'Checklist';
  });

  const relativeTime = createMemo(() => {
    return formatRelativeTime(props.checklist?.updatedAt || props.checklist?.createdAt);
  });

  return (
    <div
      class='group border-border/60 bg-card hover:border-border flex items-center gap-4 rounded-xl border p-4 transition-all duration-200 hover:shadow-md'
      style={props.style}
    >
      {/* Icon */}
      <div class='bg-secondary text-muted-foreground group-hover:bg-primary-subtle group-hover:text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors'>
        <FiFileText class='h-5 w-5' />
      </div>

      {/* Content */}
      <div class='min-w-0 flex-1'>
        <Show
          when={props.onRename}
          fallback={
            <h4 class='text-foreground truncate text-sm font-medium'>{props.checklist?.name}</h4>
          }
        >
          <SimpleEditable
            activationMode='click'
            variant='inline'
            class='text-foreground truncate text-sm font-medium'
            value={props.checklist?.name || 'Untitled'}
            showEditIcon={true}
            onSubmit={newName => props.onRename?.(newName)}
          />
        </Show>
        <div class='text-muted-foreground/70 mt-0.5 flex items-center gap-2 text-xs'>
          <span class='bg-secondary text-muted-foreground rounded px-1.5 py-0.5 font-medium'>
            {typeLabel()}
          </span>
          <span>{relativeTime()}</span>
        </div>
      </div>

      {/* Actions */}
      <div class='flex shrink-0 items-center gap-1'>
        <Show when={props.onDelete}>
          <button
            type='button'
            onClick={e => {
              e.stopPropagation();
              props.onDelete?.(props.checklist?.id);
            }}
            class='text-muted-foreground/50 rounded-lg p-2 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-500'
            title='Delete appraisal'
          >
            <FiTrash2 class='h-4 w-4' />
          </button>
        </Show>
        <button
          type='button'
          onClick={() => props.onOpen?.(props.checklist?.id)}
          class='text-primary hover:bg-primary-subtle hover:text-primary/80 flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-all'
          title='Open appraisal'
        >
          Open
          <FiChevronRight class='h-4 w-4 transition-transform group-hover:translate-x-0.5' />
        </button>
      </div>
    </div>
  );
}

export default LocalAppraisalCard;
