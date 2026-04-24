/**
 * DevJsonEditor - JSON export/import for project state
 *
 * When importing, if the JSON contains user IDs, shows a mapping step
 * so they can be remapped to real users.
 */

import { useState, useMemo, useCallback } from 'react';
import {
  DownloadIcon,
  UploadIcon,
  CopyIcon,
  CheckIcon,
  AlertCircleIcon,
  ArrowLeftIcon,
} from 'lucide-react';
import { importState, exportState as exportStateAction } from '@/server/functions/dev-tools.functions';
import { DevUserMapping, extractUserIds } from './DevUserMapping';

interface ActionResult {
  success: boolean;
  message: string;
}

interface DevJsonEditorProps {
  projectId: string | null;
  orgId: string | null;
  data: object | null;
}

type Step = 'editor' | 'mapping';

export function DevJsonEditor({ projectId, orgId, data }: DevJsonEditorProps) {
  const [jsonText, setJsonText] = useState('');
  const [hasUserEdited, setHasUserEdited] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  // Mapping step state
  const [step, setStep] = useState<Step>('editor');
  const [parsedImport, setParsedImport] = useState<Record<string, unknown> | null>(null);
  const [importUserIds, setImportUserIds] = useState<string[]>([]);

  const currentJson = useMemo(() => {
    if (!data) return '{}';
    return JSON.stringify(data, null, 2);
  }, [data]);

  const handleExport = async () => {
    if (!projectId || !orgId) return;

    setIsExporting(true);
    setResult(null);

    try {
      const fetchedData = await exportStateAction({ data: { orgId, projectId } });
      setJsonText(JSON.stringify(fetchedData, null, 2));
      setHasUserEdited(true);
      setResult({ success: true, message: 'State exported' });
    } catch (err) {
      setResult({ success: false, message: (err as Error).message });
    } finally {
      setIsExporting(false);
    }
  };

  const doImport = useCallback(
    async (parsed: Record<string, unknown>, userMapping?: Record<string, string>) => {
      if (!projectId || !orgId) return;

      setIsImporting(true);
      setResult(null);

      try {
        await importState({
          data: {
            orgId,
            projectId,
            data: parsed,
            mode: 'replace',
            ...(userMapping && Object.keys(userMapping).length > 0 ? { userMapping } : {}),
          },
        });
        setResult({ success: true, message: 'State imported' });
        setStep('editor');
        setParsedImport(null);
      } catch (err) {
        setResult({ success: false, message: (err as Error).message });
      } finally {
        setIsImporting(false);
      }
    },
    [projectId, orgId],
  );

  const handleImportClick = () => {
    if (!jsonText) return;

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (err) {
      console.warn('JSON parse error:', (err as Error).message);
      setResult({ success: false, message: 'Invalid JSON' });
      return;
    }

    const userIds = extractUserIds(parsed);
    if (userIds.length === 0) {
      doImport(parsed);
    } else {
      setParsedImport(parsed);
      setImportUserIds(userIds);
      setStep('mapping');
      setResult(null);
    }
  };

  const copyToClipboard = async () => {
    const text = jsonText || currentJson;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (step === 'mapping') {
    return (
      <div className='flex h-full flex-col gap-3 p-3'>
        <button
          className='text-muted-foreground hover:text-foreground flex items-center gap-1 self-start text-xs'
          onClick={() => setStep('editor')}
        >
          <ArrowLeftIcon size={12} />
          Back to editor
        </button>

        <DevUserMapping
          key={importUserIds.join(',')}
          userIds={importUserIds}
          projectId={projectId || undefined}
          onConfirm={mapping => parsedImport && doImport(parsedImport, mapping)}
          onSkip={() => parsedImport && doImport(parsedImport)}
        />

        {isImporting && (
          <div className='text-muted-foreground flex items-center gap-2 text-xs'>
            <span className='size-3 animate-spin rounded-full border-2 border-purple-500 border-t-transparent' />
            Importing...
          </div>
        )}

        {result && (
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs ${
              result.success ? 'bg-success-bg text-success' : 'bg-destructive/10 text-destructive'
            }`}
          >
            {result.success ?
              <CheckIcon size={12} />
            : <AlertCircleIcon size={12} />}
            {result.message}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className='flex h-full flex-col'>
      {/* Toolbar */}
      <div className='border-border bg-muted flex items-center gap-2 border-b px-3 py-2'>
        <button
          className='bg-muted text-foreground hover:bg-muted/80 flex items-center gap-1 rounded px-2 py-1 text-xs disabled:opacity-50'
          onClick={handleExport}
          disabled={isExporting}
          title='Fetch current state from server'
        >
          {isExporting ?
            <span className='size-3 animate-spin rounded-full border-2 border-current border-t-transparent' />
          : <DownloadIcon size={12} />}
          Export
        </button>

        <button
          className='flex items-center gap-1 rounded bg-purple-600 px-2 py-1 text-xs text-white hover:bg-purple-700 disabled:opacity-50'
          onClick={handleImportClick}
          disabled={isImporting || !jsonText}
          title='Import JSON to server'
        >
          {isImporting ?
            <span className='size-3 animate-spin rounded-full border-2 border-current border-t-transparent' />
          : <UploadIcon size={12} />}
          Import
        </button>

        <button
          className='bg-muted text-foreground hover:bg-muted/80 flex items-center gap-1 rounded px-2 py-1 text-xs'
          onClick={copyToClipboard}
          title='Copy to clipboard'
        >
          {copied ?
            <CheckIcon size={12} className='text-success' />
          : <CopyIcon size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {/* Result message */}
      {result && (
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs ${
            result.success ? 'bg-success-bg text-success' : 'bg-destructive/10 text-destructive'
          }`}
        >
          {result.success ?
            <CheckIcon size={12} />
          : <AlertCircleIcon size={12} />}
          {result.message}
        </div>
      )}

      {/* Editor */}
      <textarea
        className='flex-1 resize-none bg-gray-900 p-3 font-mono text-[11px] text-green-400 focus:outline-none'
        placeholder='Paste JSON here or click Export to fetch current state...'
        value={hasUserEdited ? jsonText : jsonText || currentJson}
        onChange={e => {
          setJsonText(e.target.value);
          setHasUserEdited(true);
        }}
        spellCheck={false}
      />
    </div>
  );
}
