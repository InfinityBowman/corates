/**
 * DevTemplateSelector - Dropdown for selecting and applying mock templates
 */

import { useState, useEffect } from 'react';
import { DownloadIcon, CheckIcon, AlertCircleIcon } from 'lucide-react';
import { API_BASE } from '@/config/api';

interface ActionResult {
  success: boolean;
  message: string;
}

interface TemplatesData {
  templates: string[];
  descriptions: Record<string, string>;
}

interface DevTemplateSelectorProps {
  projectId: string | null;
  orgId: string | null;
}

export function DevTemplateSelector({ projectId, orgId }: DevTemplateSelectorProps) {
  const [templates, setTemplates] = useState<TemplatesData | null>(null);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [mode, setMode] = useState<'replace' | 'merge'>('replace');
  const [isApplying, setIsApplying] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  useEffect(() => {
    if (!orgId || !projectId) return;

    let cancelled = false;
    setTemplatesLoading(true);
    setTemplatesError(null);

    const url = `${API_BASE}/api/orgs/${orgId}/projects/${projectId}/dev/templates`;
    console.log('[DevPanel] Fetching templates from:', url);

    fetch(url, { credentials: 'include' })
      .then(async res => {
        if (!res.ok) {
          const errorText = await res.text();
          console.error('[DevPanel] Templates fetch failed:', res.status, errorText);
          throw new Error(`Failed to fetch templates: ${res.status}`);
        }
        return res.json();
      })
      .then((data: TemplatesData) => {
        if (!cancelled) {
          console.log('[DevPanel] Templates loaded:', data);
          setTemplates(data);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          console.error('[DevPanel] Templates fetch error:', err);
          setTemplatesError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setTemplatesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [orgId, projectId]);

  const applyTemplate = async () => {
    if (!selectedTemplate || !projectId || !orgId) return;

    setIsApplying(true);
    setResult(null);

    try {
      const url = new URL(`${API_BASE}/api/orgs/${orgId}/projects/${projectId}/dev/apply-template`);
      url.searchParams.set('template', selectedTemplate);
      url.searchParams.set('mode', mode);

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
      setResult({ success: true, message: `Applied "${selectedTemplate}" template` });
      setSelectedTemplate('');
    } catch (err) {
      console.error('[DevPanel] Apply template error:', err);
      setResult({ success: false, message: (err as Error).message });
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className='flex flex-col gap-3'>
      <h4 className='text-xs font-semibold text-gray-900'>Mock Data Templates</h4>

      {templatesLoading && <div className='text-xs text-gray-400'>Loading templates...</div>}

      {templatesError && (
        <div className='flex items-center gap-1.5 rounded bg-red-50 p-2 text-xs text-red-600'>
          <AlertCircleIcon size={14} />
          Failed to load templates
        </div>
      )}

      {templates && (
        <div className='flex flex-col gap-3'>
          <div className='flex flex-col gap-1'>
            <label className='text-2xs font-medium tracking-wide text-gray-500 uppercase'>
              Template
            </label>
            <select
              className='rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700 focus:border-purple-500 focus:outline-none'
              value={selectedTemplate}
              onChange={e => setSelectedTemplate(e.target.value)}
              disabled={isApplying}
            >
              <option value=''>Select a template...</option>
              {templates.templates.map(name => (
                <option key={name} value={name}>
                  {name} - {templates.descriptions[name]}
                </option>
              ))}
            </select>
          </div>

          <div className='flex flex-col gap-1'>
            <label className='text-2xs font-medium tracking-wide text-gray-500 uppercase'>
              Mode
            </label>
            <div className='flex flex-col gap-1.5'>
              <label className='flex cursor-pointer items-center gap-2 text-xs text-gray-600'>
                <input
                  type='radio'
                  name='mode'
                  value='replace'
                  checked={mode === 'replace'}
                  onChange={() => setMode('replace')}
                  disabled={isApplying}
                  className='accent-purple-600'
                />
                Replace (clear existing)
              </label>
              <label className='flex cursor-pointer items-center gap-2 text-xs text-gray-600'>
                <input
                  type='radio'
                  name='mode'
                  value='merge'
                  checked={mode === 'merge'}
                  onChange={() => setMode('merge')}
                  disabled={isApplying}
                  className='accent-purple-600'
                />
                Merge (add to existing)
              </label>
            </div>
          </div>

          <button
            className='flex items-center justify-center gap-2 rounded bg-purple-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50'
            onClick={applyTemplate}
            disabled={!selectedTemplate || isApplying}
          >
            {isApplying ?
              <span className='h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent' />
            : <DownloadIcon size={14} />}
            {isApplying ? 'Applying...' : 'Apply Template'}
          </button>
        </div>
      )}

      {result && (
        <div
          className={`flex items-center gap-1.5 rounded p-2 text-xs ${
            result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
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
