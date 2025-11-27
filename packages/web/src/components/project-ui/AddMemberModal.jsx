import { createSignal, For, Show, createEffect, onCleanup } from 'solid-js';

const API_BASE = import.meta.env.VITE_WORKER_API_URL || 'http://localhost:8787';

/**
 * Modal for searching and adding members to a project
 */
export default function AddMemberModal(props) {
  const [searchQuery, setSearchQuery] = createSignal('');
  const [searchResults, setSearchResults] = createSignal([]);
  const [searching, setSearching] = createSignal(false);
  const [selectedUser, setSelectedUser] = createSignal(null);
  const [selectedRole, setSelectedRole] = createSignal('member');
  const [adding, setAdding] = createSignal(false);
  const [error, setError] = createSignal(null);

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

      const response = await fetch(url, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const results = await response.json();
      setSearchResults(results);
    } catch (err) {
      console.error('Error searching users:', err);
      setError('Failed to search users');
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
    if (!user) return;

    setAdding(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/projects/${props.projectId}/members`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          role: selectedRole(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add member');
      }

      handleClose();
    } catch (err) {
      console.error('Error adding member:', err);
      setError(err.message);
    } finally {
      setAdding(false);
    }
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
        class='fixed inset-0 bg-black/50 flex items-center justify-center z-50'
        onClick={e => {
          if (e.target === e.currentTarget) handleClose();
        }}
        onKeyDown={handleKeyDown}
      >
        <div class='bg-white rounded-lg shadow-xl w-full max-w-md mx-4'>
          {/* Header */}
          <div class='flex items-center justify-between p-4 border-b border-gray-200'>
            <h2 class='text-lg font-semibold text-gray-900'>Add Member</h2>
            <button
              onClick={handleClose}
              class='text-gray-400 hover:text-gray-600 transition-colors'
            >
              <svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  stroke-linecap='round'
                  stroke-linejoin='round'
                  stroke-width='2'
                  d='M6 18L18 6M6 6l12 12'
                />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div class='p-4 space-y-4'>
            {/* Search Input */}
            <div class='relative'>
              <label class='block text-sm font-medium text-gray-700 mb-1'>
                Search by name or email
              </label>
              <input
                ref={inputRef}
                type='text'
                value={searchQuery()}
                onInput={e => handleSearchInput(e.target.value)}
                placeholder='Type at least 2 characters...'
                class='w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              />

              {/* Search Results Dropdown */}
              <Show when={searchResults().length > 0 && !selectedUser()}>
                <div class='absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto'>
                  <For each={searchResults()}>
                    {user => (
                      <button
                        type='button'
                        onClick={() => handleSelectUser(user)}
                        class='w-full px-4 py-3 text-left hover:bg-blue-50 flex items-center gap-3 transition-colors'
                      >
                        <div class='w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0'>
                          {(user.displayName || user.name || user.email || '?')
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                        <div class='min-w-0'>
                          <p class='text-gray-900 font-medium truncate'>
                            {user.displayName || user.name || 'Unknown'}
                          </p>
                          <p class='text-gray-500 text-sm truncate'>{user.email}</p>
                        </div>
                      </button>
                    )}
                  </For>
                </div>
              </Show>

              {/* Searching indicator */}
              <Show when={searching()}>
                <div class='absolute right-3 top-8'>
                  <div class='animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full' />
                </div>
              </Show>
            </div>

            {/* No results message */}
            <Show
              when={
                searchQuery().length >= 2 &&
                !searching() &&
                searchResults().length === 0 &&
                !selectedUser()
              }
            >
              <p class='text-gray-500 text-sm'>No users found matching "{searchQuery()}"</p>
            </Show>

            {/* Selected User Display */}
            <Show when={selectedUser()}>
              <div class='bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between'>
                <div class='flex items-center gap-3'>
                  <div class='w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium'>
                    {(
                      selectedUser().displayName ||
                      selectedUser().name ||
                      selectedUser().email ||
                      '?'
                    )
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                  <div>
                    <p class='text-gray-900 font-medium'>
                      {selectedUser().displayName || selectedUser().name || 'Unknown'}
                    </p>
                    <p class='text-gray-500 text-sm'>{selectedUser().email}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedUser(null);
                    setSearchQuery('');
                  }}
                  class='text-gray-400 hover:text-gray-600'
                >
                  <svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path
                      stroke-linecap='round'
                      stroke-linejoin='round'
                      stroke-width='2'
                      d='M6 18L18 6M6 6l12 12'
                    />
                  </svg>
                </button>
              </div>
            </Show>

            {/* Role Selection */}
            <Show when={selectedUser()}>
              <div>
                <label class='block text-sm font-medium text-gray-700 mb-1'>Role</label>
                <select
                  value={selectedRole()}
                  onChange={e => setSelectedRole(e.target.value)}
                  class='w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                >
                  <option value='viewer'>Viewer - Can view only</option>
                  <option value='member'>Member - Can edit checklists</option>
                  <option value='collaborator'>Collaborator - Can edit project</option>
                  <option value='owner'>Owner - Full access</option>
                </select>
              </div>
            </Show>

            {/* Error Message */}
            <Show when={error()}>
              <div class='bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm'>
                {error()}
              </div>
            </Show>
          </div>

          {/* Footer */}
          <div class='flex justify-end gap-3 p-4 border-t border-gray-200'>
            <button
              onClick={handleClose}
              class='px-4 py-2 text-gray-700 font-medium rounded-lg border border-gray-300 hover:border-gray-400 transition-colors'
            >
              Cancel
            </button>
            <button
              onClick={handleAddMember}
              disabled={!selectedUser() || adding()}
              class='px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors'
            >
              {adding() ? 'Adding...' : 'Add Member'}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
