/**
 * DevTemplateSelector - Dropdown for selecting and applying mock templates
 *
 * After selecting a template, shows a user mapping step if the template
 * contains user IDs that need to be remapped to real users.
 */

import { useState, useEffect, useCallback } from 'react';
import { DownloadIcon, CheckIcon, AlertCircleIcon, ArrowLeftIcon } from 'lucide-react';
import { getDevTemplates, applyTemplate } from '@/server/functions/dev-tools.functions';
import { DevUserMapping, TEMPLATE_USER_IDS } from './DevUserMapping';

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

type Step = 'select' | 'mapping';

export function DevTemplateSelector({ projectId, orgId }: DevTemplateSelectorProps) {
  const [templates, setTemplates] = useState<TemplatesData | null>(null);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [mode, setMode] = useState<'replace' | 'merge'>('replace');
  const [isApplying, setIsApplying] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  // Mapping step state
  const [step, setStep] = useState<Step>('select');
  const [pendingTemplate, setPendingTemplate] = useState('');
  const [pendingMode, setPendingMode] = useState<'replace' | 'merge'>('replace');
  const [templateUserIds, setTemplateUserIds] = useState<string[]>([]);

  useEffect(() => {
    if (!orgId || !projectId) return;

    let cancelled = false;
    setTemplatesLoading(true);
    setTemplatesError(null);

    getDevTemplates({ data: { orgId, projectId } })
      .then((data) => {
        if (!cancelled) {
          setTemplates(data as TemplatesData);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
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

  const handleApplyClick = () => {
    if (!selectedTemplate) return;

    const userIds = TEMPLATE_USER_IDS[selectedTemplate] || [];
    if (userIds.length === 0) {
      // No user IDs in this template, apply directly
      doApplyTemplate(selectedTemplate, mode);
    } else {
      setPendingTemplate(selectedTemplate);
      setPendingMode(mode);
      setTemplateUserIds(userIds);
      setStep('mapping');
      setResult(null);
    }
  };

  const doApplyTemplate = useCallback(
    async (
      template: string,
      applyMode: 'replace' | 'merge',
      userMapping?: Record<string, string>,
    ) => {
      if (!projectId || !orgId) return;

      setIsApplying(true);
      setResult(null);

      try {
        await applyTemplate({
          data: {
            orgId,
            projectId,
            template,
            mode: applyMode,
            ...(userMapping && Object.keys(userMapping).length > 0 ? { userMapping } : {}),
          },
        });
        setResult({ success: true, message: `Applied "${template}" template` });
        setSelectedTemplate('');
        setStep('select');
      } catch (err) {
        setResult({ success: false, message: (err as Error).message });
      } finally {
        setIsApplying(false);
      }
    },
    [projectId, orgId],
  );

  if (step === 'mapping') {
    return (
      <div className='flex flex-col gap-3'>
        <button
          className='text-muted-foreground hover:text-foreground flex items-center gap-1 self-start text-xs'
          onClick={() => setStep('select')}
        >
          <ArrowLeftIcon size={12} />
          Back to template selection
        </button>

        <div className='text-muted-foreground text-xs'>
          Template: <span className='text-foreground font-medium'>{pendingTemplate}</span>
        </div>

        <DevUserMapping
          key={templateUserIds.join(',')}
          userIds={templateUserIds}
          projectId={projectId || undefined}
          onConfirm={mapping => doApplyTemplate(pendingTemplate, pendingMode, mapping)}
          onSkip={() => doApplyTemplate(pendingTemplate, pendingMode)}
          confirmLabel='Apply with Mapping'
          skipLabel='Apply As-Is'
        />

        {isApplying && (
          <div className='text-muted-foreground flex items-center gap-2 text-xs'>
            <span className='size-3 animate-spin rounded-full border-2 border-purple-500 border-t-transparent' />
            Applying template...
          </div>
        )}

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

  return (
    <div className='flex flex-col gap-3'>
      <h4 className='text-foreground text-xs font-semibold'>Mock Data Templates</h4>

      {templatesLoading && (
        <div className='text-muted-foreground text-xs'>Loading templates...</div>
      )}

      {templatesError && (
        <div className='bg-destructive/10 text-destructive flex items-center gap-1.5 rounded p-2 text-xs'>
          <AlertCircleIcon size={14} />
          Failed to load templates
        </div>
      )}

      {templates && (
        <div className='flex flex-col gap-3'>
          <div className='flex flex-col gap-1'>
            <label className='text-2xs text-muted-foreground font-medium tracking-wide uppercase'>
              Template
            </label>
            <select
              className='border-border bg-card text-foreground rounded border px-2 py-1.5 text-xs focus:border-purple-500 focus:outline-none'
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
            <label className='text-2xs text-muted-foreground font-medium tracking-wide uppercase'>
              Mode
            </label>
            <div className='flex flex-col gap-1.5'>
              <label className='text-muted-foreground flex cursor-pointer items-center gap-2 text-xs'>
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
              <label className='text-muted-foreground flex cursor-pointer items-center gap-2 text-xs'>
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
            onClick={handleApplyClick}
            disabled={!selectedTemplate || isApplying}
          >
            {isApplying ?
              <span className='size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent' />
            : <DownloadIcon size={14} />}
            {isApplying ? 'Applying...' : 'Apply Template'}
          </button>
        </div>
      )}

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
