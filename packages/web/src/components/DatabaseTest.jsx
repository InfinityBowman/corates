import { createSignal, onMount } from 'solid-js';

export default function DatabaseTest({ apiBase }) {
  const [users, setUsers] = createSignal([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  const [newUser, setNewUser] = createSignal({ username: '', email: '', displayName: '' });
  const [creating, setCreating] = createSignal(false);

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${apiBase}/api/db/users`);
      const data = await response.json();
      
      if (response.ok) {
        setUsers(data.users || []);
      } else {
        setError(data.error || 'Failed to load users');
      }
    } catch (err) {
      console.error('Database error:', err);
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const createUser = async () => {
    const user = newUser();
    if (!user.username.trim()) {
      setError('Username is required');
      return;
    }

    setCreating(true);
    setError('');
    
    try {
      const response = await fetch(`${apiBase}/api/db/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: user.username.trim(),
          email: user.email.trim() || null,
          displayName: user.displayName.trim() || user.username.trim()
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setNewUser({ username: '', email: '', displayName: '' });
        await loadUsers(); // Refresh the list
      } else {
        setError(data.error || 'Failed to create user');
      }
    } catch (err) {
      console.error('Create user error:', err);
      setError('Network error occurred');
    } finally {
      setCreating(false);
    }
  };

  const testMigration = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${apiBase}/api/db/migrate`, {
        method: 'POST'
      });
      const data = await response.json();
      
      if (response.ok) {
        setError('Migration completed successfully ✅');
      } else {
        setError(data.error || 'Migration failed');
      }
    } catch (err) {
      console.error('Migration error:', err);
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    loadUsers();
  });

  return (
    <div class="bg-gray-800 rounded-lg p-6">
      <h2 class="text-xl font-bold mb-4 text-blue-400">🗄️ Database Test (D1)</h2>
      
      {/* Controls */}
      <div class="mb-4 flex gap-2">
        <button
          onClick={loadUsers}
          disabled={loading()}
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded"
        >
          {loading() ? 'Loading...' : 'Refresh Users'}
        </button>
        <button
          onClick={testMigration}
          disabled={loading()}
          class="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded"
        >
          Run Migration
        </button>
      </div>

      {/* Create User Form */}
      <div class="mb-6 p-4 bg-gray-700 rounded">
        <h3 class="font-semibold text-green-400 mb-3">Create New User</h3>
        <div class="space-y-2">
          <input
            type="text"
            placeholder="Username (required)"
            value={newUser().username}
            onInput={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))}
            class="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded"
          />
          <input
            type="email"
            placeholder="Email (optional)"
            value={newUser().email}
            onInput={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
            class="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded"
          />
          <input
            type="text"
            placeholder="Display Name (optional)"
            value={newUser().displayName}
            onInput={(e) => setNewUser(prev => ({ ...prev, displayName: e.target.value }))}
            class="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded"
          />
          <button
            onClick={createUser}
            disabled={creating() || !newUser().username.trim()}
            class="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded"
          >
            {creating() ? 'Creating...' : 'Create User'}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error() && (
        <div class={`mb-4 p-3 rounded ${
          error().includes('✅') 
            ? 'bg-green-900 border border-green-700 text-green-300'
            : 'bg-red-900 border border-red-700 text-red-300'
        }`}>
          {error()}
        </div>
      )}

      {/* Users List */}
      <div class="bg-gray-900 rounded p-4">
        <h3 class="font-semibold text-blue-400 mb-3">Users in Database</h3>
        {loading() ? (
          <p class="text-gray-400">Loading...</p>
        ) : users().length === 0 ? (
          <p class="text-gray-400">No users found. Try running the migration first.</p>
        ) : (
          <div class="space-y-2">
            {users().map((user, index) => (
              <div key={index} class="border border-gray-700 rounded p-3">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                  <div>
                    <span class="text-gray-400">Username:</span>
                    <span class="ml-2 text-blue-300 font-medium">{user.username}</span>
                  </div>
                  <div>
                    <span class="text-gray-400">Email:</span>
                    <span class="ml-2 text-white">{user.email || 'N/A'}</span>
                  </div>
                  <div>
                    <span class="text-gray-400">Display:</span>
                    <span class="ml-2 text-white">{user.display_name || 'N/A'}</span>
                  </div>
                </div>
                <div class="mt-2 text-xs text-gray-500">
                  Created: {new Date(user.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div class="mt-4 p-3 bg-blue-900 border border-blue-700 rounded">
        <h3 class="font-semibold text-blue-400 mb-2">ℹ️ How it works</h3>
        <p class="text-sm text-blue-200">
          This demonstrates D1 database operations through your Workers API. 
          The migration creates tables and sample data using SQL commands.
        </p>
      </div>
    </div>
  );
}