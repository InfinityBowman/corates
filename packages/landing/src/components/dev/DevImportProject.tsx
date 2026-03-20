/**
 * DevImportProject - Import a project from JSON
 *
 * Creates a new project and imports data from JSON.
 * Shows org selector if user has multiple orgs.
 * After JSON is parsed, shows a user mapping step so imported user IDs
 * can be remapped to real users in the database.
 */

import { useState, useEffect, useCallback, type ChangeEvent } from 'react';
import { UploadIcon, CheckIcon, AlertCircleIcon, ArrowLeftIcon } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { API_BASE } from '@/config/api';
import { useOrgs } from '@/hooks/useOrgs';
import { queryKeys } from '@/lib/queryKeys';
import { DevUserMapping, extractUserIds } from './DevUserMapping';

interface ActionResult {
  success: boolean;
  message: string;
}

type Step = 'input' | 'mapping';

export function DevImportProject() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { orgs, isLoading: orgsLoading } = useOrgs();

  const [jsonText, setJsonText] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  // Mapping step state
  const [step, setStep] = useState<Step>('input');
  const [parsedData, setParsedData] = useState<Record<string, unknown> | null>(null);
  const [extractedUserIds, setExtractedUserIds] = useState<string[]>([]);

  // Auto-select first org when loaded
  useEffect(() => {
    if (orgs.length > 0 && !selectedOrgId) {
      setSelectedOrgId(orgs[0].id);
    }
  }, [orgs, selectedOrgId]);

  const resolvedOrgId = orgs.length === 1 ? orgs[0].id : selectedOrgId;

  const parseAndExtract = useCallback((): Record<string, unknown> | null => {
    if (!jsonText.trim()) return null;
    try {
      const parsed = JSON.parse(jsonText);
      return parsed;
    } catch (err) {
      console.warn('JSON parse error:', (err as Error).message);
      setResult({ success: false, message: 'Invalid JSON' });
      return null;
    }
  }, [jsonText]);

  const handleProceedToMapping = () => {
    const parsed = parseAndExtract();
    if (!parsed) return;

    const userIds = extractUserIds(parsed);
    setParsedData(parsed);
    setExtractedUserIds(userIds);

    if (userIds.length === 0) {
      // No user IDs to map, import directly
      setIsImporting(true);
      doImport(parsed);
    } else {
      setStep('mapping');
      setResult(null);
    }
  };

  const doImport = async (data: Record<string, unknown>, userMapping?: Record<string, string>) => {
    if (!resolvedOrgId) return;

    setIsImporting(true);
    setResult(null);

    try {
      const projectName = (data.meta as Record<string, unknown>)?.name || 'Imported Project';

      // Step 1: Create the project
      const createRes = await fetch(`${API_BASE}/api/orgs/${resolvedOrgId}/projects`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName,
          description: (data.meta as Record<string, unknown>)?.description || '',
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create project');
      }

      const newProject = await createRes.json();
      console.log('[DevPanel] Created project:', newProject.id);

      // Step 2: Import data to the new project
      const importBody: Record<string, unknown> = { data, mode: 'replace' };
      if (userMapping && Object.keys(userMapping).length > 0) {
        importBody.userMapping = userMapping;
      }

      const importRes = await fetch(
        `${API_BASE}/api/orgs/${resolvedOrgId}/projects/${newProject.id}/dev/import`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(importBody),
        },
      );

      if (!importRes.ok) {
        const err = await importRes.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to import data');
      }

      console.log('[DevPanel] Import complete');
      setResult({ success: true, message: 'Project imported successfully' });
      setStep('input');
      setParsedData(null);

      // Invalidate project list
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });

      // Navigate to the new project after a short delay
      setTimeout(() => {
        navigate({ to: `/projects/${newProject.id}` });
      }, 500);
    } catch (err) {
      console.error('[DevPanel] Import error:', err);
      setResult({ success: false, message: (err as Error).message });
    } finally {
      setIsImporting(false);
    }
  };

  const handleMappingConfirm = (mapping: Record<string, string>) => {
    if (parsedData) doImport(parsedData, mapping);
  };

  const handleMappingSkip = () => {
    if (parsedData) doImport(parsedData);
  };

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      setJsonText(text);
      setResult(null);
      setStep('input');
    } catch (err) {
      console.warn('Failed to read file:', (err as Error).message);
      setResult({ success: false, message: 'Failed to read file' });
    }
  };

  return (
    <div className='flex h-full flex-col gap-3 p-3'>
      <div className='text-sm font-medium text-gray-700'>Import Project from JSON</div>

      {step === 'input' && (
        <>
          {/* Org selector - only show if multiple orgs */}
          {!orgsLoading && orgs.length > 1 && (
            <div>
              <label className='mb-1 block text-xs text-gray-500'>Organization</label>
              <select
                className='w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700 focus:border-purple-500 focus:outline-none'
                value={selectedOrgId || ''}
                onChange={e => setSelectedOrgId(e.target.value || null)}
              >
                <option value=''>Select organization</option>
                {orgs.map(org => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* File input */}
          <div>
            <label className='mb-1 block text-xs text-gray-500'>JSON File</label>
            <input
              type='file'
              accept='.json,application/json'
              onChange={handleFileSelect}
              className='w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-purple-100 file:px-2 file:py-1 file:text-xs file:text-purple-700 hover:file:bg-purple-200'
            />
          </div>

          {/* JSON text area */}
          <div className='min-h-0 flex-1'>
            <label className='mb-1 block text-xs text-gray-500'>Or paste JSON</label>
            <textarea
              className='h-[calc(100%-1.25rem)] w-full resize-none rounded border border-gray-300 bg-gray-50 p-2 font-mono text-xs focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none'
              placeholder='Paste exported project JSON here...'
              value={jsonText}
              onChange={e => setJsonText(e.target.value)}
            />
          </div>

          {/* Import button */}
          <button
            className='flex items-center justify-center gap-2 rounded bg-purple-600 px-3 py-2 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50'
            onClick={handleProceedToMapping}
            disabled={isImporting || !jsonText.trim() || !resolvedOrgId}
          >
            {isImporting ?
              <span className='size-3 animate-spin rounded-full border-2 border-current border-t-transparent' />
            : <UploadIcon size={14} />}
            {isImporting ? 'Importing...' : 'Create & Import Project'}
          </button>
        </>
      )}

      {step === 'mapping' && (
        <>
          <button
            className='flex items-center gap-1 self-start text-xs text-gray-500 hover:text-gray-700'
            onClick={() => setStep('input')}
          >
            <ArrowLeftIcon size={12} />
            Back to JSON input
          </button>

          <DevUserMapping
            key={extractedUserIds.join(',')}
            userIds={extractedUserIds}
            onConfirm={handleMappingConfirm}
            onSkip={handleMappingSkip}
          />

          {isImporting && (
            <div className='flex items-center gap-2 text-xs text-gray-500'>
              <span className='size-3 animate-spin rounded-full border-2 border-purple-500 border-t-transparent' />
              Importing...
            </div>
          )}
        </>
      )}

      {/* Result message */}
      {result && (
        <div
          className={`flex items-center gap-2 rounded p-2 text-xs ${
            result.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
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
