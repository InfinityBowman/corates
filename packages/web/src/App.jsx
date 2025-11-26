import { createSignal, onMount, Show } from 'solid-js';
import ProjectDashboard from './components/ProjectDashboard.jsx';
import { useBetterAuth } from './api/better-auth-store.js';

export default function App() {
  const [activeTab, setActiveTab] = createSignal('projects');
  const [workerStatus, setWorkerStatus] = createSignal('checking...');
  const { user, authLoading, isLoggedIn } = useBetterAuth();

  const API_BASE = import.meta.env.VITE_WORKER_API_URL || 'http://localhost:8787';

  onMount(async () => {
    try {
      const response = await fetch(`${API_BASE}/health`);
      if (response.ok) {
        setWorkerStatus('connected');
      } else {
        setWorkerStatus('error');
      }
    } catch (error) {
      setWorkerStatus('offline');
      console.error('Worker health check failed:', error);
    }
  });

  const tabs = [{ id: 'projects', label: 'Projects', icon: '📁' }];

  return (
    <div class='min-h-screen'>
      {/* Worker Status Bar */}
      <div class='bg-gray-800 px-6 py-2 border-b border-gray-700'>
        <div class='text-sm'>
          Worker Status:{' '}
          <span class={workerStatus() === 'connected' ? 'text-green-400' : 'text-red-400'}>
            {workerStatus()}
          </span>
        </div>
      </div>

      {/* Content Tabs */}
      <div class='bg-gray-800 px-6 py-2'>
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
      </div>

      {/* Main Content */}
      <main class='p-6'>
        <div class='max-w-6xl mx-auto'>
          <Show
            when={!authLoading() && isLoggedIn() && user()}
            fallback={
              <div class='text-center py-8'>
                <div class='text-gray-400'>Loading user data...</div>
              </div>
            }
          >
            {activeTab() === 'projects' && (
              <ProjectDashboard apiBase={API_BASE} userId={user().id} />
            )}
          </Show>
        </div>
      </main>
    </div>
  );
}
