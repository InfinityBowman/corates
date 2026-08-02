/**
 * DevJsonEditor - Export, edit, and re-import the raw workspace snapshot
 *
 * The snapshot is the engine's opaque JSON: exported as-is, edited as text,
 * imported back verbatim. Import replaces the workspace state and
 * refresh-disconnects live sessions so open clients resync. Before the first
 * export the viewer shows the local (client-side) view of the project,
 * which is not importable.
 */

import { useState, useMemo } from 'react';
import { DownloadIcon, UploadIcon, CopyIcon, CheckIcon, AlertCircleIcon } from 'lucide-react';
import {
  exportState as exportStateAction,
  importState as importStateAction,
} from '@/server/functions/dev-tools.functions';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';

interface ActionResult {
  success: boolean;
  message: string;
}

interface DevJsonEditorProps {
  projectId: string | null;
  orgId: string | null;
  data: object | null;
}

export function DevJsonEditor({ projectId, orgId, data }: DevJsonEditorProps) {
  const [jsonText, setJsonText] = useState('');
  const [hasExported, setHasExported] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  const currentJson = useMemo(() => {
    if (!data) return '{}';
    return JSON.stringify(data, null, 2);
  }, [data]);

  const isBusy = isExporting || isImporting;

  const handleExport = async () => {
    if (!projectId || !orgId) return;

    setIsExporting(true);
    setResult(null);

    try {
      const snapshot = await exportStateAction({ data: { orgId, projectId } });
      setJsonText(JSON.stringify(snapshot, null, 2));
      setHasExported(true);
      setResult({ success: true, message: 'State exported - edit below, then Import' });
    } catch (err) {
      setResult({ success: false, message: (err as Error).message });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async () => {
    if (!projectId || !orgId || !hasExported) return;

    let snapshot: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(jsonText);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('snapshot must be a JSON object');
      }
      snapshot = parsed as Record<string, unknown>;
    } catch (err) {
      setResult({ success: false, message: `Invalid JSON: ${(err as Error).message}` });
      return;
    }

    setIsImporting(true);
    setResult(null);

    try {
      await importStateAction({ data: { orgId, projectId, snapshot } });
      setResult({ success: true, message: 'State imported - live sessions will resync' });
    } catch (err) {
      setResult({ success: false, message: (err as Error).message });
    } finally {
      setIsImporting(false);
    }
  };

  const copyToClipboard = async () => {
    const text = hasExported ? jsonText : currentJson;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className='flex h-full flex-col'>
      {/* Toolbar */}
      <div className='border-border bg-muted flex items-center gap-2 border-b px-3 py-2'>
        <Button
          variant='secondary'
          size='xs'
          onClick={handleExport}
          disabled={isBusy}
          title='Fetch current workspace snapshot from server'
        >
          {isExporting ?
            <Spinner size='sm' variant='gray' />
          : <DownloadIcon />}
          Export
        </Button>

        <Button
          variant='secondary'
          size='xs'
          onClick={handleImport}
          disabled={!hasExported || isBusy}
          title='Replace workspace state with the JSON below'
        >
          {isImporting ?
            <Spinner size='sm' variant='gray' />
          : <UploadIcon />}
          Import
        </Button>

        <Button variant='secondary' size='xs' onClick={copyToClipboard} title='Copy to clipboard'>
          {copied ?
            <CheckIcon className='text-success' />
          : <CopyIcon />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>

      {/* Result message */}
      {result && (
        <Alert
          variant={result.success ? 'success' : 'destructive'}
          className='items-center gap-1.5 rounded-none border-x-0 border-t-0 px-3 py-1.5'
        >
          {result.success ?
            <CheckIcon />
          : <AlertCircleIcon />}
          <AlertDescription className='text-xs'>{result.message}</AlertDescription>
        </Alert>
      )}

      {/* Snapshot editor (read-only local view until exported) */}
      <textarea
        className='flex-1 resize-none bg-gray-900 p-3 font-mono text-[11px] text-green-400 focus:outline-none'
        value={hasExported ? jsonText : currentJson}
        onChange={e => setJsonText(e.target.value)}
        readOnly={!hasExported}
        spellCheck={false}
      />
    </div>
  );
}
