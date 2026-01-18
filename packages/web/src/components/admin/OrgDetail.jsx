/**
 * Org Detail component for admin dashboard
 * Shows organization details, billing summary, subscriptions, and grants.
 * Allows admins to manage subscriptions, create grants, and view organization statistics.
 */

import { createSignal, Show } from 'solid-js';
import { useParams, A } from '@solidjs/router';
import { FiArrowLeft, FiHome, FiUsers, FiFolder, FiShield, FiLoader, FiX } from 'solid-icons/fi';
import { useAdminOrgDetails, useAdminOrgBilling } from '@primitives/useAdminQueries.js';
import {
  createOrgSubscription,
  updateOrgSubscription,
  cancelOrgSubscription,
  createOrgGrant,
  revokeOrgGrant,
  grantOrgTrial,
  grantOrgSingleProject,
  isAdminChecked,
  isAdmin,
} from '@/stores/adminStore.js';
import { showToast } from '@/components/ui/toast';
import {
  Dialog,
  DialogBackdrop,
  DialogPositioner,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogCloseTrigger,
} from '@/components/ui/dialog';
import { handleError } from '@/lib/error-utils.js';
import { AdminBox } from './ui/index.js';
import OrgBillingSummary from './OrgBillingSummary.jsx';
import OrgQuickActions from './OrgQuickActions.jsx';
import SubscriptionList from './SubscriptionList.jsx';
import GrantList from './GrantList.jsx';
import SubscriptionDialog from './SubscriptionDialog.jsx';
import GrantDialog from './GrantDialog.jsx';
import OrgBillingReconcilePanel from './billing-observability/OrgBillingReconcilePanel.jsx';

export default function OrgDetail() {
  const params = useParams();
  const orgId = () => params.orgId;

  // Fetch org details and billing - pass accessors so hooks can track changes
  const orgDetailsQuery = useAdminOrgDetails(orgId);
  const billingQuery = useAdminOrgBilling(orgId);
  const orgDetails = () => orgDetailsQuery.data;
  const billing = () => billingQuery.data;

  // Dialog states
  const [subscriptionDialogOpen, setSubscriptionDialogOpen] = createSignal(false);
  const [grantDialogOpen, setGrantDialogOpen] = createSignal(false);
  const [confirmDialog, setConfirmDialog] = createSignal(null);
  const [loading, setLoading] = createSignal(false);
  const [editingSubscription, setEditingSubscription] = createSignal(null);

  // Subscription form state
  const [subPlan, setSubPlan] = createSignal('starter_team');
  const [subStatus, setSubStatus] = createSignal('active');
  const [subPeriodStart, setSubPeriodStart] = createSignal('');
  const [subPeriodEnd, setSubPeriodEnd] = createSignal('');
  const [subCancelAtPeriodEnd, setSubCancelAtPeriodEnd] = createSignal(false);
  const [subCanceledAt, setSubCanceledAt] = createSignal(null);
  const [subEndedAt, setSubEndedAt] = createSignal(null);
  const [subStripeCustomerId, setSubStripeCustomerId] = createSignal('');
  const [subStripeSubscriptionId, setSubStripeSubscriptionId] = createSignal('');

  // Grant form state
  const [grantType, setGrantType] = createSignal('trial');
  const [grantStartsAt, setGrantStartsAt] = createSignal('');
  const [grantExpiresAt, setGrantExpiresAt] = createSignal('');

  const formatDateInput = timestamp => {
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

  const handleCreateSubscription = async () => {
    setLoading(true);
    try {
      const data = {
        plan: subPlan(),
        status: subStatus(),
      };
      if (subPeriodStart()) data.periodStart = new Date(subPeriodStart());
      if (subPeriodEnd()) data.periodEnd = new Date(subPeriodEnd());
      if (subStripeCustomerId()) data.stripeCustomerId = subStripeCustomerId();
      if (subStripeSubscriptionId()) data.stripeSubscriptionId = subStripeSubscriptionId();
      data.cancelAtPeriodEnd = subCancelAtPeriodEnd();

      await createOrgSubscription(orgId(), data);
      showToast.success('Success', 'Subscription created successfully');
      setSubscriptionDialogOpen(false);
      resetSubscriptionForm();
      billingQuery.refetch();
    } catch (error) {
      await handleError(error, { toastTitle: 'Error creating subscription' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSubscription = async () => {
    const subscription = editingSubscription();
    if (!subscription) return;

    setLoading(true);
    try {
      const data = {};
      if (subPlan() !== subscription.plan) data.plan = subPlan();
      if (subStatus() !== subscription.status) data.status = subStatus();
      if (subPeriodStart()) {
        const newStart = new Date(subPeriodStart());
        const oldStart =
          subscription.periodStart ?
            subscription.periodStart instanceof Date ? subscription.periodStart
            : typeof subscription.periodStart === 'string' ? new Date(subscription.periodStart)
            : new Date(subscription.periodStart * 1000)
          : null;
        if (!oldStart || newStart.getTime() !== oldStart.getTime()) {
          data.periodStart = newStart;
        }
      }
      if (subPeriodEnd()) {
        const newEnd = new Date(subPeriodEnd());
        const oldEnd =
          subscription.periodEnd ?
            subscription.periodEnd instanceof Date ? subscription.periodEnd
            : typeof subscription.periodEnd === 'string' ? new Date(subscription.periodEnd)
            : new Date(subscription.periodEnd * 1000)
          : null;
        if (!oldEnd || newEnd.getTime() !== oldEnd.getTime()) {
          data.periodEnd = newEnd;
        }
      }
      if (subCancelAtPeriodEnd() !== subscription.cancelAtPeriodEnd) {
        data.cancelAtPeriodEnd = subCancelAtPeriodEnd();
      }
      if (subCanceledAt() !== subscription.canceledAt) {
        data.canceledAt = subCanceledAt();
      }
      if (subEndedAt() !== subscription.endedAt) {
        data.endedAt = subEndedAt();
      }

      await updateOrgSubscription(orgId(), subscription.id, data);
      showToast.success('Success', 'Subscription updated successfully');
      setSubscriptionDialogOpen(false);
      setEditingSubscription(null);
      resetSubscriptionForm();
      billingQuery.refetch();
    } catch (error) {
      await handleError(error, { toastTitle: 'Error updating subscription' });
    } finally {
      setLoading(false);
    }
  };

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

  const handleCancelSubscription = async subscriptionId => {
    setLoading(true);
    try {
      await cancelOrgSubscription(orgId(), subscriptionId);
      showToast.success('Success', 'Subscription canceled (status=canceled, endedAt=now)');
      setConfirmDialog(null);
      billingQuery.refetch();
    } catch (error) {
      await handleError(error, { toastTitle: 'Error canceling subscription' });
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubscription = subscription => {
    setEditingSubscription(subscription);
    setSubPlan(subscription.plan);
    setSubStatus(subscription.status);
    setSubPeriodStart(formatDateInput(subscription.periodStart));
    setSubPeriodEnd(formatDateInput(subscription.periodEnd));
    setSubCancelAtPeriodEnd(subscription.cancelAtPeriodEnd || false);
    setSubCanceledAt(subscription.canceledAt);
    setSubEndedAt(subscription.endedAt);
    setSubStripeCustomerId(subscription.stripeCustomerId || '');
    setSubStripeSubscriptionId(subscription.stripeSubscriptionId || '');
    setSubscriptionDialogOpen(true);
  };

  const handleCreateGrant = async () => {
    setLoading(true);
    try {
      const data = {
        type: grantType(),
        startsAt: new Date(grantStartsAt()),
        expiresAt: new Date(grantExpiresAt()),
      };

      await createOrgGrant(orgId(), data);
      showToast.success('Success', 'Grant created successfully');
      setGrantDialogOpen(false);
      billingQuery.refetch();
    } catch (error) {
      await handleError(error, { toastTitle: 'Error creating grant' });
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeGrant = async grantId => {
    setLoading(true);
    try {
      await revokeOrgGrant(orgId(), grantId);
      showToast.success('Success', 'Grant revoked');
      setConfirmDialog(null);
      billingQuery.refetch();
    } catch (error) {
      await handleError(error, { toastTitle: 'Error revoking grant' });
    } finally {
      setLoading(false);
    }
  };

  const handleQuickTrial = async () => {
    setLoading(true);
    try {
      await grantOrgTrial(orgId());
      showToast.success('Success', 'Trial granted (14 days)');
      billingQuery.refetch();
    } catch (error) {
      await handleError(error, { toastTitle: 'Error granting trial' });
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSingleProject = async () => {
    setLoading(true);
    try {
      await grantOrgSingleProject(orgId());
      showToast.success('Success', 'Single project grant created/extended (6 months)');
      billingQuery.refetch();
    } catch (error) {
      await handleError(error, { toastTitle: 'Error granting single project access' });
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

  const billingData = () => billing()?.billing;

  return (
    <Show
      when={isAdminChecked()}
      fallback={
        <div class='flex min-h-100 items-center justify-center'>
          <FiLoader class='h-8 w-8 animate-spin text-blue-600' />
        </div>
      }
    >
      <Show
        when={isAdmin()}
        fallback={
          <div class='flex min-h-100 flex-col items-center justify-center text-gray-500'>
            <FiShield class='mb-4 h-12 w-12' />
            <p class='text-lg font-medium'>Access Denied</p>
            <p class='text-sm'>You do not have admin privileges.</p>
          </div>
        }
      >
        {/* Header */}
        <div class='mb-6'>
          <A
            href='/admin/orgs'
            class='mb-4 inline-flex items-center text-sm text-gray-500 hover:text-gray-700'
          >
            <FiArrowLeft class='mr-1 h-4 w-4' />
            Back to Organizations
          </A>
          <div class='flex items-center space-x-3'>
            <div class='flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100'>
              <FiHome class='h-6 w-6 text-blue-600' />
            </div>
            <div>
              <h1 class='text-2xl font-bold text-gray-900'>
                {orgDetails()?.org?.name || 'Organization'}
              </h1>
              <p class='text-sm text-gray-500'>
                <code>{orgDetails()?.org?.slug || ''}</code>
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <Show when={orgDetails()}>
          <div class='mb-6 grid grid-cols-1 gap-4 md:grid-cols-3'>
            <AdminBox padding='sm'>
              <div class='flex items-center space-x-2'>
                <FiUsers class='h-5 w-5 text-gray-400' />
                <div>
                  <p class='text-sm text-gray-500'>Members</p>
                  <p class='text-2xl font-bold text-gray-900'>
                    {orgDetails()?.stats?.memberCount ?? 0}
                  </p>
                </div>
              </div>
            </AdminBox>
            <AdminBox padding='sm'>
              <div class='flex items-center space-x-2'>
                <FiFolder class='h-5 w-5 text-gray-400' />
                <div>
                  <p class='text-sm text-gray-500'>Projects</p>
                  <p class='text-2xl font-bold text-gray-900'>
                    {orgDetails()?.stats?.projectCount ?? 0}
                  </p>
                </div>
              </div>
            </AdminBox>
          </div>
        </Show>

        {/* Billing Summary */}
        <div class='mb-6'>
          <OrgBillingSummary billing={billingData()} />
        </div>

        {/* Quick Actions */}
        <div class='mb-6'>
          <OrgQuickActions
            loading={loading()}
            onGrantTrial={handleQuickTrial}
            onGrantSingleProject={handleQuickSingleProject}
            onCreateSubscription={handleOpenSubscriptionDialog}
            onCreateGrant={handleOpenGrantDialog}
          />
        </div>

        {/* Subscriptions */}
        <div class='mb-6'>
          <SubscriptionList
            subscriptions={billing()?.subscriptions}
            effectiveSubscriptionId={billingData()?.subscription?.id}
            loading={loading()}
            isLoading={billingQuery.isLoading}
            onCancel={subscriptionId =>
              setConfirmDialog({ type: 'cancel-subscription', subscriptionId })
            }
            onEdit={handleEditSubscription}
          />
        </div>

        {/* Grants */}
        <div class='mb-6'>
          <GrantList
            grants={billing()?.grants}
            loading={loading()}
            isLoading={billingQuery.isLoading}
            onRevoke={grantId => setConfirmDialog({ type: 'revoke-grant', grantId })}
          />
        </div>

        {/* Billing Observability / Reconciliation */}
        <div class='mb-6'>
          <OrgBillingReconcilePanel orgId={orgId} />
        </div>

        {/* Create/Edit Subscription Dialog */}
        <SubscriptionDialog
          open={subscriptionDialogOpen()}
          onOpenChange={open => {
            if (!open) {
              setEditingSubscription(null);
              resetSubscriptionForm();
            }
            setSubscriptionDialogOpen(open);
          }}
          loading={loading()}
          isEdit={!!editingSubscription()}
          plan={subPlan()}
          status={subStatus()}
          periodStart={subPeriodStart()}
          periodEnd={subPeriodEnd()}
          cancelAtPeriodEnd={subCancelAtPeriodEnd()}
          canceledAt={subCanceledAt()}
          endedAt={subEndedAt()}
          stripeCustomerId={subStripeCustomerId()}
          stripeSubscriptionId={subStripeSubscriptionId()}
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
            const editing = editingSubscription();
            if (editing) {
              handleUpdateSubscription();
            } else {
              handleCreateSubscription();
            }
          }}
        />

        {/* Create Grant Dialog */}
        <GrantDialog
          open={grantDialogOpen()}
          onOpenChange={setGrantDialogOpen}
          loading={loading()}
          type={grantType()}
          startsAt={grantStartsAt()}
          expiresAt={grantExpiresAt()}
          onTypeChange={setGrantType}
          onStartsAtChange={setGrantStartsAt}
          onExpiresAtChange={setGrantExpiresAt}
          onSubmit={handleCreateGrant}
        />

        {/* Confirm Dialog */}
        <Dialog open={!!confirmDialog()} onOpenChange={open => !open && setConfirmDialog(null)}>
          <DialogBackdrop />
          <DialogPositioner>
            <DialogContent class='max-w-md'>
              <DialogHeader>
                <DialogTitle>
                  {confirmDialog()?.type === 'cancel-subscription' ?
                    'Cancel Subscription'
                  : 'Revoke Grant'}
                </DialogTitle>
                <DialogCloseTrigger>
                  <FiX class='h-5 w-5' />
                </DialogCloseTrigger>
              </DialogHeader>
              <DialogBody>
                <div class='space-y-4'>
                  <p class='text-sm text-gray-600'>
                    {confirmDialog()?.type === 'cancel-subscription' ?
                      'Are you sure you want to cancel this subscription?'
                    : 'Are you sure you want to revoke this grant?'}
                  </p>
                  <div class='flex justify-end space-x-3'>
                    <button
                      onClick={() => setConfirmDialog(null)}
                      class='rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200'
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        const dialog = confirmDialog();
                        if (dialog?.type === 'cancel-subscription') {
                          handleCancelSubscription(dialog.subscriptionId);
                        } else if (dialog?.type === 'revoke-grant') {
                          handleRevokeGrant(dialog.grantId);
                        }
                      }}
                      disabled={loading()}
                      class='rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50'
                    >
                      {loading() ? 'Processing...' : 'Confirm'}
                    </button>
                  </div>
                </div>
              </DialogBody>
            </DialogContent>
          </DialogPositioner>
        </Dialog>
      </Show>
    </Show>
  );
}
