import { createSignal, onMount } from 'solid-js';

export default function SessionManager({ apiBase }) {
  const [sessionId, setSessionId] = createSignal('');
  const [sessionData, setSessionData] = createSignal(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  const [newData, setNewData] = createSignal('');
  const [updating, setUpdating] = createSignal(false);

  // Generate a random session ID
  const generateSessionId = () => {
    const id = 'session-' + Math.random().toString(36).substr(2, 9);
    setSessionId(id);
  };

  const loadSession = async () => {
    if (!sessionId().trim()) {
      setError('Please enter a session ID');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${apiBase}/api/sessions/${sessionId()}`);
      const data = await response.json();
      
      if (response.ok) {
        setSessionData(data);
      } else {
        setError(data.error || 'Failed to load session');
        setSessionData(null);
      }
    } catch (err) {
      console.error('Session load error:', err);
      setError('Network error occurred');
      setSessionData(null);
    } finally {
      setLoading(false);
    }
  };

  const createSession = async () => {
    if (!sessionId().trim()) {
      setError('Please enter a session ID');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${apiBase}/api/sessions/${sessionId()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          data: {
            initialized: true,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
          }
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setSessionData(data);
      } else {
        setError(data.error || 'Failed to create session');
      }
    } catch (err) {
      console.error('Session create error:', err);
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const updateSession = async () => {
    if (!sessionId().trim()) {
      setError('Please enter a session ID');
      return;
    }

    if (!newData().trim()) {
      setError('Please enter some data to update');
      return;
    }

    setUpdating(true);
    setError('');
    
    try {
      let updateObj;
      try {
        // Try to parse as JSON first
        updateObj = JSON.parse(newData());
      } catch {
        // If not JSON, treat as a simple key-value
        updateObj = { userMessage: newData(), timestamp: new Date().toISOString() };
      }

      const response = await fetch(`${apiBase}/api/sessions/${sessionId()}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          data: updateObj
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setSessionData(data);
        setNewData('');
      } else {
        setError(data.error || 'Failed to update session');
      }
    } catch (err) {
      console.error('Session update error:', err);
      setError('Network error occurred');
    } finally {
      setUpdating(false);
    }
  };

  const deleteSession = async () => {
    if (!sessionId().trim()) {
      setError('Please enter a session ID');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${apiBase}/api/sessions/${sessionId()}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      
      if (response.ok) {
        setSessionData(null);
        setError('Session deleted successfully ✅');
      } else {
        setError(data.error || 'Failed to delete session');
      }
    } catch (err) {
      console.error('Session delete error:', err);
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    generateSessionId();
  });

  return (
    <div class="bg-gray-800 rounded-lg p-6">
      <h2 class="text-xl font-bold mb-4 text-blue-400">👤 Session Manager (Durable Objects)</h2>
      
      {/* Session ID Input */}
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-300 mb-2">Session ID</label>
        <div class="flex gap-2">
          <input
            type="text"
            placeholder="Enter session ID"
            value={sessionId()}
            onInput={(e) => setSessionId(e.target.value)}
            class="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded"
          />
          <button
            onClick={generateSessionId}
            class="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded"
          >
            Generate
          </button>
        </div>
      </div>

      {/* Session Controls */}
      <div class="mb-4 flex gap-2 flex-wrap">
        <button
          onClick={loadSession}
          disabled={loading() || !sessionId().trim()}
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded"
        >
          {loading() ? 'Loading...' : 'Load Session'}
        </button>
        <button
          onClick={createSession}
          disabled={loading() || !sessionId().trim()}
          class="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded"
        >
          Create Session
        </button>
        <button
          onClick={deleteSession}
          disabled={loading() || !sessionId().trim()}
          class="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded"
        >
          Delete Session
        </button>
      </div>

      {/* Update Session Data */}
      <div class="mb-4 p-4 bg-gray-700 rounded">
        <h3 class="font-semibold text-green-400 mb-3">Update Session Data</h3>
        <div class="space-y-2">
          <textarea
            placeholder={'Enter data (JSON or plain text)\nExample: {"key": "value", "count": 42}'}
            value={newData()}
            onInput={(e) => setNewData(e.target.value)}
            rows="3"
            class="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded"
          />
          <button
            onClick={updateSession}
            disabled={updating() || !sessionId().trim() || !newData().trim()}
            class="w-full px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded"
          >
            {updating() ? 'Updating...' : 'Update Session'}
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

      {/* Session Data Display */}
      {sessionData() && (
        <div class="bg-gray-900 rounded p-4">
          <h3 class="font-semibold text-blue-400 mb-3">Session Data</h3>
          <div class="space-y-2 text-sm">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span class="text-gray-400">Session ID:</span>
                <br />
                <code class="text-blue-300">{sessionData().id}</code>
              </div>
              <div>
                <span class="text-gray-400">Created:</span>
                <br />
                <span class="text-white">{new Date(sessionData().createdAt).toLocaleString()}</span>
              </div>
            </div>
            <div>
              <span class="text-gray-400">Last Active:</span>
              <br />
              <span class="text-white">{new Date(sessionData().lastActive).toLocaleString()}</span>
            </div>
            <div>
              <span class="text-gray-400">Custom Data:</span>
              <br />
              <pre class="mt-1 p-2 bg-gray-800 rounded overflow-x-auto text-green-300">
                {JSON.stringify(sessionData().data, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Info */}
      <div class="mt-4 p-3 bg-blue-900 border border-blue-700 rounded">
        <h3 class="font-semibold text-blue-400 mb-2">ℹ️ How it works</h3>
        <p class="text-sm text-blue-200">
          Sessions are stored in Durable Objects with automatic cleanup. Each session has a unique ID and can store custom data. 
          Sessions automatically expire after 24 hours of inactivity.
        </p>
      </div>
    </div>
  );
}