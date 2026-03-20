/**
 * Grant Dialog component
 * Dialog for creating grants using shadcn Dialog
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface GrantDialogProps {
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  type: string;
  startsAt: string;
  expiresAt: string;
  onTypeChange: (_value: string) => void;
  onStartsAtChange: (_value: string) => void;
  onExpiresAtChange: (_value: string) => void;
  onSubmit: () => void;
  loading: boolean;
}

export function GrantDialog({
  open,
  onOpenChange,
  type,
  startsAt,
  expiresAt,
  onTypeChange,
  onStartsAtChange,
  onExpiresAtChange,
  onSubmit,
  loading,
}: GrantDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-md'>
        <DialogHeader>
          <DialogTitle>Create Grant</DialogTitle>
        </DialogHeader>
        <div className='flex flex-col gap-4'>
          <div>
            <label className='text-secondary-foreground mb-1 block text-sm font-medium'>Type</label>
            <select
              value={type}
              onChange={e => onTypeChange?.(e.target.value)}
              className='border-border w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none'
            >
              <option value='trial'>Trial</option>
              <option value='single_project'>Single Project</option>
            </select>
          </div>
          <div>
            <label className='text-secondary-foreground mb-1 block text-sm font-medium'>
              Starts At
            </label>
            <input
              type='datetime-local'
              value={startsAt}
              onChange={e => onStartsAtChange?.(e.target.value)}
              className='border-border w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none'
            />
          </div>
          <div>
            <label className='text-secondary-foreground mb-1 block text-sm font-medium'>
              Expires At
            </label>
            <input
              type='datetime-local'
              value={expiresAt}
              onChange={e => onExpiresAtChange?.(e.target.value)}
              className='border-border w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none'
            />
          </div>
        </div>
        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            className='bg-secondary text-secondary-foreground hover:bg-secondary rounded-lg px-4 py-2 text-sm font-medium'
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit?.()}
            disabled={loading}
            className='rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50'
          >
            {loading ? 'Creating...' : 'Create'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
