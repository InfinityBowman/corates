/**
 * User Table component for admin dashboard
 */

import { createSignal, Show, For } from 'solid-js';
import { A } from '@solidjs/router';
import {
  FiMoreVertical,
  FiUserX,
  FiUserCheck,
  FiTrash2,
  FiLogIn,
  FiXCircle,
  FiCheckCircle,
  FiClock,
  FiMail,
} from 'solid-icons/fi';
import {
  banUser,
  unbanUser,
  impersonateUser,
  revokeUserSessions,
  deleteUser,
} from '@/stores/adminStore.js';
import { Avatar, Dialog, Tooltip } from '@corates/ui';

// Provider display info
const PROVIDER_INFO = {
  google: { name: 'Google', icon: '/logos/google.svg' },
  orcid: { name: 'ORCID', icon: '/logos/orcid.svg' },
  credential: { name: 'Email/Password', icon: null },
};

/**
 * User Table component for admin dashboard
 * Lists all users with search and pagination
 * @param {object} props - Component props
 * @param {Array<object>} props.users - Array of user objects
 * @param {function(): void} props.onRefresh - Function to refresh the user list
 * @returns {JSX.Element} - The UserTable component
 */
export default function UserTable(props) {
  const users = () => props.users || [];
  const [actionMenuOpen, setActionMenuOpen] = createSignal(null);
  const [menuPosition, setMenuPosition] = createSignal({ top: 0, right: 0 });
  const [confirmDialog, setConfirmDialog] = createSignal(null);
  const [banDialog, setBanDialog] = createSignal(null);
  const [banReason, setBanReason] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal(null);

  const formatDate = timestamp => {
    if (!timestamp) return '-';
    // Handle both ISO strings and unix timestamps
    const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };
  const handleAction = async (action, user) => {
    setActionMenuOpen(null);
    setError(null);

    if (action === 'ban') {
      setBanDialog(user);
      return;
    }

    if (action === 'delete') {
      setConfirmDialog({ type: 'delete', user });
      return;
    }

    if (action === 'revoke') {
      setConfirmDialog({ type: 'revoke', user });
      return;
    }

    setLoading(true);
    try {
      if (action === 'unban') {
        await unbanUser(user.id);
      } else if (action === 'impersonate') {
        await impersonateUser(user.id);
        return; // Page will redirect
      }
      props.onRefresh?.();
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils.js');
      await handleError(err, {
        setError,
        showToast: false,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBan = async () => {
    const user = banDialog();
    if (!user) return;

    setLoading(true);
    try {
      await banUser(user.id, banReason() || 'Banned by administrator');
      setBanDialog(null);
      setBanReason('');
      props.onRefresh?.();
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils.js');
      await handleError(err, {
        setError,
        showToast: false,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    const dialog = confirmDialog();
    if (!dialog) return;

    setLoading(true);
    try {
      if (dialog.type === 'delete') {
        await deleteUser(dialog.user.id);
      } else if (dialog.type === 'revoke') {
        await revokeUserSessions(dialog.user.id);
      }
      setConfirmDialog(null);
      props.onRefresh?.();
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils.js');
      await handleError(err, {
        setError,
        showToast: false,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Error Toast */}
      <Show when={error()}>
        <div class='mx-6 mt-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700'>
          <span>{error()}</span>
          <button
            onClick={() => setError(null)}
            class='text-red-600 hover:text-red-700 focus:ring-2 focus:ring-blue-500 focus:outline-none'
          >
            <FiXCircle class='h-4 w-4' />
          </button>
        </div>
      </Show>

      <div class='overflow-x-auto'>
        <table class='w-full'>
          <thead>
            <tr class='border-b border-gray-200 bg-gray-50'>
              <th class='px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase'>
                User
              </th>
              <th class='px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase'>
                Email
              </th>
              <th class='px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase'>
                Providers
              </th>
              <th class='px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase'>
                Status
              </th>
              <th class='px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase'>
                Stripe Customer
              </th>
              <th class='px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase'>
                Joined
              </th>
              <th class='px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase'>
                Actions
              </th>
            </tr>
          </thead>
          <tbody class='divide-y divide-gray-200'>
            <For
              each={users()}
              fallback={
                <tr>
                  <td colspan='7' class='px-6 py-12 text-center text-gray-500'>
                    No users found
                  </td>
                </tr>
              }
            >
              {user => (
                <tr class='hover:bg-gray-50'>
                  <td class='px-6 py-4'>
                    <div class='flex items-center space-x-3'>
                      <Avatar
                        src={user.avatarUrl || user.image}
                        name={user.displayName || user.name}
                        class='h-8 w-8'
                      />
                      <div>
                        <A
                          href={`/admin/users/${user.id}`}
                          class='font-medium text-blue-600 hover:text-blue-700 hover:underline'
                        >
                          {user.displayName || user.name || 'Unknown'}
                        </A>
                        <Show when={user.username}>
                          <p class='text-sm text-gray-500'>@{user.username}</p>
                        </Show>
                      </div>
                    </div>
                  </td>
                  <td class='px-6 py-4'>
                    <div class='flex items-center space-x-2'>
                      <span class='text-sm text-gray-600'>{user.email}</span>
                      <Show when={user.emailVerified}>
                        <FiCheckCircle class='h-4 w-4 text-green-500' title='Email verified' />
                      </Show>
                    </div>
                  </td>
                  <td class='px-6 py-4'>
                    <div class='flex items-center gap-1.5'>
                      <For each={user.providers || []}>
                        {provider => {
                          const info = PROVIDER_INFO[provider];
                          return (
                            <Tooltip content={info?.name || provider}>
                              <div class='flex h-5 w-5 items-center justify-center'>
                                <Show
                                  when={info?.icon}
                                  fallback={<FiMail class='h-4 w-4 text-gray-500' />}
                                >
                                  <img
                                    src={info?.icon}
                                    alt={info?.name || provider}
                                    title={info?.name || provider}
                                    class='h-4 w-4'
                                  />
                                </Show>
                              </div>
                            </Tooltip>
                          );
                        }}
                      </For>
                      <Show when={!user.providers || user.providers.length === 0}>
                        <span class='text-xs text-gray-400'>None</span>
                      </Show>
                    </div>
                  </td>
                  <td class='px-6 py-4'>
                    <Show
                      when={user.banned}
                      fallback={
                        <span class='inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800'>
                          Active
                        </span>
                      }
                    >
                      <span class='inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800'>
                        Banned
                      </span>
                    </Show>
                  </td>
                  <td class='px-6 py-4'>
                    <Show
                      when={user.stripeCustomerId}
                      fallback={<span class='text-sm text-gray-400'>-</span>}
                    >
                      <code class='rounded bg-gray-100 px-2 py-1 text-xs text-gray-700'>
                        {user.stripeCustomerId}
                      </code>
                    </Show>
                  </td>
                  <td class='px-6 py-4 text-sm text-gray-500'>{formatDate(user.createdAt)}</td>
                  <td class='px-6 py-4 text-right'>
                    <div class='relative'>
                      <button
                        onClick={e => {
                          if (actionMenuOpen() === user.id) {
                            setActionMenuOpen(null);
                          } else {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setMenuPosition({
                              top: rect.bottom + window.scrollY,
                              right: window.innerWidth - rect.right,
                            });
                            setActionMenuOpen(user.id);
                          }
                        }}
                        class='rounded-lg p-2 hover:bg-gray-100'
                      >
                        <FiMoreVertical class='h-4 w-4 text-gray-500' />
                      </button>

                      {/* Action Menu */}
                      <Show when={actionMenuOpen() === user.id}>
                        <div
                          class='fixed z-50 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg'
                          style={{
                            top: `${menuPosition().top}px`,
                            right: `${menuPosition().right}px`,
                          }}
                        >
                          <button
                            onClick={() => handleAction('impersonate', user)}
                            class='flex w-full items-center space-x-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100'
                          >
                            <FiLogIn class='h-4 w-4' />
                            <span>Impersonate</span>
                          </button>
                          <Show
                            when={user.banned}
                            fallback={
                              <button
                                onClick={() => handleAction('ban', user)}
                                class='flex w-full items-center space-x-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100'
                              >
                                <FiUserX class='h-4 w-4' />
                                <span>Ban User</span>
                              </button>
                            }
                          >
                            <button
                              onClick={() => handleAction('unban', user)}
                              class='flex w-full items-center space-x-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100'
                            >
                              <FiUserCheck class='h-4 w-4' />
                              <span>Unban User</span>
                            </button>
                          </Show>
                          <button
                            onClick={() => handleAction('revoke', user)}
                            class='flex w-full items-center space-x-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100'
                          >
                            <FiClock class='h-4 w-4' />
                            <span>Revoke Sessions</span>
                          </button>
                          <hr class='my-1 border-gray-200' />
                          <button
                            onClick={() => handleAction('delete', user)}
                            class='flex w-full items-center space-x-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50'
                          >
                            <FiTrash2 class='h-4 w-4' />
                            <span>Delete User</span>
                          </button>
                        </div>
                      </Show>
                    </div>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>

      {/* Ban Dialog */}
      <Dialog
        open={!!banDialog()}
        onOpenChange={open => !open && setBanDialog(null)}
        title='Ban User'
      >
        <div class='space-y-4'>
          <p class='text-sm text-gray-600'>
            Are you sure you want to ban{' '}
            <strong>{banDialog()?.displayName || banDialog()?.name || banDialog()?.email}</strong>?
            They will be logged out and unable to sign in.
          </p>
          <div>
            <label class='mb-1 block text-sm font-medium text-gray-700'>Reason (optional)</label>
            <textarea
              value={banReason()}
              onInput={e => setBanReason(e.target.value)}
              placeholder='Enter reason for ban...'
              class='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none'
              rows={3}
            />
          </div>
          <div class='flex justify-end space-x-3'>
            <button
              onClick={() => setBanDialog(null)}
              class='rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200'
            >
              Cancel
            </button>
            <button
              onClick={handleBan}
              disabled={loading()}
              class='rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50'
            >
              {loading() ? 'Banning...' : 'Ban User'}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Confirm Dialog */}
      <Dialog
        open={!!confirmDialog()}
        onOpenChange={open => !open && setConfirmDialog(null)}
        title={confirmDialog()?.type === 'delete' ? 'Delete User' : 'Revoke Sessions'}
        role='alertdialog'
      >
        <div class='space-y-4'>
          <Show when={confirmDialog()?.type === 'delete'}>
            <p class='text-sm text-gray-600'>
              Are you sure you want to permanently delete{' '}
              <strong>
                {confirmDialog()?.user?.displayName ||
                  confirmDialog()?.user?.name ||
                  confirmDialog()?.user?.email}
              </strong>
              ? This action cannot be undone.
            </p>
          </Show>
          <Show when={confirmDialog()?.type === 'revoke'}>
            <p class='text-sm text-gray-600'>
              This will log out{' '}
              <strong>
                {confirmDialog()?.user?.displayName ||
                  confirmDialog()?.user?.name ||
                  confirmDialog()?.user?.email}
              </strong>{' '}
              from all devices.
            </p>
          </Show>
          <div class='flex justify-end space-x-3'>
            <button
              onClick={() => setConfirmDialog(null)}
              class='rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200'
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading()}
              class={`rounded-lg px-4 py-2 text-sm font-medium text-white focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50 ${
                confirmDialog()?.type === 'delete' ?
                  'bg-red-600 hover:bg-red-700'
                : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading() ?
                'Processing...'
              : confirmDialog()?.type === 'delete' ?
                'Delete'
              : 'Revoke'}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Click outside to close action menu */}
      <Show when={actionMenuOpen()}>
        <div class='fixed inset-0 z-0' onClick={() => setActionMenuOpen(null)} />
      </Show>
    </>
  );
}
