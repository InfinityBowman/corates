import { createSignal, onMount } from 'solid-js';
import ChatRoom from './components/ChatRoom.jsx';
import FileUpload from './components/FileUpload.jsx';
import DatabaseTest from './components/DatabaseTest.jsx';
import SessionManager from './components/SessionManager.jsx';
import CollaborativeEditor from './components/CollaborativeEditor.jsx';

export default function App() {
  const [activeTab, setActiveTab] = createSignal('chat');
  const [workerStatus, setWorkerStatus] = createSignal('checking...');

  const API_BASE = import.meta.env.VITE_WORKER_API_URL || 'http://localhost:8787';

  onMount(async () => {
    try {
      const response = await fetch(`${API_BASE}/health`);
      if (response.ok) {
        setWorkerStatus('connected ✅');
      } else {
        setWorkerStatus('error ❌');
      }
    } catch (error) {
      setWorkerStatus('offline ❌');
      console.error('Worker health check failed:', error);
    }
  });

  const tabs = [
    { id: 'chat', label: 'Chat Room', icon: '💬' },
    { id: 'editor', label: 'Collaborative Doc', icon: '📝' },
    { id: 'upload', label: 'File Upload', icon: '📁' },
    { id: 'database', label: 'Database', icon: '🗄️' },
    { id: 'session', label: 'Session', icon: '👤' },
  ];

  return (
    <div class='text-white'>
      {/* Worker Status Bar */}
      <div class='bg-gray-800 px-6 py-2 border-b border-gray-700'>
        <div class='text-sm'>
          Worker Status:{' '}
          <span class={workerStatus().includes('✅') ? 'text-green-400' : 'text-red-400'}>
            {workerStatus()}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav class='bg-gray-800 px-6 py-2'>
        <div class='flex space-x-1'>
          {tabs.map(tab => (
            <button
              class={`px-4 py-2 rounded-lg transition-colors ${
                activeTab() === tab.id ?
                  'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main class='p-6'>
        <div class='max-w-4xl mx-auto'>
          {activeTab() === 'chat' && <ChatRoom apiBase={API_BASE} />}
          {activeTab() === 'editor' && <CollaborativeEditor apiBase={API_BASE} />}
          {activeTab() === 'upload' && <FileUpload apiBase={API_BASE} />}
          {activeTab() === 'database' && <DatabaseTest apiBase={API_BASE} />}
          {activeTab() === 'session' && <SessionManager apiBase={API_BASE} />}
        </div>
      </main>
    </div>
  );
}
