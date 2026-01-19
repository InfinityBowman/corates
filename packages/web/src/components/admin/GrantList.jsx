/**
 * Grant List component
 * Displays and manages grants for an organization
 */

import { Show, For } from 'solid-js';
import { FiLoader, FiTrash2 } from 'solid-icons/fi';

/**
 * Grant List component
 * Displays and manages grants for an organization
 * @param {object} props - Component props
 * @param {Array} props.grants - Array of grant objects
 * @param {boolean} props.loading - Whether an action is in progress
 * @param {boolean} props.isLoading - Whether the list is being loaded
 * @param {function(string): void} props.onRevoke - Function to revoke a grant by ID
 * @returns {JSX.Element} - The GrantList component
 */
export default function GrantList(props) {
  const grants = () => props.grants || [];
  const loading = () => props.loading;
  const isLoading = () => props.isLoading;

  const formatDate = timestamp => {
    if (!timestamp) return '-';
    const date =
      timestamp instanceof Date ? timestamp
      : typeof timestamp === 'string' ? new Date(timestamp)
      : new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div class='border-border bg-card rounded-lg border'>
      <div class='border-border border-b px-6 py-4'>
        <h2 class='text-foreground text-lg font-semibold'>Grants</h2>
      </div>
      <Show
        when={!isLoading()}
        fallback={
          <div class='flex items-center justify-center py-12'>
            <FiLoader class='h-8 w-8 animate-spin text-blue-600' />
          </div>
        }
      >
        <div class='p-6'>
          <Show
            when={grants().length > 0}
            fallback={<p class='text-muted-foreground text-sm'>No grants</p>}
          >
            <div class='space-y-4'>
              <For each={grants()}>
                {grant => (
                  <div class='border-border rounded-lg border p-4'>
                    <div class='flex items-start justify-between'>
                      <div class='flex-1'>
                        <div class='flex items-center space-x-2'>
                          <p class='text-foreground font-medium capitalize'>{grant.type}</p>
                          {grant.revokedAt ?
                            <span class='inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800'>
                              Revoked
                            </span>
                          : <span class='inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800'>
                              Active
                            </span>
                          }
                        </div>
                        <div class='text-muted-foreground mt-2 grid grid-cols-2 gap-4 text-sm'>
                          <div>
                            <p>Starts: {formatDate(grant.startsAt)}</p>
                            <p>Expires: {formatDate(grant.expiresAt)}</p>
                          </div>
                          <div>
                            <p>Created: {formatDate(grant.createdAt)}</p>
                            {grant.revokedAt && <p>Revoked: {formatDate(grant.revokedAt)}</p>}
                          </div>
                        </div>
                      </div>
                      <Show when={!grant.revokedAt}>
                        <div class='ml-4'>
                          <button
                            onClick={() => props.onRevoke?.(grant.id)}
                            disabled={loading()}
                            class='bg-card rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50'
                          >
                            <FiTrash2 class='h-4 w-4' />
                          </button>
                        </div>
                      </Show>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
