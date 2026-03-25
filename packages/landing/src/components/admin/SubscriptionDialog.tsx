/**
 * Subscription Dialog component
 * Dialog for creating and editing subscriptions using shadcn Dialog
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';

interface SubscriptionDialogProps {
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  isEdit?: boolean;
  plan: string;
  status: string;
  periodStart?: string;
  periodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: Date | null;
  endedAt?: Date | null;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  onPlanChange: (_value: string) => void;
  onStatusChange: (_value: string) => void;
  onPeriodStartChange: (_value: string) => void;
  onPeriodEndChange: (_value: string) => void;
  onCancelAtPeriodEndChange: (_checked: boolean) => void;
  onCanceledAtChange: (_value: Date | null) => void;
  onEndedAtChange: (_value: Date | null) => void;
  onStripeCustomerIdChange: (_value: string) => void;
  onStripeSubscriptionIdChange: (_value: string) => void;
  onSubmit: () => void;
  loading?: boolean;
}

const formatDateInput = (timestamp: Date | string | number | null | undefined): string => {
  if (!timestamp) return '';
  const date =
    timestamp instanceof Date ? timestamp
    : typeof timestamp === 'string' ? new Date(timestamp)
    : new Date(timestamp * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export function SubscriptionDialog({
  open,
  onOpenChange,
  isEdit = false,
  plan,
  status,
  periodStart,
  periodEnd,
  cancelAtPeriodEnd = false,
  canceledAt,
  endedAt,
  stripeCustomerId = '',
  stripeSubscriptionId = '',
  onPlanChange,
  onStatusChange,
  onPeriodStartChange,
  onPeriodEndChange,
  onCancelAtPeriodEndChange,
  onCanceledAtChange,
  onEndedAtChange,
  onStripeCustomerIdChange,
  onStripeSubscriptionIdChange,
  onSubmit,
  loading,
}: SubscriptionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-lg'>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Subscription' : 'Create Subscription'}</DialogTitle>
        </DialogHeader>
        <div className='flex flex-col gap-4'>
          <div className='flex flex-col gap-2'>
            <Label>Plan</Label>
            <Select value={plan} onValueChange={onPlanChange}>
              <SelectTrigger className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value='starter_team'>Starter Team</SelectItem>
                  <SelectItem value='team'>Team</SelectItem>
                  <SelectItem value='unlimited_team'>Unlimited Team</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className='flex flex-col gap-2'>
            <Label>Status</Label>
            <Select value={status} onValueChange={onStatusChange}>
              <SelectTrigger className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value='active'>Active</SelectItem>
                  <SelectItem value='trialing'>Trialing</SelectItem>
                  <SelectItem value='past_due'>Past Due</SelectItem>
                  <SelectItem value='paused'>Paused</SelectItem>
                  <SelectItem value='canceled'>Canceled</SelectItem>
                  <SelectItem value='unpaid'>Unpaid</SelectItem>
                  {isEdit && <SelectItem value='incomplete'>Incomplete</SelectItem>}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className='flex flex-col gap-2'>
            <Label>Period Start (optional)</Label>
            <Input
              type='datetime-local'
              value={periodStart || ''}
              onChange={e => onPeriodStartChange?.(e.target.value)}
            />
          </div>
          <div className='flex flex-col gap-2'>
            <Label>Period End (optional)</Label>
            <Input
              type='datetime-local'
              value={periodEnd || ''}
              onChange={e => onPeriodEndChange?.(e.target.value)}
            />
          </div>
          <div className='flex items-center gap-2'>
            <Checkbox
              checked={cancelAtPeriodEnd}
              onCheckedChange={checked => onCancelAtPeriodEndChange?.(checked === true)}
            />
            <Label>Cancel at period end</Label>
          </div>
          <div className='flex flex-col gap-2'>
            <Label>Canceled At (optional)</Label>
            <Input
              type='datetime-local'
              value={canceledAt ? formatDateInput(canceledAt) : ''}
              onChange={e => onCanceledAtChange?.(e.target.value ? new Date(e.target.value) : null)}
            />
          </div>
          <div className='flex flex-col gap-2'>
            <Label>Ended At (optional)</Label>
            <Input
              type='datetime-local'
              value={endedAt ? formatDateInput(endedAt) : ''}
              onChange={e => onEndedAtChange?.(e.target.value ? new Date(e.target.value) : null)}
            />
          </div>
          <div className='flex flex-col gap-2'>
            <Label>Stripe Customer ID (optional)</Label>
            <Input
              type='text'
              value={stripeCustomerId}
              onChange={e => onStripeCustomerIdChange?.(e.target.value)}
              placeholder='cus_...'
              className='font-mono'
            />
          </div>
          <div className='flex flex-col gap-2'>
            <Label>Stripe Subscription ID (optional)</Label>
            <Input
              type='text'
              value={stripeSubscriptionId}
              onChange={e => onStripeSubscriptionIdChange?.(e.target.value)}
              placeholder='sub_...'
              className='font-mono'
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant='secondary' onClick={() => onOpenChange?.(false)}>
            Cancel
          </Button>
          <Button onClick={() => onSubmit?.()} disabled={loading}>
            {loading ?
              <>
                <Spinner size='sm' variant='white' data-icon='inline-start' />
                {isEdit ? 'Updating...' : 'Creating...'}
              </>
            : isEdit ?
              'Update'
            : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
