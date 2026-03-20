/**
 * Admin Org Detail route
 * Shows organization details, billing summary, subscriptions, grants, and reconciliation.
 */

import { useState, useCallback } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import {
  ArrowLeftIcon,
  HomeIcon,
  UsersIcon,
  FolderIcon,
  LoaderIcon,
  ShieldIcon,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAdminOrgDetails, useAdminOrgBilling } from '@/hooks/useAdminQueries';
import {
  useAdminStore,
  createOrgSubscription,
  updateOrgSubscription,
  cancelOrgSubscription,
  createOrgGrant,
  revokeOrgGrant,
  grantOrgTrial,
  grantOrgSingleProject,
} from '@/stores/adminStore';
import { showToast } from '@/components/ui/toast';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { handleError } from '@/lib/error-utils';
import { AdminBox } from '@/components/admin/ui';
import { OrgBillingSummary } from '@/components/admin/OrgBillingSummary';
import { OrgQuickActions } from '@/components/admin/OrgQuickActions';
import { SubscriptionList } from '@/components/admin/SubscriptionList';
import { SubscriptionDialog } from '@/components/admin/SubscriptionDialog';
import { GrantList } from '@/components/admin/GrantList';
import { GrantDialog } from '@/components/admin/GrantDialog';
import { OrgBillingReconcilePanel } from '@/components/admin/OrgBillingReconcilePanel';
import { queryKeys } from '@/lib/queryKeys';

export const Route = createFileRoute('/_app/_protected/admin/orgs/$orgId')({
  component: OrgDetailPage,
});

interface OrgDetails {
  org?: { name?: string; slug?: string };
  stats?: { memberCount?: number; projectCount?: number };
}

interface SubscriptionRecord {
  id: string;
  plan: string;
  status: string;
  periodStart?: string | number | Date;
  periodEnd?: string | number | Date;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: string | number | Date | null;
  endedAt?: string | number | Date | null;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

interface BillingData {
  billing?: {
    plan?: {
      name?: string;
      entitlements?: Record<string, boolean | string | number>;
      quotas?: Record<string, number | null | undefined>;
    };
    effectivePlanId?: string;
    accessMode?: 'full' | 'readOnly';
    source?: 'free' | 'subscription' | 'grant';
    subscription?: { id?: string; plan?: string } | null;
    grant?: { type?: string } | null;
  };
  subscriptions?: SubscriptionRecord[];
  grants?: Array<{
    id: string;
    type: string;
    startsAt?: string | number | Date;
    expiresAt?: string | number | Date;
    createdAt?: string | number | Date;
    revokedAt?: string | number | Date | null;
  }>;
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

function OrgDetailPage() {
  const { orgId } = Route.useParams();
  const queryClient = useQueryClient();
  const { isAdmin, isAdminChecked } = useAdminStore();

  const orgDetailsQuery = useAdminOrgDetails(orgId);
  const billingQuery = useAdminOrgBilling(orgId);
  const orgDetails = orgDetailsQuery.data as OrgDetails | undefined;
  const billing = billingQuery.data as BillingData | undefined;

  const [subscriptionDialogOpen, setSubscriptionDialogOpen] = useState(false);
  const [grantDialogOpen, setGrantDialogOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'cancel-subscription' | 'revoke-grant';
    subscriptionId?: string;
    grantId?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<SubscriptionRecord | null>(null);

  // Subscription form state
  const [subPlan, setSubPlan] = useState('starter_team');
  const [subStatus, setSubStatus] = useState('active');
  const [subPeriodStart, setSubPeriodStart] = useState('');
  const [subPeriodEnd, setSubPeriodEnd] = useState('');
  const [subCancelAtPeriodEnd, setSubCancelAtPeriodEnd] = useState(false);
  const [subCanceledAt, setSubCanceledAt] = useState<Date | null>(null);
  const [subEndedAt, setSubEndedAt] = useState<Date | null>(null);
  const [subStripeCustomerId, setSubStripeCustomerId] = useState('');
  const [subStripeSubscriptionId, setSubStripeSubscriptionId] = useState('');

  // Grant form state
  const [grantType, setGrantType] = useState('trial');
  const [grantStartsAt, setGrantStartsAt] = useState('');
  const [grantExpiresAt, setGrantExpiresAt] = useState('');

  const invalidateBilling = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgBilling(orgId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgDetails(orgId) });
  }, [queryClient, orgId]);

  const resetSubscriptionForm = () => {
    setSubPlan('starter_team');
    setSubStatus('active');
    setSubPeriodStart('');
    setSubPeriodEnd('');
    setSubCancelAtPeriodEnd(false);
    setSubCanceledAt(null);
    setSubEndedAt(null);
    setSubStripeCustomerId('');
    setSubStripeSubscriptionId('');
  };

  const handleCreateSubscription = async () => {
    setLoading(true);
    try {
      const data: Record<string, unknown> = { plan: subPlan, status: subStatus };
      if (subPeriodStart) data.periodStart = new Date(subPeriodStart);
      if (subPeriodEnd) data.periodEnd = new Date(subPeriodEnd);
      if (subStripeCustomerId) data.stripeCustomerId = subStripeCustomerId;
      if (subStripeSubscriptionId) data.stripeSubscriptionId = subStripeSubscriptionId;
      data.cancelAtPeriodEnd = subCancelAtPeriodEnd;

      await createOrgSubscription(orgId, data);
      showToast.success('Success', 'Subscription created successfully');
      setSubscriptionDialogOpen(false);
      resetSubscriptionForm();
      invalidateBilling();
    } catch (error) {
      await handleError(error, { showToast: true });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSubscription = async () => {
    if (!editingSubscription) return;
    setLoading(true);
    try {
      const data: Record<string, unknown> = {};
      if (subPlan !== editingSubscription.plan) data.plan = subPlan;
      if (subStatus !== editingSubscription.status) data.status = subStatus;
      if (subPeriodStart) {
        const newStart = new Date(subPeriodStart);
        const oldStart =
          editingSubscription.periodStart ?
            editingSubscription.periodStart instanceof Date ? editingSubscription.periodStart
            : typeof editingSubscription.periodStart === 'string' ?
              new Date(editingSubscription.periodStart)
            : new Date((editingSubscription.periodStart as number) * 1000)
          : null;
        if (!oldStart || newStart.getTime() !== oldStart.getTime()) {
          data.periodStart = newStart;
        }
      }
      if (subPeriodEnd) {
        const newEnd = new Date(subPeriodEnd);
        const oldEnd =
          editingSubscription.periodEnd ?
            editingSubscription.periodEnd instanceof Date ? editingSubscription.periodEnd
            : typeof editingSubscription.periodEnd === 'string' ?
              new Date(editingSubscription.periodEnd)
            : new Date((editingSubscription.periodEnd as number) * 1000)
          : null;
        if (!oldEnd || newEnd.getTime() !== oldEnd.getTime()) {
          data.periodEnd = newEnd;
        }
      }
      if (subCancelAtPeriodEnd !== editingSubscription.cancelAtPeriodEnd) {
        data.cancelAtPeriodEnd = subCancelAtPeriodEnd;
      }
      const oldCanceledAt = toDateOrNull(editingSubscription.canceledAt);
      if (subCanceledAt?.getTime() !== oldCanceledAt?.getTime()) {
        data.canceledAt = subCanceledAt;
      }
      const oldEndedAt = toDateOrNull(editingSubscription.endedAt);
      if (subEndedAt?.getTime() !== oldEndedAt?.getTime()) {
        data.endedAt = subEndedAt;
      }

      await updateOrgSubscription(orgId, editingSubscription.id, data);
      showToast.success('Success', 'Subscription updated successfully');
      setSubscriptionDialogOpen(false);
      setEditingSubscription(null);
      resetSubscriptionForm();
      invalidateBilling();
    } catch (error) {
      await handleError(error, { showToast: true });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async (subscriptionId: string) => {
    setLoading(true);
    try {
      await cancelOrgSubscription(orgId, subscriptionId);
      showToast.success('Success', 'Subscription canceled (status=canceled, endedAt=now)');
      setConfirmDialog(null);
      invalidateBilling();
    } catch (error) {
      await handleError(error, { showToast: true });
    } finally {
      setLoading(false);
    }
  };

  const toDateOrNull = (val: string | number | Date | null | undefined): Date | null => {
    if (val == null) return null;
    if (val instanceof Date) return val;
    if (typeof val === 'string') return new Date(val);
    return new Date(val * 1000);
  };

  const handleEditSubscription = (subscription: SubscriptionRecord) => {
    setEditingSubscription(subscription);
    setSubPlan(subscription.plan);
    setSubStatus(subscription.status);
    setSubPeriodStart(formatDateInput(subscription.periodStart));
    setSubPeriodEnd(formatDateInput(subscription.periodEnd));
    setSubCancelAtPeriodEnd(subscription.cancelAtPeriodEnd ?? false);
    setSubCanceledAt(toDateOrNull(subscription.canceledAt));
    setSubEndedAt(toDateOrNull(subscription.endedAt));
    setSubStripeCustomerId(subscription.stripeCustomerId ?? '');
    setSubStripeSubscriptionId(subscription.stripeSubscriptionId ?? '');
    setSubscriptionDialogOpen(true);
  };

  const handleCreateGrant = async () => {
    setLoading(true);
    try {
      const data = {
        type: grantType,
        startsAt: new Date(grantStartsAt),
        expiresAt: new Date(grantExpiresAt),
      };
      await createOrgGrant(orgId, data);
      showToast.success('Success', 'Grant created successfully');
      setGrantDialogOpen(false);
      invalidateBilling();
    } catch (error) {
      await handleError(error, { showToast: true });
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeGrant = async (grantId: string) => {
    setLoading(true);
    try {
      await revokeOrgGrant(orgId, grantId);
      showToast.success('Success', 'Grant revoked');
      setConfirmDialog(null);
      invalidateBilling();
    } catch (error) {
      await handleError(error, { showToast: true });
    } finally {
      setLoading(false);
    }
  };

  const handleQuickTrial = async () => {
    setLoading(true);
    try {
      await grantOrgTrial(orgId);
      showToast.success('Success', 'Trial granted (14 days)');
      invalidateBilling();
    } catch (error) {
      await handleError(error, { showToast: true });
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSingleProject = async () => {
    setLoading(true);
    try {
      await grantOrgSingleProject(orgId);
      showToast.success('Success', 'Single project grant created/extended (6 months)');
      invalidateBilling();
    } catch (error) {
      await handleError(error, { showToast: true });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSubscriptionDialog = () => {
    setEditingSubscription(null);
    resetSubscriptionForm();
    setSubscriptionDialogOpen(true);
  };

  const handleOpenGrantDialog = () => {
    setGrantType('trial');
    const now = new Date();
    const expires = new Date(now);
    expires.setDate(expires.getDate() + 14);
    setGrantStartsAt(formatDateInput(now));
    setGrantExpiresAt(formatDateInput(expires));
    setGrantDialogOpen(true);
  };

  const billingData = billing?.billing;

  if (!isAdminChecked) {
    return (
      <div className='flex min-h-[400px] items-center justify-center'>
        <LoaderIcon className='h-8 w-8 animate-spin text-blue-600' />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className='text-muted-foreground flex min-h-[400px] flex-col items-center justify-center'>
        <ShieldIcon className='mb-4 h-12 w-12' />
        <p className='text-lg font-medium'>Access Denied</p>
        <p className='text-sm'>You do not have admin privileges.</p>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className='mb-6'>
        <Link
          to={'/admin/orgs' as string}
          className='text-muted-foreground hover:text-secondary-foreground mb-4 inline-flex items-center text-sm'
        >
          <ArrowLeftIcon className='mr-1 h-4 w-4' />
          Back to Organizations
        </Link>
        <div className='flex items-center space-x-3'>
          <div className='flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100'>
            <HomeIcon className='h-6 w-6 text-blue-600' />
          </div>
          <div>
            <h1 className='text-foreground text-2xl font-bold'>
              {orgDetails?.org?.name || 'Organization'}
            </h1>
            <p className='text-muted-foreground text-sm'>
              <code>{orgDetails?.org?.slug || ''}</code>
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      {orgDetails && (
        <div className='mb-6 grid grid-cols-1 gap-4 md:grid-cols-3'>
          <AdminBox padding='compact'>
            <div className='flex items-center space-x-2'>
              <UsersIcon className='text-muted-foreground/70 h-5 w-5' />
              <div>
                <p className='text-muted-foreground text-sm'>Members</p>
                <p className='text-foreground text-2xl font-bold'>
                  {orgDetails.stats?.memberCount ?? 0}
                </p>
              </div>
            </div>
          </AdminBox>
          <AdminBox padding='compact'>
            <div className='flex items-center space-x-2'>
              <FolderIcon className='text-muted-foreground/70 h-5 w-5' />
              <div>
                <p className='text-muted-foreground text-sm'>Projects</p>
                <p className='text-foreground text-2xl font-bold'>
                  {orgDetails.stats?.projectCount ?? 0}
                </p>
              </div>
            </div>
          </AdminBox>
        </div>
      )}

      {/* Billing Summary */}
      <div className='mb-6'>
        <OrgBillingSummary billing={billingData ?? null} />
      </div>

      {/* Quick Actions */}
      <div className='mb-6'>
        <OrgQuickActions
          loading={loading}
          onGrantTrial={handleQuickTrial}
          onGrantSingleProject={handleQuickSingleProject}
          onCreateSubscription={handleOpenSubscriptionDialog}
          onCreateGrant={handleOpenGrantDialog}
        />
      </div>

      {/* Subscriptions */}
      <div className='mb-6'>
        <SubscriptionList
          subscriptions={billing?.subscriptions}
          effectiveSubscriptionId={billingData?.subscription?.id}
          loading={loading}
          isLoading={billingQuery.isLoading}
          onCancel={(_subscriptionId: string) =>
            setConfirmDialog({ type: 'cancel-subscription', subscriptionId: _subscriptionId })
          }
          onEdit={handleEditSubscription}
        />
      </div>

      {/* Grants */}
      <div className='mb-6'>
        <GrantList
          grants={billing?.grants ?? []}
          loading={loading}
          isLoading={billingQuery.isLoading}
          onRevoke={(_grantId: string) =>
            setConfirmDialog({ type: 'revoke-grant', grantId: _grantId })
          }
        />
      </div>

      {/* Billing Reconciliation */}
      <div className='mb-6'>
        <OrgBillingReconcilePanel orgId={orgId} />
      </div>

      {/* Subscription Dialog */}
      <SubscriptionDialog
        open={subscriptionDialogOpen}
        onOpenChange={(_open: boolean) => {
          if (!_open) {
            setEditingSubscription(null);
            resetSubscriptionForm();
          }
          setSubscriptionDialogOpen(_open);
        }}
        loading={loading}
        isEdit={!!editingSubscription}
        plan={subPlan}
        status={subStatus}
        periodStart={subPeriodStart}
        periodEnd={subPeriodEnd}
        cancelAtPeriodEnd={subCancelAtPeriodEnd}
        canceledAt={subCanceledAt}
        endedAt={subEndedAt}
        stripeCustomerId={subStripeCustomerId}
        stripeSubscriptionId={subStripeSubscriptionId}
        onPlanChange={setSubPlan}
        onStatusChange={setSubStatus}
        onPeriodStartChange={setSubPeriodStart}
        onPeriodEndChange={setSubPeriodEnd}
        onCancelAtPeriodEndChange={setSubCancelAtPeriodEnd}
        onCanceledAtChange={setSubCanceledAt}
        onEndedAtChange={setSubEndedAt}
        onStripeCustomerIdChange={setSubStripeCustomerId}
        onStripeSubscriptionIdChange={setSubStripeSubscriptionId}
        onSubmit={() => {
          if (editingSubscription) {
            handleUpdateSubscription();
          } else {
            handleCreateSubscription();
          }
        }}
      />

      {/* Grant Dialog */}
      <GrantDialog
        open={grantDialogOpen}
        onOpenChange={setGrantDialogOpen}
        loading={loading}
        type={grantType}
        startsAt={grantStartsAt}
        expiresAt={grantExpiresAt}
        onTypeChange={setGrantType}
        onStartsAtChange={setGrantStartsAt}
        onExpiresAtChange={setGrantExpiresAt}
        onSubmit={handleCreateGrant}
      />

      {/* Confirm Cancel Subscription */}
      <AlertDialog
        open={confirmDialog?.type === 'cancel-subscription'}
        onOpenChange={_open => !_open && setConfirmDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this subscription?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant='destructive'
              onClick={() => {
                if (confirmDialog?.subscriptionId) {
                  handleCancelSubscription(confirmDialog.subscriptionId);
                }
              }}
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Revoke Grant */}
      <AlertDialog
        open={confirmDialog?.type === 'revoke-grant'}
        onOpenChange={_open => !_open && setConfirmDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Grant</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke this grant?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant='destructive'
              onClick={() => {
                if (confirmDialog?.grantId) {
                  handleRevokeGrant(confirmDialog.grantId);
                }
              }}
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
