import { createSignal, createEffect, onCleanup } from 'solid-js';
import { useBetterAuth } from '../auth-ui/BetterAuthStore.js';

export default function ChatRoom({ apiBase }) {
  const [messages, setMessages] = createSignal([]);
  const [newMessage, setNewMessage] = createSignal('');
  const [username, setUsername] = createSignal('User' + Math.floor(Math.random() * 1000));
  const [roomId, setRoomId] = createSignal('general');
  const [connected, setConnected] = createSignal(false);
  const [wsConnection, setWsConnection] = createSignal(null);

  const auth = useBetterAuth();

  let ws;

  const connectWebSocket = async () => {
    try {
      if (!auth.isLoggedIn()) {
        console.error('Must be logged in to connect to chat');
        return;
      }

      // Get session token from cookies for WebSocket auth
      const sessionToken = await getSessionToken();
      const wsUrl =
        apiBase.replace('http', 'ws') +
        `/api/rooms/${roomId()}${sessionToken ? `?token=${sessionToken}` : ''}`;

      ws = new WebSocket(wsUrl);
      setWsConnection(ws);

      ws.onopen = () => {
        setConnected(true);
        console.log('Connected to chat room:', roomId());

        // Send authentication message if no token in URL
        if (!sessionToken) {
          ws.send(
            JSON.stringify({
              type: 'auth',
              token: getSessionToken(),
            }),
          );
        }
      };

      ws.onmessage = event => {
        const message = JSON.parse(event.data);
        console.log('Received message from backend:', message);

        if (message.type === 'auth') {
          if (message.success) {
            console.log('WebSocket authentication successful');
          } else {
            console.error('WebSocket authentication failed');
            disconnect();
          }
          return;
        }

        if (message.type === 'error') {
          console.error('WebSocket error:', message.message);
          return;
        }

        setMessages(prev => [...prev, message]);
      };

      ws.onclose = () => {
        setConnected(false);
        console.log('Disconnected from chat room');
      };

      ws.onerror = error => {
        console.error('WebSocket error:', error);
        setConnected(false);
      };
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
    }
  };

  // Helper function to extract session token from cookies
  const getSessionToken = async () => {
    try {
      // Try to get the session token from Better Auth
      const response = await fetch(`${apiBase}/api/auth/session`, {
        credentials: 'include',
      });

      if (response.ok) {
        const sessionData = await response.json();
        return sessionData.session?.id || sessionData.sessionToken;
      }
    } catch (error) {
      console.error('Failed to get session token:', error);
    }
    return null;
  };

  const disconnect = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
    setWsConnection(null);
    setConnected(false);
  };

  const sendMessage = () => {
    if (ws && ws.readyState === WebSocket.OPEN && newMessage().trim()) {
      const user = auth.user();
      const message = {
        type: 'message',
        content: newMessage().trim(),
        userId: user?.id,
        username: user?.username || user?.name,
        displayName: user?.displayName || user?.name,
        timestamp: Date.now(),
      };
      ws.send(JSON.stringify(message));
      setNewMessage('');
    }
  };

  const loadChatHistory = async () => {
    try {
      const response = await auth.authFetch(`${apiBase}/api/rooms/${roomId()}/messages`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };

  // Load chat history when component mounts or room changes
  createEffect(() => {
    if (roomId()) {
      loadChatHistory();
    }
  });

  onCleanup(() => {
    disconnect();
  });

  return (
    <div class='bg-gray-800 rounded-lg p-6'>
      <h2 class='text-xl font-bold mb-4 text-blue-400'>
        💬 Chat Room (Durable Objects + WebSocket)
      </h2>

      {/* Connection Controls */}
      <div class='mb-4 space-y-2'>
        <div class='flex gap-2'>
          <div class='px-3 py-1 bg-gray-700 border border-gray-600 rounded text-sm flex-1 flex items-center'>
            {auth.isLoggedIn() ?
              <span class='text-green-400'>
                👤 {auth.user()?.username || auth.user()?.name || 'User'}
              </span>
            : <span class='text-red-400'>🚫 Not logged in</span>}
          </div>
          <input
            type='text'
            placeholder='Room ID'
            value={roomId()}
            onInput={e => setRoomId(e.target.value)}
            class='px-3 py-1 bg-gray-700 border border-gray-600 rounded text-sm flex-1'
          />
        </div>
        <div class='flex gap-2'>
          <button
            onClick={connectWebSocket}
            disabled={connected() || !auth.isLoggedIn()}
            class='px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm'
          >
            {connected() ?
              '🟢 Connected'
            : auth.isLoggedIn() ?
              '🔴 Connect'
            : '🔒 Login Required'}
          </button>
          <button
            onClick={disconnect}
            disabled={!connected()}
            class='px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm'
          >
            Disconnect
          </button>
          <button
            onClick={loadChatHistory}
            class='px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm'
          >
            Load History
          </button>
        </div>
      </div>

      {/* Messages */}
      <div class='bg-gray-900 rounded p-4 h-64 overflow-y-auto mb-4'>
        {messages().length === 0 ?
          <p class='text-gray-500 text-center'>No messages yet. Start a conversation!</p>
        : <div class='space-y-2'>
            {messages().map((msg, index) => (
              <div key={index} class='border-b border-gray-700 pb-2'>
                <div class='flex justify-between text-xs text-gray-400 mb-1'>
                  <span class='font-semibold text-blue-300'>{msg.username}</span>
                  <span>{msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : '—'}</span>
                </div>
                <p class='text-white'>{msg.content}</p>
              </div>
            ))}
          </div>
        }
      </div>

      {/* Send Message */}
      <div class='flex gap-2'>
        <input
          type='text'
          placeholder='Type a message...'
          value={newMessage()}
          onInput={e => setNewMessage(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && sendMessage()}
          disabled={!connected()}
          class='flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded disabled:bg-gray-800 disabled:cursor-not-allowed'
        />
        <button
          onClick={sendMessage}
          disabled={!connected() || !newMessage().trim()}
          class='px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded'
        >
          Send
        </button>
      </div>
    </div>
  );
}
