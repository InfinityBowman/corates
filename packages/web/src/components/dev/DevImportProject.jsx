/**
 * DevImportProject - Import a project from JSON
 *
 * Creates a new project and imports data from JSON.
 * Shows org selector if user has multiple orgs.
 */

import { createSignal, Show, createEffect } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { FiUpload, FiCheck, FiAlertCircle } from 'solid-icons/fi';
import { useQueryClient } from '@tanstack/solid-query';
import { API_BASE } from '@config/api.js';
import { useOrgs } from '@primitives/useOrgs.js';
import { queryKeys } from '@lib/queryKeys.js';
import { SimpleSelect } from '@/components/ui/select';

export default function DevImportProject() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { orgs, isLoading: orgsLoading } = useOrgs();

  const [jsonText, setJsonText] = createSignal('');
  const [selectedOrgId, setSelectedOrgId] = createSignal(null);
  const [isImporting, setIsImporting] = createSignal(false);
  const [result, setResult] = createSignal(null);

  // Auto-select first org when loaded
  createEffect(() => {
    const orgsList = orgs();
    if (orgsList.length > 0 && !selectedOrgId()) {
      setSelectedOrgId(orgsList[0].id);
    }
  });

  const resolvedOrgId = () => {
    const orgsList = orgs();
    if (orgsList.length === 1) return orgsList[0].id;
    return selectedOrgId();
  };

  const handleImport = async () => {
    const orgId = resolvedOrgId();
    if (!orgId || !jsonText().trim()) return;

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
      // Extract project name from imported data
      const projectName = parsed.meta?.name || 'Imported Project';

      // Step 1: Create the project
      const createRes = await fetch(`${API_BASE}/api/orgs/${orgId}/projects`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName,
          description: parsed.meta?.description || '',
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create project');
      }

      const newProject = await createRes.json();
      console.log('[DevPanel] Created project:', newProject.id);

      // Step 2: Import data to the new project
      const importRes = await fetch(
        `${API_BASE}/api/orgs/${orgId}/projects/${newProject.id}/dev/import`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: parsed, mode: 'replace' }),
        },
      );

      if (!importRes.ok) {
        const err = await importRes.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to import data');
      }

      console.log('[DevPanel] Import complete');
      setResult({ success: true, message: 'Project imported successfully' });

      // Invalidate project list
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });

      // Navigate to the new project after a short delay
      setTimeout(() => {
        navigate(`/projects/${newProject.id}`);
      }, 500);
    } catch (err) {
      console.error('[DevPanel] Import error:', err);
      setResult({ success: false, message: err.message });
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileSelect = async e => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      setJsonText(text);
      setResult(null);
    } catch (err) {
      console.warn('Failed to read file:', err.message);
      setResult({ success: false, message: 'Failed to read file' });
    }
  };

  return (
    <div class='flex h-full flex-col gap-3 p-3'>
      <div class='text-sm font-medium text-gray-700'>Import Project from JSON</div>

      {/* Org selector - only show if multiple orgs */}
      <Show when={!orgsLoading() && orgs().length > 1}>
        <div>
          <label class='mb-1 block text-xs text-gray-500'>Organization</label>
          <SimpleSelect
            value={selectedOrgId()}
            onChange={setSelectedOrgId}
            items={orgs().map(org => ({ value: org.id, label: org.name }))}
            placeholder='Select organization'
          />
        </div>
      </Show>

      {/* File input */}
      <div>
        <label class='mb-1 block text-xs text-gray-500'>JSON File</label>
        <input
          type='file'
          accept='.json,application/json'
          onChange={handleFileSelect}
          class='w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-purple-100 file:px-2 file:py-1 file:text-xs file:text-purple-700 hover:file:bg-purple-200'
        />
      </div>

      {/* JSON text area */}
      <div class='flex-1'>
        <label class='mb-1 block text-xs text-gray-500'>Or paste JSON</label>
        <textarea
          class='h-full min-h-37.5 w-full resize-none rounded border border-gray-300 bg-gray-50 p-2 font-mono text-xs focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none'
          placeholder='Paste exported project JSON here...'
          value={jsonText()}
          onInput={e => setJsonText(e.target.value)}
        />
      </div>

      {/* Import button */}
      <button
        class='flex items-center justify-center gap-2 rounded bg-purple-600 px-3 py-2 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50'
        onClick={handleImport}
        disabled={isImporting() || !jsonText().trim() || !resolvedOrgId()}
      >
        <Show when={isImporting()} fallback={<FiUpload size={14} />}>
          <span class='h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent' />
        </Show>
        {isImporting() ? 'Importing...' : 'Create & Import Project'}
      </button>

      {/* Result message */}
      <Show when={result()}>
        <div
          class={`flex items-center gap-2 rounded p-2 text-xs ${
            result().success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
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
