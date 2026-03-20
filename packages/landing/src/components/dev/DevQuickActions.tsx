/**
 * DevQuickActions - Common operations for dev workflow
 */

import { useState } from 'react';
import { Trash2Icon, RefreshCwIcon, CheckIcon, AlertCircleIcon } from 'lucide-react';
import { API_BASE } from '@/config/api';

interface ActionResult {
  success: boolean;
  message: string;
}

interface DevQuickActionsProps {
  projectId: string | null;
  orgId: string | null;
}

export function DevQuickActions({ projectId, orgId }: DevQuickActionsProps) {
  const [isResetting, setIsResetting] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  const resetProject = async () => {
    if (!projectId || !orgId) return;
    if (!confirm('This will clear ALL project data. Are you sure?')) return;

    setIsResetting(true);
    setResult(null);

    try {
      const url = `${API_BASE}/api/orgs/${orgId}/projects/${projectId}/dev/reset`;
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
      setResult({ success: false, message: (err as Error).message });
    } finally {
      setIsResetting(false);
    }
  };

  const forceRefresh = () => {
    window.location.reload();
  };

  return (
    <div className='flex flex-col gap-3 border-t border-border pt-3'>
      <h4 className='text-xs font-semibold text-foreground'>Quick Actions</h4>

      <div className='flex gap-2'>
        <button
          className='flex items-center gap-1.5 rounded border border-red-200 px-3 py-1.5 text-xs text-red-600 transition-colors hover:border-red-400 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50'
          onClick={resetProject}
          disabled={isResetting}
          title='Clear all project data'
        >
          {isResetting ?
            <span className='size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent' />
          : <Trash2Icon size={14} />}
          Reset State
        </button>

        <button
          className='flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border hover:bg-muted'
          onClick={forceRefresh}
          title='Reload the page'
        >
          <RefreshCwIcon size={14} />
          Force Refresh
        </button>
      </div>

      {result && (
        <div
          className={`flex items-center gap-1.5 rounded p-2 text-xs ${
            result.success ? 'bg-success-bg text-success' : 'bg-destructive/10 text-destructive'
          }`}
        >
          {result.success ?
            <CheckIcon size={14} />
          : <AlertCircleIcon size={14} />}
          {result.message}
        </div>
      )}
    </div>
  );
}
