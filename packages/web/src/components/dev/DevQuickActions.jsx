/**
 * DevQuickActions - Common operations for dev workflow
 */

import { createSignal, Show } from 'solid-js';
import { FiTrash2, FiRefreshCw, FiCheck, FiAlertCircle } from 'solid-icons/fi';
import { API_BASE } from '@config/api.js';

export default function DevQuickActions(props) {
  const [isResetting, setIsResetting] = createSignal(false);
  const [result, setResult] = createSignal(null);

  const resetProject = async () => {
    if (!props.projectId || !props.orgId) return;
    if (!confirm('This will clear ALL project data. Are you sure?')) return;

    setIsResetting(true);
    setResult(null);

    try {
      const url = `${API_BASE}/api/orgs/${props.orgId}/projects/${props.projectId}/dev/reset`;
      console.log('[DevPanel] Resetting project state:', url);
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        const err = await res.json();
        console.error('[DevPanel] Reset failed:', err);
        throw new Error(err.error || 'Failed to reset');
      }

      console.log('[DevPanel] Reset success');
      setResult({ success: true, message: 'Project state cleared' });
    } catch (err) {
      console.error('[DevPanel] Reset error:', err);
      setResult({ success: false, message: err.message });
    } finally {
      setIsResetting(false);
    }
  };

  const forceRefresh = () => {
    window.location.reload();
  };

  return (
    <div class='flex flex-col gap-3 border-t border-gray-200 pt-3'>
      <h4 class='text-xs font-semibold text-gray-900'>Quick Actions</h4>

      <div class='flex gap-2'>
        <button
          class='flex items-center gap-1.5 rounded border border-red-200 px-3 py-1.5 text-xs text-red-600 transition-colors hover:border-red-400 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50'
          onClick={resetProject}
          disabled={isResetting()}
          title='Clear all project data'
        >
          <Show when={isResetting()} fallback={<FiTrash2 size={14} />}>
            <span class='h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent' />
          </Show>
          Reset State
        </button>

        <button
          class='flex items-center gap-1.5 rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:border-gray-400 hover:bg-gray-50'
          onClick={forceRefresh}
          title='Reload the page'
        >
          <FiRefreshCw size={14} />
          Force Refresh
        </button>
      </div>

      <Show when={result()}>
        <div
          class={`flex items-center gap-1.5 rounded p-2 text-xs ${
            result().success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
          }`}
        >
          <Show when={result().success} fallback={<FiAlertCircle size={14} />}>
            <FiCheck size={14} />
          </Show>
          {result().message}
        </div>
      </Show>
    </div>
  );
}
