/**
 * DevTemplateSelector - Dropdown for selecting and applying mock templates
 */

import { createSignal, createResource, For, Show } from 'solid-js';
import { FiDownload, FiCheck, FiAlertCircle } from 'solid-icons/fi';
import { API_BASE } from '@config/api.js';

async function fetchTemplates({ orgId, projectId }) {
  if (!orgId || !projectId) return null;
  const url = `${API_BASE}/api/orgs/${orgId}/projects/${projectId}/dev/templates`;
  console.log('[DevPanel] Fetching templates from:', url);
  try {
    const res = await fetch(url, {
      credentials: 'include',
    });
    if (!res.ok) {
      const errorText = await res.text();
      console.error('[DevPanel] Templates fetch failed:', res.status, errorText);
      throw new Error(`Failed to fetch templates: ${res.status}`);
    }
    const data = await res.json();
    console.log('[DevPanel] Templates loaded:', data);
    return data;
  } catch (err) {
    console.error('[DevPanel] Templates fetch error:', err);
    throw err;
  }
}

export default function DevTemplateSelector(props) {
  const [templates] = createResource(
    () => ({ orgId: props.orgId, projectId: props.projectId }),
    fetchTemplates,
  );
  const [selectedTemplate, setSelectedTemplate] = createSignal('');
  const [mode, setMode] = createSignal('replace');
  const [isApplying, setIsApplying] = createSignal(false);
  const [result, setResult] = createSignal(null);

  const applyTemplate = async () => {
    if (!selectedTemplate() || !props.projectId || !props.orgId) return;

    setIsApplying(true);
    setResult(null);

    try {
      const url = new URL(
        `${API_BASE}/api/orgs/${props.orgId}/projects/${props.projectId}/dev/apply-template`,
      );
      url.searchParams.set('template', selectedTemplate());
      url.searchParams.set('mode', mode());

      console.log('[DevPanel] Applying template:', url.toString());
      const res = await fetch(url.toString(), {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        const err = await res.json();
        console.error('[DevPanel] Apply template failed:', err);
        throw new Error(err.error || 'Failed to apply template');
      }

      const data = await res.json();
      console.log('[DevPanel] Template applied:', data);
      setResult({ success: true, message: `Applied "${selectedTemplate()}" template` });
      setSelectedTemplate('');
    } catch (err) {
      console.error('[DevPanel] Apply template error:', err);
      setResult({ success: false, message: err.message });
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div class='flex flex-col gap-3'>
      <h4 class='text-xs font-semibold text-gray-900'>Mock Data Templates</h4>

      <Show when={templates.loading}>
        <div class='text-xs text-gray-400'>Loading templates...</div>
      </Show>

      <Show when={templates.error}>
        <div class='flex items-center gap-1.5 rounded bg-red-50 p-2 text-xs text-red-600'>
          <FiAlertCircle size={14} />
          Failed to load templates
        </div>
      </Show>

      <Show when={templates()}>
        <div class='flex flex-col gap-3'>
          <div class='flex flex-col gap-1'>
            <label class='text-2xs font-medium tracking-wide text-gray-500 uppercase'>
              Template
            </label>
            <select
              class='rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700 focus:border-purple-500 focus:outline-none'
              value={selectedTemplate()}
              onChange={e => setSelectedTemplate(e.target.value)}
              disabled={isApplying()}
            >
              <option value=''>Select a template...</option>
              <For each={templates().templates}>
                {name => (
                  <option value={name}>
                    {name} - {templates().descriptions[name]}
                  </option>
                )}
              </For>
            </select>
          </div>

          <div class='flex flex-col gap-1'>
            <label class='text-2xs font-medium tracking-wide text-gray-500 uppercase'>Mode</label>
            <div class='flex flex-col gap-1.5'>
              <label class='flex cursor-pointer items-center gap-2 text-xs text-gray-600'>
                <input
                  type='radio'
                  name='mode'
                  value='replace'
                  checked={mode() === 'replace'}
                  onChange={() => setMode('replace')}
                  disabled={isApplying()}
                  class='accent-purple-600'
                />
                Replace (clear existing)
              </label>
              <label class='flex cursor-pointer items-center gap-2 text-xs text-gray-600'>
                <input
                  type='radio'
                  name='mode'
                  value='merge'
                  checked={mode() === 'merge'}
                  onChange={() => setMode('merge')}
                  disabled={isApplying()}
                  class='accent-purple-600'
                />
                Merge (add to existing)
              </label>
            </div>
          </div>

          <button
            class='flex items-center justify-center gap-2 rounded bg-purple-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50'
            onClick={applyTemplate}
            disabled={!selectedTemplate() || isApplying()}
          >
            <Show when={isApplying()} fallback={<FiDownload size={14} />}>
              <span class='h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent' />
            </Show>
            {isApplying() ? 'Applying...' : 'Apply Template'}
          </button>
        </div>
      </Show>

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
