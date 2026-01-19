import { createSignal, For, Show, createEffect, onCleanup } from 'solid-js';
import { debounce } from '@solid-primitives/scheduled';
import { A } from '@solidjs/router';
import { FiX, FiAlertTriangle } from 'solid-icons/fi';
import { showToast } from '@/components/ui/toast';
import { SimpleSelect } from '@/components/ui/select';
import { Avatar, AvatarImage, AvatarFallback, getInitials } from '@/components/ui/avatar';
import { apiFetch } from '@lib/apiFetch.js';
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
  const [selectedUser, setSimpleSelectedUser] = createSignal(null);
  const [selectedRole, setSimpleSelectedRole] = createSignal('member');
  const [adding, setAdding] = createSignal(false);
  const [error, setError] = createSignal(null);

  // Check if at collaborator quota limit
  const isAtQuotaLimit = () => {
    if (!props.quotaInfo) return false;
    if (isUnlimitedQuota(props.quotaInfo.max)) return false;
    return props.quotaInfo.used >= props.quotaInfo.max;
  };

  let inputRef;

  // Focus input when modal opens
  createEffect(() => {
    if (props.isOpen && inputRef) {
      inputRef.focus();
    }
  });

  const searchUsers = async query => {
    setSearching(true);
    try {
      const results = await apiFetch.get(
        `/api/users/search?q=${encodeURIComponent(query)}&projectId=${encodeURIComponent(props.projectId)}`,
        { toastMessage: false },
      );
      setSearchResults(results);
    } catch (err) {
      setError(err.message || 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  // Debounced search function
  // eslint-disable-next-line solid/reactivity -- searchUsers is used via debounce in event handler
  const debouncedSearchUsers = debounce(searchUsers, 300);

  // Cleanup debounced function on unmount
  onCleanup(() => {
    debouncedSearchUsers.clear();
  });

  // Handle search input
  const handleSearchInput = value => {
    setSearchQuery(value);
    setError(null);

    if (value.length < 2) {
      setSearchResults([]);
      debouncedSearchUsers.clear();
      return;
    }

    debouncedSearchUsers(value);
  };

  const handleSimpleSelectUser = user => {
    setSimpleSelectedUser(user);
    setSearchQuery(user.name || user.email);
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
      const result = await apiFetch.post(
        `/api/orgs/${props.orgId}/projects/${props.projectId}/members`,
        user ?
          {
            userId: user.id,
            role: selectedRole(),
          }
        : {
            email: searchQuery().trim(),
            role: selectedRole(),
          },
        { toastMessage: false },
      );

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
    setSimpleSelectedUser(null);
    setSimpleSelectedRole('member');
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
        <div class='bg-card mx-4 w-full max-w-md rounded-lg shadow-xl'>
          {/* Header */}
          <div class='border-border flex items-center justify-between border-b p-4'>
            <h2 class='text-foreground text-lg font-semibold'>Add Member</h2>
            <button
              onClick={handleClose}
              class='text-muted-foreground/70 hover:text-secondary-foreground transition-colors'
            >
              <FiX class='h-5 w-5' />
            </button>
          </div>

          {/* Content */}
          <div class='space-y-4 p-4'>
            {/* Quota Warning Banner */}
            <Show when={isAtQuotaLimit()}>
              <div class='flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3'>
                <FiAlertTriangle class='mt-0.5 h-5 w-5 shrink-0 text-amber-600' />
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
              <label class='text-secondary-foreground mb-1 block text-sm font-medium'>
                Search by name or email
              </label>
              <input
                ref={inputRef}
                type='text'
                autocomplete='off'
                value={searchQuery()}
                onInput={e => handleSearchInput(e.target.value)}
                placeholder='Type at least 2 characters...'
                class='border-border text-foreground placeholder-muted-foreground/70 focus:ring-primary w-full rounded-lg border px-3 py-2 focus:border-transparent focus:ring-2 focus:outline-none'
                disabled={isAtQuotaLimit()}
              />

              {/* Search Results Dropdown */}
              <Show when={searchResults().length > 0 && !selectedUser()}>
                <div class='border-border bg-card absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border shadow-lg'>
                  <For each={searchResults()}>
                    {user => (
                      <button
                        type='button'
                        onClick={() => handleSimpleSelectUser(user)}
                        class='flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-blue-50'
                      >
                        <Avatar class='h-8 w-8 shrink-0'>
                          <AvatarImage src={user.image} alt={user.name || user.email} />
                          <AvatarFallback class='bg-primary text-sm text-white'>
                            {getInitials(user.name || user.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div class='min-w-0'>
                          <p class='text-foreground truncate font-medium'>
                            {user.name || 'Unknown'}
                          </p>
                          <p class='text-muted-foreground truncate text-sm'>{user.email}</p>
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
              <p class='text-muted-foreground text-sm'>No users found matching "{searchQuery()}"</p>
            </Show>

            {/* Email invitation prompt */}
            <Show when={canAddByEmail()}>
              <div class='rounded-lg border border-blue-200 bg-blue-50 p-3'>
                <p class='text-secondary-foreground text-sm'>
                  No user found with this email. You can send an invitation to{' '}
                  <span class='font-medium'>{searchQuery().trim()}</span> to join the project.
                </p>
              </div>
            </Show>

            {/* SimpleSelected User Display */}
            <Show when={selectedUser()}>
              <div class='flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-3'>
                <div class='flex items-center gap-3'>
                  <Avatar class='h-10 w-10'>
                    <AvatarImage
                      src={selectedUser().image}
                      alt={selectedUser().name || selectedUser().email}
                    />
                    <AvatarFallback class='bg-primary text-white'>
                      {getInitials(selectedUser().name || selectedUser().email)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p class='text-foreground font-medium'>{selectedUser().name || 'Unknown'}</p>
                    <p class='text-muted-foreground text-sm'>{selectedUser().email}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSimpleSelectedUser(null);
                    setSearchQuery('');
                  }}
                  class='text-muted-foreground/70 hover:text-secondary-foreground'
                >
                  <FiX class='h-5 w-5' />
                </button>
              </div>
            </Show>

            {/* Role SimpleSelection */}
            <Show when={selectedUser() || canAddByEmail()}>
              <SimpleSelect
                label='Role'
                items={[
                  { label: 'Member - Can edit project content', value: 'member' },
                  { label: 'Owner - Full access and member management', value: 'owner' },
                ]}
                value={selectedRole()}
                onChange={setSimpleSelectedRole}
                placeholder='SimpleSelect a role'
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
          <div class='border-border flex justify-end gap-3 border-t p-4'>
            <button
              onClick={handleClose}
              class='border-border text-secondary-foreground hover:border-border-strong rounded-lg border px-4 py-2 font-medium transition-colors'
            >
              Cancel
            </button>
            <button
              onClick={handleAddMember}
              disabled={(!selectedUser() && !canAddByEmail()) || adding() || isAtQuotaLimit()}
              class='bg-primary hover:bg-primary/90 focus:ring-primary rounded-lg px-4 py-2 font-medium text-white transition-colors focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50'
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
