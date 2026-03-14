/**
 * LocalAppraisalCard - Compact horizontal card for local checklists
 */

import { useMemo } from 'react';
import { FileTextIcon, ChevronRightIcon, TrashIcon } from 'lucide-react';
import { SimpleEditable } from '@/components/ui/editable';
import { getChecklistMetadata } from '@/checklist-registry';
import { formatRelativeTime } from './utils';

/* eslint-disable no-unused-vars */
interface LocalAppraisalCardProps {
  checklist: { id: string; name?: string; type?: string; checklistType?: string; updatedAt?: number; createdAt?: number };
  onOpen: (id: string) => void;
  onDelete?: (id: string) => void;
  onRename?: (name: string) => void;
  style?: React.CSSProperties;
}
/* eslint-enable no-unused-vars */

export function LocalAppraisalCard({ checklist, onOpen, onDelete, onRename, style }: LocalAppraisalCardProps) {
  const typeLabel = useMemo(() => {
    const metadata = getChecklistMetadata(checklist.type || checklist.checklistType || '');
    return (metadata as { name?: string })?.name || checklist.type || 'Checklist';
  }, [checklist.type, checklist.checklistType]);

  const relativeTime = formatRelativeTime(checklist.updatedAt || checklist.createdAt);

  return (
    <div
      className="group flex items-center gap-4 rounded-xl border border-border/60 bg-card p-4 transition-all duration-200 hover:border-border hover:shadow-md"
      style={style}
    >
      {/* Icon */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
        <FileTextIcon className="h-5 w-5" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {onRename ? (
          <SimpleEditable
            activationMode="click"
            variant="inline"
            className="truncate text-sm font-medium text-foreground"
            value={checklist.name || 'Untitled'}
            showEditIcon
            onSubmit={newName => onRename(newName)}
          />
        ) : (
          <h4 className="truncate text-sm font-medium text-foreground">{checklist.name}</h4>
        )}
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground/70">
          <span className="rounded bg-secondary px-1.5 py-0.5 font-medium text-muted-foreground">
            {typeLabel}
          </span>
          <span>{relativeTime}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        {onDelete && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onDelete(checklist.id); }}
            className="rounded-lg p-2 text-muted-foreground/50 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
            title="Delete appraisal"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onOpen(checklist.id)}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-primary transition-all hover:bg-primary/5 hover:text-primary/80"
          title="Open appraisal"
        >
          Open
          <ChevronRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}
