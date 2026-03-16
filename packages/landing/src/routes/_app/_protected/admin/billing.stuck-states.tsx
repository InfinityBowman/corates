/**
 * Admin Billing Stuck States route
 * Displays orgs with stuck billing states for monitoring and alerting
 */

import { useState, useMemo } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import {
  LoaderIcon,
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  RefreshCwIcon,
} from 'lucide-react';
import { useAdminBillingStuckStates } from '@/hooks/useAdminQueries';
import { DashboardHeader, AdminBox } from '@/components/admin/ui';
import { input } from '@/components/admin/styles/admin-tokens';

interface StuckOrg {
  type: string;
  orgId: string;
  description?: string;
  ageMinutes?: number;
  subscriptionId?: string;
  stripeSubscriptionId?: string;
  stripeEventId?: string;
  failedCount?: number;
}

const formatDate = (timestamp: string | number | null | undefined): string => {
  if (!timestamp) return '-';
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const getStuckStateTypeLabel = (type: string): string => {
  switch (type) {
    case 'incomplete_subscription':
      return 'Incomplete Subscription';
    case 'checkout_no_subscription':
      return 'Checkout Without Subscription';
    case 'repeated_failures':
      return 'Repeated Failures';
    case 'past_due_expired':
      return 'Past Due Expired';
    default:
      return type;
  }
};

const getStuckStateSeverityIcon = (type: string) => {
  if (type === 'checkout_no_subscription') {
    return AlertTriangleIcon;
  }
  return AlertCircleIcon;
};

const getInvestigationSteps = (type: string): string[] => {
  switch (type) {
    case 'checkout_no_subscription':
      return [
        'Verify Better Auth Stripe plugin configuration',
        'Check authorizeReference function for this org',
        'Verify referenceId/orgId mapping matches',
        'Check Stripe dashboard for subscription creation',
      ];
    case 'incomplete_subscription':
      return [
        'Check Stripe dashboard for payment failures',
        'Verify customer payment method is valid',
        'Check webhook delivery logs for errors',
      ];
    case 'repeated_failures':
      return [
        'Review recent webhook error messages in ledger',
        'Check for API changes or configuration issues',
        'Verify webhook endpoint is accessible',
      ];
    default:
      return ['Review billing state and recent events'];
  }
};

export const Route = (createFileRoute as unknown as Function)(
  '/_app/_protected/admin/billing/stuck-states',
)({
  component: AdminBillingStuckStatesPage,
});

function AdminBillingStuckStatesPage() {
  const [incompleteThreshold, setIncompleteThreshold] = useState(30);

  const stuckStatesQuery = useAdminBillingStuckStates({
    incompleteThreshold,
    limit: 50,
  });

  const data = stuckStatesQuery.data as
    | { stuckOrgs: StuckOrg[]; checkedAt?: string | number }
    | undefined;
  const stuckOrgs = data?.stuckOrgs || [];
  const checkedAt = data?.checkedAt;

  const groupedByType = useMemo(() => {
    const groups: Record<string, StuckOrg[]> = {};
    for (const org of stuckOrgs) {
      const type = org.type;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(org);
    }
    return groups;
  }, [stuckOrgs]);

  return (
    <div>
      <DashboardHeader
        icon={AlertTriangleIcon}
        title="Stuck Billing States"
        description="Organizations with billing issues requiring attention"
        iconColor="orange"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center space-x-2">
              <label className="text-muted-foreground text-sm">Threshold (min):</label>
              <input
                type="number"
                value={incompleteThreshold}
                onChange={(e) => setIncompleteThreshold(parseInt(e.target.value, 10))}
                min="1"
                className={`w-20 ${input.base}`}
              />
            </div>
            <button
              type="button"
              onClick={() => stuckStatesQuery.refetch()}
              className="border-border bg-card text-secondary-foreground hover:bg-muted inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium shadow-xs focus:ring-[3px] focus:ring-blue-100 focus:outline-none"
              disabled={stuckStatesQuery.isFetching}
            >
              {stuckStatesQuery.isFetching ? (
                <LoaderIcon className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <RefreshCwIcon className="h-4 w-4" /> Refresh
                </>
              )}
            </button>
          </div>
        }
      />

      {checkedAt && (
        <p className="text-muted-foreground mb-6 text-sm">
          Last checked: {formatDate(checkedAt)}
        </p>
      )}

      {/* Summary */}
      <AdminBox className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-foreground text-lg font-semibold">
              {stuckOrgs.length} Organization{stuckOrgs.length !== 1 ? 's' : ''} with Stuck States
            </p>
            <p className="text-muted-foreground text-sm">
              Click on an org to view details and run reconciliation
            </p>
          </div>
        </div>
      </AdminBox>

      {/* Stuck Orgs by Type */}
      {stuckStatesQuery.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <LoaderIcon className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : stuckOrgs.length === 0 ? (
        <AdminBox className="p-12 text-center">
          <CheckCircleIcon className="mx-auto mb-4 h-12 w-12 text-green-500" />
          <p className="text-foreground text-lg font-medium">No stuck states found</p>
          <p className="text-muted-foreground text-sm">
            All organizations have healthy billing states
          </p>
        </AdminBox>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByType).map(([type, orgs]) => {
            const Icon = getStuckStateSeverityIcon(type);
            const steps = getInvestigationSteps(type);
            return (
              <AdminBox key={type} padding="compact" className="overflow-hidden p-0">
                <div className="border-border border-b px-6 py-4">
                  <div className="flex items-center space-x-3">
                    <Icon className="h-5 w-5 text-orange-600" />
                    <h2 className="text-foreground text-lg font-semibold">
                      {getStuckStateTypeLabel(type)}
                    </h2>
                    <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800">
                      {orgs.length}
                    </span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {orgs.map((org) => (
                      <div key={org.orgId} className="border-border rounded-lg border p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <Link
                                to={'/admin/orgs/$orgId' as string}
                                params={{ orgId: org.orgId } as Record<string, string>}
                                className="font-medium text-blue-600 hover:text-blue-800"
                              >
                                Org: {org.orgId.slice(0, 8)}...
                              </Link>
                              {org.ageMinutes && (
                                <span className="text-muted-foreground text-sm">
                                  ({org.ageMinutes} minutes)
                                </span>
                              )}
                            </div>
                            {org.description && (
                              <p className="text-muted-foreground mt-2 text-sm">
                                {org.description}
                              </p>
                            )}
                            {org.subscriptionId && (
                              <p className="text-muted-foreground mt-1 text-xs">
                                Subscription: {org.subscriptionId}
                              </p>
                            )}
                            {org.stripeSubscriptionId && (
                              <p className="text-muted-foreground mt-1 text-xs">
                                Stripe: {org.stripeSubscriptionId}
                              </p>
                            )}
                            {org.stripeEventId && (
                              <p className="text-muted-foreground mt-1 text-xs">
                                Event: {org.stripeEventId}
                              </p>
                            )}
                            {org.failedCount && (
                              <p className="mt-1 text-xs text-red-600">
                                {org.failedCount} webhook failures
                              </p>
                            )}
                          </div>
                          <Link
                            to={'/admin/orgs/$orgId' as string}
                            params={{ orgId: org.orgId } as Record<string, string>}
                            className="border-border bg-card text-secondary-foreground hover:bg-muted ml-4 rounded-md border px-4 py-2 text-sm font-medium"
                          >
                            View Details
                          </Link>
                        </div>
                        <div className="bg-muted mt-4 rounded p-3">
                          <p className="text-secondary-foreground mb-2 text-xs font-medium">
                            Investigation Steps:
                          </p>
                          <ul className="text-muted-foreground list-inside list-disc space-y-1 text-xs">
                            {steps.map((step) => (
                              <li key={step}>{step}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </AdminBox>
            );
          })}
        </div>
      )}
    </div>
  );
}
