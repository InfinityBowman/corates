/**
 * DevJsonEditor - JSON export/import for project state
 */

import { createSignal, Show, createMemo } from 'solid-js';
import { FiDownload, FiUpload, FiCopy, FiCheck, FiAlertCircle } from 'solid-icons/fi';
import { API_BASE } from '@config/api.js';

export default function DevJsonEditor(props) {
  const [jsonText, setJsonText] = createSignal('');
  const [isExporting, setIsExporting] = createSignal(false);
  const [isImporting, setIsImporting] = createSignal(false);
  const [copied, setCopied] = createSignal(false);
  const [result, setResult] = createSignal(null);

  const currentJson = createMemo(() => {
    if (!props.data) return '{}';
    return JSON.stringify(props.data, null, 2);
  });

  const exportState = async () => {
    if (!props.projectId || !props.orgId) return;

    setIsExporting(true);
    setResult(null);

    try {
      const url = `${API_BASE}/api/orgs/${props.orgId}/projects/${props.projectId}/dev/export`;
      console.log('[DevPanel] Exporting state from:', url);
      const res = await fetch(url, {
        credentials: 'include',
      });

      if (!res.ok) {
        const err = await res.json();
        console.error('[DevPanel] Export failed:', err);
        throw new Error(err.error || 'Failed to export');
      }

      const data = await res.json();
      console.log('[DevPanel] Export success:', data);
      setJsonText(JSON.stringify(data, null, 2));
      setResult({ success: true, message: 'State exported' });
    } catch (err) {
      console.error('[DevPanel] Export error:', err);
      setResult({ success: false, message: err.message });
    } finally {
      setIsExporting(false);
    }
  };

  const importState = async () => {
    if (!props.projectId || !props.orgId || !jsonText()) return;

    let parsed;
    try {
      parsed = JSON.parse(jsonText());
    } catch (err) {
      console.warn('JSON parse error:', err.message);
      setResult({ success: false, message: 'Invalid JSON' });
      return;
    }

    setIsImporting(true);
    setResult(null);

    try {
      const url = `${API_BASE}/api/orgs/${props.orgId}/projects/${props.projectId}/dev/import`;
      console.log('[DevPanel] Importing state to:', url);
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: parsed, mode: 'replace' }),
      });

      if (!res.ok) {
        const err = await res.json();
        console.error('[DevPanel] Import failed:', err);
        throw new Error(err.error || 'Failed to import');
      }

      console.log('[DevPanel] Import success');
      setResult({ success: true, message: 'State imported' });
    } catch (err) {
      console.error('[DevPanel] Import error:', err);
      setResult({ success: false, message: err.message });
    } finally {
      setIsImporting(false);
    }
  };

  const copyToClipboard = async () => {
    const text = jsonText() || currentJson();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div class='flex h-full flex-col'>
      {/* Toolbar */}
      <div class='flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2'>
        <button
          class='flex items-center gap-1 rounded bg-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-300 disabled:opacity-50'
          onClick={exportState}
          disabled={isExporting()}
          title='Fetch current state from server'
        >
          <Show when={isExporting()} fallback={<FiDownload size={12} />}>
            <span class='h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent' />
          </Show>
          Export
        </button>

        <button
          class='flex items-center gap-1 rounded bg-purple-600 px-2 py-1 text-xs text-white hover:bg-purple-700 disabled:opacity-50'
          onClick={importState}
          disabled={isImporting() || !jsonText()}
          title='Import JSON to server'
        >
          <Show when={isImporting()} fallback={<FiUpload size={12} />}>
            <span class='h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent' />
          </Show>
          Import
        </button>

        <button
          class='flex items-center gap-1 rounded bg-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-300'
          onClick={copyToClipboard}
          title='Copy to clipboard'
        >
          <Show when={copied()} fallback={<FiCopy size={12} />}>
            <FiCheck size={12} class='text-green-600' />
          </Show>
          {copied() ? 'Copied' : 'Copy'}
        </button>
      </div>

      {/* Result message */}
      <Show when={result()}>
        <div
          class={`flex items-center gap-1.5 px-3 py-1.5 text-xs ${
            result().success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
          }`}
        >
          <Show when={result().success} fallback={<FiAlertCircle size={12} />}>
            <FiCheck size={12} />
          </Show>
          {result().message}
        </div>
      </Show>

      {/* Editor */}
      <textarea
        class='flex-1 resize-none bg-gray-900 p-3 font-mono text-[11px] text-green-400 focus:outline-none'
        placeholder='Paste JSON here or click Export to fetch current state...'
        value={jsonText() || currentJson()}
        onInput={e => setJsonText(e.target.value)}
        spellcheck={false}
      />
    </div>
  );
}
