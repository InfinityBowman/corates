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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';

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
          <div className='flex flex-col gap-2'>
            <Label>Type</Label>
            <Select value={type} onValueChange={onTypeChange}>
              <SelectTrigger className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value='trial'>Trial</SelectItem>
                  <SelectItem value='single_project'>Single Project</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className='flex flex-col gap-2'>
            <Label>Starts At</Label>
            <Input
              type='datetime-local'
              value={startsAt}
              onChange={e => onStartsAtChange?.(e.target.value)}
            />
          </div>
          <div className='flex flex-col gap-2'>
            <Label>Expires At</Label>
            <Input
              type='datetime-local'
              value={expiresAt}
              onChange={e => onExpiresAtChange?.(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant='secondary' onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onSubmit?.()} disabled={loading}>
            {loading ?
              <>
                <Spinner size='sm' variant='white' data-icon='inline-start' />
                Creating...
              </>
            : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
