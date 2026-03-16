/**
 * Subscription Dialog component
 * Dialog for creating and editing subscriptions using shadcn Dialog
 */

import { useId } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

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
    timestamp instanceof Date
      ? timestamp
      : typeof timestamp === 'string'
        ? new Date(timestamp)
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
  const checkboxId = useId();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Subscription' : 'Create Subscription'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-secondary-foreground mb-1 block text-sm font-medium">
              Plan
            </label>
            <select
              value={plan}
              onChange={(e) => onPlanChange?.(e.target.value)}
              className="border-border w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="starter_team">Starter Team</option>
              <option value="team">Team</option>
              <option value="unlimited_team">Unlimited Team</option>
            </select>
          </div>
          <div>
            <label className="text-secondary-foreground mb-1 block text-sm font-medium">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => onStatusChange?.(e.target.value)}
              className="border-border w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="active">Active</option>
              <option value="trialing">Trialing</option>
              <option value="past_due">Past Due</option>
              <option value="paused">Paused</option>
              <option value="canceled">Canceled</option>
              <option value="unpaid">Unpaid</option>
              <option value="incomplete">Incomplete</option>
            </select>
          </div>
          <div>
            <label className="text-secondary-foreground mb-1 block text-sm font-medium">
              Period Start (optional)
            </label>
            <input
              type="datetime-local"
              value={periodStart || ''}
              onChange={(e) => onPeriodStartChange?.(e.target.value)}
              className="border-border w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-secondary-foreground mb-1 block text-sm font-medium">
              Period End (optional)
            </label>
            <input
              type="datetime-local"
              value={periodEnd || ''}
              onChange={(e) => onPeriodEndChange?.(e.target.value)}
              className="border-border w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id={checkboxId}
              checked={cancelAtPeriodEnd}
              onChange={(e) => onCancelAtPeriodEndChange?.(e.target.checked)}
              className="border-border h-4 w-4 rounded text-blue-600 focus:ring-2 focus:ring-blue-500"
            />
            <label htmlFor={checkboxId} className="text-secondary-foreground text-sm font-medium">
              Cancel at period end
            </label>
          </div>
          <div>
            <label className="text-secondary-foreground mb-1 block text-sm font-medium">
              Canceled At (optional)
            </label>
            <input
              type="datetime-local"
              value={canceledAt ? formatDateInput(canceledAt) : ''}
              onChange={(e) =>
                onCanceledAtChange?.(e.target.value ? new Date(e.target.value) : null)
              }
              className="border-border w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-secondary-foreground mb-1 block text-sm font-medium">
              Ended At (optional)
            </label>
            <input
              type="datetime-local"
              value={endedAt ? formatDateInput(endedAt) : ''}
              onChange={(e) =>
                onEndedAtChange?.(e.target.value ? new Date(e.target.value) : null)
              }
              className="border-border w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-secondary-foreground mb-1 block text-sm font-medium">
              Stripe Customer ID (optional)
            </label>
            <input
              type="text"
              value={stripeCustomerId}
              onChange={(e) => onStripeCustomerIdChange?.(e.target.value)}
              placeholder="cus_..."
              className="border-border w-full rounded-lg border px-3 py-2 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-secondary-foreground mb-1 block text-sm font-medium">
              Stripe Subscription ID (optional)
            </label>
            <input
              type="text"
              value={stripeSubscriptionId}
              onChange={(e) => onStripeSubscriptionIdChange?.(e.target.value)}
              placeholder="sub_..."
              className="border-border w-full rounded-lg border px-3 py-2 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>
        <DialogFooter>
          <button
            onClick={() => onOpenChange?.(false)}
            className="bg-secondary text-secondary-foreground hover:bg-secondary rounded-lg px-4 py-2 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit?.()}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
          >
            {loading ? (isEdit ? 'Updating...' : 'Creating...') : isEdit ? 'Update' : 'Create'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
