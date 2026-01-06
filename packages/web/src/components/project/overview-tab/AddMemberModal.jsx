import { createSignal, For, Show, createEffect, onCleanup } from 'solid-js';
import { A } from '@solidjs/router';
import { API_BASE } from '@config/api.js';
import { FiX, FiAlertTriangle } from 'solid-icons/fi';
import { Select, Avatar, showToast } from '@corates/ui';
import { handleFetchError } from '@/lib/error-utils.js';
import { isUnlimitedQuota } from '@corates/shared/plans';

/**
 * Modal for searching and adding members to a project
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {string} props.projectId
 * @param {string} props.orgId
 * @param {Object} [props.quotaInfo] - Collaborator quota info { used: number, max: number }
 * @returns {JSX.Element}
 */
export default function AddMemberModal(props) {
  const [searchQuery, setSearchQuery] = createSignal('');
  const [searchResults, setSearchResults] = createSignal([]);
  const [searching, setSearching] = createSignal(false);
  const [selectedUser, setSelectedUser] = createSignal(null);
  const [selectedRole, setSelectedRole] = createSignal('member');
  const [adding, setAdding] = createSignal(false);
  const [error, setError] = createSignal(null);

  // Check if at collaborator quota limit
  const isAtQuotaLimit = () => {
    if (!props.quotaInfo) return false;
    if (isUnlimitedQuota(props.quotaInfo.max)) return false;
    return props.quotaInfo.used >= props.quotaInfo.max;
  };

  let searchTimeout = null;
  let inputRef;

  // Focus input when modal opens
  createEffect(() => {
    if (props.isOpen && inputRef) {
      inputRef.focus();
    }
  });

  // Cleanup timeout on unmount
  onCleanup(() => {
    if (searchTimeout) clearTimeout(searchTimeout);
  });

  // Debounced search
  const handleSearchInput = value => {
    setSearchQuery(value);
    setError(null);

    if (searchTimeout) clearTimeout(searchTimeout);

    if (value.length < 2) {
      setSearchResults([]);
      return;
    }

    searchTimeout = setTimeout(() => {
      searchUsers(value);
    }, 300);
  };

  const searchUsers = async query => {
    setSearching(true);
    try {
      const url = new URL(`${API_BASE}/api/users/search`);
      url.searchParams.set('q', query);
      url.searchParams.set('projectId', props.projectId);

      const response = await handleFetchError(
        fetch(url, {
          credentials: 'include',
        }),
        {
          setError,
          showToast: false,
        },
      );

      const results = await response.json();
      setSearchResults(results);
    } catch (_err) {
      // Error already handled by handleFetchError
    } finally {
      setSearching(false);
    }
  };

  const handleSelectUser = user => {
    setSelectedUser(user);
    setSearchQuery(user.displayName || user.name || user.email);
    setSearchResults([]);
  };

  const handleAddMember = async () => {
    const user = selectedUser();
    if (!user && !isValidEmail(searchQuery())) return;
    if (!props.orgId) {
      setError('No organization context');
      return;
    }

    setAdding(true);
    setError(null);

    try {
      const response = await handleFetchError(
        fetch(`${API_BASE}/api/orgs/${props.orgId}/projects/${props.projectId}/members`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(
            user ?
              {
                userId: user.id,
                role: selectedRole(),
              }
            : {
                email: searchQuery().trim(),
                role: selectedRole(),
              },
          ),
        }),
        {
          setError,
          showToast: false,
        },
      );

      const result = await response.json();

      // Check if invitation was sent
      if (result.invitation) {
        showToast.success('Invitation Sent', `Invitation sent to ${result.email || searchQuery()}`);
        handleClose();
      } else {
        // User was added directly
        handleClose();
      }
    } catch (_err) {
      // Error already handled by handleFetchError
    } finally {
      setAdding(false);
    }
  };

  // Helper to check if string looks like an email
  const isValidEmail = str => {
    if (!str || str.length < 3) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str.trim());
  };

  // Check if we can add by email (no user selected, but query looks like email)
  const canAddByEmail = () => {
    const query = searchQuery().trim();
    return !selectedUser() && isValidEmail(query) && query.length >= 3;
  };

  const handleClose = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedUser(null);
    setSelectedRole('member');
    setError(null);
    props.onClose();
  };

  // Close on escape key
  const handleKeyDown = e => {
    if (e.key === 'Escape') {
      handleClose();
    }
  };

  return (
    <Show when={props.isOpen}>
      <div
        class='fixed inset-0 z-50 flex items-center justify-center bg-black/50'
        onClick={e => {
          if (e.target === e.currentTarget) handleClose();
        }}
        onKeyDown={handleKeyDown}
      >
        <div class='mx-4 w-full max-w-md rounded-lg bg-white shadow-xl'>
          {/* Header */}
          <div class='flex items-center justify-between border-b border-gray-200 p-4'>
            <h2 class='text-lg font-semibold text-gray-900'>Add Member</h2>
            <button
              onClick={handleClose}
              class='text-gray-400 transition-colors hover:text-gray-600'
            >
              <FiX class='h-5 w-5' />
            </button>
          </div>

          {/* Content */}
          <div class='space-y-4 p-4'>
            {/* Quota Warning Banner */}
            <Show when={isAtQuotaLimit()}>
              <div class='flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3'>
                <FiAlertTriangle class='mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600' />
                <div class='text-sm'>
                  <p class='font-medium text-amber-800'>Collaborator limit reached</p>
                  <p class='mt-1 text-amber-700'>
                    Your team has {props.quotaInfo?.used} of {props.quotaInfo?.max} collaborators.{' '}
                    <A href='/settings/billing/plans' class='font-medium underline'>
                      Upgrade your plan
                    </A>{' '}
                    to add more team members.
                  </p>
                </div>
              </div>
            </Show>

            {/* Search Input */}
            <div class='relative'>
              <label class='mb-1 block text-sm font-medium text-gray-700'>
                Search by name or email
              </label>
              <input
                ref={inputRef}
                type='text'
                autocomplete='off'
                value={searchQuery()}
                onInput={e => handleSearchInput(e.target.value)}
                placeholder='Type at least 2 characters...'
                class='w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none'
                disabled={isAtQuotaLimit()}
              />

              {/* Search Results Dropdown */}
              <Show when={searchResults().length > 0 && !selectedUser()}>
                <div class='absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg'>
                  <For each={searchResults()}>
                    {user => (
                      <button
                        type='button'
                        onClick={() => handleSelectUser(user)}
                        class='flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-blue-50'
                      >
                        <Avatar
                          src={user.image}
                          name={user.displayName || user.name || user.email}
                          class='h-8 w-8 shrink-0 rounded-full'
                          fallbackClass='flex items-center justify-center w-full h-full bg-blue-600 text-white text-sm font-medium'
                        />
                        <div class='min-w-0'>
                          <p class='truncate font-medium text-gray-900'>
                            {user.displayName || user.name || 'Unknown'}
                          </p>
                          <p class='truncate text-sm text-gray-500'>{user.email}</p>
                        </div>
                      </button>
                    )}
                  </For>
                </div>
              </Show>

              {/* Searching indicator */}
              <Show when={searching()}>
                <div class='absolute top-8 right-3'>
                  <div class='h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent' />
                </div>
              </Show>
            </div>

            {/* No results message */}
            <Show
              when={
                searchQuery().length >= 2 &&
                !searching() &&
                searchResults().length === 0 &&
                !selectedUser() &&
                !canAddByEmail()
              }
            >
              <p class='text-sm text-gray-500'>No users found matching "{searchQuery()}"</p>
            </Show>

            {/* Email invitation prompt */}
            <Show when={canAddByEmail()}>
              <div class='rounded-lg border border-blue-200 bg-blue-50 p-3'>
                <p class='text-sm text-gray-700'>
                  No user found with this email. You can send an invitation to{' '}
                  <span class='font-medium'>{searchQuery().trim()}</span> to join the project.
                </p>
              </div>
            </Show>

            {/* Selected User Display */}
            <Show when={selectedUser()}>
              <div class='flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-3'>
                <div class='flex items-center gap-3'>
                  <Avatar
                    src={selectedUser().image}
                    name={selectedUser().displayName || selectedUser().name || selectedUser().email}
                    class='h-10 w-10 rounded-full'
                    fallbackClass='flex items-center justify-center w-full h-full bg-blue-600 text-white font-medium'
                  />
                  <div>
                    <p class='font-medium text-gray-900'>
                      {selectedUser().displayName || selectedUser().name || 'Unknown'}
                    </p>
                    <p class='text-sm text-gray-500'>{selectedUser().email}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedUser(null);
                    setSearchQuery('');
                  }}
                  class='text-gray-400 hover:text-gray-600'
                >
                  <FiX class='h-5 w-5' />
                </button>
              </div>
            </Show>

            {/* Role Selection */}
            <Show when={selectedUser() || canAddByEmail()}>
              <Select
                label='Role'
                items={[
                  { label: 'Member - Can edit project content', value: 'member' },
                  { label: 'Owner - Full access and member management', value: 'owner' },
                ]}
                value={selectedRole()}
                onChange={setSelectedRole}
                placeholder='Select a role'
                inDialog={true}
              />
            </Show>

            {/* Error Message */}
            <Show when={error()}>
              <div class='rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700'>
                {error()}
              </div>
            </Show>
          </div>

          {/* Footer */}
          <div class='flex justify-end gap-3 border-t border-gray-200 p-4'>
            <button
              onClick={handleClose}
              class='rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 transition-colors hover:border-gray-400'
            >
              Cancel
            </button>
            <button
              onClick={handleAddMember}
              disabled={(!selectedUser() && !canAddByEmail()) || adding() || isAtQuotaLimit()}
              class='rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50'
            >
              {adding() ?
                canAddByEmail() ?
                  'Sending Invitation...'
                : 'Adding...'
              : canAddByEmail() ?
                'Send Invitation'
              : 'Add Member'}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
