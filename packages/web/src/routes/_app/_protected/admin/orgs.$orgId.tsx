import { useState, useCallback } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAdminOrgDetails, useAdminOrgBilling } from '@/hooks/useAdminQueries';
import {
  createOrgSubscription,
  updateOrgSubscription,
  cancelOrgSubscription,
  createOrgGrant,
  revokeOrgGrant,
  grantOrgTrial,
  grantOrgSingleProject,
} from '@/stores/adminStore';
import { showToast } from '@/lib/toast';
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
import { AdminError, AdminPage } from '@/components/admin/ui';
import { formatDateInput } from '@/lib/formatDate';
import { OrgBillingSummary } from '@/components/admin/OrgBillingSummary';
import { OrgQuickActions } from '@/components/admin/OrgQuickActions';
import { SubscriptionList } from '@/components/admin/SubscriptionList';
import { SubscriptionDialog } from '@/components/admin/SubscriptionDialog';
import { GrantList } from '@/components/admin/GrantList';
import { GrantDialog } from '@/components/admin/GrantDialog';
import { OrgBillingReconcilePanel } from '@/components/admin/OrgBillingReconcilePanel';
import { OrgMembersSection } from '@/components/admin/orgs/OrgMembersSection';
import { OrgProjectsSection } from '@/components/admin/orgs/OrgProjectsSection';
import type { AdminOrgSubscription } from '@/server/functions/admin-orgs.server';
import { queryKeys } from '@/lib/queryKeys';

const BACK_TO_ORGS = { to: '/admin/orgs', label: 'Back to Organizations' };

export const Route = createFileRoute('/_app/_protected/admin/orgs/$orgId')({
  component: OrgDetailPage,
});

function OrgDetailPage() {
  const { orgId } = Route.useParams();
  const queryClient = useQueryClient();

  const orgDetailsQuery = useAdminOrgDetails(orgId);
  const billingQuery = useAdminOrgBilling(orgId);
  const orgDetails = orgDetailsQuery.data;
  const billing = billingQuery.data;

  const memberCount = orgDetails?.stats?.memberCount ?? 0;
  const projectCount = orgDetails?.stats?.projectCount ?? 0;

  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [subscriptionDialogOpen, setSubscriptionDialogOpen] = useState(false);
  const [grantDialogOpen, setGrantDialogOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'cancel-subscription' | 'revoke-grant';
    subscriptionId?: string;
    grantId?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<AdminOrgSubscription | null>(null);

  // Subscription form state
  const [subPlan, setSubPlan] = useState('team');
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
    setSubPlan('team');
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

  const toDateOrNull = (val: string | number | Date | null | undefined): Date | null => {
    if (val == null) return null;
    if (val instanceof Date) return val;
    if (typeof val === 'string') return new Date(val);
    return new Date(val * 1000);
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

  const handleEditSubscription = (subscription: AdminOrgSubscription) => {
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

  if (orgDetailsQuery.isError) {
    return (
      <AdminPage title='Organization' back={BACK_TO_ORGS}>
        <AdminError
          title='Failed to load organization details'
          description='This organization may have been deleted.'
          onRetry={() => orgDetailsQuery.refetch()}
        />
      </AdminPage>
    );
  }

  return (
    <AdminPage
      back={BACK_TO_ORGS}
      title={orgDetails?.org?.name ?? 'Organization'}
      description={
        orgDetails?.org?.slug ?
          `@${orgDetails.org.slug} - ${memberCount} members - ${projectCount} projects`
        : ' '
      }
      loadingTitle={orgDetailsQuery.isLoading}
    >
      <OrgMembersSection
        members={orgDetails?.members}
        total={memberCount}
        isLoading={orgDetailsQuery.isLoading}
      />

      <OrgProjectsSection
        projects={orgDetails?.projects}
        total={projectCount}
        isLoading={orgDetailsQuery.isLoading}
      />

      <OrgBillingSummary billing={billingData ?? null} isLoading={billingQuery.isLoading} />

      <OrgQuickActions
        loading={loading}
        onGrantTrial={handleQuickTrial}
        onGrantSingleProject={handleQuickSingleProject}
        onCreateSubscription={handleOpenSubscriptionDialog}
        onCreateGrant={handleOpenGrantDialog}
      />

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

      <GrantList
        grants={billing?.grants ?? []}
        loading={loading}
        isLoading={billingQuery.isLoading}
        onRevoke={(_grantId: string) =>
          setConfirmDialog({ type: 'revoke-grant', grantId: _grantId })
        }
      />

      {reconcileOpen ?
        <OrgBillingReconcilePanel orgId={orgId} onHide={() => setReconcileOpen(false)} />
      : <button
          type='button'
          onClick={() => setReconcileOpen(true)}
          className='border-border bg-card hover:bg-muted/40 flex min-h-13 w-full items-center justify-between gap-3 rounded-xl border px-4 text-left shadow-xs transition-colors'
        >
          <span className='text-foreground text-sm font-semibold'>Billing Reconciliation</span>
          <span className='text-muted-foreground text-[13px]'>Check for stuck states</span>
        </button>
      }

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
    </AdminPage>
  );
}
