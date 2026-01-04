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
    <div class='rounded-lg border border-gray-200 bg-white'>
      <div class='border-b border-gray-200 px-6 py-4'>
        <h2 class='text-lg font-semibold text-gray-900'>Grants</h2>
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
            fallback={<p class='text-sm text-gray-500'>No grants</p>}
          >
            <div class='space-y-4'>
              <For each={grants()}>
                {grant => (
                  <div class='rounded-lg border border-gray-200 p-4'>
                    <div class='flex items-start justify-between'>
                      <div class='flex-1'>
                        <div class='flex items-center space-x-2'>
                          <p class='font-medium text-gray-900 capitalize'>{grant.type}</p>
                          {grant.revokedAt ?
                            <span class='inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800'>
                              Revoked
                            </span>
                          : <span class='inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800'>
                              Active
                            </span>
                          }
                        </div>
                        <div class='mt-2 grid grid-cols-2 gap-4 text-sm text-gray-500'>
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
                            class='rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50'
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
