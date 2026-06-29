/**
 * DevJsonEditor - JSON export and inspection for project state (read-only)
 */

import { useState, useMemo } from 'react';
import { DownloadIcon, CopyIcon, CheckIcon, AlertCircleIcon } from 'lucide-react';
import { exportState as exportStateAction } from '@/server/functions/dev-tools.functions';
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
        <Button
          variant='secondary'
          size='xs'
          onClick={handleExport}
          disabled={isExporting}
          title='Fetch current state from server'
        >
          {isExporting ?
            <Spinner size='sm' variant='gray' />
          : <DownloadIcon />}
          Export
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
