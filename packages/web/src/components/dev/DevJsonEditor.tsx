/**
 * DevJsonEditor - JSON export and inspection for project state (read-only)
 */

import { useState, useMemo } from 'react';
import { DownloadIcon, CopyIcon, CheckIcon, AlertCircleIcon } from 'lucide-react';
import { exportState as exportStateAction } from '@/server/functions/dev-tools.functions';

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
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

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
      setHasExported(true);
      setResult({ success: true, message: 'State exported' });
    } catch (err) {
      setResult({ success: false, message: (err as Error).message });
    } finally {
      setIsExporting(false);
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

      {/* Read-only viewer */}
      <textarea
        className='flex-1 resize-none bg-gray-900 p-3 font-mono text-[11px] text-green-400 focus:outline-none'
        value={hasExported ? jsonText : currentJson}
        readOnly
        spellCheck={false}
      />
    </div>
  );
}
